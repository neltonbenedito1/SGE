/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import {
  initializeFirestore as initClientFirestore,
  doc as clientDoc,
  collection as clientCollection,
  getDoc as clientGetDoc,
  getDocs as clientGetDocs,
  getCountFromServer as clientGetCountFromServer,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  addDoc as clientAddDoc,
  query as clientQuery,
  where as clientWhere,
  orderBy as clientOrderBy,
  limit as clientLimit,
  startAfter as clientStartAfter,
  writeBatch as clientWriteBatch,
  runTransaction as clientRunTransaction,
  serverTimestamp as clientServerTimestamp,
  deleteField as clientDeleteField,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSession } from '../security/authManager';
import { enrichRequestContext } from '../security/logger';

let adminApp: App | null = null;
let cachedDatabaseId: string | undefined = undefined;

function loadAppletConfig(): { projectId: string; apiKey: string; firestoreDatabaseId?: string } {
  let cfg: any = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'sentinel-fef50',
    apiKey: process.env.FIREBASE_API_KEY || '',
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || undefined,
  };
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg = { ...cfg, ...parsed };
    }
  } catch {
    // fallback to env/defaults
  }
  cachedDatabaseId = cfg.firestoreDatabaseId || undefined;
  return cfg;
}

export function getFirebaseAdminInstance(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0]!;
    } else {
      const cfg = loadAppletConfig();
      adminApp = initializeApp({ projectId: cfg.projectId });
    }
  }
  return adminApp;
}

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  const out: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object') {
      const vAny = v as any;
      if (vAny.constructor?.name === 'DeleteFieldValueImpl' || vAny._methodName === 'FieldValue.delete') {
        out[k] = clientDeleteField();
        continue;
      }
      if (vAny.constructor?.name === 'ServerTimestampFieldValueImpl' || vAny._methodName === 'FieldValue.serverTimestamp') {
        out[k] = clientServerTimestamp();
        continue;
      }
    }
    out[k] = sanitizeData(v);
  }
  return out;
}

let clientFirestoreInstance: any = null;
function getClientFirestore() {
  if (!clientFirestoreInstance) {
    const cfg = loadAppletConfig();
    const app = getClientApps().length > 0 ? getClientApps()[0]! : initClientApp(cfg);
    clientFirestoreInstance = initClientFirestore(app, {}, cfg.firestoreDatabaseId);
  }
  return clientFirestoreInstance;
}

function createDocRef(cDb: any, colPath: string, docId: string): any {
  const dRef = clientDoc(cDb, colPath, docId);
  return {
    id: docId,
    path: `${colPath}/${docId}`,
    _rawRef: dRef,
    async get() {
      const snap = await clientGetDoc(dRef);
      return {
        id: snap.id,
        exists: snap.exists(),
        data: () => snap.data(),
        _rawSnap: snap,
      };
    },
    async set(data: any, options?: { merge?: boolean }) {
      const sanitized = sanitizeData(data);
      return clientSetDoc(dRef, sanitized, options);
    },
    async update(data: any) {
      const sanitized = sanitizeData(data);
      return clientUpdateDoc(dRef, sanitized);
    },
    async delete() {
      return clientDeleteDoc(dRef);
    },
    collection(subColName: string) {
      return createCollectionRef(cDb, `${colPath}/${docId}/${subColName}`);
    },
  };
}

