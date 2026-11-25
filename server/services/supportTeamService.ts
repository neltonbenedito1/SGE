/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Equipa de Atendimento, Departamentos/Filas e Matriz de Permissões (Fase 2)
 * - CRUD de Departamentos/Filas de suporte com SLA e integridade referencial
 * - CRUD de Funcionários de suporte com horários, disponibilidade, limites e regras de atribuição
 * - Matriz de permissões (Assistente vs Supervisor vs Administrador) configurável por funcionário
 * - Redefinição segura de credenciais com política de senhas fortes e revogação de sessões
 * - Histórico de atendimento por funcionário e contagens reais na visão geral
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAuth } from 'firebase-admin/auth';
import {
  AuthenticatedUser,
  getFirebaseAdminInstance,
  getFirestoreInstance,
  invalidateAuthResolutionCache,
} from '../middleware/auth';
import { hashPasswordPBKDF2, revokeUserSessions } from '../security/authManager';
import { recordAuditLog } from '../security/audit';
import { validatePasswordPolicy } from '../../src/shared/passwordPolicy';
import type {
  SupportAgent,
  SupportAgentHistoryEntry,
  SupportAgentRole,
  SupportAgentStatus,
  SupportAssignmentRules,
  SupportAvailability,
  SupportDepartment,
  SupportPermissionSet,
  SupportPermissionsRecord,
  SupportTeamOverviewStats,
  SupportWeekday,
  SupportWorkingHours,
} from '../../src/types';

const DEPARTMENTS_COL = 'support_departments';
const AGENTS_COL = 'support_agents';
const PERMISSIONS_COL = 'support_permissions';
const TICKETS_COL = 'support_tickets';
const ASSIGNMENTS_COL = 'support_assignments';
const AUDIT_COL = 'audit_logs';
const IDEMPOTENCY_COL = 'idempotency_keys';

export function getDefaultPermissionsForRole(role: SupportAgentRole): SupportPermissionSet {
  switch (role) {
    case 'administrador':
      return {
        visualizar: true,
        responder: true,
        transferir: true,
        encerrar: true,
        consultar_historico: true,
        historico_escopo: 'todos',
        consultar_analytics: true,
        gerir_funcionarios: true,
        configurar_ia: true,
        gerir_faq: true,
      };
    case 'supervisor':
      return {
        visualizar: true,
        responder: true,
        transferir: true,
        encerrar: true,
        consultar_historico: true,
        historico_escopo: 'todos',
        consultar_analytics: true,
        gerir_funcionarios: false,
        configurar_ia: false,
        gerir_faq: true,
      };
    case 'assistente':
    default:
      return {
        visualizar: true,
        responder: true,
        transferir: true,
        encerrar: true,
        consultar_historico: true,
        historico_escopo: 'proprio',
        consultar_analytics: false,
        gerir_funcionarios: false,
        configurar_ia: false,
        gerir_faq: false,
      };
  }
}

export function buildDefaultWorkingHours(): SupportWorkingHours {
  const days: SupportWeekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  return {
    ativo: true,
    timezone: 'Africa/Maputo',
    dias: days.map((dia) => ({
      dia,
      ativo: dia !== 'sab' && dia !== 'dom',
      inicio: '08:00',
      fim: '17:00',
    })),
  };
}

export function buildDefaultAssignmentRules(): SupportAssignmentRules {
  return {
    auto_atribuir: true,
    apenas_horario: true,
    prioridade_atribuicao: 50,
    categorias_especialidade: [],
  };
}

