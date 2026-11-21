/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gerenciador de Autenticação Segura & Sessões Stateless/Distribuídas (SysEdu — Fase 5)
 * - Validação com PBKDF2-SHA512 (100.000 iterações) e comparação em tempo constante
 * - Tokens de sessão assinados via HMAC-SHA256 (`st1.<payload>.<sig>`) + espelho em Firestore (`server_sessions`)
 * - Revogação global distribuída (`user_revocations`) para permitir auto-scaling horizontal sem sticky sessions
 * - Circuit Breaker e Timeout estrito para chamadas REST ao Firebase Identity Toolkit
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getFirestoreInstance } from '../middleware/auth';
import { firebaseAuthRestBreaker } from '../services/circuitBreaker';

export interface AuthenticatedUserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'tenant_admin' | 'admin' | 'director' | 'docente' | 'pai' | 'estudante' | string;
  tipo: 'super_admin' | 'tenant_admin' | 'admin' | 'director' | 'docente' | 'pai' | 'estudante' | string;
  tenant_id: string;
  ativo: boolean;
  mustChangePassword?: boolean;
}

export interface ServerSession {
  userId: string;
  role: string;
  tenantId: string;
  email: string;
  createdAt: number;
  lastActivity: number;
  expiresAt?: number;
  must_reset_password?: boolean;
  revoked?: boolean;
  sessionHash?: string;
}

const SESSIONS_COLLECTION = 'server_sessions';
const REVOCATIONS_COLLECTION = 'user_revocations';
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;
const L1_SESSION_TTL_MS = 15 * 1000;
const ACTIVITY_PERSIST_THROTTLE_MS = 60 * 1000;

const SESSION_SECRET =
  process.env.SESSION_SIGNING_SECRET ||
  process.env.QR_SIGNING_SECRET ||
  process.env.AUTH_SALT ||
  'sysedu_cluster_stateless_session_key_v1_2026';

// Cache L1 curta apenas para aceleração (nunca fonte exclusiva da verdade)
interface CachedSessionEntry {
  session: ServerSession;
  cachedAt: number;
  lastPersistedActivity: number;
}
export const serverSessions = new Map<string, ServerSession>();
const l1SessionCache = new Map<string, CachedSessionEntry>();
const l1RevocationCache = new Map<string, { revokedAfter: number; checkedAt: number }>();

function hashSessionId(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 40);
}

function signTokenPayload(encodedPayload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');
}

