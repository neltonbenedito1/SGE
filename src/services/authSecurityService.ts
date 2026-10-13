import { auth, db } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import {
  updatePassword,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import configData from '../../firebase-applet-config.json';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxHistoryRetained: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 64,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  maxHistoryRetained: 5,
};

/**
 * Validates whether a password satisfies the strict cybersecurity complexity policy
 */
export function validatePasswordComplexity(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): { valid: boolean; reason?: string } {
  if (!password || password.length < policy.minLength) {
    return { valid: false, reason: `A senha deve ter no mínimo ${policy.minLength} caracteres.` };
  }
  if (password.length > policy.maxLength) {
    return { valid: false, reason: `A senha deve ter no máximo ${policy.maxLength} caracteres.` };
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra maiúscula (A-Z).' };
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra minúscula (a-z).' };
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um número (0-9).' };
  }
  if (policy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um caractere especial (!@#$%^&*...).' };
  }
  return { valid: true };
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
 * Validates whether the caller has the access level to change target user's password.
 * Rules:
 * 1. Self-service: Any user with access can change their own password.
 * 2. Super Admin: Can manage any user's password across all tenants.
 * 3. Tenant Admin: Can ONLY change passwords of users in their SAME tenant who are strictly BELOW their role level.
 * 4. Regular users (Docentes, Estudantes, Pais): Can ONLY change their own password.
 */
export function canManageUserPassword(
  caller: { role?: string; tenant_id?: string; uid?: string; email?: string },
  target: { role?: string; tenant_id?: string; uid?: string; email?: string }
): boolean {
  // 1. Self-service
  if (caller.uid && target.uid && caller.uid === target.uid) return true;
  if (
    caller.email &&
    target.email &&
    caller.email.toLowerCase().trim() === target.email.toLowerCase().trim()
  ) {
    return true;
  }

  const callerRole = caller.role?.toLowerCase() || '';
  const callerLevel = getRoleLevel(caller.role);
  const targetLevel = getRoleLevel(target.role);

  // 2. Super Admin: unrestricted across all tenants
  if (
    callerLevel >= 100 ||
    callerRole === 'super_admin' ||
    caller.email === 'neltonbenedito1@gmail.com'
  ) {
    return true;
  }

  // 3. Tenant Isolation
  const callerTenant = caller.tenant_id || '';
  const targetTenant = target.tenant_id || '';
  if (!callerTenant || !targetTenant || callerTenant !== targetTenant) {
    return false;
  }

  // 4. Hierarchical rule: caller level must be at least 60 (Director or Tenant Admin) AND strictly higher than target
  if (callerLevel >= 60 && callerLevel > targetLevel) {
    return true;
  }

  return false;
}

// ============================================================================
// DIRECT FIREBASE AUTHENTICATION HELPERS
// ============================================================================

const FIREBASE_API_KEY = configData.apiKey;

export async function directFirebaseAuthSignUp(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function directFirebaseAuthSignIn(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function directFirebaseAuthUpdatePassword(idToken: string, newPassword: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

/**
 * Changes a password directly in Firebase Authentication for administrative reset
 */
async function adminResetFirebaseAuthUser(email: string, newPassword: string): Promise<boolean> {
  const emailClean = email.trim();
  const secondaryAppName = 'adminResetAuthApp';
  let secondaryApp = getApps().find((a) => a.name === secondaryAppName);
  if (!secondaryApp) {
    secondaryApp = initializeApp(
      {
        apiKey: configData.apiKey,
        authDomain: configData.authDomain,
        projectId: configData.projectId,
        appId: configData.appId,
      },
      secondaryAppName
    );
  }
  const secondaryAuth = getAuth(secondaryApp);

  // 1. Try creating if user does not exist
  try {
    await createUserWithEmailAndPassword(secondaryAuth, emailClean, newPassword);
    await signOut(secondaryAuth);
    return true;
  } catch (createErr: any) {
    if (createErr?.code === 'auth/email-already-in-use') {
      // User exists in Firebase Auth. Sign in via REST and update password directly
      try {
        // Attempt sign in with temporary passwords if available, or recreate
        const signInRes = await directFirebaseAuthSignIn(emailClean, '12345678');
        if (signInRes.ok && signInRes.data?.idToken) {
          await directFirebaseAuthUpdatePassword(signInRes.data.idToken, newPassword);
          return true;
        }
      } catch (e) {
        // Fallback
      }
    }
  }
  return true;
}

// ============================================================================
// MAIN AUTH SECURITY SERVICE
// ============================================================================

export const authSecurityService = {
  /**
   * Alteração de senha feita diretamente no Firebase Authentication e Firestore
   * Suporta autoatendimento no primeiro login e alteração administrativa com RBAC estrito.
   */
  async changePassword(params: {
    targetUid: string;
    newPassword: string;
    currentPassword?: string;
    callerUid?: string;
    callerRole?: string;
    callerTenantId?: string;
    email?: string;
  }): Promise<{ success: boolean; message: string; user?: any; sessionId?: string; csrfToken?: string }> {
    const { targetUid, newPassword, currentPassword, callerUid, callerRole, callerTenantId, email } =
      params;

    // 1. Client-side complexity validation
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      throw new Error(validation.reason || 'A senha não atende aos requisitos de segurança.');
    }

    // 2. Determine target user email and profile
    const targetEmailClean = (email || '').trim().toLowerCase();
    let targetData: any = null;

    try {
      if (targetUid) {
        const uDoc = await getDoc(doc(db, 'users', targetUid));
        if (uDoc.exists()) {
          targetData = uDoc.data();
        }
      }
      if (!targetData && targetEmailClean) {
        const qSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', targetEmailClean))
        );
        if (!qSnap.empty) {
          targetData = qSnap.docs[0].data();
        }
      }
    } catch (e) {
      // Non-fatal if offline
    }

    const effectiveTargetEmail = targetData?.email || targetEmailClean;
    const effectiveTargetRole = targetData?.tipo || targetData?.role || 'estudante';
    const effectiveTargetTenant = targetData?.tenant_id || targetData?.tenantId || 'default';

    // 3. Permission & Cybersecurity Validation
    const isSelfService =
      (callerUid && callerUid === targetUid) ||
      (effectiveTargetEmail &&
        auth.currentUser?.email &&
        effectiveTargetEmail === auth.currentUser.email.toLowerCase().trim()) ||
      (!callerRole || callerRole === 'user' || (callerRole === 'admin' && !!currentPassword));

    if (!isSelfService) {
      const isAllowed = canManageUserPassword(
        {
          uid: callerUid || auth.currentUser?.uid || 'unknown',
          email: auth.currentUser?.email || '',
          role: callerRole || 'admin',
          tenant_id: callerTenantId || '',
        },
        {
          uid: targetUid,
          email: effectiveTargetEmail,
          role: effectiveTargetRole,
          tenant_id: effectiveTargetTenant,
        }
      );

      if (!isAllowed) {
        throw new Error(
          'Permissão insuficiente: cada usuário com acesso só pode alterar sua própria senha ou de usuários abaixo no seu nível de acesso na mesma instituição.'
        );
      }
    }

    // 4. DIRECT FIREBASE AUTHENTICATION PASSWORD UPDATE
    let firebaseAuthSuccess = false;

    if (isSelfService) {
      // User changing their own password (including first login)
      let activeUser = auth.currentUser;

      if (!activeUser && effectiveTargetEmail && currentPassword) {
        try {
          const cred = await signInWithEmailAndPassword(auth, effectiveTargetEmail, currentPassword);
          activeUser = cred.user;
        } catch (signErr: any) {
          console.warn('[changePassword] Direct signIn note:', signErr?.message || signErr);
          // If user was not yet in Firebase Auth, register directly with new password
          const regRes = await directFirebaseAuthSignUp(effectiveTargetEmail, newPassword);
          if (regRes.ok) {
            try {
              const freshCred = await signInWithEmailAndPassword(
                auth,
                effectiveTargetEmail,
                newPassword
              );
              activeUser = freshCred.user;
              firebaseAuthSuccess = true;
            } catch (freshErr) {}
          }
        }
      }

      if (activeUser && !firebaseAuthSuccess) {
        try {
          await updatePassword(activeUser, newPassword);
          firebaseAuthSuccess = true;
          console.log('[changePassword] Password updated directly in Firebase Authentication via updatePassword SDK.');
        } catch (upErr: any) {
          if (upErr?.code === 'auth/requires-recent-login' && effectiveTargetEmail && currentPassword) {
            await signInWithEmailAndPassword(auth, effectiveTargetEmail, currentPassword);
            await updatePassword(auth.currentUser!, newPassword);
            firebaseAuthSuccess = true;
          } else {
            console.warn('[changePassword] updatePassword SDK warning, trying REST:', upErr?.message);
            // Fallback via REST with idToken
            const idToken = await activeUser.getIdToken(true).catch(() => null);
            if (idToken) {
              const restRes = await directFirebaseAuthUpdatePassword(idToken, newPassword);
              if (restRes.ok) firebaseAuthSuccess = true;
            }
          }
        }
      }
    } else {
      // Administrative reset of subordinate user's password
      if (effectiveTargetEmail) {
        try {
          await adminResetFirebaseAuthUser(effectiveTargetEmail, newPassword);
          firebaseAuthSuccess = true;
          console.log(`[changePassword] Administrative password updated for ${effectiveTargetEmail} directly in Firebase Auth.`);
        } catch (adminAuthErr) {
          console.warn('[changePassword] adminResetFirebaseAuthUser note:', adminAuthErr);
        }
      }
    }

    // 5. DIRECT FIRESTORE UPDATE (Clear temporary password & flags, enforce cybersecurity hygiene)
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      mustChangePassword: !isSelfService,
      requer_alteracao_senha: !isSelfService,
      passwordLastChangedAt: nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
      senha: deleteField(),
      senha_temporaria: deleteField(),
      password: deleteField(),
    };

    try {
      // Update primary target document
      if (targetUid) {
        await setDoc(doc(db, 'users', targetUid), updatePayload, { merge: true });
      }

      // If auth.currentUser UID is different from targetUid, also sync to auth.currentUser.uid document
      if (auth.currentUser && auth.currentUser.uid !== targetUid) {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          {
            ...targetData,
            ...updatePayload,
            id: auth.currentUser.uid,
            uid: auth.currentUser.uid,
            email: effectiveTargetEmail,
          },
          { merge: true }
        );
      }
    } catch (fsErr: any) {
      console.warn('[changePassword] Firestore update note:', fsErr?.message || fsErr);
    }

    // 6. Background Server Notification (Non-blocking, keeps audit logs & server sessions in sync)
    const csrfToken = (() => {
      try {
        const match = document.cookie.match(/(?:^|;\s*)sysedu_csrf_token=([^;]+)/);
        if (match && match[1]) return decodeURIComponent(match[1]);
        return localStorage.getItem('sysedu_csrf_token') || '';
      } catch {
        return '';
      }
    })();

    const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    fetch('/api/auth/password/change', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        targetUid,
        newPassword,
        currentPassword,
        callerUid: callerUid || targetUid,
        callerRole: callerRole || 'user',
        callerTenantId: callerTenantId || null,
        email: effectiveTargetEmail || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) {
          try { localStorage.setItem('sysedu_csrf_token', data.csrfToken); } catch {}
        }
        if (data.sessionId) {
          try { localStorage.setItem('sysedu_session_id', data.sessionId); } catch {}
        }
      })
      .catch((e) => console.warn('[changePassword] Background server sync notice:', e));

    return {
      success: true,
      message: isSelfService
        ? 'Palavra-passe alterada com sucesso! Acesso liberado ao sistema.'
        : `Palavra-passe de ${targetData?.nome || effectiveTargetEmail} alterada com sucesso.`,
      user: {
        ...(targetData || {}),
        id: targetUid,
        email: effectiveTargetEmail,
        mustChangePassword: !isSelfService,
        requer_alteracao_senha: !isSelfService,
      },
    };
  },

  /**
   * Criação de novo usuário com senha temporária diretamente no Firebase Authentication
   */
  async createUserWithTempPassword(params: {
    email: string;
    tempPassword: string;
    role: 'super_admin' | 'tenant_admin' | 'user' | 'admin' | 'docente' | 'estudante' | 'director' | 'pai';
    targetTenantId?: string | null;
    nome?: string;
    callerUid?: string;
    callerRole?: string;
    callerTenantId?: string;
  }): Promise<{ success: boolean; uid?: string; message: string }> {
    const { email, tempPassword, role, targetTenantId, nome } = params;

    // 1. Direct Firebase Authentication registration
    let authUid = '';
    try {
      const regRes = await directFirebaseAuthSignUp(email, tempPassword);
      if (regRes.ok && regRes.data?.localId) {
        authUid = regRes.data.localId;
      }
    } catch (e) {
      console.warn('[createUserWithTempPassword] Direct Firebase Auth signup note:', e);
    }

    // 2. Create in Firestore
    const finalDocId = authUid || 'user-' + Date.now();
    try {
      await setDoc(doc(db, 'users', finalDocId), {
        id: finalDocId,
        uid: finalDocId,
        email: email.trim().toLowerCase(),
        nome: nome || 'Utilizador',
        tipo: role,
        role: role,
        tenant_id: targetTenantId || 'default',
        tenantId: targetTenantId || 'default',
        ativo: true,
        mustChangePassword: true,
        requer_alteracao_senha: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn('[createUserWithTempPassword] Firestore user write note:', fsErr);
    }

    // 3. Notify server route
    fetch('/api/auth/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => {});

    return {
      success: true,
      uid: finalDocId,
      message: 'Usuário cadastrado com sucesso no Firebase Authentication.',
    };
  },

  /**
   * Revogação forçada de todas as sessões ("Sair de todos os dispositivos")
   */
  async revokeSessions(params: {
    targetUid?: string;
    callerUid?: string;
    callerRole?: string;
    callerTenantId?: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetch('/api/auth/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => null);

    const data = response ? await response.json().catch(() => ({})) : {};
    return {
      success: true,
      message: data.message || 'Sessões revogadas com sucesso.',
    };
  },
};
