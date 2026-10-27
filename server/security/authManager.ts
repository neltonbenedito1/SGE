/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Autenticação Segura a Nível de Servidor (SysEdu)
 * Implementa validação com PBKDF2-SHA512 (100.000 iterações), salt criptográfico,
 * comparação em tempo constante (anti-timing attack) e sessões HttpOnly.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getFirestoreInstance } from '../middleware/auth';

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
  must_reset_password?: boolean;
}

export const serverSessions = new Map<string, ServerSession>();
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export function getSession(sessionId: string): ServerSession | undefined {
  if (!sessionId) return undefined;
  const session = serverSessions.get(sessionId);
  if (!session) return undefined;

  const now = Date.now();
  if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT_MS) {
    serverSessions.delete(sessionId);
    return undefined;
  }
  session.lastActivity = now;
  return session;
}

export function deleteSession(sessionId: string): void {
  if (sessionId) serverSessions.delete(sessionId);
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

/**
 * Validates whether the caller can change the password of the target user.
 * Rules:
 * 1. Self-service: Any user can change their own password.
 * 2. Super Admin: Can manage any user's password across all tenants.
 * 3. Tenant Admin / Director: Can ONLY change passwords of users in their SAME tenant who are strictly BELOW their role level.
 * 4. Regular users (Docentes, Estudantes, Pais): Can only change their own password.
 */
export function canManageUserPassword(
  caller: { role: string; tenant_id?: string; uid: string; email?: string },
  target: { role: string; tenant_id?: string; uid: string; email?: string }
): boolean {
  // 1. Self-service
  if (caller.uid === target.uid || (caller.email && target.email && caller.email.toLowerCase() === target.email.toLowerCase())) {
    return true;
  }

  const callerRole = caller.role?.toLowerCase() || '';
  const callerLevel = getRoleLevel(caller.role);
  const targetLevel = getRoleLevel(target.role);

  // 2. Super Admin: unrestricted across all tenants
  if (callerLevel >= 100 || callerRole === 'super_admin' || callerRole === 'superadmin') {
    return true;
  }

  // 3. Multi-tenant isolation: caller and target MUST share the exact same institution
  const callerTenant = caller.tenant_id;
  const targetTenant = target.tenant_id;
  if (!callerTenant || !targetTenant || callerTenant !== targetTenant) {
    return false;
  }

  // 4. Hierarchical rule: caller level must be at least 60 (Director or Admin) AND strictly higher than target level
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
  } catch (err) {
    return false;
  }
}

const SUPERADMIN_SALT = process.env.AUTH_SALT || 'sysedu_auth_salt_superadmin_sec_2026';

/**
 * Autentica o usuário a nível do servidor com rigor criptográfico
 */
export async function authenticateServerUser(
  email: string,
  password: string
): Promise<AuthenticatedUserProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  const db = getFirestoreInstance();

  // 1. Verificação dinâmica de Super Administrador (via superusers ou ownership no Firestore)
  let superData: any = null;
  let superusersSnapDocsId: string | null = null;
  let currentOwnerEmail: string | null = null;

  try {
    const ownershipDoc = await db.collection('system_config').doc('ownership').get();
    if (ownershipDoc.exists) {
      currentOwnerEmail = ownershipDoc.data()?.currentOwnerEmail?.toLowerCase() || null;
    }
  } catch (err) {
    // Firestore query failed, proceed
  }

  try {
    const superusersSnap = await db.collection('superusers').where('email', '==', cleanEmail).limit(1).get();
    if (!superusersSnap.empty) {
      superData = superusersSnap.docs[0].data();
      superusersSnapDocsId = superusersSnap.docs[0].id;
    } else {
      // Também verificar na coleção users
      const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!usersSnap.empty) {
        const uData = usersSnap.docs[0].data();
        if (uData.role === 'super_admin' || uData.role === 'superadmin' || uData.tipo === 'super_admin') {
          superData = uData;
          superusersSnapDocsId = usersSnap.docs[0].id;
        }
      }
    }
  } catch (err) {
    // Firestore query failed
  }

  const isDesignatedSuperadmin =
    superData !== null ||
    (currentOwnerEmail !== null && currentOwnerEmail === cleanEmail);

  if (isDesignatedSuperadmin) {
    // A. Verificação via hash PBKDF2 armazenado no documento do Firestore
    let passwordMatches = false;
    if (superData?.passwordHash) {
      passwordMatches = verifyPasswordHash(password, superData.salt || SUPERADMIN_SALT, superData.passwordHash);
    }

    // B. Verificação via Firebase Authentication REST API
    if (!passwordMatches) {
      try {
        const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          const apiKey = process.env.FIREBASE_API_KEY || cfg.apiKey;
          if (apiKey) {
            const authRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true }),
              }
            );
            if (authRes.ok) {
              passwordMatches = true;
            }
          }
        }
      } catch {}
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

  // 2. Verificação de usuários institucionais (Tenant Admins, Directores, Docentes, Estudantes, etc.) no Firestore
  try {
    const db = getFirestoreInstance();
    const querySnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();

    if (!querySnap.empty) {
      const userDoc = querySnap.docs[0];
      const data = userDoc.data();

      // Verificação de conta ativa
      if (data.ativo === false) {
        return null;
      }

      let passwordMatches = false;

      // A. Senha criptografada com PBKDF2
      if (data.passwordHash && data.salt) {
        passwordMatches = verifyPasswordHash(password, data.salt, data.passwordHash);
      }

      // B. Senha temporária no primeiro acesso
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

  // 3. Fallback: Autenticação direta via Firebase Authentication Identity Toolkit
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.apiKey) {
        const authRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true }),
          }
        );
        if (authRes.ok) {
          const authData = await authRes.json();
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
          } catch {}
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
  } catch (fbErr) {
    // Non-fatal
  }

  return null;
}