function createCollectionRef(cDb: any, colPath: string): any {
  const baseColRef = clientCollection(cDb, colPath);

  function buildQuery(constraints: any[] = []): any {
    return {
      where(field: string, op: any, val: any) {
        return buildQuery([...constraints, clientWhere(field, op, val)]);
      },
      orderBy(field: string, direction?: 'asc' | 'desc') {
        return buildQuery([...constraints, clientOrderBy(field, direction || 'asc')]);
      },
      limit(n: number) {
        return buildQuery([...constraints, clientLimit(n)]);
      },
      startAfter(cursor: any) {
        const raw = cursor?._rawSnap || cursor;
        return buildQuery([...constraints, clientStartAfter(raw)]);
      },
      async count() {
        const q = constraints.length > 0 ? clientQuery(baseColRef, ...constraints) : baseColRef;
        const aggSnap = await clientGetCountFromServer(q);
        return { data: () => ({ count: aggSnap.data().count }) };
      },
      async get() {
        const q = constraints.length > 0 ? clientQuery(baseColRef, ...constraints) : baseColRef;
        const snap = await clientGetDocs(q);
        return {
          empty: snap.empty,
          size: snap.size,
          docs: snap.docs.map((d) => ({
            id: d.id,
            exists: d.exists(),
            data: () => d.data(),
            ref: createDocRef(cDb, colPath, d.id),
            _rawSnap: d,
          })),
        };
      },
      doc(id?: string) {
        const actualId = id && id.trim().length > 0 ? id.trim() : crypto.randomUUID();
        return createDocRef(cDb, colPath, actualId);
      },
      async add(data: any) {
        const sanitized = sanitizeData(data);
        const res = await clientAddDoc(baseColRef, sanitized);
        return createDocRef(cDb, colPath, res.id);
      },
    };
  }

  return buildQuery();
}

export function getFirestoreInstance(): any {
  if (
    process.env.USE_ADMIN_FIRESTORE === 'true' &&
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  ) {
    const app = getFirebaseAdminInstance();
    if (!cachedDatabaseId) loadAppletConfig();
    return cachedDatabaseId ? getAdminFirestore(app, cachedDatabaseId) : getAdminFirestore(app);
  }

  const cDb = getClientFirestore();
  return {
    collection(colName: string) {
      return createCollectionRef(cDb, colName);
    },
    batch() {
      const realBatch = clientWriteBatch(cDb);
      return {
        set(docRef: any, data: any, options?: { merge?: boolean }) {
          const target = docRef?._rawRef || docRef;
          realBatch.set(target, sanitizeData(data), options as any);
          return this;
        },
        update(docRef: any, data: any) {
          const target = docRef?._rawRef || docRef;
          realBatch.update(target, sanitizeData(data));
          return this;
        },
        delete(docRef: any) {
          const target = docRef?._rawRef || docRef;
          realBatch.delete(target);
          return this;
        },
        async commit() {
          return realBatch.commit();
        },
      };
    },
    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      return clientRunTransaction(cDb, async (tx) => {
        const txWrapper = {
          async get(docRef: any) {
            const target = docRef?._rawRef || docRef;
            const snap = await tx.get(target);
            return {
              id: snap.id,
              exists: snap.exists(),
              data: () => snap.data(),
            };
          },
          set(docRef: any, data: any, options?: any) {
            const target = docRef?._rawRef || docRef;
            tx.set(target, sanitizeData(data), options);
            return txWrapper;
          },
          update(docRef: any, data: any) {
            const target = docRef?._rawRef || docRef;
            tx.update(target, sanitizeData(data));
            return txWrapper;
          },
          delete(docRef: any) {
            const target = docRef?._rawRef || docRef;
            tx.delete(target);
            return txWrapper;
          },
        };
        return updateFunction(txWrapper);
      });
    },
  };
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'admin' | 'director' | 'docente' | 'pai' | 'estudante' | 'finance' | string;
  tenant_id: string;
  must_reset_password?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

interface CachedAuthResolution {
  user: AuthenticatedUser;
  cachedAt: number;
}
const authResolutionCache = new Map<string, CachedAuthResolution>();
const revocationCheckCache = new Map<string, { revokedAfter: number; checkedAt: number }>();
const verifiedTokenCache = new Map<string, { decoded: any; cachedAt: number }>();
const AUTH_RESOLUTION_CACHE_TTL_MS = 10_000;
const REVOCATION_CACHE_TTL_MS = 5_000;
const VERIFIED_TOKEN_CACHE_TTL_MS = 15_000;
const IAM_REVOCATION_BACKOFF_MS = 10 * 60 * 1000;
let iamRevocationUnavailableUntil = 0;

export function invalidateAuthResolutionCache(uidOrEmail?: string): void {
  if (!uidOrEmail) {
    authResolutionCache.clear();
    revocationCheckCache.clear();
    verifiedTokenCache.clear();
    iamRevocationUnavailableUntil = 0;
    return;
  }
  const needle = uidOrEmail.toLowerCase();
  for (const key of authResolutionCache.keys()) {
    if (key.toLowerCase().includes(needle)) {
      authResolutionCache.delete(key);
    }
  }
  revocationCheckCache.delete(uidOrEmail);
  verifiedTokenCache.clear();
}

