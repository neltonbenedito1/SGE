import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Configurações da Política de Senhas
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 64,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  maxHistoryRetained: 5 // Quantidade de senhas anteriores para impedir reuso
};

/**
 * Validador de Força e Complexidade da Senha
 */
function validatePasswordComplexity(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < PASSWORD_POLICY.minLength) {
    return { valid: false, reason: `A senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres.` };
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    return { valid: false, reason: `A senha deve ter no máximo ${PASSWORD_POLICY.maxLength} caracteres.` };
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra maiúscula.' };
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra minúscula.' };
  }
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um número.' };
  }
  if (PASSWORD_POLICY.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um caractere especial.' };
  }
  return { valid: true };
}

/**
 * Gera um hash HMAC-SHA256 irreversível com salt para o histórico de senhas
 */
function generatePasswordHistoryHash(password: string, userSalt: string): string {
  return crypto.createHmac('sha256', userSalt).update(password).digest('hex');
}

/**
 * Obtém perfil do usuário solicitante para validação de autorização
 */
async function getCallerProfile(callerUid: string) {
  const callerDoc = await db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new functions.HttpsError('permission-denied', 'Perfil do solicitante não encontrado no Firestore.');
  }
  return callerDoc.data() as {
    uid?: string;
    id?: string;
    role?: 'super_admin' | 'tenant_admin' | 'user' | string;
    tipo?: string;
    tenantId?: string | null;
    tenant_id?: string | null;
  };
}

// ============================================================================
// 1. CRIAÇÃO DE USUÁRIO COM SENHA TEMPORÁRIA (ADMIN / SUPER ADMIN)
// ============================================================================
export const createUserWithTempPassword = functions.onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Requer autenticação.');
  }

  const { email, tempPassword, role, targetTenantId, nome } = request.data;
  const caller = await getCallerProfile(request.auth.uid);
  const callerRole = caller.role || caller.tipo;
  const callerTenant = caller.tenantId || caller.tenant_id;

  // Validação de Permissões
  if (callerRole !== 'super_admin' && callerRole !== 'tenant_admin' && callerRole !== 'admin') {
    throw new functions.HttpsError('permission-denied', 'Usuários comuns não podem criar novos usuários.');
  }

  if (callerRole === 'tenant_admin' || callerRole === 'admin') {
    if (!callerTenant || targetTenantId !== callerTenant) {
      throw new functions.HttpsError('permission-denied', 'Tenant Admin só pode criar usuários para seu próprio tenant.');
    }
    if (role === 'super_admin') {
      throw new functions.HttpsError('permission-denied', 'Tenant Admin não pode criar perfis de Super Admin.');
    }
  }

  const complexity = validatePasswordComplexity(tempPassword);
  if (!complexity.valid) {
    throw new functions.HttpsError('invalid-argument', complexity.reason || 'Senha fraca.');
  }

  try {
    // 1. Cria usuário no Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password: tempPassword,
      emailVerified: false,
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const userTenantId = callerRole === 'super_admin' ? (targetTenantId || null) : callerTenant;

    // 2. Cria documento de metadados no Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      id: userRecord.uid,
      tenantId: userTenantId,
      tenant_id: userTenantId,
      role: role || 'user',
      tipo: role || 'user',
      email: email,
      nome: nome || email.split('@')[0],
      mustChangePassword: true, // Força alteração no próximo login
      requer_alteracao_senha: true,
      passwordLastChangedAt: now,
      passwordChangedBy: request.auth.uid,
      sessionsRevokedAt: now,
      ativo: true,
      createdAt: now,
      updatedAt: now
    });

    // 3. Registra hash no histórico
    const passHash = generatePasswordHistoryHash(tempPassword, userRecord.uid);
    await db.collection('users').doc(userRecord.uid).collection('passwordHistory').add({
      hash: passHash,
      createdAt: now
    });

    return { success: true, uid: userRecord.uid, message: 'Usuário criado com sucesso com senha temporária.' };
  } catch (error: any) {
    throw new functions.HttpsError('internal', error.message || 'Erro ao criar usuário.');
  }
});

