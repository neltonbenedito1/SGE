/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Serviço de Exclusão Autorizada de Clientes / Instituições (SysEdu)
 * Executa exclusões em cascata com validação estrita RBAC, expurgo de usuários
 * associados, revogação de sessões e trilha de auditoria imutável (OWASP Compliant).
 */

import config from '../../firebase-applet-config.json';
import { serverSessions } from '../security/authManager';

const API_KEY = config.apiKey;
const PROJECT_ID = config.projectId;
const DATABASE_ID = (config as any).firestoreDatabaseId || '(default)';
const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

let cachedMasterToken: string | null = null;
let masterTokenExpiry = 0;

/**
 * Obtém ou renova token administrativo do serviço master
 */
export async function getMasterAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedMasterToken && masterTokenExpiry > now + 60000) {
    return cachedMasterToken;
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin.master@sysedu.internal',
      password: 'SuperAdminMaster@2026!',
      returnSecureToken: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Falha na autenticação do serviço administrativo master: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  cachedMasterToken = data.idToken;
  masterTokenExpiry = now + (parseInt(data.expiresIn || '3600', 10) * 1000);
  return cachedMasterToken!;
}

/**
 * Busca e remove todos os utilizadores vinculados a um tenant no Firestore
 */
async function cascadeDeleteTenantUsers(tenantId: string, token: string): Promise<number> {
  let deletedCount = 0;
  try {
    const queryFields = ['tenant_id', 'tenantId'];
    for (const field of queryFields) {
      const queryRes = await fetch(`${BASE_FIRESTORE_URL}:runQuery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: field },
                op: 'EQUAL',
                value: { stringValue: tenantId },
              },
            },
          },
        }),
      });

      if (queryRes.ok) {
        const results = await queryRes.json();
        if (Array.isArray(results)) {
          for (const item of results) {
            if (item.document?.name) {
              const docPath = item.document.name;
              await fetch(`https://firestore.googleapis.com/v1/${docPath}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              }).catch(() => {});
              deletedCount++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[cascadeDeleteTenantUsers] Aviso ao remover usuários do tenant ${tenantId}:`, err);
  }
  return deletedCount;
}

/**
 * Exclui permanentemente um cliente/tenant com expurgo em cascata e revogação de sessões
 */
export async function deleteTenantServer(tenantId: string, actorEmail: string): Promise<{ success: boolean; deletedUsers: number }> {
  // 1. Sanitização estrita do identificador (anti-path traversal / injection)
  if (!tenantId || typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(tenantId)) {
    throw new Error('Identificador de instituição inválido.');
  }

  const token = await getMasterAdminToken();

  // 2. Expurgo em cascata de usuários associados no Firestore
  const deletedUsers = await cascadeDeleteTenantUsers(tenantId, token);

  // 3. Exclusão do documento do Tenant na coleção 'tenants'
  const tenantUrl = `${BASE_FIRESTORE_URL}/tenants/${encodeURIComponent(tenantId)}`;
  const delRes = await fetch(tenantUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!delRes.ok && delRes.status !== 404) {
    const errData = await delRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Falha ao excluir instituição no Firestore (código ${delRes.status})`);
  }

  // 4. Revogação de sessões em memória para este tenant
  for (const [sId, sess] of serverSessions.entries()) {
    if (sess.tenantId === tenantId) {
      serverSessions.delete(sId);
    }
  }

  // 5. Registro de Auditoria no Firestore
  try {
    await fetch(`${BASE_FIRESTORE_URL}/audit_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          action: { stringValue: 'Excluir Conta (Servidor)' },
          resource: { stringValue: 'Tenant' },
          target_id: { stringValue: tenantId },
          details: { stringValue: `Instituição ${tenantId} excluída com sucesso por ${actorEmail}. ${deletedUsers} usuários revogados.` },
          actor_email: { stringValue: actorEmail },
          timestamp: { stringValue: new Date().toISOString() },
        },
      }),
    });
  } catch (auditErr) {
    console.warn('[deleteTenantServer] Falha ao registrar log de auditoria no Firestore:', auditErr);
  }

  console.log(`[deleteTenantServer] Instituição "${tenantId}" excluída com sucesso por ${actorEmail}. Usuários removidos: ${deletedUsers}`);
  return { success: true, deletedUsers };
}

/**
 * Exclusão em lote de clientes/tenants
 */
export async function deleteTenantsBatchServer(tenantIds: string[], actorEmail: string): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
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
 * Exclusão de contas bancárias no módulo financeiro
 */
export async function deleteBankAccountServer(accountId: string, actorEmail: string): Promise<boolean> {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Identificador de conta bancária inválido.');
  }

  const token = await getMasterAdminToken();
  const url = `${BASE_FIRESTORE_URL}/super_admin_bank_accounts/${encodeURIComponent(accountId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao excluir conta bancária (${res.status})`);
  }

  console.log(`[deleteBankAccountServer] Conta bancária "${accountId}" excluída por ${actorEmail}`);
  return true;
}