/**
 * Verifies Firebase ID token resiliently.
 * On Starter Tier / Google-hosted projects where Identity Toolkit Admin IAM is absent,
 * verifyIdToken(token, true) fails on the revocation lookup; fall back safely to
 * verifyIdToken(token, false) (local JWKS RSA signature check) while NEVER swallowing
 * genuine token revocation, expiration, disabled-user, or signature errors.
 */
export async function verifyFirebaseIdTokenSafe(idToken: string, checkRevoked = true): Promise<any> {
  const tokenKey = crypto.createHash('sha256').update(idToken).digest('hex');
  const now = Date.now();
  const cachedToken = verifiedTokenCache.get(tokenKey);
  if (cachedToken && now - cachedToken.cachedAt < VERIFIED_TOKEN_CACHE_TTL_MS) {
    const expMs = typeof cachedToken.decoded?.exp === 'number' ? cachedToken.decoded.exp * 1000 : Infinity;
    if (expMs > now + 2000) {
      return cachedToken.decoded;
    }
    verifiedTokenCache.delete(tokenKey);
  }

  const admin = getFirebaseAdminInstance();
  const fbAuth = getAuth(admin);
  const shouldCheckRevoked = checkRevoked && now >= iamRevocationUnavailableUntil;

  let decoded: any;
  try {
    decoded = await fbAuth.verifyIdToken(idToken, shouldCheckRevoked);
  } catch (error: any) {
    const code = error?.code || '';
    const isGenuineTokenFailure =
      code === 'auth/id-token-revoked' ||
      code === 'auth/id-token-expired' ||
      code === 'auth/user-disabled' ||
      code === 'auth/argument-error' ||
      code === 'auth/invalid-id-token';

    if (!shouldCheckRevoked || isGenuineTokenFailure) {
      throw error;
    }

    // Admin IAM / IdentityToolkit unavailable on this project tier -> verify signature & expiry locally
    // and avoid repeating the ~600ms failing IAM network round-trip on every subsequent request.
    iamRevocationUnavailableUntil = Date.now() + IAM_REVOCATION_BACKOFF_MS;
    decoded = await fbAuth.verifyIdToken(idToken, false);
  }

  if (verifiedTokenCache.size > 2000) {
    verifiedTokenCache.clear();
  }
  verifiedTokenCache.set(tokenKey, { decoded, cachedAt: Date.now() });
  return decoded;
}

function assertNotRevokedByTimestamp(revokedAfter: number, decoded: any): void {
  const authTimeMs = typeof decoded.auth_time === 'number' ? decoded.auth_time * 1000 : 0;
  // Only invalidate if token was issued strictly before revocation (>1s margin for clock skew)
  if (revokedAfter > 0 && authTimeMs > 0 && authTimeMs + 1000 < revokedAfter) {
    const revErr: any = new Error('Token revogado.');
    revErr.code = 'auth/id-token-revoked';
    throw revErr;
  }
}

/**
 * Resolves authoritative role, tenant_id, and revocation state from Firestore when
 * custom claims are absent or stale.
 */
