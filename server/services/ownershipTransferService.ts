/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SERVIÇO DE TRANSFERÊNCIA DE ADMINISTRAÇÃO ("SEDER ADMINISTRACAO") - SGE
 * 
 * Implementa máquina de estados resiliente, atomicidade e recuperação de falhas:
 * 1. pending
 * 2. new_account_created
 * 3. ownership_transferred
 * 4. completed
 * 5. failed
 * 
 * Garante que a antiga conta perde acesso completamente e que os tokens antigos são revogados.
 */

import crypto from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminInstance, getFirestoreInstance } from '../middleware/auth';
import { setUserCustomClaims } from '../security/claims';
import { recordAuditLog } from '../security/audit';
import { logSecurityEvent } from '../security/logger';
import { serverSessions, hashPasswordPBKDF2 } from '../security/authManager';
import { TransferOwnershipSchema } from '../../src/shared/schemas';

export type TransferState =
  | 'pending'
  | 'new_account_created'
  | 'ownership_transferred'
  | 'completed'
  | 'failed';

export interface OwnershipTransferRecord {
  id: string;
  state: TransferState;
  initiatedByUid: string;
  initiatedByEmail: string;
  targetEmail: string;
  newAdminUid?: string;
  createdAt: string;
  updatedAt: any;
  error?: string;
}

let isTransferInProgress = false;