function normalizeText(v: string): string {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(v: string): string {
  return normalizeText(v)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'departamento';
}

async function getIdempotentResult<T>(scope: string, key?: string): Promise<{ hit: boolean; data?: T }> {
  if (!key || !key.trim()) return { hit: false };
  try {
    const db = getFirestoreInstance();
    const docId = `idem_${scope}_${crypto.createHash('sha256').update(key.trim()).digest('hex').slice(0, 32)}`;
    const snap = await db.collection(IDEMPOTENCY_COL).doc(docId).get();
    if (snap.exists) {
      const payload = snap.data();
      if (payload?.expiresAt && Number(payload.expiresAt) > Date.now() && payload?.result) {
        return { hit: true, data: payload.result as T };
      }
    }
  } catch {}
  return { hit: false };
}

async function saveIdempotentResult(scope: string, key: string | undefined, result: any): Promise<void> {
  if (!key || !key.trim()) return;
  try {
    const db = getFirestoreInstance();
    const docId = `idem_${scope}_${crypto.createHash('sha256').update(key.trim()).digest('hex').slice(0, 32)}`;
    await db.collection(IDEMPOTENCY_COL).doc(docId).set({
      scope,
      key: key.trim(),
      result,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch {}
}

// ============================================================================
// DEPARTAMENTOS / FILAS DE ATENDIMENTO
// ============================================================================

export async function listSupportDepartments(params?: {
  tenantId?: string;
  includeInactive?: boolean;
}): Promise<SupportDepartment[]> {
  const db = getFirestoreInstance();
  const [deptSnap, agentSnap] = await Promise.all([
    db.collection(DEPARTMENTS_COL).get(),
    db.collection(AGENTS_COL).get(),
  ]);

  const countByDept = new Map<string, number>();
  for (const d of agentSnap.docs) {
    const data = d.data() || {};
    if (data.tipo === 'ia' || data.estado === 'arquivado') continue;
    const deptIds = new Set<string>();
    if (data.departamento_id) deptIds.add(String(data.departamento_id));
    if (Array.isArray(data.departamentos_autorizados)) {
      for (const did of data.departamentos_autorizados) {
        if (did) deptIds.add(String(did));
      }
    }
    for (const did of deptIds) {
      countByDept.set(did, (countByDept.get(did) || 0) + 1);
    }
  }

  const targetTenant = params?.tenantId?.trim();
  const rows: SupportDepartment[] = [];

  for (const d of deptSnap.docs) {
    const data = d.data() || {};
    const dept: SupportDepartment = {
      id: d.id,
      tenant_id: String(data.tenant_id || 'global'),
      nome: String(data.nome || ''),
      slug: String(data.slug || slugify(data.nome || d.id)),
      descricao: String(data.descricao || ''),
      email_fila: String(data.email_fila || ''),
      sla_resposta_minutos: Number(data.sla_resposta_minutos ?? 60),
      sla_resolucao_horas: Number(data.sla_resolucao_horas ?? 24),
      ordem: Number(data.ordem ?? 0),
      ativo: data.ativo !== false,
      padrao: Boolean(data.padrao),
      membros_count: countByDept.get(d.id) || 0,
      created_at: String(data.created_at || ''),
      updated_at: String(data.updated_at || ''),
      created_by: String(data.created_by || ''),
      updated_by: String(data.updated_by || ''),
    };

    if (targetTenant && dept.tenant_id !== targetTenant && dept.tenant_id !== 'global') {
      continue;
    }
    if (params?.includeInactive === false && !dept.ativo) {
      continue;
    }
    rows.push(dept);
  }

  rows.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
  return rows;
}

export async function createSupportDepartment(
  input: {
    tenant_id: string;
    nome: string;
    descricao?: string;
    email_fila?: string;
    sla_resposta_minutos?: number;
    sla_resolucao_horas?: number;
    ordem?: number;
    ativo?: boolean;
    padrao?: boolean;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ department: SupportDepartment; idempotent: boolean }> {
  const idem = await getIdempotentResult<SupportDepartment>('sup_dept_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { department: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const id = `supdept_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const cleanNome = input.nome.trim();

  if (input.padrao) {
    try {
      const existingSnap = await db.collection(DEPARTMENTS_COL).where('padrao', '==', true).get();
      if (!existingSnap.empty) {
        const batch = db.batch();
        for (const docItem of existingSnap.docs) {
          if ((docItem.data()?.tenant_id || 'global') === (input.tenant_id || 'global')) {
            batch.update(docItem.ref, { padrao: false });
          }
        }
        await batch.commit();
      }
    } catch {}
  }

  const department: SupportDepartment = {
    id,
    tenant_id: input.tenant_id || 'global',
    nome: cleanNome,
    slug: slugify(cleanNome),
    descricao: (input.descricao || '').trim(),
    email_fila: (input.email_fila || '').trim(),
    sla_resposta_minutos: Number(input.sla_resposta_minutos ?? 60),
    sla_resolucao_horas: Number(input.sla_resolucao_horas ?? 24),
    ordem: Number(input.ordem ?? 0),
    ativo: input.ativo !== false,
    padrao: Boolean(input.padrao),
    membros_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: actor.email || actor.uid,
    updated_by: actor.email || actor.uid,
  };

  await db.collection(DEPARTMENTS_COL).doc(id).set(department);
  await saveIdempotentResult('sup_dept_create', input.idempotencyKey, department);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'support_department',
    entity_id: id,
    tenant_id: department.tenant_id,
    after_state: department,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { department, idempotent: false };
}

export async function updateSupportDepartment(
  id: string,
  input: {
    nome?: string;
    descricao?: string;
    email_fila?: string;
    sla_resposta_minutos?: number;
    sla_resolucao_horas?: number;
    ordem?: number;
    ativo?: boolean;
    padrao?: boolean;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportDepartment | null> {
  const db = getFirestoreInstance();
  const ref = db.collection(DEPARTMENTS_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const before = snap.data() as SupportDepartment;
  const nowIso = new Date().toISOString();
  const nextNome = input.nome !== undefined ? input.nome.trim() : before.nome;

  if (input.padrao === true) {
    try {
      const existingSnap = await db.collection(DEPARTMENTS_COL).where('padrao', '==', true).get();
      if (!existingSnap.empty) {
        const batch = db.batch();
        for (const docItem of existingSnap.docs) {
          if (docItem.id !== id && (docItem.data()?.tenant_id || 'global') === (before.tenant_id || 'global')) {
            batch.update(docItem.ref, { padrao: false });
          }
        }
        await batch.commit();
      }
    } catch {}
  }

  const updated: SupportDepartment = {
    ...before,
    id,
    nome: nextNome,
    slug: input.nome !== undefined ? slugify(nextNome) : before.slug || slugify(nextNome),
    descricao: input.descricao !== undefined ? input.descricao.trim() : before.descricao || '',
    email_fila: input.email_fila !== undefined ? input.email_fila.trim() : before.email_fila || '',
    sla_resposta_minutos:
      input.sla_resposta_minutos !== undefined
        ? Number(input.sla_resposta_minutos)
        : Number(before.sla_resposta_minutos ?? 60),
    sla_resolucao_horas:
      input.sla_resolucao_horas !== undefined
        ? Number(input.sla_resolucao_horas)
        : Number(before.sla_resolucao_horas ?? 24),
    ordem: input.ordem !== undefined ? Number(input.ordem) : Number(before.ordem ?? 0),
    ativo: input.ativo !== undefined ? Boolean(input.ativo) : before.ativo !== false,
    padrao: input.padrao !== undefined ? Boolean(input.padrao) : Boolean(before.padrao),
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await ref.set(updated, { merge: true });

  // Propagate department name change to referencing agents
  if (input.nome !== undefined && nextNome !== before.nome) {
    try {
      const agentSnap = await db.collection(AGENTS_COL).where('departamento_id', '==', id).get();
      if (!agentSnap.empty) {
        const batch = db.batch();
        for (const aDoc of agentSnap.docs) {
          batch.update(aDoc.ref, { departamento_nome: nextNome });
        }
        await batch.commit();
      }
    } catch {}
  }

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'update',
    entity: 'support_department',
    entity_id: id,
    tenant_id: updated.tenant_id,
    before_state: before,
    after_state: updated,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return updated;
}

export async function deleteSupportDepartment(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ deleted: boolean; conflict?: boolean; error?: string }> {
  const db = getFirestoreInstance();
  const ref = db.collection(DEPARTMENTS_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { deleted: false, error: 'Departamento não encontrado.' };
  }

  const agentSnap = await db.collection(AGENTS_COL).get();
  const hasMember = agentSnap.docs.some((d: any) => {
    const a = d.data() || {};
    if (a.estado === 'arquivado') return false;
    return (
      a.departamento_id === id ||
      (Array.isArray(a.departamentos_autorizados) && a.departamentos_autorizados.includes(id))
    );
  });

  if (hasMember) {
    return {
      deleted: false,
      conflict: true,
      error: 'Não é possível eliminar um departamento com funcionários associados. Reatribua os funcionários primeiro.',
    };
  }

  const before = snap.data() as SupportDepartment;
  await ref.delete();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'support_department',
    entity_id: id,
    tenant_id: before.tenant_id || 'global',
    before_state: before,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { deleted: true };
}

// ============================================================================
// FUNCIONÁRIOS DE SUPORTE & PERMISSÕES
// ============================================================================

function mapAgentDoc(
  id: string,
  data: any,
  deptNameMap?: Map<string, string>,
  permsMap?: Map<string, SupportPermissionSet>
): SupportAgent {
  const deptId = String(data.departamento_id || '');
  const funcao = (data.funcao || 'assistente') as SupportAgentRole;
  const authDepts = Array.isArray(data.departamentos_autorizados)
    ? Array.from(new Set([deptId, ...data.departamentos_autorizados.map(String)].filter(Boolean)))
    : deptId
    ? [deptId]
    : [];

  return {
    id,
    uid: data.uid ? String(data.uid) : undefined,
    tenant_id: String(data.tenant_id || 'global'),
    tipo: data.tipo === 'ia' ? 'ia' : 'humano',
    nome: String(data.nome || ''),
    email: String(data.email || '').toLowerCase(),
    departamento_id: deptId,
    departamento_nome: deptNameMap?.get(deptId) || String(data.departamento_nome || ''),
    departamentos_autorizados: authDepts,
    funcao,
    estado: (data.estado || 'activo') as SupportAgentStatus,
    disponibilidade: (data.disponibilidade || 'offline') as SupportAvailability,
    limite_simultaneo: Number(data.limite_simultaneo ?? 10),
    carga_actual: Number(data.carga_actual ?? 0),
    horario_atendimento: data.horario_atendimento || buildDefaultWorkingHours(),
    regras_atribuicao: data.regras_atribuicao || buildDefaultAssignmentRules(),
    permissoes: permsMap?.get(id) || data.permissoes || getDefaultPermissionsForRole(funcao),
    must_reset_password: Boolean(data.must_reset_password),
    credenciais_redefinidas_em: data.credenciais_redefinidas_em || null,
    ultimo_acesso: data.ultimo_acesso || null,
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    created_by: String(data.created_by || ''),
    updated_by: String(data.updated_by || ''),
  };
}

export async function listSupportAgents(params?: {
  tenantId?: string;
  q?: string;
  departamento_id?: string;
  funcao?: SupportAgentRole | 'todas';
  estado?: SupportAgentStatus | 'todos';
  disponibilidade?: SupportAvailability | 'todas';
  authorizedDepartmentIds?: string[];
  selfAgentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: SupportAgent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const db = getFirestoreInstance();
  const [agentSnap, deptSnap, permSnap] = await Promise.all([
    db.collection(AGENTS_COL).get(),
    db.collection(DEPARTMENTS_COL).get(),
    db.collection(PERMISSIONS_COL).get(),
  ]);

  const deptNameMap = new Map<string, string>();
  for (const d of deptSnap.docs) {
    deptNameMap.set(d.id, String(d.data()?.nome || ''));
  }

  const permsMap = new Map<string, SupportPermissionSet>();
  for (const p of permSnap.docs) {
    const pd = p.data() || {};
    if (pd.permissoes) {
      permsMap.set(String(pd.agent_id || p.id), pd.permissoes as SupportPermissionSet);
    }
  }

  let items = agentSnap.docs
    .map((d: any) => mapAgentDoc(d.id, d.data() || {}, deptNameMap, permsMap))
    .filter((a: SupportAgent) => a.tipo === 'humano');

  if (params?.authorizedDepartmentIds && !params.authorizedDepartmentIds.includes('*')) {
    const allowedDepts = new Set(params.authorizedDepartmentIds);
    items = items.filter(
      (a) =>
        (params.selfAgentId && a.id === params.selfAgentId) ||
        allowedDepts.has(a.departamento_id) ||
        a.departamentos_autorizados.some((d) => allowedDepts.has(d))
    );
  }

  if (params?.tenantId && params.tenantId.trim()) {
    const t = params.tenantId.trim();
    items = items.filter((a) => a.tenant_id === t || a.tenant_id === 'global');
  }
  if (params?.departamento_id && params.departamento_id !== 'todos') {
    const targetDept = params.departamento_id;
    items = items.filter(
      (a) => a.departamento_id === targetDept || a.departamentos_autorizados.includes(targetDept)
    );
  }
  if (params?.funcao && params.funcao !== 'todas') {
    items = items.filter((a) => a.funcao === params.funcao);
  }
  if (params?.estado && params.estado !== 'todos') {
    items = items.filter((a) => a.estado === params.estado);
  }
  if (params?.disponibilidade && params.disponibilidade !== 'todas') {
    items = items.filter((a) => a.disponibilidade === params.disponibilidade);
  }
  if (params?.q && params.q.trim()) {
    const needle = normalizeText(params.q);
    items = items.filter((a) => {
      const hay = normalizeText(`${a.nome} ${a.email} ${a.departamento_nome || ''} ${a.funcao}`);
      return hay.includes(needle);
    });
  }

  items.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  const total = items.length;
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 15)));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(params?.page || 1)));
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getSupportAgentById(id: string): Promise<SupportAgent | null> {
  const db = getFirestoreInstance();
  const snap = await db.collection(AGENTS_COL).doc(id).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  const [deptSnap, permSnap] = await Promise.all([
    data.departamento_id
      ? db.collection(DEPARTMENTS_COL).doc(String(data.departamento_id)).get().catch(() => null)
      : Promise.resolve(null),
    db.collection(PERMISSIONS_COL).doc(id).get().catch(() => null),
  ]);

  const deptNameMap = new Map<string, string>();
  if (deptSnap?.exists) {
    deptNameMap.set(deptSnap.id, String(deptSnap.data()?.nome || ''));
  }

  const permsMap = new Map<string, SupportPermissionSet>();
  if (permSnap?.exists && permSnap.data()?.permissoes) {
    permsMap.set(id, permSnap.data().permissoes as SupportPermissionSet);
  }

  return mapAgentDoc(snap.id, data, deptNameMap, permsMap);
}

export async function resolveSupportAgentByCaller(uid?: string, email?: string): Promise<SupportAgent | null> {
  const db = getFirestoreInstance();
  const cleanEmail = String(email || '').trim().toLowerCase();

  let matchedDoc: any = null;
  if (uid) {
    const byUidSnap = await db.collection(AGENTS_COL).where('uid', '==', uid).limit(3).get().catch(() => null);
    if (byUidSnap && !byUidSnap.empty) {
      matchedDoc = byUidSnap.docs.find((d: any) => d.data()?.tipo !== 'ia') || byUidSnap.docs[0];
    }
  }
  if (!matchedDoc && cleanEmail) {
    const byEmailSnap = await db.collection(AGENTS_COL).where('email', '==', cleanEmail).limit(3).get().catch(() => null);
    if (byEmailSnap && !byEmailSnap.empty) {
      matchedDoc =
        byEmailSnap.docs.find((d: any) => d.data()?.tipo !== 'ia' && d.data()?.estado === 'activo') ||
        byEmailSnap.docs[0];
    }
  }

  if (!matchedDoc) return null;
  return await getSupportAgentById(matchedDoc.id);
}

async function provisionOrSyncAuthAccount(params: {
  email: string;
  nome: string;
  tenantId: string;
  password?: string;
  mustResetPassword?: boolean;
  ativo: boolean;
  existingUid?: string;
}): Promise<string> {
  const db = getFirestoreInstance();
  const cleanEmail = params.email.trim().toLowerCase();
  let uid = params.existingUid || '';

  // Protect existing super_admin and non-support institutional accounts from accidental role/password overwrite
  const [superUsersSnap, usersByEmailSnap, existingByUidSnap] = await Promise.all([
    db.collection('superusers').where('email', '==', cleanEmail).limit(5).get().catch(() => null),
    db.collection('users').where('email', '==', cleanEmail).limit(5).get().catch(() => null),
    uid ? db.collection('users').doc(uid).get().catch(() => null) : Promise.resolve(null),
  ]);

  const userDocs: Array<{ id: string; data: any }> = [];
  if (existingByUidSnap?.exists) {
    userDocs.push({ id: existingByUidSnap.id, data: existingByUidSnap.data() || {} });
  }
  if (usersByEmailSnap && !usersByEmailSnap.empty) {
    for (const d of usersByEmailSnap.docs) {
      if (!userDocs.some((u) => u.id === d.id)) {
        userDocs.push({ id: d.id, data: d.data() || {} });
      }
    }
  }

  const isSuperAdminDoc = (data: any) => {
    const r = String(data?.tipo || data?.role || '').toLowerCase().trim();
    return (r === 'super_admin' || r === 'superadmin') && data?.ativo !== false;
  };

  const hasActiveSuperuser =
    Boolean(superUsersSnap && !superUsersSnap.empty && superUsersSnap.docs.some((d: any) => d.data()?.ativo !== false && d.data()?.active !== false)) ||
    userDocs.some((u) => isSuperAdminDoc(u.data));

  if (hasActiveSuperuser) {
    if (params.password) {
      throw new Error(
        'Este e-mail pertence a um Superadministrador activo. Deixe a palavra-passe inicial em branco para apenas vincular à equipa de atendimento sem alterar as credenciais principais.'
      );
    }
    const superUserDoc = userDocs.find((u) => isSuperAdminDoc(u.data)) || userDocs[0];
    if (superUserDoc) {
      return superUserDoc.id;
    }
    if (superUsersSnap && !superUsersSnap.empty) {
      return superUsersSnap.docs[0].id;
    }
    return uid || `supusr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  const conflictingSchoolUser = userDocs.find((u) => {
    const r = String(u.data?.tipo || u.data?.role || '').toLowerCase().trim();
    return r && r !== 'suporte' && r !== 'revoked_superadmin' && u.data?.ativo !== false;
  });
  if (conflictingSchoolUser) {
    throw new Error(
      'Este endereço de e-mail já pertence a uma conta institucional activa do sistema. Utilize um e-mail exclusivo para o funcionário de atendimento.'
    );
  }

  if (params.password) {
    // Try Firebase Admin Auth first
    try {
      const admin = getFirebaseAdminInstance();
      const fbAuth = getAuth(admin);
      if (uid) {
        try {
          await fbAuth.updateUser(uid, {
            email: cleanEmail,
            displayName: params.nome,
            password: params.password,
            disabled: !params.ativo,
          });
        } catch {
          // If uid wasn't in Firebase Auth yet, check by email
          const existing = await fbAuth.getUserByEmail(cleanEmail).catch(() => null);
          if (existing) {
            uid = existing.uid;
            await fbAuth.updateUser(uid, {
              displayName: params.nome,
              password: params.password,
              disabled: !params.ativo,
            });
          } else {
            const created = await fbAuth.createUser({
              email: cleanEmail,
              password: params.password,
              displayName: params.nome,
              emailVerified: true,
              disabled: !params.ativo,
            });
            uid = created.uid;
          }
        }
      } else {
        const existing = await fbAuth.getUserByEmail(cleanEmail).catch(() => null);
        if (existing) {
          uid = existing.uid;
          await fbAuth.updateUser(uid, {
            displayName: params.nome,
            password: params.password,
            disabled: !params.ativo,
          });
        } else {
          const created = await fbAuth.createUser({
            email: cleanEmail,
            password: params.password,
            displayName: params.nome,
            emailVerified: true,
            disabled: !params.ativo,
          });
          uid = created.uid;
        }
      }
    } catch {
      // Fallback REST signUp on Starter Tier when Admin IAM is unavailable
      if (!uid) {
        try {
          const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(cfgPath)) {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (cfg.apiKey) {
              const res = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: cleanEmail,
                    password: params.password,
                    returnSecureToken: true,
                  }),
                }
              );
              const body = await res.json().catch(() => ({}));
              if (res.ok && body.localId) {
                uid = body.localId;
              }
            }
          }
        } catch {}
      }
    }
  }

  if (!uid) {
    const existingSupportUser = userDocs.find((u) => {
      const r = String(u.data?.tipo || u.data?.role || '').toLowerCase().trim();
      return !r || r === 'suporte';
    });
    if (existingSupportUser) {
      uid = existingSupportUser.id;
    } else {
      uid = `supusr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
  }

  const userPayload: Record<string, any> = {
    id: uid,
    uid,
    email: cleanEmail,
    nome: params.nome,
    tipo: 'suporte',
    role: 'suporte',
    tenant_id: params.tenantId || 'global',
    ativo: params.ativo,
    updated_at: new Date().toISOString(),
  };

  if (params.password) {
    const salt = crypto.randomBytes(32).toString('hex');
    userPayload.salt = salt;
    userPayload.passwordHash = hashPasswordPBKDF2(params.password, salt);
    userPayload.passwordLastChangedAt = new Date().toISOString();
    userPayload.mustChangePassword = Boolean(params.mustResetPassword);
    userPayload.requer_alteracao_senha = Boolean(params.mustResetPassword);
  }

  await db.collection('users').doc(uid).set(userPayload, { merge: true });
  invalidateAuthResolutionCache(cleanEmail);
  invalidateAuthResolutionCache(uid);

  return uid;
}

export async function createSupportAgent(
  input: {
    tenant_id: string;
    nome: string;
    email: string;
    departamento_id: string;
    departamentos_autorizados?: string[];
    funcao: SupportAgentRole;
    estado: SupportAgentStatus;
    disponibilidade: SupportAvailability;
    limite_simultaneo: number;
    horario_atendimento?: SupportWorkingHours;
    regras_atribuicao?: SupportAssignmentRules;
    permissoes?: SupportPermissionSet;
    initialPassword?: string;
    mustResetPassword?: boolean;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ agent: SupportAgent; idempotent: boolean }> {
  const idem = await getIdempotentResult<SupportAgent>('sup_agent_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { agent: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const cleanEmail = input.email.trim().toLowerCase();

  // Verify department exists
  const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.departamento_id).get();
  if (!deptSnap.exists) {
    throw new Error('Departamento principal selecionado não existe.');
  }
  const deptData = deptSnap.data() || {};

  // Check duplicate email in active/non-archived human staff (ignore AI agents)
  const existingAgentSnap = await db.collection(AGENTS_COL).where('email', '==', cleanEmail).get();
  const hasConflict = existingAgentSnap.docs.some(
    (d: any) => d.data()?.tipo !== 'ia' && d.data()?.estado !== 'arquivado'
  );
  if (hasConflict) {
    throw new Error('Já existe um funcionário de atendimento registado com este endereço de e-mail.');
  }

  if (input.initialPassword) {
    const policy = validatePasswordPolicy(input.initialPassword, cleanEmail);
    if (!policy.valid) {
      throw new Error(policy.errors[0] || 'A palavra-passe inicial não cumpre a política de segurança.');
    }
  }

  // Validate authorized departments subset
  const candidateDepts = Array.from(
    new Set([input.departamento_id, ...(input.departamentos_autorizados || [])].filter(Boolean))
  );
  const allDeptsSnap = await db.collection(DEPARTMENTS_COL).get();
  const validDeptIds = new Set<string>(allDeptsSnap.docs.map((d: any) => d.id));
  const authorizedDepts = candidateDepts.filter((id) => validDeptIds.has(id));
  if (!authorizedDepts.includes(input.departamento_id)) {
    authorizedDepts.unshift(input.departamento_id);
  }

  const id = `supagt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const uid = await provisionOrSyncAuthAccount({
    email: cleanEmail,
    nome: input.nome.trim(),
    tenantId: input.tenant_id || 'global',
    password: input.initialPassword || undefined,
    mustResetPassword: input.mustResetPassword,
    ativo: input.estado === 'activo',
  });

  const permissions = input.permissoes || getDefaultPermissionsForRole(input.funcao);
  const permRecord: SupportPermissionsRecord = {
    id,
    agent_id: id,
    tenant_id: input.tenant_id || 'global',
    funcao: input.funcao,
    permissoes: permissions,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  const agent: SupportAgent = {
    id,
    uid,
    tenant_id: input.tenant_id || 'global',
    tipo: 'humano',
    nome: input.nome.trim(),
    email: cleanEmail,
    departamento_id: input.departamento_id,
    departamento_nome: String(deptData.nome || ''),
    departamentos_autorizados: authorizedDepts,
    funcao: input.funcao,
    estado: input.estado,
    disponibilidade: input.disponibilidade,
    limite_simultaneo: Number(input.limite_simultaneo ?? 10),
    carga_actual: 0,
    horario_atendimento: input.horario_atendimento || buildDefaultWorkingHours(),
    regras_atribuicao: input.regras_atribuicao || buildDefaultAssignmentRules(),
    permissoes: permissions,
    must_reset_password: Boolean(input.initialPassword && input.mustResetPassword),
    credenciais_redefinidas_em: input.initialPassword ? nowIso : null,
    ultimo_acesso: null,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: actor.email || actor.uid,
    updated_by: actor.email || actor.uid,
  };

  const batch = db.batch();
  batch.set(db.collection(AGENTS_COL).doc(id), agent);
  batch.set(db.collection(PERMISSIONS_COL).doc(id), permRecord);
  await batch.commit();

  await saveIdempotentResult('sup_agent_create', input.idempotencyKey, agent);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'support_agent',
    entity_id: id,
    tenant_id: agent.tenant_id,
    after_state: {
      id: agent.id,
      nome: agent.nome,
      email: agent.email,
      funcao: agent.funcao,
      estado: agent.estado,
      departamento_id: agent.departamento_id,
      departamentos_autorizados: agent.departamentos_autorizados,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { agent, idempotent: false };
}

export async function updateSupportAgent(
  id: string,
  input: {
    nome?: string;
    email?: string;
    departamento_id?: string;
    departamentos_autorizados?: string[];
    funcao?: SupportAgentRole;
    estado?: SupportAgentStatus;
    disponibilidade?: SupportAvailability;
    limite_simultaneo?: number;
    horario_atendimento?: SupportWorkingHours;
    regras_atribuicao?: SupportAssignmentRules;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportAgent | null> {
  const db = getFirestoreInstance();
  const ref = db.collection(AGENTS_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const before = await getSupportAgentById(id);
  if (!before) return null;

  const nextEmail = input.email !== undefined ? input.email.trim().toLowerCase() : before.email;
  if (nextEmail !== before.email) {
    const dupSnap = await db.collection(AGENTS_COL).where('email', '==', nextEmail).get();
    const hasConflict = dupSnap.docs.some(
      (d: any) => d.id !== id && d.data()?.tipo !== 'ia' && d.data()?.estado !== 'arquivado'
    );
    if (hasConflict) {
      throw new Error('Outro funcionário já utiliza este endereço de e-mail.');
    }
  }

  let nextDeptId = before.departamento_id;
  let nextDeptNome = before.departamento_nome || '';
  if (input.departamento_id && input.departamento_id !== before.departamento_id) {
    const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.departamento_id).get();
    if (!deptSnap.exists) {
      throw new Error('Departamento principal selecionado não existe.');
    }
    nextDeptId = input.departamento_id;
    nextDeptNome = String(deptSnap.data()?.nome || '');
  }

  let nextAuthorizedDepts = before.departamentos_autorizados;
  if (input.departamentos_autorizados !== undefined || input.departamento_id !== undefined) {
    const rawList = input.departamentos_autorizados !== undefined ? input.departamentos_autorizados : before.departamentos_autorizados;
    nextAuthorizedDepts = Array.from(new Set([nextDeptId, ...rawList].filter(Boolean)));
  }

  const nextFuncao = input.funcao || before.funcao;
  const nextEstado = input.estado || before.estado;
  const nowIso = new Date().toISOString();

  // If role changed and no explicit custom override request, update permission preset for the new role
  let nextPermissions = before.permissoes || getDefaultPermissionsForRole(before.funcao);
  if (input.funcao && input.funcao !== before.funcao) {
    nextPermissions = getDefaultPermissionsForRole(input.funcao);
    await db.collection(PERMISSIONS_COL).doc(id).set(
      {
        id,
        agent_id: id,
        tenant_id: before.tenant_id,
        funcao: nextFuncao,
        permissoes: nextPermissions,
        updated_at: nowIso,
        updated_by: actor.email || actor.uid,
      },
      { merge: true }
    );
  }

  const updated: SupportAgent = {
    ...before,
    id,
    nome: input.nome !== undefined ? input.nome.trim() : before.nome,
    email: nextEmail,
    departamento_id: nextDeptId,
    departamento_nome: nextDeptNome,
    departamentos_autorizados: nextAuthorizedDepts,
    funcao: nextFuncao,
    estado: nextEstado,
    disponibilidade: input.disponibilidade || before.disponibilidade,
    limite_simultaneo:
      input.limite_simultaneo !== undefined ? Number(input.limite_simultaneo) : before.limite_simultaneo,
    horario_atendimento: input.horario_atendimento || before.horario_atendimento,
    regras_atribuicao: input.regras_atribuicao || before.regras_atribuicao,
    permissoes: nextPermissions,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await ref.set(updated, { merge: true });

  if (before.uid) {
    const userDocSnap = await db.collection('users').doc(before.uid).get().catch(() => null);
    const uData = userDocSnap?.exists ? userDocSnap.data() || {} : null;
    const uRole = String(uData?.tipo || uData?.role || '').toLowerCase().trim();
    // Only sync users doc if it belongs to support role (never downgrade super_admin or institutional user)
    if (uData && (uRole === 'suporte' || !uRole)) {
      await db.collection('users').doc(before.uid).set(
        {
          nome: updated.nome,
          email: updated.email,
          ativo: updated.estado === 'activo',
          updated_at: nowIso,
        },
        { merge: true }
      );
      if (updated.estado !== 'activo') {
        await revokeUserSessions(before.uid).catch(() => {});
      }
      invalidateAuthResolutionCache(before.uid);
      invalidateAuthResolutionCache(before.email);
      invalidateAuthResolutionCache(updated.email);
    }
  }

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'update',
    entity: 'support_agent',
    entity_id: id,
    tenant_id: updated.tenant_id,
    before_state: {
      nome: before.nome,
      email: before.email,
      funcao: before.funcao,
      estado: before.estado,
      disponibilidade: before.disponibilidade,
      departamento_id: before.departamento_id,
      departamentos_autorizados: before.departamentos_autorizados,
    },
    after_state: {
      nome: updated.nome,
      email: updated.email,
      funcao: updated.funcao,
      estado: updated.estado,
      disponibilidade: updated.disponibilidade,
      departamento_id: updated.departamento_id,
      departamentos_autorizados: updated.departamentos_autorizados,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return updated;
}

export async function updateSupportAgentStatus(
  id: string,
  estado: SupportAgentStatus,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportAgent | null> {
  return await updateSupportAgent(id, { estado }, actor, meta);
}

export async function updateSupportAgentAvailability(
  id: string,
  disponibilidade: SupportAvailability,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportAgent | null> {
  const db = getFirestoreInstance();
  const ref = db.collection(AGENTS_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const before = snap.data() as SupportAgent;
  const nowIso = new Date().toISOString();
  await ref.set(
    {
      disponibilidade,
      updated_at: nowIso,
      updated_by: actor.email || actor.uid,
    },
    { merge: true }
  );

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'status_change',
    entity: 'support_agent_availability',
    entity_id: id,
    tenant_id: before.tenant_id || 'global',
    before_state: { disponibilidade: before.disponibilidade },
    after_state: { disponibilidade },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return await getSupportAgentById(id);
}

export async function deleteSupportAgent(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ deleted: boolean; conflict?: boolean; error?: string }> {
  const db = getFirestoreInstance();
  const ref = db.collection(AGENTS_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { deleted: false, error: 'Funcionário não encontrado.' };
  }

  const before = snap.data() as SupportAgent;

  // Check if tickets exist assigned to this agent (Fase 3 compatibility)
  const openTicketSnap = await db.collection(TICKETS_COL).where('responsavel_id', '==', id).limit(1).get().catch(() => null);
  if (openTicketSnap && !openTicketSnap.empty) {
    return {
      deleted: false,
      conflict: true,
      error: 'Este funcionário possui solicitações no histórico. Altere o estado para "Arquivado" para preservar a rastreabilidade.',
    };
  }

  const batch = db.batch();
  batch.delete(ref);
  batch.delete(db.collection(PERMISSIONS_COL).doc(id));
  await batch.commit();

  if (before.uid) {
    await db.collection('users').doc(before.uid).set({ ativo: false, updated_at: new Date().toISOString() }, { merge: true }).catch(() => {});
    await revokeUserSessions(before.uid).catch(() => {});
    invalidateAuthResolutionCache(before.uid);
    invalidateAuthResolutionCache(before.email);
  }

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'support_agent',
    entity_id: id,
    tenant_id: before.tenant_id || 'global',
    before_state: { id: before.id, nome: before.nome, email: before.email, funcao: before.funcao },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { deleted: true };
}

export async function getSupportAgentPermissions(agentId: string): Promise<SupportPermissionsRecord | null> {
  const db = getFirestoreInstance();
  const agentSnap = await db.collection(AGENTS_COL).doc(agentId).get();
  if (!agentSnap.exists) return null;

  const agentData = agentSnap.data() || {};
  const permSnap = await db.collection(PERMISSIONS_COL).doc(agentId).get();
  const funcao = (agentData.funcao || 'assistente') as SupportAgentRole;

  if (permSnap.exists) {
    const p = permSnap.data() || {};
    return {
      id: permSnap.id,
      agent_id: agentId,
      tenant_id: String(p.tenant_id || agentData.tenant_id || 'global'),
      funcao: (p.funcao || funcao) as SupportAgentRole,
      permissoes: (p.permissoes || getDefaultPermissionsForRole(funcao)) as SupportPermissionSet,
      updated_at: String(p.updated_at || agentData.updated_at || ''),
      updated_by: String(p.updated_by || ''),
    };
  }

  return {
    id: agentId,
    agent_id: agentId,
    tenant_id: String(agentData.tenant_id || 'global'),
    funcao,
    permissoes: getDefaultPermissionsForRole(funcao),
    updated_at: String(agentData.updated_at || ''),
    updated_by: '',
  };
}

export async function updateSupportAgentPermissions(
  agentId: string,
  input: { funcao?: SupportAgentRole; permissoes: SupportPermissionSet },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportPermissionsRecord | null> {
  const db = getFirestoreInstance();
  const agentRef = db.collection(AGENTS_COL).doc(agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) return null;

  const beforePerm = await getSupportAgentPermissions(agentId);
  const agentData = agentSnap.data() || {};
  const nextFuncao = input.funcao || (agentData.funcao as SupportAgentRole) || 'assistente';
  const nowIso = new Date().toISOString();

  const record: SupportPermissionsRecord = {
    id: agentId,
    agent_id: agentId,
    tenant_id: String(agentData.tenant_id || 'global'),
    funcao: nextFuncao,
    permissoes: input.permissoes,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  const batch = db.batch();
  batch.set(db.collection(PERMISSIONS_COL).doc(agentId), record, { merge: true });
  batch.set(
    agentRef,
    {
      funcao: nextFuncao,
      permissoes: input.permissoes,
      updated_at: nowIso,
      updated_by: actor.email || actor.uid,
    },
    { merge: true }
  );
  await batch.commit();

  if (agentData.uid) invalidateAuthResolutionCache(String(agentData.uid));
  if (agentData.email) invalidateAuthResolutionCache(String(agentData.email));

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'permission_change',
    entity: 'support_permissions',
    entity_id: agentId,
    tenant_id: record.tenant_id,
    before_state: beforePerm ? { funcao: beforePerm.funcao, permissoes: beforePerm.permissoes } : undefined,
    after_state: { funcao: record.funcao, permissoes: record.permissoes },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return record;
}

export async function resetSupportAgentCredentials(
  agentId: string,
  input: {
    newPassword: string;
    mustResetPassword: boolean;
    revokeActiveSessions: boolean;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; credenciais_redefinidas_em: string; uid: string } | null> {
  const db = getFirestoreInstance();
  const agentRef = db.collection(AGENTS_COL).doc(agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) return null;

  const agentData = agentSnap.data() as SupportAgent;
  const policy = validatePasswordPolicy(input.newPassword, agentData.email);
  if (!policy.valid) {
    throw new Error(policy.errors[0] || 'A nova palavra-passe não cumpre a política de segurança.');
  }

  const uid = await provisionOrSyncAuthAccount({
    email: agentData.email,
    nome: agentData.nome,
    tenantId: agentData.tenant_id || 'global',
    password: input.newPassword,
    mustResetPassword: input.mustResetPassword,
    ativo: agentData.estado === 'activo',
    existingUid: agentData.uid,
  });

  const nowIso = new Date().toISOString();
  await agentRef.set(
    {
      uid,
      must_reset_password: Boolean(input.mustResetPassword),
      credenciais_redefinidas_em: nowIso,
      updated_at: nowIso,
      updated_by: actor.email || actor.uid,
    },
    { merge: true }
  );

  if (input.revokeActiveSessions) {
    await revokeUserSessions(uid).catch(() => {});
    try {
      const admin = getFirebaseAdminInstance();
      await getAuth(admin).revokeRefreshTokens(uid);
    } catch {}
  }
  invalidateAuthResolutionCache(uid);
  invalidateAuthResolutionCache(agentData.email);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'password_reset',
    entity: 'support_agent',
    entity_id: agentId,
    tenant_id: agentData.tenant_id || 'global',
    metadata: {
      targetEmail: agentData.email,
      mustResetPassword: Boolean(input.mustResetPassword),
      sessionsRevoked: Boolean(input.revokeActiveSessions),
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return {
    success: true,
    credenciais_redefinidas_em: nowIso,
    uid,
  };
}

export async function getSupportAgentHistory(agentId: string): Promise<SupportAgentHistoryEntry[]> {
  const db = getFirestoreInstance();
  const agentSnap = await db.collection(AGENTS_COL).doc(agentId).get();
  if (!agentSnap.exists) return [];
  const agent = agentSnap.data() as SupportAgent;

  const [ticketsSnap, assignmentsSnap, auditSnap] = await Promise.all([
    db.collection(TICKETS_COL).where('responsavel_id', '==', agentId).limit(50).get().catch(() => null),
    db.collection(ASSIGNMENTS_COL).where('agent_id', '==', agentId).limit(50).get().catch(() => null),
    db.collection(AUDIT_COL).where('entity_id', '==', agentId).limit(50).get().catch(() => null),
  ]);

  const entries: SupportAgentHistoryEntry[] = [];

  if (ticketsSnap && !ticketsSnap.empty) {
    for (const d of ticketsSnap.docs) {
      const t = d.data() || {};
      entries.push({
        id: `t_${d.id}`,
        origem: 'ticket',
        titulo: String(t.assunto || `Solicitação ${d.id}`),
        detalhe: `Categoria: ${t.categoria || 'Geral'} · Prioridade: ${t.prioridade || 'normal'}`,
        estado: String(t.estado || 'aberto'),
        tenant_id: String(t.tenant_id || agent.tenant_id || 'global'),
        data: String(t.ultima_interacao || t.updated_at || t.created_at || ''),
      });
    }
  }

  if (assignmentsSnap && !assignmentsSnap.empty) {
    for (const d of assignmentsSnap.docs) {
      const a = d.data() || {};
      entries.push({
        id: `asg_${d.id}`,
        origem: 'atribuicao',
        titulo: `Atribuição ${a.ticket_id ? `#${a.ticket_id}` : ''}`,
        detalhe: String(a.motivo || a.tipo || 'Solicitação atribuída ao funcionário'),
        estado: String(a.estado || 'activo'),
        tenant_id: String(a.tenant_id || agent.tenant_id || 'global'),
        data: String(a.created_at || ''),
      });
    }
  }

  if (auditSnap && !auditSnap.empty) {
    for (const d of auditSnap.docs) {
      const l = d.data() || {};
      entries.push({
        id: `aud_${d.id}`,
        origem: 'auditoria',
        titulo: `Auditoria: ${String(l.action || 'alteracao')}`,
        detalhe: `Entidade ${String(l.entity || 'support_agent')} por ${String(l.actor_email || l.actor_id || 'sistema')}`,
        tenant_id: String(l.tenant_id || agent.tenant_id || 'global'),
        data: String(l.timestamp || l.created_at || ''),
        actor_email: String(l.actor_email || ''),
      });
    }
  }

  entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return entries.slice(0, 60);
}

// ============================================================================
// VISÃO GERAL REAL DA EQUIPA (FASE 2)
// ============================================================================

export async function getSupportTeamOverview(tenantId?: string): Promise<SupportTeamOverviewStats> {
  const db = getFirestoreInstance();
  const [deptSnap, agentSnap] = await Promise.all([
    db.collection(DEPARTMENTS_COL).get(),
    db.collection(AGENTS_COL).get(),
  ]);

  const departments = deptSnap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((d: any) => !tenantId || d.tenant_id === tenantId || d.tenant_id === 'global');

  const deptNameMap = new Map<string, string>();
  const deptBuckets = new Map<
    string,
    { departamento_id: string; nome: string; total_membros: number; online: number; capacidade: number }
  >();

  for (const d of departments) {
    const nome = String(d.nome || '');
    deptNameMap.set(d.id, nome);
    deptBuckets.set(d.id, {
      departamento_id: d.id,
      nome,
      total_membros: 0,
      online: 0,
      capacidade: 0,
    });
  }

  const mappedAgents = agentSnap.docs.map((d: any) => mapAgentDoc(d.id, d.data() || {}, deptNameMap));
  const aiAgentsCount = mappedAgents.filter(
    (a: SupportAgent) =>
      a.tipo === 'ia' &&
      a.estado !== 'arquivado' &&
      (!tenantId || a.tenant_id === tenantId || a.tenant_id === 'global')
  ).length;

  const agents = mappedAgents
    .filter((a: SupportAgent) => a.tipo === 'humano')
    .filter((a: SupportAgent) => !tenantId || a.tenant_id === tenantId || a.tenant_id === 'global');

  let activos = 0;
  let inactivos = 0;
  let suspensos = 0;
  let arquivados = 0;
  let online = 0;
  let ocupado = 0;
  let offline = 0;
  let capacidadeTotalSimultanea = 0;
  let cargaActualTotal = 0;
  const porFuncao = { administrador: 0, supervisor: 0, assistente: 0 };

  for (const a of agents) {
    if (a.estado === 'activo') activos += 1;
    else if (a.estado === 'inactivo') inactivos += 1;
    else if (a.estado === 'suspenso') suspensos += 1;
    else if (a.estado === 'arquivado') arquivados += 1;

    if (a.estado !== 'arquivado') {
      if (a.disponibilidade === 'online') online += 1;
      else if (a.disponibilidade === 'ocupado') ocupado += 1;
      else offline += 1;
    }

    if (a.estado === 'activo') {
      capacidadeTotalSimultanea += Number(a.limite_simultaneo || 0);
      cargaActualTotal += Number(a.carga_actual || 0);
    }

    if (a.funcao === 'administrador') porFuncao.administrador += 1;
    else if (a.funcao === 'supervisor') porFuncao.supervisor += 1;
    else porFuncao.assistente += 1;

    if (a.estado !== 'arquivado') {
      const uniqueDeptIds = Array.from(
        new Set([a.departamento_id, ...(a.departamentos_autorizados || [])].filter(Boolean))
      );
      if (uniqueDeptIds.length === 0) {
        uniqueDeptIds.push('sem_departamento');
      }
      for (const did of uniqueDeptIds) {
        const bucket = deptBuckets.get(did) || {
          departamento_id: did,
          nome: deptNameMap.get(did) || (did === a.departamento_id ? a.departamento_nome : '') || 'Sem departamento',
          total_membros: 0,
          online: 0,
          capacidade: 0,
        };
        bucket.total_membros += 1;
        if (a.estado === 'activo' && a.disponibilidade === 'online') bucket.online += 1;
        if (a.estado === 'activo') bucket.capacidade += Number(a.limite_simultaneo || 0);
        deptBuckets.set(bucket.departamento_id, bucket);
      }
    }
  }

  return {
    totalFuncionarios: agents.length,
    totalAgentesIa: aiAgentsCount,
    activos,
    inactivos,
    suspensos,
    arquivados,
    online,
    ocupado,
    offline,
    totalDepartamentos: departments.length,
    departamentosActivos: departments.filter((d: any) => d.ativo !== false).length,
    capacidadeTotalSimultanea,
    cargaActualTotal,
    porFuncao,
    porDepartamento: Array.from(deptBuckets.values()).sort((a, b) => b.total_membros - a.total_membros),
  };
}