export function issueStatelessSessionToken(session: ServerSession): string {
  const payload = {
    sid: crypto.randomUUID(),
    uid: session.userId,
    rol: session.role,
    tid: session.tenantId,
    eml: session.email,
    iat: session.createdAt,
    exp: session.createdAt + SESSION_MAX_LIFETIME_MS,
    mrp: Boolean(session.must_reset_password),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signTokenPayload(encoded);
  return `st1.${encoded}.${sig}`;
}

export function verifyStatelessSessionToken(token: string): ServerSession | null {
  if (!token || !token.startsWith('st1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = signTokenPayload(encoded);
  if (!timingSafeCompare(sig, expectedSig)) return null;

  try {
    const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const now = Date.now();
    if (typeof raw.exp === 'number' && now > raw.exp) {
      return null;
    }
    return {
      userId: String(raw.uid || ''),
      role: String(raw.rol || 'estudante'),
      tenantId: String(raw.tid || 'default'),
      email: String(raw.eml || ''),
      createdAt: Number(raw.iat || now),
      lastActivity: now,
      expiresAt: Number(raw.exp || now + SESSION_MAX_LIFETIME_MS),
      must_reset_password: Boolean(raw.mrp),
    };
  } catch {
    return null;
  }
}

async function getUserRevokedAfter(userId: string): Promise<number> {
  if (!userId) return 0;
  const now = Date.now();
  const cached = l1RevocationCache.get(userId);
  if (cached && now - cached.checkedAt < L1_SESSION_TTL_MS) {
    return cached.revokedAfter;
  }
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection(REVOCATIONS_COLLECTION).doc(userId).get();
    const revokedAfter = snap.exists ? Number(snap.data()?.revokedAfter || 0) : 0;
    l1RevocationCache.set(userId, { revokedAfter, checkedAt: now });
    if (l1RevocationCache.size > 5000) {
      const oldest = l1RevocationCache.keys().next().value;
      if (oldest) l1RevocationCache.delete(oldest);
    }
    return revokedAfter;
  } catch {
    return cached?.revokedAfter || 0;
  }
}

function cacheSessionL1(sessionId: string, session: ServerSession, persistedAt: number) {
  if (l1SessionCache.size >= 2000 && !l1SessionCache.has(sessionId)) {
    const oldest = l1SessionCache.keys().next().value;
    if (oldest) l1SessionCache.delete(oldest);
  }
  l1SessionCache.set(sessionId, {
    session,
    cachedAt: Date.now(),
    lastPersistedActivity: persistedAt,
  });
  serverSessions.set(sessionId, session);
}

/**
 * Cria sessão stateless (token HMAC-SHA256) + persiste no Firestore para revogação/inatividade distribuída.
 */
export async function createSession(sessionData: Omit<ServerSession, 'sessionHash'>): Promise<{
  sessionId: string;
  session: ServerSession;
}> {
  const now = Date.now();
  const session: ServerSession = {
    ...sessionData,
    createdAt: sessionData.createdAt || now,
    lastActivity: sessionData.lastActivity || now,
    expiresAt: sessionData.expiresAt || now + SESSION_MAX_LIFETIME_MS,
    revoked: false,
  };

  const sessionToken = issueStatelessSessionToken(session);
  const docId = hashSessionId(sessionToken);
  session.sessionHash = docId;

  cacheSessionL1(sessionToken, session, now);

  try {
    const db = getFirestoreInstance();
    await db.collection(SESSIONS_COLLECTION).doc(docId).set({
      userId: session.userId,
      role: session.role,
      tenantId: session.tenantId,
      email: session.email,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      must_reset_password: Boolean(session.must_reset_password),
      revoked: false,
    });
  } catch {
    // Mesmo se a escrita externa falhar momentaneamente, o token HMAC-SHA256 continua válido entre réplicas
  }

  return { sessionId: sessionToken, session };
}

/**
 * Obtém e valida sessão em modo stateless/distribuído entre réplicas.
 */
export async function getSession(sessionId: string): Promise<ServerSession | undefined> {
  if (!sessionId) return undefined;
  const now = Date.now();
  const docId = hashSessionId(sessionId);

  // 1. Verificar cache L1 fresca
  const cachedEntry = l1SessionCache.get(sessionId);
  if (cachedEntry && now - cachedEntry.cachedAt < L1_SESSION_TTL_MS) {
    const sess = cachedEntry.session;
    if (now - sess.lastActivity > SESSION_INACTIVITY_TIMEOUT_MS || (sess.expiresAt && now > sess.expiresAt)) {
      await deleteSession(sessionId);
      return undefined;
    }
    const revokedAfter = await getUserRevokedAfter(sess.userId);
    if (revokedAfter > 0 && sess.createdAt <= revokedAfter) {
      await deleteSession(sessionId);
      return undefined;
    }
    sess.lastActivity = now;
    if (now - cachedEntry.lastPersistedActivity > ACTIVITY_PERSIST_THROTTLE_MS) {
      cachedEntry.lastPersistedActivity = now;
      void persistLastActivity(docId, now);
    }
    return sess;
  }

  // 2. Consultar store externo (Firestore) para sincronização cross-instance
  let resolved: ServerSession | undefined;
  let loadedFromDb = false;

  try {
    const db = getFirestoreInstance();
    const snap = await db.collection(SESSIONS_COLLECTION).doc(docId).get();
    if (snap.exists) {
      const data = snap.data() as ServerSession;
      if (data.revoked) {
        l1SessionCache.delete(sessionId);
        serverSessions.delete(sessionId);
        return undefined;
      }
      resolved = {
        userId: data.userId,
        role: data.role,
        tenantId: data.tenantId,
        email: data.email,
        createdAt: Number(data.createdAt || now),
        lastActivity: Number(data.lastActivity || now),
        expiresAt: data.expiresAt ? Number(data.expiresAt) : undefined,
        must_reset_password: Boolean(data.must_reset_password),
        revoked: false,
      };
      loadedFromDb = true;
    }
  } catch {
    // Se Firestore falhar temporariamente, valida token stateless abaixo
  }

  // 3. Fallback / validação criptográfica stateless (`st1.*`) quando não existe no Firestore local
  if (!resolved) {
    const stateless = verifyStatelessSessionToken(sessionId);
    if (stateless) {
      resolved = stateless;
    } else if (serverSessions.has(sessionId)) {
      resolved = serverSessions.get(sessionId);
    }
  }

  if (!resolved) return undefined;

  // 4. Validar inatividade (30 min), validade absoluta (24h) e revogação global do utilizador
  if (
    now - resolved.lastActivity > SESSION_INACTIVITY_TIMEOUT_MS ||
    (resolved.expiresAt && now > resolved.expiresAt)
  ) {
    await deleteSession(sessionId);
    return undefined;
  }

  const revokedAfter = await getUserRevokedAfter(resolved.userId);
  if (revokedAfter > 0 && resolved.createdAt <= revokedAfter) {
    await deleteSession(sessionId);
    return undefined;
  }

  const previousActivity = resolved.lastActivity;
  resolved.lastActivity = now;
  cacheSessionL1(sessionId, resolved, loadedFromDb ? previousActivity : now);

  if (loadedFromDb && now - previousActivity > ACTIVITY_PERSIST_THROTTLE_MS) {
    void persistLastActivity(docId, now);
  }

  return resolved;
}

async function persistLastActivity(docId: string, now: number): Promise<void> {
  try {
    const db = getFirestoreInstance();
    await db.collection(SESSIONS_COLLECTION).doc(docId).set({ lastActivity: now }, { merge: true });
  } catch {
    // non-fatal
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  l1SessionCache.delete(sessionId);
  serverSessions.delete(sessionId);
  const docId = hashSessionId(sessionId);
  try {
    const db = getFirestoreInstance();
    await db.collection(SESSIONS_COLLECTION).doc(docId).set(
      {
        revoked: true,
        revokedAt: Date.now(),
      },
      { merge: true }
    );
  } catch {
    // non-fatal
  }
}

/**
 * Revoga globalmente todas as sessões de um utilizador em todas as instâncias.
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  const now = Date.now();
  l1RevocationCache.set(userId, { revokedAfter: now, checkedAt: now });

  for (const [sid, sess] of serverSessions.entries()) {
    if (sess.userId === userId) {
      serverSessions.delete(sid);
      l1SessionCache.delete(sid);
    }
  }

  try {
    const db = getFirestoreInstance();
    await db.collection(REVOCATIONS_COLLECTION).doc(userId).set({ revokedAfter: now }, { merge: true });
    const activeSnap = await db.collection(SESSIONS_COLLECTION).where('userId', '==', userId).limit(50).get();
    if (!activeSnap.empty) {
      const batch = db.batch();
      for (const docSnap of activeSnap.docs) {
        batch.set(docSnap.ref, { revoked: true, revokedAt: now }, { merge: true });
      }
      await batch.commit();
    }
  } catch {
    // non-fatal
  }
}

export function verifyCsrfToken(req: any): boolean {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return true; // Stateless Bearer token is immune to classic browser CSRF
  }
  const cookieCsrf = req.cookies?.sysedu_csrf_token;
  const headerCsrf = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (cookieCsrf && headerCsrf && typeof cookieCsrf === 'string' && typeof headerCsrf === 'string') {
    return timingSafeCompare(cookieCsrf, headerCsrf);
  }
  return false;
}

// ============================================================================
// RBAC ROLE HIERARCHY & PERMISSION MATRIX
// ============================================================================

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  superadmin: 100,
  admin: 80,
  tenant_admin: 80,
  administrador: 80,
  director: 60,
  diretor: 60,
  secretario: 40,
  secretaria: 40,
  financeiro: 40,
  finance: 40,
  docente: 40,
  professor: 40,
  suporte: 30,
  motorista: 20,
  seguranca: 20,
  estudante: 20,
  aluno: 20,
  pai: 20,
  encarregado: 20,
  user: 10,
};

export function getRoleLevel(role?: string): number {
  if (!role) return 10;
  const clean = role.toLowerCase().trim();
  return ROLE_HIERARCHY[clean] ?? 20;
}

export function canManageUserPassword(
  caller: { role: string; tenant_id?: string; uid: string; email?: string },
  target: { role: string; tenant_id?: string; uid: string; email?: string }
): boolean {
  if (caller.uid === target.uid || (caller.email && target.email && caller.email.toLowerCase() === target.email.toLowerCase())) {
    return true;
  }

  const callerRole = caller.role?.toLowerCase() || '';
  const callerLevel = getRoleLevel(caller.role);
  const targetLevel = getRoleLevel(target.role);

  if (callerLevel >= 100 || callerRole === 'super_admin' || callerRole === 'superadmin') {
    return true;
  }

  const callerTenant = caller.tenant_id;
  const targetTenant = target.tenant_id;
  if (!callerTenant || !targetTenant || callerTenant !== targetTenant) {
    return false;
  }

  if (callerLevel >= 60 && callerLevel > targetLevel) {
    return true;
  }

  return false;
}

// ============================================================================
// CRYPTOGRAPHIC COMPARISONS & HASHING
// ============================================================================

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function hashPasswordPBKDF2(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyPasswordHash(password: string, salt: string, expectedHash: string): boolean {
  try {
    const computedHash = hashPasswordPBKDF2(password, salt);
    const computedBuffer = Buffer.from(computedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

const SUPERADMIN_SALT = process.env.AUTH_SALT || 'sysedu_auth_salt_superadmin_sec_2026';

async function verifyPasswordViaIdentityToolkit(
  apiKey: string,
  email: string,
  password: string
): Promise<{ ok: boolean; data?: any }> {
  return firebaseAuthRestBreaker.execute(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          // 400 invalid credentials não deve abrir o circuit breaker; só 5xx/network abrem
          if (res.status >= 500) {
            throw new Error(`IdentityToolkit HTTP ${res.status}`);
          }
          return { ok: false };
        }
        const data = await res.json();
        return { ok: true, data };
      } finally {
        clearTimeout(timer);
      }
    },
    () => ({ ok: false })
  );
}

/**
 * Autentica o usuário a nível do servidor com rigor criptográfico
 */
export async function authenticateServerUser(
  email: string,
  password: string
): Promise<AuthenticatedUserProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  const db = getFirestoreInstance();

  let superData: any = null;
  let superusersSnapDocsId: string | null = null;
  let currentOwnerEmail: string | null = null;

  try {
    const ownershipDoc = await db.collection('system_config').doc('ownership').get();
    if (ownershipDoc.exists) {
      currentOwnerEmail = ownershipDoc.data()?.currentOwnerEmail?.toLowerCase() || null;
    }
  } catch {
    // Firestore query failed, proceed
  }

  try {
    const superusersSnap = await db.collection('superusers').where('email', '==', cleanEmail).limit(1).get();
    if (!superusersSnap.empty) {
      superData = superusersSnap.docs[0].data();
      superusersSnapDocsId = superusersSnap.docs[0].id;
    } else {
      const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!usersSnap.empty) {
        const uData = usersSnap.docs[0].data();
        if (uData.role === 'super_admin' || uData.role === 'superadmin' || uData.tipo === 'super_admin') {
          superData = uData;
          superusersSnapDocsId = usersSnap.docs[0].id;
        }
      }
    }
  } catch {
    // Firestore query failed
  }

  const isDesignatedSuperadmin =
    superData !== null ||
    (currentOwnerEmail !== null && currentOwnerEmail === cleanEmail);

  if (isDesignatedSuperadmin) {
    let passwordMatches = false;
    if (superData?.passwordHash) {
      passwordMatches = verifyPasswordHash(password, superData.salt || SUPERADMIN_SALT, superData.passwordHash);
    }

    if (!passwordMatches) {
      try {
        const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          const apiKey = process.env.FIREBASE_API_KEY || cfg.apiKey;
          if (apiKey) {
            const authRes = await verifyPasswordViaIdentityToolkit(apiKey, cleanEmail, password);
            if (authRes.ok) {
              passwordMatches = true;
            }
          }
        }
      } catch {
        // non-fatal
      }
    }

    if (passwordMatches) {
      return {
        id: superData?.uid || superusersSnapDocsId || 'super_admin_active',
        email: cleanEmail,
        nome: superData?.nome || 'Administrador do Sistema',
        role: 'super_admin',
        tipo: 'super_admin',
        tenant_id: 'super-admin',
        ativo: true,
        mustChangePassword: false,
      };
    } else {
      return null;
    }
  }

  try {
    const querySnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();

    if (!querySnap.empty) {
      const userDoc = querySnap.docs[0];
      const data = userDoc.data();

      if (data.ativo === false) {
        return null;
      }

      let passwordMatches = false;

      if (data.passwordHash && data.salt) {
        passwordMatches = verifyPasswordHash(password, data.salt, data.passwordHash);
      }

      if (!passwordMatches && (data.senha_temporaria || data.senha)) {
        if (data.senha_temporaria && timingSafeCompare(password, data.senha_temporaria)) {
          passwordMatches = true;
        } else if (data.senha && timingSafeCompare(password, data.senha)) {
          passwordMatches = true;
        }
      }

      if (passwordMatches) {
        const role = data.tipo || data.role || 'estudante';
        const tenant_id = data.tenant_id || data.tenantId || 'default';
        const mustChangePassword = Boolean(data.mustChangePassword || data.requer_alteracao_senha || !data.passwordLastChangedAt);

        return {
          id: userDoc.id,
          email: cleanEmail,
          nome: data.nome || 'Utilizador',
          role,
          tipo: role,
          tenant_id,
          ativo: true,
          mustChangePassword,
        };
      }
    }
  } catch (err) {
    console.warn('[authenticateServerUser] Consulta Firestore:', err);
  }

  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const apiKey = process.env.FIREBASE_API_KEY || cfg.apiKey;
      if (apiKey) {
        const authRes = await verifyPasswordViaIdentityToolkit(apiKey, cleanEmail, password);
        if (authRes.ok && authRes.data) {
          const authData = authRes.data;
          let isSuper = false;
          try {
            const superSnap = await db.collection('superusers').where('email', '==', cleanEmail).limit(1).get();
            if (!superSnap.empty) isSuper = true;
            const ownDoc = await db.collection('system_config').doc('ownership').get();
            if (ownDoc.exists && ownDoc.data()?.currentOwnerEmail?.toLowerCase() === cleanEmail) {
              isSuper = true;
            }
            if (authData.localId) {
              const uDoc = await db.collection('users').doc(authData.localId).get();
              if (uDoc.exists && (uDoc.data()?.role === 'super_admin' || uDoc.data()?.tipo === 'super_admin')) {
                isSuper = true;
              }
            }
          } catch {
            // non-fatal
          }
          return {
            id: authData.localId || 'user_' + Date.now(),
            email: cleanEmail,
            nome: authData.displayName || cleanEmail.split('@')[0],
            role: isSuper ? 'super_admin' : 'admin',
            tipo: isSuper ? 'super_admin' : 'admin',
            tenant_id: isSuper ? 'super-admin' : 'default',
            ativo: true,
            mustChangePassword: false,
          };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}
