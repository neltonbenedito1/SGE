/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Exclusão Autorizada de Clientes / Instituições (SysEdu)
 * Executa exclusões em lote (writeBatch de até 450 documentos) sem consultas N+1
 * nem credenciais hardcoded em código-fonte.
 */

import { getFirestoreInstance } from '../middleware/auth';
import { serverSessions } from '../security/authManager';
import { recordAuditLog } from '../security/audit';

const BATCH_LIMIT = 450;

/**
 * Remove em lotes paginados todos os documentos de uma colecção pertencentes a um tenant.
 */
async function deleteTenantCollectionInBatches(
  db: any,
  collectionName: string,
  tenantField: string,
  tenantId: string
): Promise<number> {
  let deleted = 0;
  try {
    while (true) {
      const snap = await db
        .collection(collectionName)
        .where(tenantField, '==', tenantId)
        .limit(BATCH_LIMIT)
        .get();

      if (snap.empty || snap.docs.length === 0) break;

      const batch = db.batch();
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
      await batch.commit();
      deleted += snap.docs.length;

      if (snap.docs.length < BATCH_LIMIT) break;
    }
  } catch (err) {
    console.warn(`[deleteTenantCollectionInBatches] Aviso em ${collectionName}:`, err);
  }
  return deleted;
}

/**
 * Exclui permanentemente um cliente/tenant com expurgo em lote e revogação de sessões.
 */
export async function deleteTenantServer(
  tenantId: string,
  actorEmail: string
): Promise<{ success: boolean; deletedUsers: number; deletedRecords: number }> {
  if (!tenantId || typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(tenantId)) {
    throw new Error('Identificador de instituição inválido.');
  }

  const db = getFirestoreInstance();

  // 1. Expurgo em lotes de utilizadores associados
  const deletedUsersPrimary = await deleteTenantCollectionInBatches(db, 'users', 'tenant_id', tenantId);
  const deletedUsersAlt = await deleteTenantCollectionInBatches(db, 'users', 'tenantId', tenantId);
  const deletedUsers = deletedUsersPrimary + deletedUsersAlt;

  // 2. Expurgo em lotes das partições do tenant e agregado analítico
  let deletedRecords = deletedUsers;
  const tenantCollections = [
    'estudantes',
    'docentes',
    'turmas',
    'escolas',
    'provincias',
    'classes',
    'salas',
    'pautas',
    'processos_aluno',
    'processos_docentes',
    'atividades',
    'assiduidade_logs',
    'notificacoes',
    'faturas_estudantes',
    'cursos',
    'cadeiras',
    'inscricoes_cadeiras',
    'custom_forms',
  ];

  for (const col of tenantCollections) {
    deletedRecords += await deleteTenantCollectionInBatches(db, col, 'tenant_id', tenantId);
  }
  deletedRecords += await deleteTenantCollectionInBatches(db, 'planoAulas', 'tenantId', tenantId);

  await db.collection('tenant_analytics').doc(tenantId).delete().catch(() => {});

  // 3. Exclusão do documento do Tenant na colecção 'tenants'
  await db.collection('tenants').doc(tenantId).delete();

  // 4. Revogação de sessões em memória para este tenant
  for (const [sId, sess] of serverSessions.entries()) {
    if (sess.tenantId === tenantId) {
      serverSessions.delete(sId);
    }
  }

  // 5. Registo de Auditoria
  await recordAuditLog({
    actor_id: actorEmail || 'super_admin',
    actor_email: actorEmail || 'super_admin',
    actor_role: 'super_admin',
    action: 'delete',
    entity: 'Tenant',
    entity_id: tenantId,
    tenant_id: tenantId,
    metadata: { deletedUsers, deletedRecords },
  });

  return { success: true, deletedUsers, deletedRecords };
}

/**
 * Exclusão em lote de clientes/tenants.
 */
export async function deleteTenantsBatchServer(
  tenantIds: string[],
  actorEmail: string
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
    throw new Error('Nenhum identificador de instituição fornecido para exclusão em lote.');
  }

  let deletedCount = 0;
  const errors: string[] = [];

  for (const id of tenantIds) {
    try {
      await deleteTenantServer(id, actorEmail);
      deletedCount++;
    } catch (e: any) {
      errors.push(`Erro no tenant ${id}: ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    deletedCount,
    errors,
  };
}

/**
 * Exclusão de contas bancárias no módulo financeiro.
 */
export async function deleteBankAccountServer(accountId: string, actorEmail: string): Promise<boolean> {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Identificador de conta bancária inválido.');
  }

  const db = getFirestoreInstance();
  await db.collection('super_admin_bank_accounts').doc(accountId).delete();
  console.log(`[deleteBankAccountServer] Conta bancária "${accountId}" excluída por ${actorEmail}`);
  return true;
}