export async function resolveUserAuthorizationFromFirestore(decoded: any): Promise<AuthenticatedUser> {
  const uid = String(decoded.uid || '');
  const email = String(decoded.email || '').trim().toLowerCase();
  const claimRole = String(
    decoded.role || decoded.tipo || (decoded.super_admin ? 'super_admin' : '')
  ).trim();
  const claimTenant = String(decoded.tenant_id || decoded.tenantId || '').trim();
  const claimMustReset = Boolean(decoded.must_reset_password || decoded.requer_alteracao_senha);

  const db = getFirestoreInstance();
  const cacheKey = `${uid}::${email}`;
  const now = Date.now();
  const cached = authResolutionCache.get(cacheKey);
  const cachedRev = uid ? revocationCheckCache.get(uid) : undefined;

  if (cached && now - cached.cachedAt < AUTH_RESOLUTION_CACHE_TTL_MS) {
    if (uid && (!cachedRev || now - cachedRev.checkedAt >= REVOCATION_CACHE_TTL_MS)) {
      try {
        const revSnap = await db.collection('user_revocations').doc(uid).get();
        const revokedAfter = revSnap.exists ? Number(revSnap.data()?.revokedAfter || 0) : 0;
        revocationCheckCache.set(uid, { revokedAfter, checkedAt: now });
        assertNotRevokedByTimestamp(revokedAfter, decoded);
      } catch (err: any) {
        if (err?.code === 'auth/id-token-revoked') throw err;
      }
    } else if (cachedRev) {
      assertNotRevokedByTimestamp(cachedRev.revokedAfter, decoded);
    }
    return cached.user;
  }

  let isActiveSuperAdmin = false;
  let isExplicitlyRevokedSuper = false;
  let resolvedRole = claimRole;
  let resolvedTenant = claimTenant;
  let mustReset = claimMustReset;

  try {
    const [
      revSnap,
      ownershipSnap,
      bootstrapSnap,
      superByUidSnap,
      userByUidSnap,
      superByEmailSnap,
      usersByEmailSnap,
    ] = await Promise.all([
      uid ? db.collection('user_revocations').doc(uid).get().catch(() => null) : Promise.resolve(null),
      db.collection('system_config').doc('ownership').get().catch(() => null),
      db.collection('system_config').doc('bootstrap').get().catch(() => null),
      uid ? db.collection('superusers').doc(uid).get().catch(() => null) : Promise.resolve(null),
      uid ? db.collection('users').doc(uid).get().catch(() => null) : Promise.resolve(null),
      email ? db.collection('superusers').where('email', '==', email).limit(5).get().catch(() => null) : Promise.resolve(null),
      email ? db.collection('users').where('email', '==', email).limit(5).get().catch(() => null) : Promise.resolve(null),
    ]);

    if (uid && revSnap) {
      const revokedAfter = revSnap.exists ? Number(revSnap.data()?.revokedAfter || 0) : 0;
      if (revocationCheckCache.size > 5000) revocationCheckCache.clear();
      revocationCheckCache.set(uid, { revokedAfter, checkedAt: now });
      assertNotRevokedByTimestamp(revokedAfter, decoded);
    }

    const ownerEmail = String(ownershipSnap?.exists ? ownershipSnap.data()?.currentOwnerEmail || '' : '')
      .trim()
      .toLowerCase();
    const bootstrapData = bootstrapSnap?.exists ? bootstrapSnap.data() : null;
    const bootstrapPrimaryEmail = String(bootstrapData?.primarySuperadminEmail || '')
      .trim()
      .toLowerCase();
    const isBootstrapActiveOwner =
      Boolean(bootstrapData?.initialized) &&
      Boolean(bootstrapPrimaryEmail) &&
      bootstrapPrimaryEmail === email &&
      (!ownerEmail || ownerEmail === email);

    if (superByUidSnap?.exists) {
      const sData = superByUidSnap.data();
      if (sData?.ativo !== false && sData?.active !== false) {
        isActiveSuperAdmin = true;
      }
    }

    if (!isActiveSuperAdmin && superByEmailSnap && !superByEmailSnap.empty) {
      const hasActiveSuperDoc = superByEmailSnap.docs.some((d: any) => {
        const sData = d.data();
        return sData?.ativo !== false && sData?.active !== false;
      });
      if (hasActiveSuperDoc) {
        isActiveSuperAdmin = true;
      }
    }

    if (!isActiveSuperAdmin && email && ((ownerEmail && ownerEmail === email) || isBootstrapActiveOwner)) {
      isActiveSuperAdmin = true;
    }

    // Check users docs (by UID and email)
    let matchedUserData: any = userByUidSnap?.exists ? userByUidSnap.data() : null;
    if (!matchedUserData && usersByEmailSnap && !usersByEmailSnap.empty) {
      const activeSuperUserDoc = usersByEmailSnap.docs.find((d: any) => {
        const u = d.data();
        return (u?.role === 'super_admin' || u?.role === 'superadmin' || u?.tipo === 'super_admin') && u?.ativo !== false;
      });
      const anyActiveDoc = usersByEmailSnap.docs.find((d: any) => d.data()?.ativo !== false);
      matchedUserData = (activeSuperUserDoc || anyActiveDoc || usersByEmailSnap.docs[0]).data();
    }

    if (!isActiveSuperAdmin && matchedUserData) {
      const uRole = String(matchedUserData.tipo || matchedUserData.role || '').trim();
      if ((uRole === 'super_admin' || uRole === 'superadmin') && matchedUserData.ativo !== false) {
        isActiveSuperAdmin = true;
      } else if (uRole === 'revoked_superadmin') {
        isExplicitlyRevokedSuper = true;
      } else {
        if (matchedUserData.ativo === false) {
          const disErr: any = new Error('Esta conta foi desativada.');
          disErr.code = 'auth/user-disabled';
          throw disErr;
        }
        resolvedRole = uRole || resolvedRole || 'estudante';
        resolvedTenant = String(matchedUserData.tenant_id || matchedUserData.tenantId || resolvedTenant || 'default');
        mustReset = mustReset || Boolean(matchedUserData.mustChangePassword || matchedUserData.requer_alteracao_senha);
      }
    }

    // Check support_agents table when user is support staff (or has no non-support role yet)
    if (!isActiveSuperAdmin && (resolvedRole === 'suporte' || !resolvedRole || resolvedRole === 'estudante')) {
      const [supUidSnap, supEmailSnap] = await Promise.all([
        uid ? db.collection('support_agents').where('uid', '==', uid).limit(2).get().catch(() => null) : Promise.resolve(null),
        email ? db.collection('support_agents').where('email', '==', email).limit(2).get().catch(() => null) : Promise.resolve(null),
      ]);
      let supAgentData: any = null;
      if (supUidSnap && !supUidSnap.empty) {
        supAgentData = supUidSnap.docs.find((d: any) => d.data()?.tipo !== 'ia')?.data() || supUidSnap.docs[0].data();
      } else if (supEmailSnap && !supEmailSnap.empty) {
        supAgentData = supEmailSnap.docs.find((d: any) => d.data()?.tipo !== 'ia')?.data() || supEmailSnap.docs[0].data();
      }
      if (supAgentData && supAgentData.tipo !== 'ia') {
        if (supAgentData.estado && supAgentData.estado !== 'activo') {
          const disErr: any = new Error('A conta de atendimento foi desativada, suspensa ou arquivada.');
          disErr.code = 'auth/user-disabled';
          throw disErr;
        }
        resolvedRole = 'suporte';
        resolvedTenant = String(supAgentData.tenant_id || resolvedTenant || 'global');
        mustReset = mustReset || Boolean(supAgentData.must_reset_password);
      }
    }
  } catch (err: any) {
    if (err?.code === 'auth/user-disabled' || err?.code === 'auth/id-token-revoked') {
      throw err;
    }
  }

  if (isExplicitlyRevokedSuper && !isActiveSuperAdmin) {
    const revErr: any = new Error('O utilizador superadministrador foi revogado ou a titularidade foi transferida.');
    revErr.code = 'auth/superadmin-revoked';
    throw revErr;
  }

  const user: AuthenticatedUser = {
    uid,
    email,
    role: isActiveSuperAdmin ? 'super_admin' : resolvedRole || 'estudante',
    tenant_id: isActiveSuperAdmin ? 'super-admin' : resolvedTenant || 'default',
    must_reset_password: isActiveSuperAdmin ? false : mustReset,
  };

  if (authResolutionCache.size > 5000) {
    authResolutionCache.clear();
  }
  authResolutionCache.set(cacheKey, { user, cachedAt: Date.now() });
  return user;
}