// ============================================================================
// 2. ALTERAÇÃO / REDEFINIÇÃO DE SENHA (SELF-SERVICE OU ADMINISTRATIVA)
// ============================================================================
export const changePassword = functions.onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const { targetUid, newPassword } = request.data;
  const callerUid = request.auth.uid;

  if (!targetUid || !newPassword) {
    throw new functions.HttpsError('invalid-argument', 'targetUid e newPassword são obrigatórios.');
  }

  // 1. Validação de Complexidade
  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    throw new functions.HttpsError('invalid-argument', complexity.reason || 'Senha fora do padrão exigido.');
  }

  const caller = await getCallerProfile(callerUid);
  const targetDoc = await db.collection('users').doc(targetUid).get();

  if (!targetDoc.exists) {
    throw new functions.HttpsError('not-found', 'Usuário de destino não encontrado.');
  }

  const targetData = targetDoc.data()!;
  const isSelfService = callerUid === targetUid;
  const callerRole = caller.role || caller.tipo;
  const callerTenant = caller.tenantId || caller.tenant_id;
  const targetTenant = targetData.tenantId || targetData.tenant_id;
  const targetRole = targetData.role || targetData.tipo;

  // 2. Validação de Autorização Baseada em Roles e Multi-Tenant
  if (!isSelfService) {
    if (callerRole !== 'super_admin' && callerRole !== 'tenant_admin' && callerRole !== 'admin') {
      throw new functions.HttpsError('permission-denied', 'Você não tem permissão para alterar a senha de outros usuários.');
    }
    if (callerRole === 'tenant_admin' || callerRole === 'admin') {
      if (callerTenant !== targetTenant) {
        throw new functions.HttpsError('permission-denied', 'Tenant Admins só podem gerenciar usuários do mesmo tenant.');
      }
      if (targetRole === 'super_admin') {
        throw new functions.HttpsError('permission-denied', 'Não é permitido alterar a senha de um Super Admin.');
      }
    }
  }

  // 3. Verificação de Histórico de Senhas (Impedir Reuso das últimas N senhas)
  const newPassHash = generatePasswordHistoryHash(newPassword, targetUid);
  const historySnapshot = await db
    .collection('users')
    .doc(targetUid)
    .collection('passwordHistory')
    .orderBy('createdAt', 'desc')
    .limit(PASSWORD_POLICY.maxHistoryRetained)
    .get();

  for (const doc of historySnapshot.docs) {
    if (doc.data().hash === newPassHash) {
      throw new functions.HttpsError(
        'already-exists',
        `Esta senha já foi utilizada recentemente. Escolha uma senha diferente das últimas ${PASSWORD_POLICY.maxHistoryRetained} senhas.`
      );
    }
  }

  try {
    // 4. Atualiza a senha no Firebase Authentication
    await auth.updateUser(targetUid, { password: newPassword });

    // 5. Invalida todas as sessões e tokens existentes
    await auth.revokeRefreshTokens(targetUid);

    const now = admin.firestore.FieldValue.serverTimestamp();

    // 6. Atualiza metadados no documento do Firestore
    await db.collection('users').doc(targetUid).update({
      mustChangePassword: false,
      requer_alteracao_senha: false,
      passwordLastChangedAt: now,
      passwordChangedBy: callerUid,
      sessionsRevokedAt: now,
      updatedAt: now
    });

    // 7. Salva novo hash no histórico
    await db.collection('users').doc(targetUid).collection('passwordHistory').add({
      hash: newPassHash,
      createdAt: now
    });

    // Limpeza de histórico antigo mantendo apenas os últimos N
    if (historySnapshot.size >= PASSWORD_POLICY.maxHistoryRetained) {
      const oldestDocs = await db
        .collection('users')
        .doc(targetUid)
        .collection('passwordHistory')
        .orderBy('createdAt', 'asc')
        .limit(historySnapshot.size - PASSWORD_POLICY.maxHistoryRetained + 1)
        .get();

      const batch = db.batch();
      oldestDocs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return {
      success: true,
      message: isSelfService
        ? 'Sua senha foi alterada com sucesso e as outras sessões foram encerradas.'
        : 'Senha alterada pelo administrador com sucesso.'
    };
  } catch (error: any) {
    throw new functions.HttpsError('internal', error.message || 'Falha ao atualizar senha.');
  }
});

// ============================================================================
// 3. REVOGAÇÃO FORÇADA DE SESSÕES ("SAIR DE TODOS OS DISPOSITIVOS")
// ============================================================================
export const revokeUserSessions = functions.onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Requer autenticação.');
  }

  const { targetUid } = request.data;
  const callerUid = request.auth.uid;
  const target = targetUid || callerUid;

  const caller = await getCallerProfile(callerUid);
  const targetDoc = await db.collection('users').doc(target).get();

  if (!targetDoc.exists) {
    throw new functions.HttpsError('not-found', 'Usuário não encontrado.');
  }

  const targetData = targetDoc.data()!;
  const callerRole = caller.role || caller.tipo;
  const callerTenant = caller.tenantId || caller.tenant_id;
  const targetTenant = targetData.tenantId || targetData.tenant_id;

  // Validação de Tenant / Hierarquia
  if (callerUid !== target) {
    if (callerRole !== 'super_admin' && callerRole !== 'tenant_admin' && callerRole !== 'admin') {
      throw new functions.HttpsError('permission-denied', 'Sem permissão.');
    }
    if ((callerRole === 'tenant_admin' || callerRole === 'admin') && callerTenant !== targetTenant) {
      throw new functions.HttpsError('permission-denied', 'Isolamento de tenant violado.');
    }
  }

  await auth.revokeRefreshTokens(target);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.collection('users').doc(target).update({
    sessionsRevokedAt: now,
    updatedAt: now
  });

  return { success: true, message: 'Todas as sessões ativas foram revogadas com sucesso.' };
});