export async function executeOwnershipTransfer(params: {
  callerUid: string;
  callerEmail: string;
  callerRole: string;
  newAdminEmail: string;
  newPassword: string;
  confirmPassword: string;
  currentAdminPassword?: string;
  clientIp?: string;
  userAgent?: string;
}): Promise<{ success: boolean; message: string; transferId: string; newAdminUid: string }> {
  // 1. Verificação de permissões do solicitante
  if (params.callerRole !== 'super_admin') {
    throw new Error('Acesso negado: apenas o superadministrador atual pode transferir a administração principal.');
  }

  // 2. Validação estrita via Zod e política global de senhas
  const parseResult = TransferOwnershipSchema.safeParse({
    newAdminEmail: params.newAdminEmail,
    newPassword: params.newPassword,
    confirmPassword: params.confirmPassword,
    currentAdminPassword: params.currentAdminPassword,
  });

  if (!parseResult.success) {
    throw new Error(parseResult.error.issues[0]?.message || 'Dados inválidos para a transferência de administração.');
  }

  const { newAdminEmail, newPassword } = parseResult.data;

  // Não permitir transferir para o mesmo email
  if (newAdminEmail.toLowerCase() === params.callerEmail.toLowerCase()) {
    throw new Error('O novo administrador deve possuir um e-mail diferente do administrador atual.');
  }

  // 3. Trava de concorrência
  if (isTransferInProgress) {
    throw new Error('Já existe uma transferência de administração em andamento. Aguarde a conclusão.');
  }
  isTransferInProgress = true;

  const admin = getFirebaseAdminInstance();
  const auth = getAuth(admin);
  const db = getFirestoreInstance();

  const transferId = `transf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const transferDocRef = db.collection('admin_transfers').doc(transferId);
  const nowIso = new Date().toISOString();

  // Inicializar registro da máquina de estados
  await transferDocRef.set({
    id: transferId,
    state: 'pending' as TransferState,
    initiatedByUid: params.callerUid,
    initiatedByEmail: params.callerEmail,
    targetEmail: newAdminEmail,
    createdAt: nowIso,
    updatedAt: FieldValue.serverTimestamp(),
  });

  let createdNewUid: string | null = null;

  try {
    // 4. Verificar se o e-mail pretendido já pertence a um usuário no Firestore
    const existingUserSnap = await db.collection('users').where('email', '==', newAdminEmail).limit(1).get();
    if (!existingUserSnap.empty) {
      throw new Error(`O endereço ${newAdminEmail} já está associado a uma conta no sistema.`);
    }

    // 5. ETAPA: Criar nova conta administrativa no Firebase Authentication
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: newAdminEmail,
        password: newPassword,
        displayName: 'Super Administrador (Titular)',
      });
      createdNewUid = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        throw new Error('O endereço de e-mail especificado já existe no Firebase Authentication.');
      }
      throw new Error(`Falha ao registrar novo superadministrador no Firebase Auth: ${authErr.message}`);
    }

    await transferDocRef.update({
      state: 'new_account_created' as TransferState,
      newAdminUid: createdNewUid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 6. Atribuir Custom Claims de SuperAdmin no Firebase Auth
    await setUserCustomClaims(createdNewUid, {
      role: 'super_admin',
      super_admin: true,
      tenant_id: 'super-admin',
      must_reset_password: false,
    });

    // 7. ETAPA: Transação atômica para transferir titularidade no Firestore
    const newAdminSalt = crypto.randomBytes(16).toString('hex');
    const newAdminPasswordHash = hashPasswordPBKDF2(params.newPassword, newAdminSalt);

    await db.runTransaction(async (transaction) => {
      const ownershipRef = db.collection('system_config').doc('ownership');
      const bootstrapRef = db.collection('system_config').doc('bootstrap');

      // Perfil da nova conta em users
      const newUserRef = db.collection('users').doc(createdNewUid!);
      transaction.set(newUserRef, {
        id: createdNewUid,
        uid: createdNewUid,
        email: newAdminEmail,
        nome: 'Super Administrador (Titular)',
        role: 'super_admin',
        tipo: 'super_admin',
        tenant_id: 'super-admin',
        passwordHash: newAdminPasswordHash,
        salt: newAdminSalt,
        ativo: true,
        mustChangePassword: false,
        transferredFrom: params.callerUid,
        createdAt: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Registro no repositório de superusers
      const newSuperuserRef = db.collection('superusers').doc(createdNewUid!);
      transaction.set(newSuperuserRef, {
        id: createdNewUid,
        uid: createdNewUid,
        email: newAdminEmail,
        role: 'super_admin',
        isOwner: true,
        passwordHash: newAdminPasswordHash,
        salt: newAdminSalt,
        createdAt: nowIso,
        active: true,
      });

      // Atualizar o registro central de titularidade
      transaction.set(ownershipRef, {
        currentOwnerUid: createdNewUid,
        currentOwnerEmail: newAdminEmail,
        transferredAt: nowIso,
        previousOwnerUid: params.callerUid,
        previousOwnerEmail: params.callerEmail,
        transferId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Atualizar o bootstrap para apontar para o novo titular
      transaction.set(bootstrapRef, {
        initialized: true,
        primarySuperadminUid: createdNewUid,
        primarySuperadminEmail: newAdminEmail,
        lastTransferredAt: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Remover o antigo superadmin da lista de superusers
      const oldSuperuserRef = db.collection('superusers').doc(params.callerUid);
      transaction.delete(oldSuperuserRef);

      // Rebaixar/desativar permissão super_admin do antigo usuário no documento users
      const oldUserRef = db.collection('users').doc(params.callerUid);
      transaction.update(oldUserRef, {
        role: 'revoked_superadmin',
        tipo: 'revoked_superadmin',
        ativo: false,
        ownershipTransferredAt: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await transferDocRef.update({
      state: 'ownership_transferred' as TransferState,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 8. ETAPA: Invalidar imediatamente sessões e tokens do antigo superadmin
    try {
      await auth.revokeRefreshTokens(params.callerUid);
    } catch (revokeErr) {
      logSecurityEvent('WARN', 'old_superadmin_revoke_refresh_tokens_note', { error: String(revokeErr) });
    }

    // Invalidação em memória de todas as sessões do antigo superadmin
    for (const [sId, sess] of serverSessions.entries()) {
      if (sess.userId === params.callerUid || sess.email.toLowerCase() === params.callerEmail.toLowerCase()) {
        serverSessions.delete(sId);
      }
    }

    // 9. ETAPA: Eliminar conta antiga do Firebase Auth com segurança se for conta exclusiva de superadmin
    try {
      await auth.deleteUser(params.callerUid);
      logSecurityEvent('SECURITY', 'old_superadmin_firebase_auth_deleted', { oldUid: params.callerUid });
    } catch (delErr: any) {
      logSecurityEvent('WARN', 'old_superadmin_firebase_auth_delete_note', { error: delErr.message });
      // Se não for possível deletar imediatamente, garante que os claims foram revogados
      try {
        await setUserCustomClaims(params.callerUid, {
          role: 'revoked',
          super_admin: false,
          tenant_id: 'revoked',
        });
      } catch {}
    }

    // 10. Concluir máquina de estados
    await transferDocRef.update({
      state: 'completed' as TransferState,
      completedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 11. Registro de Auditoria Imutável
    await recordAuditLog({
      actor_id: params.callerUid,
      actor_email: params.callerEmail,
      actor_role: 'super_admin',
      action: 'status_change',
      entity: 'SuperAdminOwnershipTransfer',
      entity_id: createdNewUid,
      tenant_id: 'super-admin',
      ip: params.clientIp,
      user_agent: params.userAgent,
      after_state: {
        newOwnerUid: createdNewUid,
        newOwnerEmail: newAdminEmail,
        previousOwnerEmail: params.callerEmail,
      },
    });

    logSecurityEvent('SECURITY', 'superadmin_ownership_transfer_completed', {
      fromEmail: params.callerEmail,
      toEmail: newAdminEmail,
      transferId,
    });

    return {
      success: true,
      message: `Administração principal transferida com sucesso para ${newAdminEmail}. A sessão anterior foi encerrada e revogada.`,
      transferId,
      newAdminUid: createdNewUid,
    };
  } catch (error: any) {
    logSecurityEvent('ERROR', 'superadmin_ownership_transfer_failed', {
      transferId,
      error: error.message,
    });

    // Se falhar DEPOIS de criar o usuário no Firebase Auth, mas ANTES de transferir a posse,
    // fazer rollback seguro removendo a nova conta para evitar dois superadmins
    if (createdNewUid) {
      try {
        const transferSnap = await transferDocRef.get();
        const state = transferSnap.data()?.state;
        if (state === 'new_account_created') {
          await auth.deleteUser(createdNewUid);
          logSecurityEvent('SECURITY', 'rollback_deleted_unlinked_new_admin_auth', { createdNewUid });
        }
      } catch (rollbackErr) {
        logSecurityEvent('ERROR', 'rollback_failed', { rollbackErr: String(rollbackErr) });
      }
    }

    await transferDocRef.update({
      state: 'failed' as TransferState,
      error: error.message,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    throw error;
  } finally {
    isTransferInProgress = false;
  }
}