export async function verifyFirebaseTokenAndResolveUser(idToken: string): Promise<AuthenticatedUser> {
  const decoded = await verifyFirebaseIdTokenSafe(idToken, true);
  return await resolveUserAuthorizationFromFirestore(decoded);
}

/**
 * Middleware that verifies Firebase ID Token from Authorization Bearer header.
 * Attaches decoded user info (including Firestore-enriched roles) to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  let idToken = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1].trim();
  }

  if (!idToken) {
    const sessionId = req.cookies?.sysedu_session_id || (req.headers['x-session-id'] as string);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        req.user = {
          uid: session.userId,
          email: session.email,
          role: session.role,
          tenant_id: session.tenantId,
          must_reset_password: Boolean(session.must_reset_password),
        };
        enrichRequestContext({
          tenantId: req.user.tenant_id,
          userId: req.user.uid,
          role: req.user.role,
        });
        return next();
      }
    }

    return res.status(401).json({
      code: 'unauthorized',
      message: 'Acesso não autorizado. Sessão inválida ou token Bearer ausente.',
      requestId: req.requestId,
    });
  }

  try {
    req.user = await verifyFirebaseTokenAndResolveUser(idToken);
    enrichRequestContext({
      tenantId: req.user.tenant_id,
      userId: req.user.uid,
      role: req.user.role,
    });

    // If user has must_reset_password flag, block all routes except password change
    if (req.user.must_reset_password && !req.path.includes('/password/change') && !req.path.includes('/auth/session/logout')) {
      return res.status(403).json({
        code: 'must_reset_password',
        message: 'Redefinição de senha obrigatória no primeiro acesso antes de prosseguir.',
        requestId: req.requestId,
      });
    }

    next();
  } catch (error: any) {
    if (error?.code === 'auth/superadmin-revoked') {
      return res.status(403).json({
        code: 'superadmin_revoked',
        message: 'A conta de Superadministrador foi revogada ou transferida.',
        requestId: req.requestId,
      });
    }
    if (error?.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        code: 'token_revoked',
        message: 'A sua sessão foi revogada. Faça login novamente.',
        requestId: req.requestId,
      });
    }
    if (error?.code === 'auth/user-disabled') {
      return res.status(403).json({
        code: 'user_disabled',
        message: 'Esta conta foi desativada pelo administrador.',
        requestId: req.requestId,
      });
    }
    return res.status(401).json({
      code: 'invalid_token',
      message: 'Token de autenticação inválido ou expirado.',
      requestId: req.requestId,
    });
  }
}

/**
 * Optional Auth middleware - verifies token if present, but does not reject if missing.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const sessionId = req.cookies?.sysedu_session_id || (req.headers['x-session-id'] as string);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        req.user = {
          uid: session.userId,
          email: session.email,
          role: (session.role as string) || 'estudante',
          tenant_id: (session.tenantId as string) || 'default',
          must_reset_password: Boolean(session.must_reset_password),
        };
        enrichRequestContext({
          tenantId: req.user.tenant_id,
          userId: req.user.uid,
          role: req.user.role,
        });
      }
    }
    return next();
  }
  const idToken = authHeader.split('Bearer ')[1].trim();
  try {
    req.user = await verifyFirebaseTokenAndResolveUser(idToken);
    enrichRequestContext({
      tenantId: req.user.tenant_id,
      userId: req.user.uid,
      role: req.user.role,
    });
  } catch (e) {
    // Ignore invalid token on optional auth
  }
  next();
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({
        code: 'unauthorized',
        message: 'Usuário não autenticado.',
        requestId: req.requestId,
      });
    }

    const userRole = req.user.role;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';

    if (isSuperAdmin || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      code: 'forbidden',
      message: `Acesso negado. Esta operação exige privilégios de: ${allowedRoles.join(', ')}.`,
      requestId: req.requestId,
    });
  };
}

/**
 * Multi-Tenant Isolation Guard
 */
export function requireSameTenant(getTargetTenantId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ code: 'unauthorized', message: 'Requer autenticação.' });
    }

    if (req.user.role === 'super_admin' || req.user.role === 'superadmin') {
      return next(); // Super Admin has global tenant access
    }

    const targetTenantId = getTargetTenantId(req);
    if (!targetTenantId || targetTenantId !== req.user.tenant_id) {
      return res.status(403).json({
        code: 'tenant_isolation_violation',
        message: 'Violação de isolamento multi-tenant: você não tem permissão para acessar recursos de outra instituição.',
        requestId: req.requestId,
      });
    }

    next();
  };
}
