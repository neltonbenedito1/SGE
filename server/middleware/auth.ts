/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import {
  initializeFirestore as initClientFirestore,
  doc as clientDoc,
  collection as clientCollection,
  getDoc as clientGetDoc,
  getDocs as clientGetDocs,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  addDoc as clientAddDoc,
  query as clientQuery,
  where as clientWhere,
  orderBy as clientOrderBy,
  limit as clientLimit,
  serverTimestamp as clientServerTimestamp,
  deleteField as clientDeleteField,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSession } from '../security/authManager';

let adminApp: App | null = null;
export function getFirebaseAdminInstance(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0]!;
    } else {
      let projectId = 'sentinel-fef50';
      try {
        const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          projectId = cfg.projectId || projectId;
        }
      } catch (e) {
        // use default
      }
      adminApp = initializeApp({ projectId });
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
    let cfg: any = {
      projectId: 'sentinel-fef50',
      apiKey: 'AIzaSyDWcU1jZxn9wpIRQXz6OURFt7LIrdpLrdA',
    };
    try {
      const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      }
    } catch (e) {}

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
    async get() {
      const snap = await clientGetDoc(dRef);
      return {
        id: snap.id,
        exists: snap.exists(),
        data: () => snap.data(),
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
      async get() {
        const q = constraints.length > 0 ? clientQuery(baseColRef, ...constraints) : baseColRef;
        const snap = await clientGetDocs(q);
        return {
          empty: snap.empty,
          size: snap.size,
          docs: snap.docs.map(d => ({
            id: d.id,
            exists: d.exists(),
            data: () => d.data(),
            ref: createDocRef(cDb, colPath, d.id),
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
  const cDb = getClientFirestore();
  return {
    collection(colName: string) {
      return createCollectionRef(cDb, colName);
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

/**
 * Middleware that verifies Firebase ID Token from Authorization Bearer header.
 * Attaches decoded user info (including custom claims) to req.user.
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
      const session = getSession(sessionId);
      if (session) {
        req.user = {
          uid: session.userId,
          email: session.email,
          role: session.role,
          tenant_id: session.tenantId,
          must_reset_password: false,
        };
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
    const admin = getFirebaseAdminInstance();
    const decoded = await getAuth(admin).verifyIdToken(idToken, true);

    const role = (decoded.role as string) || (decoded.tipo as string) || (decoded.email === 'neltonbenedito1@gmail.com' ? 'super_admin' : 'estudante');
    const tenant_id = (decoded.tenant_id as string) || (decoded.tenantId as string) || 'default';
    const must_reset_password = Boolean(decoded.must_reset_password || decoded.requer_alteracao_senha);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role,
      tenant_id,
      must_reset_password,
    };

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
    if (error?.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        code: 'token_revoked',
        message: 'A sua sessão foi revogada. Faça login novamente.',
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
      const session = getSession(sessionId);
      if (session) {
        req.user = {
          uid: session.userId,
          email: session.email,
          role: (session.role as string) || 'estudante',
          tenant_id: (session.tenantId as string) || 'default',
          must_reset_password: false,
        };
      }
    }
    return next();
  }
  const idToken = authHeader.split('Bearer ')[1].trim();
  try {
    const admin = getFirebaseAdminInstance();
    const decoded = await getAuth(admin).verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: (decoded.role as string) || 'estudante',
      tenant_id: (decoded.tenant_id as string) || 'default',
      must_reset_password: Boolean(decoded.must_reset_password),
    };
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
    const isSuperAdmin = userRole === 'super_admin' || req.user.email === 'neltonbenedito1@gmail.com';

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

    if (req.user.role === 'super_admin' || req.user.email === 'neltonbenedito1@gmail.com') {
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
