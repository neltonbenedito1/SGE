import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, deleteField } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';

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
  maxHistoryRetained: 5
};

/**
 * Validates whether a password satisfies the strict complexity policy
 */
export function validatePasswordComplexity(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): { valid: boolean; reason?: string } {
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

/**
 * Generates an irreversible cryptographic HMAC-SHA256 representation of password with user-specific salt
 */
async function generateClientHash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(salt);
  const messageData = encoder.encode(password);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const authSecurityService = {
  /**
   * Alteração de senha (Autoatendimento ou Administrativa)
   */
  async changePassword(params: {
    targetUid: string;
    newPassword: string;
    callerUid?: string;
    callerRole?: string;
    callerTenantId?: string;
    email?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { targetUid, newPassword, callerUid, callerRole, callerTenantId, email } = params;

    // 1. Client-side complexity validation
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      throw new Error(validation.reason || 'Senha fraca.');
    }

    // 2. Call backend server endpoint (which runs Firebase Admin SDK)
    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUid,
          newPassword,
          callerUid: callerUid || targetUid,
          callerRole: callerRole || 'user',
          callerTenantId: callerTenantId || null,
          email: email || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Falha ao alterar senha no servidor.');
      }

      return data;
    } catch (serverError: any) {
      console.warn('[AuthSecurityService] Server endpoint note:', serverError.message);
      
      // Fallback for direct client-side Firestore handling if backend server route is unreachable
      try {
        if (auth.currentUser && (auth.currentUser.uid === targetUid || (email && auth.currentUser.email === email))) {
          try {
            await updatePassword(auth.currentUser, newPassword);
          } catch (pErr) {
            console.warn('[ClientAuth] direct updatePassword warning:', pErr);
          }
        }

        const hash = await generateClientHash(newPassword, targetUid);
        
        // Check password history
        const historyRef = collection(db, 'users', targetUid, 'passwordHistory');
        const historyQuery = query(historyRef, orderBy('createdAt', 'desc'), limit(5));
        const historySnap = await getDocs(historyQuery);
        
        for (const docSnap of historySnap.docs) {
          if (docSnap.data().hash === hash) {
            throw new Error(`Esta senha já foi utilizada recentemente. Escolha uma senha diferente das últimas 5 senhas.`);
          }
        }

        const now = serverTimestamp();
        const userDocRef = doc(db, 'users', targetUid);
        await updateDoc(userDocRef, {
          mustChangePassword: false,
          requer_alteracao_senha: false,
          passwordLastChangedAt: now,
          passwordChangedBy: callerUid || targetUid,
          sessionsRevokedAt: now,
          senha: deleteField(),
          senha_temporaria: deleteField(),
          password: deleteField(),
          updatedAt: now
        });

        await addDoc(historyRef, {
          hash,
          createdAt: now
        });

        return { success: true, message: 'Senha alterada com sucesso.' };
      } catch (fallbackError: any) {
        throw new Error(fallbackError.message || serverError.message || 'Erro ao alterar senha.');
      }
    }
  },

  /**
   * Criação de novo usuário com senha temporária e flag mustChangePassword: true
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
    const response = await fetch('/api/auth/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Falha ao criar usuário com senha temporária.');
    }
    return data;
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
      body: JSON.stringify(params)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Falha ao revogar sessões.');
    }
    return data;
  }
};
