/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Distribuição Automática, Balanceamento de Filas e Reencaminhamento SLA (Fase 5)
 * - CRUD de regras de distribuição por prioridade/ordem, condições e tenant_id
 * - Avaliação determinística de elegibilidade: estado activo, departamento autorizado,
 *   disponibilidade (online/ocupado), capacidade simultânea e horário de atendimento por fuso horário
 * - Estratégias: ia_primeiro (com execução IA e fallback humano), round_robin persistido,
 *   menor_carga, especialidade e fila_departamento
 * - Simulador dry-run sem escrita na BD e balanceador manual/SLA de filas em lote
 */

import crypto from 'crypto';
import { AuthenticatedUser, getFirestoreInstance } from '../middleware/auth';
import { recordAuditLog } from '../security/audit';
import { listSupportDepartments } from './supportTeamService';
import type {
  SupportAgent,
  SupportAvailability,
  SupportDepartment,
  SupportDistributionCandidateCheck,
  SupportDistributionConditions,
  SupportDistributionExecutionResult,
  SupportDistributionOverview,
  SupportDistributionRebalanceResult,
  SupportDistributionRule,
  SupportDistributionSimulationResult,
  SupportDistributionStrategy,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportWeekday,
  SupportWorkingHours,
} from '../../src/types';

const RULES_COL = 'support_distribution_rules';
const DEPARTMENTS_COL = 'support_departments';
const AGENTS_COL = 'support_agents';
const AI_CONFIGS_COL = 'ai_agent_configs';
const TICKETS_COL = 'support_tickets';
const MESSAGES_COL = 'support_messages';
const ASSIGNMENTS_COL = 'support_assignments';
const EVENTS_COL = 'support_events';
const NOTIFICATIONS_COL = 'notificacoes';
const IDEMPOTENCY_COL = 'idempotency_keys';

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

async function recalculateAgentLoadSafe(agentId?: string | null): Promise<void> {
  if (!agentId) return;
  try {
    const db = getFirestoreInstance();
    const agentRef = db.collection(AGENTS_COL).doc(agentId);
    const snap = await agentRef.get();
    if (!snap.exists) return;

    const ticketsSnap = await db.collection(TICKETS_COL).where('responsavel_id', '==', agentId).get();
    let count = 0;
    for (const d of ticketsSnap.docs) {
      if (String(d.data()?.estado || '') !== 'resolvido') {
        count += 1;
      }
    }
    await agentRef.update({ carga_actual: count, updated_at: new Date().toISOString() });
  } catch {}
}

function sanitizeConditions(raw?: Partial<SupportDistributionConditions>): SupportDistributionConditions {
  return {
    categorias: Array.isArray(raw?.categorias)
      ? Array.from(new Set(raw.categorias.map((c) => String(c).trim()).filter(Boolean)))
      : [],
    prioridades: Array.isArray(raw?.prioridades)
      ? Array.from(new Set(raw.prioridades.filter(Boolean))) as SupportTicketPriority[]
      : [],
    canais: Array.isArray(raw?.canais)
      ? Array.from(new Set(raw.canais.filter(Boolean))) as Array<'portal' | 'superadmin' | 'ia'>
      : [],
    departamentos_origem: Array.isArray(raw?.departamentos_origem)
      ? Array.from(new Set(raw.departamentos_origem.map((d) => String(d).trim()).filter(Boolean)))
      : [],
    palavras_chave: Array.isArray(raw?.palavras_chave)
      ? Array.from(new Set(raw.palavras_chave.map((k) => String(k).trim().toLowerCase()).filter(Boolean)))
      : [],
  };
}

function mapRuleDoc(
  id: string,
  data: any,
  deptNames?: Map<string, string>,
  agentNames?: Map<string, string>
): SupportDistributionRule {
  const destDeptId = String(data.destino_departamento_id || '');
  const destAgentId = data.destino_agent_id ? String(data.destino_agent_id) : null;
  return {
    id,
    tenant_id: String(data.tenant_id || 'global'),
    nome: String(data.nome || ''),
    descricao: String(data.descricao || ''),
    ativo: data.ativo !== false,
    ordem: Number(data.ordem ?? 10),
    condicoes: sanitizeConditions(data.condicoes),
    metodo: (data.metodo || 'menor_carga') as SupportDistributionStrategy,
    destino_departamento_id: destDeptId,
    destino_departamento_nome: deptNames?.get(destDeptId) || String(data.destino_departamento_nome || ''),
    destino_agent_id: destAgentId,
    destino_agent_nome: destAgentId ? agentNames?.get(destAgentId) || data.destino_agent_nome || null : null,
    auto_executar_ia: data.auto_executar_ia !== false,
    escalonar_para_humano_se_ia_falhar: data.escalonar_para_humano_se_ia_falhar !== false,
    respeitar_horario_atendimento: data.respeitar_horario_atendimento !== false,
    exigir_disponibilidade_online: data.exigir_disponibilidade_online !== false,
    permitir_ocupado_se_sem_online: Boolean(data.permitir_ocupado_se_sem_online),
    ultimo_agent_id: data.ultimo_agent_id ? String(data.ultimo_agent_id) : null,
    total_atribuicoes: Number(data.total_atribuicoes ?? 0),
    ultima_execucao_em: data.ultima_execucao_em || null,
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    created_by: String(data.created_by || ''),
    updated_by: String(data.updated_by || ''),
  };
}

// ============================================================================
// CRUD DE REGRAS DE DISTRIBUIÇÃO
// ============================================================================

export async function listDistributionRules(filters?: {
  tenant_id?: string;
  ativo?: boolean;
  q?: string;
}): Promise<SupportDistributionRule[]> {
  const db = getFirestoreInstance();
  const [rulesSnap, deptsSnap, agentsSnap] = await Promise.all([
    db.collection(RULES_COL).get(),
    db.collection(DEPARTMENTS_COL).get(),
    db.collection(AGENTS_COL).get(),
  ]);

  const deptNames = new Map<string, string>();
  for (const d of deptsSnap.docs) deptNames.set(d.id, String(d.data()?.nome || ''));

  const agentNames = new Map<string, string>();
  for (const a of agentsSnap.docs) agentNames.set(a.id, String(a.data()?.nome || ''));

  let rules = rulesSnap.docs.map((d: any) => mapRuleDoc(d.id, d.data() || {}, deptNames, agentNames));

  if (filters?.tenant_id && filters.tenant_id !== 'todos') {
    rules = rules.filter((r) => r.tenant_id === filters.tenant_id || r.tenant_id === 'global');
  }
  if (typeof filters?.ativo === 'boolean') {
    rules = rules.filter((r) => r.ativo === filters.ativo);
  }
  if (filters?.q && filters.q.trim()) {
    const needle = normalizeText(filters.q);
    rules = rules.filter((r) => {
      const hay = normalizeText(
        `${r.nome} ${r.descricao || ''} ${r.destino_departamento_nome || ''} ${r.metodo} ${r.condicoes.categorias.join(' ')} ${r.condicoes.palavras_chave.join(' ')}`
      );
      return hay.includes(needle);
    });
  }

  rules.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
  return rules;
}

export async function getDistributionRuleById(id: string): Promise<SupportDistributionRule | null> {
  const db = getFirestoreInstance();
  const snap = await db.collection(RULES_COL).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const [deptSnap, agentSnap] = await Promise.all([
    data.destino_departamento_id
      ? db.collection(DEPARTMENTS_COL).doc(String(data.destino_departamento_id)).get().catch(() => null)
      : Promise.resolve(null),
    data.destino_agent_id
      ? db.collection(AGENTS_COL).doc(String(data.destino_agent_id)).get().catch(() => null)
      : Promise.resolve(null),
  ]);
  const deptNames = new Map<string, string>();
  if (deptSnap?.exists) deptNames.set(deptSnap.id, String(deptSnap.data()?.nome || ''));
  const agentNames = new Map<string, string>();
  if (agentSnap?.exists) agentNames.set(agentSnap.id, String(agentSnap.data()?.nome || ''));

  return mapRuleDoc(snap.id, data, deptNames, agentNames);
}

export async function createDistributionRule(
  input: {
    tenant_id?: string;
    nome: string;
    descricao?: string;
    ativo?: boolean;
    ordem?: number;
    condicoes?: Partial<SupportDistributionConditions>;
    metodo: SupportDistributionStrategy;
    destino_departamento_id: string;
    destino_agent_id?: string | null;
    auto_executar_ia?: boolean;
    escalonar_para_humano_se_ia_falhar?: boolean;
    respeitar_horario_atendimento?: boolean;
    exigir_disponibilidade_online?: boolean;
    permitir_ocupado_se_sem_online?: boolean;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ rule: SupportDistributionRule; idempotent: boolean }> {
  const idem = await getIdempotentResult<SupportDistributionRule>('sup_dist_rule_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { rule: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.destino_departamento_id).get();
  if (!deptSnap.exists) {
    throw new Error('Departamento de destino seleccionado não existe.');
  }
  const deptNome = String(deptSnap.data()?.nome || '');

  let agentId: string | null = null;
  let agentNome: string | null = null;
  if (input.destino_agent_id) {
    const aSnap = await db.collection(AGENTS_COL).doc(input.destino_agent_id).get();
    if (!aSnap.exists) {
      throw new Error('Agente/funcionário especificado na regra não encontrado.');
    }
    agentId = aSnap.id;
    agentNome = String(aSnap.data()?.nome || '');
  }

  const id = `supdist_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const rule: SupportDistributionRule = {
    id,
    tenant_id: (input.tenant_id || 'global').trim(),
    nome: input.nome.trim(),
    descricao: (input.descricao || '').trim(),
    ativo: input.ativo !== false,
    ordem: Number(input.ordem ?? 10),
    condicoes: sanitizeConditions(input.condicoes),
    metodo: input.metodo,
    destino_departamento_id: deptSnap.id,
    destino_departamento_nome: deptNome,
    destino_agent_id: agentId,
    destino_agent_nome: agentNome,
    auto_executar_ia: input.auto_executar_ia !== false,
    escalonar_para_humano_se_ia_falhar: input.escalonar_para_humano_se_ia_falhar !== false,
    respeitar_horario_atendimento: input.respeitar_horario_atendimento !== false,
    exigir_disponibilidade_online: input.exigir_disponibilidade_online !== false,
    permitir_ocupado_se_sem_online: Boolean(input.permitir_ocupado_se_sem_online),
    ultimo_agent_id: null,
    total_atribuicoes: 0,
    ultima_execucao_em: null,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: actor.email || actor.uid,
    updated_by: actor.email || actor.uid,
  };

  await db.collection(RULES_COL).doc(id).set(rule);
  await saveIdempotentResult('sup_dist_rule_create', input.idempotencyKey, rule);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'support_distribution_rule',
    entity_id: id,
    tenant_id: rule.tenant_id,
    after_state: {
      nome: rule.nome,
      metodo: rule.metodo,
      ordem: rule.ordem,
      destino_departamento_id: rule.destino_departamento_id,
      ativo: rule.ativo,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { rule, idempotent: false };
}

export async function updateDistributionRule(
  id: string,
  input: Partial<{
    nome: string;
    descricao: string;
    ativo: boolean;
    ordem: number;
    condicoes: Partial<SupportDistributionConditions>;
    metodo: SupportDistributionStrategy;
    destino_departamento_id: string;
    destino_agent_id: string | null;
    auto_executar_ia: boolean;
    escalonar_para_humano_se_ia_falhar: boolean;
    respeitar_horario_atendimento: boolean;
    exigir_disponibilidade_online: boolean;
    permitir_ocupado_se_sem_online: boolean;
  }>,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportDistributionRule | null> {
  const existing = await getDistributionRuleById(id);
  if (!existing) return null;

  const db = getFirestoreInstance();
  let nextDeptId = existing.destino_departamento_id;
  let nextDeptNome = existing.destino_departamento_nome || '';
  if (input.destino_departamento_id && input.destino_departamento_id !== existing.destino_departamento_id) {
    const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.destino_departamento_id).get();
    if (!deptSnap.exists) {
      throw new Error('Departamento de destino seleccionado não existe.');
    }
    nextDeptId = deptSnap.id;
    nextDeptNome = String(deptSnap.data()?.nome || '');
  }

  let nextAgentId = existing.destino_agent_id ?? null;
  let nextAgentNome = existing.destino_agent_nome ?? null;
  if (input.destino_agent_id !== undefined) {
    if (!input.destino_agent_id) {
      nextAgentId = null;
      nextAgentNome = null;
    } else {
      const aSnap = await db.collection(AGENTS_COL).doc(input.destino_agent_id).get();
      if (!aSnap.exists) {
        throw new Error('Agente/funcionário especificado não encontrado.');
      }
      nextAgentId = aSnap.id;
      nextAgentNome = String(aSnap.data()?.nome || '');
    }
  }

  const nowIso = new Date().toISOString();
  const updated: SupportDistributionRule = {
    ...existing,
    id,
    nome: input.nome !== undefined ? input.nome.trim() : existing.nome,
    descricao: input.descricao !== undefined ? input.descricao.trim() : existing.descricao,
    ativo: input.ativo !== undefined ? Boolean(input.ativo) : existing.ativo,
    ordem: input.ordem !== undefined ? Number(input.ordem) : existing.ordem,
    condicoes: input.condicoes !== undefined ? sanitizeConditions(input.condicoes) : existing.condicoes,
    metodo: input.metodo || existing.metodo,
    destino_departamento_id: nextDeptId,
    destino_departamento_nome: nextDeptNome,
    destino_agent_id: nextAgentId,
    destino_agent_nome: nextAgentNome,
    auto_executar_ia:
      input.auto_executar_ia !== undefined ? Boolean(input.auto_executar_ia) : existing.auto_executar_ia,
    escalonar_para_humano_se_ia_falhar:
      input.escalonar_para_humano_se_ia_falhar !== undefined
        ? Boolean(input.escalonar_para_humano_se_ia_falhar)
        : existing.escalonar_para_humano_se_ia_falhar,
    respeitar_horario_atendimento:
      input.respeitar_horario_atendimento !== undefined
        ? Boolean(input.respeitar_horario_atendimento)
        : existing.respeitar_horario_atendimento,
    exigir_disponibilidade_online:
      input.exigir_disponibilidade_online !== undefined
        ? Boolean(input.exigir_disponibilidade_online)
        : existing.exigir_disponibilidade_online,
    permitir_ocupado_se_sem_online:
      input.permitir_ocupado_se_sem_online !== undefined
        ? Boolean(input.permitir_ocupado_se_sem_online)
        : existing.permitir_ocupado_se_sem_online,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await db.collection(RULES_COL).doc(id).set(updated, { merge: true });

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'update',
    entity: 'support_distribution_rule',
    entity_id: id,
    tenant_id: updated.tenant_id,
    before_state: {
      nome: existing.nome,
      ativo: existing.ativo,
      ordem: existing.ordem,
      metodo: existing.metodo,
      destino_departamento_id: existing.destino_departamento_id,
    },
    after_state: {
      nome: updated.nome,
      ativo: updated.ativo,
      ordem: updated.ordem,
      metodo: updated.metodo,
      destino_departamento_id: updated.destino_departamento_id,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return updated;
}

export async function deleteDistributionRule(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ deleted: boolean; error?: string }> {
  const existing = await getDistributionRuleById(id);
  if (!existing) {
    return { deleted: false, error: 'Regra de distribuição não encontrada.' };
  }

  const db = getFirestoreInstance();
  await db.collection(RULES_COL).doc(id).delete();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'support_distribution_rule',
    entity_id: id,
    tenant_id: existing.tenant_id,
    before_state: { id: existing.id, nome: existing.nome, metodo: existing.metodo },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { deleted: true };
}

// ============================================================================
// MOTOR DE AVALIAÇÃO DE HORÁRIOS, CONDIÇÕES E CANDIDATOS
// ============================================================================

const WEEKDAY_EN_TO_PT: Record<string, SupportWeekday> = {
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
  Sun: 'dom',
};

export function isWithinWorkingHours(horario?: SupportWorkingHours | null, nowDate: Date = new Date()): boolean {
  if (!horario || horario.ativo === false || !Array.isArray(horario.dias) || horario.dias.length === 0) {
    return true;
  }

  const tz = horario.timezone || 'Africa/Maputo';
  let weekdayPt: SupportWeekday = 'seg';
  let currentHHMM = '09:00';

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(nowDate);

    const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    let hh = parts.find((p) => p.type === 'hour')?.value || '09';
    const mm = parts.find((p) => p.type === 'minute')?.value || '00';
    if (hh === '24') hh = '00';
    weekdayPt = WEEKDAY_EN_TO_PT[wd] || 'seg';
    currentHHMM = `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  } catch {
    const dayIdx = nowDate.getUTCDay();
    const mapIdx: SupportWeekday[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    weekdayPt = mapIdx[dayIdx] || 'seg';
    currentHHMM = `${String(nowDate.getUTCHours()).padStart(2, '0')}:${String(nowDate.getUTCMinutes()).padStart(2, '0')}`;
  }

  const dayCfg = horario.dias.find((d) => d.dia === weekdayPt);
  if (!dayCfg) return true;
  if (!dayCfg.ativo) return false;

  const start = String(dayCfg.inicio || '00:00');
  const end = String(dayCfg.fim || '23:59');
  if (end >= start) {
    return currentHHMM >= start && currentHHMM <= end;
  }
  // Overnight shift support
  return currentHHMM >= start || currentHHMM <= end;
}

export function doesRuleMatchTicket(
  rule: SupportDistributionRule,
  ticket: {
    tenant_id: string;
    categoria: string;
    prioridade: SupportTicketPriority;
    canal: 'portal' | 'superadmin' | 'ia';
    departamento_id: string;
    assunto: string;
  },
  messageText = ''
): boolean {
  if (!rule.ativo) return false;
  if (rule.tenant_id !== 'global' && rule.tenant_id !== ticket.tenant_id) {
    return false;
  }

  const cond = rule.condicoes || {
    categorias: [],
    prioridades: [],
    canais: [],
    departamentos_origem: [],
    palavras_chave: [],
  };

  if (cond.categorias.length > 0) {
    const tCat = normalizeText(ticket.categoria);
    if (!cond.categorias.some((c) => normalizeText(c) === tCat)) return false;
  }

  if (cond.prioridades.length > 0) {
    if (!cond.prioridades.includes(ticket.prioridade)) return false;
  }

  if (cond.canais.length > 0) {
    if (!cond.canais.includes(ticket.canal)) return false;
  }

  if (cond.departamentos_origem.length > 0) {
    if (!cond.departamentos_origem.includes(ticket.departamento_id)) return false;
  }

  if (cond.palavras_chave.length > 0) {
    const haystack = normalizeText(`${ticket.assunto} ${messageText}`);
    const hasKw = cond.palavras_chave.some((kw) => haystack.includes(normalizeText(kw)));
    if (!hasKw) return false;
  }

  return true;
}

function mapRawAgent(id: string, d: any): SupportAgent {
  const deptId = String(d.departamento_id || '');
  const authDepts = Array.isArray(d.departamentos_autorizados)
    ? Array.from(new Set([deptId, ...d.departamentos_autorizados.map(String)].filter(Boolean)))
    : deptId
    ? [deptId]
    : [];
  return {
    id,
    uid: d.uid ? String(d.uid) : undefined,
    tenant_id: String(d.tenant_id || 'global'),
    tipo: d.tipo === 'ia' ? 'ia' : 'humano',
    nome: String(d.nome || ''),
    email: String(d.email || '').toLowerCase(),
    departamento_id: deptId,
    departamento_nome: String(d.departamento_nome || ''),
    departamentos_autorizados: authDepts,
    funcao: d.funcao || 'assistente',
    estado: d.estado || 'activo',
    disponibilidade: (d.disponibilidade || 'offline') as SupportAvailability,
    limite_simultaneo: Number(d.limite_simultaneo ?? 10),
    carga_actual: Number(d.carga_actual ?? 0),
    horario_atendimento: d.horario_atendimento || { ativo: false, timezone: 'Africa/Maputo', dias: [] },
    regras_atribuicao: d.regras_atribuicao || {
      auto_atribuir: true,
      apenas_horario: true,
      prioridade_atribuicao: 50,
      categorias_especialidade: [],
    },
    created_at: String(d.created_at || ''),
    updated_at: String(d.updated_at || ''),
    created_by: String(d.created_by || ''),
    updated_by: String(d.updated_by || ''),
  };
}

interface SelectionPlan {
  departamentoId: string;
  departamentoNome: string;
  selectedAgent: SupportAgent | null;
  reason: string;
  candidatesChecked: SupportDistributionCandidateCheck[];
}

async function computeSelectionPlan(params: {
  rule: {
    metodo: SupportDistributionStrategy;
    destino_departamento_id: string;
    destino_agent_id?: string | null;
    escalonar_para_humano_se_ia_falhar: boolean;
    respeitar_horario_atendimento: boolean;
    exigir_disponibilidade_online: boolean;
    permitir_ocupado_se_sem_online: boolean;
    ultimo_agent_id?: string | null;
  };
  ticket: {
    tenant_id: string;
    categoria: string;
    departamento_id: string;
    departamento_nome?: string;
  };
  nowDate?: Date;
}): Promise<SelectionPlan> {
  const db = getFirestoreInstance();
  const { rule, ticket } = params;
  const nowDate = params.nowDate || new Date();

  const [deptSnap, agentsSnap, aiCfgSnap] = await Promise.all([
    rule.destino_departamento_id
      ? db.collection(DEPARTMENTS_COL).doc(rule.destino_departamento_id).get().catch(() => null)
      : Promise.resolve(null),
    db.collection(AGENTS_COL).get(),
    db.collection(AI_CONFIGS_COL).get(),
  ]);

  const deptActive = deptSnap?.exists && deptSnap.data()?.ativo !== false;
  const targetDeptId = deptActive ? deptSnap!.id : ticket.departamento_id;
  const targetDeptNome = deptActive
    ? String(deptSnap!.data()?.nome || targetDeptId)
    : ticket.departamento_nome || targetDeptId;

  const allAgents = agentsSnap.docs.map((d: any) => mapRawAgent(d.id, d.data() || {}));
  const aiConfigMap = new Map<string, any>();
  for (const c of aiCfgSnap.docs) aiConfigMap.set(c.id, c.data() || {});

  const candidatesChecked: SupportDistributionCandidateCheck[] = [];

  // Helper to evaluate human staff eligibility
  const pickHuman = (strategy: 'round_robin' | 'menor_carga' | 'especialidade'): SupportAgent | null => {
    const humanAgents = allAgents.filter((a) => a.tipo === 'humano');
    const primaryEligible: SupportAgent[] = [];
    const busyEligible: SupportAgent[] = [];

    for (const ag of humanAgents) {
      let exclusion = '';
      if (ag.estado !== 'activo') {
        exclusion = `Estado actual "${ag.estado}"`;
      } else if (ag.tenant_id !== 'global' && ag.tenant_id !== ticket.tenant_id) {
        exclusion = 'Pertence a outra instituição';
      } else if (ag.departamento_id !== targetDeptId && !ag.departamentos_autorizados.includes(targetDeptId)) {
        exclusion = 'Não pertence à fila de destino';
      } else if (ag.regras_atribuicao?.auto_atribuir === false) {
        exclusion = 'Auto-atribuição desactivada no perfil';
      } else if (ag.carga_actual >= ag.limite_simultaneo) {
        exclusion = `Capacidade máxima atingida (${ag.carga_actual}/${ag.limite_simultaneo})`;
      } else if (
        rule.respeitar_horario_atendimento &&
        ag.regras_atribuicao?.apenas_horario !== false &&
        !isWithinWorkingHours(ag.horario_atendimento, nowDate)
      ) {
        exclusion = 'Fora do horário de atendimento';
      } else if (rule.exigir_disponibilidade_online) {
        if (ag.disponibilidade === 'online') {
          primaryEligible.push(ag);
        } else if (ag.disponibilidade === 'ocupado' && rule.permitir_ocupado_se_sem_online) {
          busyEligible.push(ag);
        } else {
          exclusion = `Disponibilidade actual "${ag.disponibilidade}"`;
        }
      } else {
        primaryEligible.push(ag);
      }

      const eligible = !exclusion && (ag.disponibilidade === 'online' || !rule.exigir_disponibilidade_online || busyEligible.includes(ag));
      candidatesChecked.push({
        agent_id: ag.id,
        nome: ag.nome,
        tipo: 'humano',
        elegivel: eligible,
        motivo_exclusao: exclusion || undefined,
        carga_actual: ag.carga_actual,
        limite_simultaneo: ag.limite_simultaneo,
        disponibilidade: ag.disponibilidade,
      });
    }

    const pool = primaryEligible.length > 0 ? primaryEligible : busyEligible;
    if (pool.length === 0) return null;

    if (rule.destino_agent_id) {
      const pinned = pool.find((a) => a.id === rule.destino_agent_id);
      if (pinned) return pinned;
    }

    if (strategy === 'round_robin') {
      const ordered = [...pool].sort((a, b) => a.id.localeCompare(b.id));
      if (!rule.ultimo_agent_id) return ordered[0];
      const idx = ordered.findIndex((a) => a.id === rule.ultimo_agent_id);
      return idx >= 0 ? ordered[(idx + 1) % ordered.length] : ordered[0];
    }

    if (strategy === 'especialidade') {
      const catNorm = normalizeText(ticket.categoria);
      const specialists = pool.filter((a) =>
        (a.regras_atribuicao?.categorias_especialidade || []).some((sp) => normalizeText(sp) === catNorm)
      );
      const activePool = specialists.length > 0 ? specialists : pool;
      activePool.sort((a, b) => {
        const ratioA = a.carga_actual / Math.max(1, a.limite_simultaneo);
        const ratioB = b.carga_actual / Math.max(1, b.limite_simultaneo);
        if (ratioA !== ratioB) return ratioA - ratioB;
        if (a.carga_actual !== b.carga_actual) return a.carga_actual - b.carga_actual;
        const priA = Number(a.regras_atribuicao?.prioridade_atribuicao ?? 50);
        const priB = Number(b.regras_atribuicao?.prioridade_atribuicao ?? 50);
        if (priA !== priB) return priB - priA;
        return a.nome.localeCompare(b.nome, 'pt');
      });
      return activePool[0];
    }

    // Default: menor_carga
    const sorted = [...pool].sort((a, b) => {
      const ratioA = a.carga_actual / Math.max(1, a.limite_simultaneo);
      const ratioB = b.carga_actual / Math.max(1, b.limite_simultaneo);
      if (ratioA !== ratioB) return ratioA - ratioB;
      if (a.carga_actual !== b.carga_actual) return a.carga_actual - b.carga_actual;
      const priA = Number(a.regras_atribuicao?.prioridade_atribuicao ?? 50);
      const priB = Number(b.regras_atribuicao?.prioridade_atribuicao ?? 50);
      if (priA !== priB) return priB - priA;
      return a.nome.localeCompare(b.nome, 'pt');
    });
    return sorted[0];
  };

  if (rule.metodo === 'fila_departamento') {
    if (rule.destino_agent_id) {
      const specific = allAgents.find((a) => a.id === rule.destino_agent_id && a.estado === 'activo');
      if (specific && specific.carga_actual < specific.limite_simultaneo) {
        return {
          departamentoId: targetDeptId,
          departamentoNome: targetDeptNome,
          selectedAgent: specific,
          reason: `Encaminhado para fila ${targetDeptNome} e atribuído ao responsável definido (${specific.nome}).`,
          candidatesChecked,
        };
      }
    }
    return {
      departamentoId: targetDeptId,
      departamentoNome: targetDeptNome,
      selectedAgent: null,
      reason: `Encaminhado directamente para a fila ${targetDeptNome} (aguarda recolha da equipa).`,
      candidatesChecked,
    };
  }

  if (rule.metodo === 'ia_primeiro') {
    const aiAgents = allAgents.filter((a) => a.tipo === 'ia');
    const eligibleAi: SupportAgent[] = [];

    for (const ia of aiAgents) {
      let exclusion = '';
      if (ia.estado !== 'activo') {
        exclusion = `Agente IA "${ia.estado}"`;
      } else if (ia.tenant_id !== 'global' && ia.tenant_id !== ticket.tenant_id) {
        exclusion = 'Pertence a outra instituição';
      } else if (ia.departamento_id !== targetDeptId && !ia.departamentos_autorizados.includes(targetDeptId)) {
        exclusion = 'Não autorizado para esta fila';
      } else if (ia.carga_actual >= ia.limite_simultaneo) {
        exclusion = `Capacidade simultânea IA atingida (${ia.carga_actual}/${ia.limite_simultaneo})`;
      }
      candidatesChecked.push({
        agent_id: ia.id,
        nome: ia.nome,
        tipo: 'ia',
        elegivel: !exclusion,
        motivo_exclusao: exclusion || undefined,
        carga_actual: ia.carga_actual,
        limite_simultaneo: ia.limite_simultaneo,
        disponibilidade: ia.disponibilidade,
      });
      if (!exclusion) eligibleAi.push(ia);
    }

    let chosenAi: SupportAgent | null = null;
    if (eligibleAi.length > 0) {
      if (rule.destino_agent_id) {
        chosenAi = eligibleAi.find((a) => a.id === rule.destino_agent_id) || null;
      }
      if (!chosenAi) {
        eligibleAi.sort((a, b) => {
          const autoA = aiConfigMap.get(a.id)?.auto_responder_tickets ? 1 : 0;
          const autoB = aiConfigMap.get(b.id)?.auto_responder_tickets ? 1 : 0;
          if (autoA !== autoB) return autoB - autoA;
          return a.carga_actual - b.carga_actual;
        });
        chosenAi = eligibleAi[0];
      }
    }

    if (chosenAi) {
      return {
        departamentoId: targetDeptId,
        departamentoNome: targetDeptNome,
        selectedAgent: chosenAi,
        reason: `Roteado para Agente IA "${chosenAi.nome}" na fila ${targetDeptNome}.`,
        candidatesChecked,
      };
    }

    if (rule.escalonar_para_humano_se_ia_falhar) {
      const humanFallback = pickHuman('menor_carga');
      if (humanFallback) {
        return {
          departamentoId: targetDeptId,
          departamentoNome: targetDeptNome,
          selectedAgent: humanFallback,
          reason: `Nenhum Agente IA elegível na fila ${targetDeptNome}; atribuído por menor carga para ${humanFallback.nome}.`,
          candidatesChecked,
        };
      }
    }

    return {
      departamentoId: targetDeptId,
      departamentoNome: targetDeptNome,
      selectedAgent: null,
      reason: `Sem Agente IA ou técnico humano elegível na fila ${targetDeptNome}; mantido em aberto na fila.`,
      candidatesChecked,
    };
  }

  // Human strategies: round_robin, menor_carga, especialidade
  const chosenHuman = pickHuman(rule.metodo);
  if (chosenHuman) {
    return {
      departamentoId: targetDeptId,
      departamentoNome: targetDeptNome,
      selectedAgent: chosenHuman,
      reason: `Atribuído automaticamente (${rule.metodo}) para ${chosenHuman.nome} na fila ${targetDeptNome}.`,
      candidatesChecked,
    };
  }

  return {
    departamentoId: targetDeptId,
    departamentoNome: targetDeptNome,
    selectedAgent: null,
    reason: `Encaminhado para a fila ${targetDeptNome}; nenhum funcionário disponível cumpre os critérios de horário/capacidade neste momento.`,
    candidatesChecked,
  };
}

// ============================================================================
// SIMULADOR DRY-RUN (SEM ALTERAR DADOS NA BD)
// ============================================================================

export async function simulateSupportDistribution(input: {
  tenant_id: string;
  categoria: string;
  prioridade: SupportTicketPriority;
  canal: 'portal' | 'superadmin' | 'ia';
  departamento_id?: string;
  assunto: string;
  mensagem?: string;
}): Promise<SupportDistributionSimulationResult> {
  const rules = await listDistributionRules({ ativo: true });
  const depts = await listSupportDepartments({ includeInactive: false });
  const inputDept =
    depts.find((d) => d.id === input.departamento_id) || depts.find((d) => d.padrao) || depts[0];
  const baseDeptId = inputDept?.id || input.departamento_id || 'geral';
  const baseDeptNome = inputDept?.nome || 'Atendimento Geral';

  // Prefer tenant-specific rules over global at equal order
  const orderedRules = [...rules].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    const specA = a.tenant_id !== 'global' ? 0 : 1;
    const specB = b.tenant_id !== 'global' ? 0 : 1;
    return specA - specB;
  });

  const matchedRule = orderedRules.find((r) =>
    doesRuleMatchTicket(
      r,
      {
        tenant_id: input.tenant_id,
        categoria: input.categoria,
        prioridade: input.prioridade,
        canal: input.canal,
        departamento_id: baseDeptId,
        assunto: input.assunto,
      },
      input.mensagem || ''
    )
  );

  if (!matchedRule) {
    const fallbackPlan = await computeSelectionPlan({
      rule: {
        metodo: 'menor_carga',
        destino_departamento_id: baseDeptId,
        destino_agent_id: null,
        escalonar_para_humano_se_ia_falhar: true,
        respeitar_horario_atendimento: true,
        exigir_disponibilidade_online: true,
        permitir_ocupado_se_sem_online: false,
      },
      ticket: {
        tenant_id: input.tenant_id,
        categoria: input.categoria,
        departamento_id: baseDeptId,
        departamento_nome: baseDeptNome,
      },
    });

    return {
      matched_rule: null,
      destino_departamento_id: fallbackPlan.departamentoId,
      destino_departamento_nome: fallbackPlan.departamentoNome,
      responsavel_selecionado: null,
      motivo:
        'Nenhuma regra activa correspondeu às condições informadas. Na criação automática, o pedido permaneceria aberto na fila de origem para recolha manual.',
      candidatos_avaliados: fallbackPlan.candidatesChecked,
    };
  }

  const plan = await computeSelectionPlan({
    rule: matchedRule,
    ticket: {
      tenant_id: input.tenant_id,
      categoria: input.categoria,
      departamento_id: baseDeptId,
      departamento_nome: baseDeptNome,
    },
  });

  return {
    matched_rule: {
      id: matchedRule.id,
      nome: matchedRule.nome,
      ordem: matchedRule.ordem,
      metodo: matchedRule.metodo,
    },
    destino_departamento_id: plan.departamentoId,
    destino_departamento_nome: plan.departamentoNome,
    responsavel_selecionado: plan.selectedAgent
      ? {
          id: plan.selectedAgent.id,
          nome: plan.selectedAgent.nome,
          tipo: plan.selectedAgent.tipo,
        }
      : null,
    motivo: plan.reason,
    candidatos_avaliados: plan.candidatesChecked,
  };
}

// ============================================================================
// EXECUÇÃO EM TICKET ÚNICO (CRIAÇÃO AUTOMÁTICA OU ACIONAMENTO MANUAL)
// ============================================================================

export async function distributeTicketAutomatically(params: {
  ticketId: string;
  initialMessageText?: string;
  ruleId?: string;
  fallbackStrategy?: SupportDistributionStrategy;
  requireMatchedRule?: boolean;
  slaEscalation?: boolean;
  actor: AuthenticatedUser;
  meta?: { ip?: string; userAgent?: string };
}): Promise<SupportDistributionExecutionResult | null> {
  const db = getFirestoreInstance();
  const ticketRef = db.collection(TICKETS_COL).doc(params.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return null;

  const ticket = { ...(ticketSnap.data() || {}), id: ticketSnap.id } as SupportTicket;
  if (ticket.estado === 'resolvido') {
    throw new Error('Não é possível redistribuir uma solicitação já resolvida.');
  }

  let messageText = params.initialMessageText || '';
  if (!messageText) {
    const msgSnap = await db.collection(MESSAGES_COL).where('ticket_id', '==', ticket.id).limit(5).get().catch(() => null);
    if (msgSnap && !msgSnap.empty) {
      messageText = msgSnap.docs.map((m: any) => String(m.data()?.conteudo || '')).join(' ');
    }
  }

  let chosenRule: SupportDistributionRule | null = null;
  if (params.ruleId) {
    chosenRule = await getDistributionRuleById(params.ruleId);
    if (!chosenRule) {
      throw new Error('Regra de distribuição seleccionada não encontrada.');
    }
  } else {
    const activeRules = await listDistributionRules({ ativo: true });
    const ordered = [...activeRules].sort((a, b) => {
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      const specA = a.tenant_id !== 'global' ? 0 : 1;
      const specB = b.tenant_id !== 'global' ? 0 : 1;
      return specA - specB;
    });
    chosenRule =
      ordered.find((r) =>
        doesRuleMatchTicket(
          r,
          {
            tenant_id: ticket.tenant_id,
            categoria: ticket.categoria,
            prioridade: ticket.prioridade,
            canal: ticket.canal,
            departamento_id: ticket.departamento_id,
            assunto: ticket.assunto,
          },
          messageText
        )
      ) || null;
  }

  if (!chosenRule && params.requireMatchedRule) {
    return null;
  }

  const effectiveRule = chosenRule || {
    metodo: params.fallbackStrategy || 'menor_carga',
    destino_departamento_id: ticket.departamento_id,
    destino_agent_id: null,
    auto_executar_ia: false,
    escalonar_para_humano_se_ia_falhar: true,
    respeitar_horario_atendimento: true,
    exigir_disponibilidade_online: true,
    permitir_ocupado_se_sem_online: true,
    ultimo_agent_id: null,
  };

  const plan = await computeSelectionPlan({
    rule: effectiveRule,
    ticket: {
      tenant_id: ticket.tenant_id,
      categoria: ticket.categoria,
      departamento_id: ticket.departamento_id,
      departamento_nome: ticket.departamento_nome,
    },
  });

  const deptChanged = plan.departamentoId && plan.departamentoId !== ticket.departamento_id;
  const agentChanged = Boolean(plan.selectedAgent && plan.selectedAgent.id !== ticket.responsavel_id);

  if (!plan.selectedAgent && !deptChanged) {
    return {
      ticket,
      atribuido: false,
      motivo: plan.reason,
      regra_id: chosenRule?.id || null,
      regra_nome: chosenRule?.nome || null,
      metodo_usado: effectiveRule.metodo,
      departamento_id: ticket.departamento_id,
      departamento_nome: ticket.departamento_nome || 'Geral',
      responsavel_id: ticket.responsavel_id || null,
      responsavel_nome: ticket.responsavel_nome || null,
      responsavel_tipo: ticket.responsavel_tipo || null,
      ia_executada: false,
    };
  }

  const nowIso = new Date().toISOString();
  const prevAgentId = ticket.responsavel_id || null;
  const nextAgentId = plan.selectedAgent ? plan.selectedAgent.id : ticket.responsavel_id || null;
  const nextAgentNome = plan.selectedAgent ? plan.selectedAgent.nome : ticket.responsavel_nome || null;
  const nextAgentTipo = plan.selectedAgent ? plan.selectedAgent.tipo : ticket.responsavel_tipo || null;
  const nextEstado: SupportTicketStatus = nextAgentId ? 'em_atendimento' : 'aberto';

  const assignRef = db.collection(ASSIGNMENTS_COL).doc();
  const eventRef = db.collection(EVENTS_COL).doc();
  const batch = db.batch();

  batch.update(ticketRef, {
    departamento_id: plan.departamentoId,
    departamento_nome: plan.departamentoNome,
    responsavel_id: nextAgentId,
    responsavel_nome: nextAgentNome,
    responsavel_tipo: nextAgentTipo,
    estado: nextEstado,
    ultima_interacao: nowIso,
    updated_at: nowIso,
  });

  batch.set(assignRef, {
    id: assignRef.id,
    ticket_id: ticket.id,
    tenant_id: ticket.tenant_id,
    de_responsavel_id: prevAgentId,
    de_responsavel_nome: ticket.responsavel_nome || null,
    para_responsavel_id: nextAgentId,
    para_responsavel_nome: nextAgentNome,
    de_departamento_id: ticket.departamento_id,
    de_departamento_nome: ticket.departamento_nome || null,
    para_departamento_id: plan.departamentoId,
    para_departamento_nome: plan.departamentoNome,
    motivo: chosenRule ? `Regra "${chosenRule.nome}" (${chosenRule.metodo}): ${plan.reason}` : plan.reason,
    actor_id: params.actor.uid,
    actor_email: params.actor.email || 'distribution-engine',
    created_at: nowIso,
  });

  batch.set(eventRef, {
    id: eventRef.id,
    ticket_id: ticket.id,
    tenant_id: ticket.tenant_id,
    tipo: params.slaEscalation ? 'reencaminhado_sla' : 'distribuido_automaticamente',
    descricao: chosenRule ? `[Regra: ${chosenRule.nome}] ${plan.reason}` : plan.reason,
    actor_id: params.actor.uid,
    actor_nome: params.actor.email || 'Motor de Distribuição',
    metadata: {
      regra_id: chosenRule?.id || null,
      metodo: effectiveRule.metodo,
      para_departamento: plan.departamentoId,
      para_responsavel: nextAgentId,
    },
    created_at: nowIso,
  });

  if (chosenRule) {
    batch.set(
      db.collection(RULES_COL).doc(chosenRule.id),
      {
        total_atribuicoes: Number(chosenRule.total_atribuicoes || 0) + 1,
        ultima_execucao_em: nowIso,
        ...(plan.selectedAgent?.tipo === 'humano' ? { ultimo_agent_id: plan.selectedAgent.id } : {}),
        updated_at: nowIso,
      },
      { merge: true }
    );
  }

  await batch.commit();

  await Promise.all([
    prevAgentId && prevAgentId !== nextAgentId ? recalculateAgentLoadSafe(prevAgentId) : Promise.resolve(),
    nextAgentId ? recalculateAgentLoadSafe(nextAgentId) : Promise.resolve(),
  ]);

  if (plan.selectedAgent?.uid && plan.selectedAgent.uid !== params.actor.uid) {
    try {
      await db.collection(NOTIFICATIONS_COL).add({
        tenant_id: 'global',
        destinatario_id: plan.selectedAgent.uid,
        destinatario_role: 'suporte',
        titulo: `Solicitação distribuída (${ticket.codigo})`,
        mensagem: `O pedido "${ticket.assunto}" foi-lhe atribuído automaticamente (${plan.departamentoNome}).`,
        tipo: params.slaEscalation || ticket.prioridade === 'urgente' ? 'urgente' : 'info',
        lido: false,
        ticket_id: ticket.id,
        link_tab: 'assistant_tickets',
        created_at: nowIso,
      });
    } catch {}
  }

  await recordAuditLog({
    actor_id: params.actor.uid,
    actor_email: params.actor.email || 'distribution-engine',
    actor_role: params.actor.role || 'system',
    action: 'update',
    entity: 'support_ticket_distribution',
    entity_id: ticket.id,
    tenant_id: ticket.tenant_id,
    metadata: {
      codigo: ticket.codigo,
      regra_id: chosenRule?.id || null,
      metodo: effectiveRule.metodo,
      departamento_id: plan.departamentoId,
      responsavel_id: nextAgentId,
    },
    ip: params.meta?.ip,
    user_agent: params.meta?.userAgent,
  });

  // Auto-execute AI if routed to an AI Agent and rule enables auto_executar_ia
  let iaExecutada = false;
  if (
    plan.selectedAgent?.tipo === 'ia' &&
    chosenRule?.auto_executar_ia
  ) {
    try {
      const { runSupportAiForTicket } = await import('./supportAiService');
      const aiOutcome = await runSupportAiForTicket({
        ticketId: ticket.id,
        agentId: plan.selectedAgent.id,
        actor: params.actor,
      });
      iaExecutada = true;

      // If AI immediately escalated and rule specifies human fallback, auto-assign to an available human in fallback queue
      if (aiOutcome?.escalonado && chosenRule.escalonar_para_humano_se_ia_falhar) {
        const refreshedSnap = await ticketRef.get();
        const refreshedData = refreshedSnap.exists ? ({ ...(refreshedSnap.data() || {}), id: ticket.id } as SupportTicket) : null;
        if (refreshedData && !refreshedData.responsavel_id) {
          const fallbackHumanPlan = await computeSelectionPlan({
            rule: {
              metodo: 'menor_carga',
              destino_departamento_id: refreshedData.departamento_id,
              destino_agent_id: null,
              escalonar_para_humano_se_ia_falhar: false,
              respeitar_horario_atendimento: chosenRule.respeitar_horario_atendimento,
              exigir_disponibilidade_online: chosenRule.exigir_disponibilidade_online,
              permitir_ocupado_se_sem_online: chosenRule.permitir_ocupado_se_sem_online,
            },
            ticket: {
              tenant_id: refreshedData.tenant_id,
              categoria: refreshedData.categoria,
              departamento_id: refreshedData.departamento_id,
              departamento_nome: refreshedData.departamento_nome,
            },
          });
          if (fallbackHumanPlan.selectedAgent) {
            const fbIso = new Date().toISOString();
            await ticketRef.update({
              responsavel_id: fallbackHumanPlan.selectedAgent.id,
              responsavel_nome: fallbackHumanPlan.selectedAgent.nome,
              responsavel_tipo: 'humano',
              estado: 'em_atendimento',
              ultima_interacao: fbIso,
              updated_at: fbIso,
            });
            await db.collection(ASSIGNMENTS_COL).add({
              ticket_id: ticket.id,
              tenant_id: ticket.tenant_id,
              de_responsavel_id: plan.selectedAgent.id,
              de_responsavel_nome: plan.selectedAgent.nome,
              para_responsavel_id: fallbackHumanPlan.selectedAgent.id,
              para_responsavel_nome: fallbackHumanPlan.selectedAgent.nome,
              de_departamento_id: refreshedData.departamento_id,
              de_departamento_nome: refreshedData.departamento_nome || '',
              para_departamento_id: fallbackHumanPlan.departamentoId,
              para_departamento_nome: fallbackHumanPlan.departamentoNome,
              motivo: `Fallback humano automático após escalonamento IA para ${fallbackHumanPlan.selectedAgent.nome}`,
              actor_id: params.actor.uid,
              actor_email: params.actor.email || 'distribution-engine',
              created_at: fbIso,
            });
            await recalculateAgentLoadSafe(fallbackHumanPlan.selectedAgent.id);
          }
        }
      }
    } catch (aiErr: any) {
      // Non-blocking: AI execution failure must never break ticket creation or distribution
      console.warn('[SupportDistribution] Falha não bloqueante na execução automática de IA:', aiErr?.message);
      if (chosenRule.escalonar_para_humano_se_ia_falhar) {
        try {
          const fallbackPlan = await computeSelectionPlan({
            rule: {
              metodo: 'menor_carga',
              destino_departamento_id: plan.departamentoId,
              destino_agent_id: null,
              escalonar_para_humano_se_ia_falhar: false,
              respeitar_horario_atendimento: chosenRule.respeitar_horario_atendimento,
              exigir_disponibilidade_online: chosenRule.exigir_disponibilidade_online,
              permitir_ocupado_se_sem_online: chosenRule.permitir_ocupado_se_sem_online,
            },
            ticket: {
              tenant_id: ticket.tenant_id,
              categoria: ticket.categoria,
              departamento_id: plan.departamentoId,
              departamento_nome: plan.departamentoNome,
            },
          });
          if (fallbackPlan.selectedAgent) {
            const fbIso = new Date().toISOString();
            await ticketRef.update({
              responsavel_id: fallbackPlan.selectedAgent.id,
              responsavel_nome: fallbackPlan.selectedAgent.nome,
              responsavel_tipo: 'humano',
              estado: 'em_atendimento',
              ultima_interacao: fbIso,
              updated_at: fbIso,
            });
            await recalculateAgentLoadSafe(plan.selectedAgent.id);
            await recalculateAgentLoadSafe(fallbackPlan.selectedAgent.id);
          }
        } catch {}
      }
    }
  }

  const finalSnap = await ticketRef.get();
  const finalTicket = { ...ticket, ...(finalSnap.data() || {}), id: ticket.id } as SupportTicket;

  return {
    ticket: finalTicket,
    atribuido: Boolean(finalTicket.responsavel_id) || deptChanged || agentChanged,
    motivo: plan.reason,
    regra_id: chosenRule?.id || null,
    regra_nome: chosenRule?.nome || null,
    metodo_usado: effectiveRule.metodo,
    departamento_id: finalTicket.departamento_id,
    departamento_nome: finalTicket.departamento_nome || plan.departamentoNome,
    responsavel_id: finalTicket.responsavel_id || null,
    responsavel_nome: finalTicket.responsavel_nome || null,
    responsavel_tipo: finalTicket.responsavel_tipo || null,
    ia_executada: iaExecutada,
  };
}

export async function autoDistributeNewTicketSafe(
  ticket: SupportTicket,
  initialMessageText: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportTicket> {
  try {
    const res = await distributeTicketAutomatically({
      ticketId: ticket.id,
      initialMessageText,
      requireMatchedRule: true,
      actor,
      meta,
    });
    if (res?.ticket) {
      return {
        ...ticket,
        ...res.ticket,
      };
    }
  } catch (err: any) {
    console.warn('[SupportDistribution] Auto-distribuição não bloqueante na abertura:', err?.message);
  }
  return ticket;
}

// ============================================================================
// BALANCEAMENTO EM LOTE & REENCAMINHAMENTO SLA
// ============================================================================

export async function rebalanceSupportQueues(params: {
  tenant_id?: string;
  departamento_id?: string;
  incluir_alertas_sla: boolean;
  reatribuir_offline: boolean;
  dry_run: boolean;
  limite: number;
  actor: AuthenticatedUser;
  meta?: { ip?: string; userAgent?: string };
}): Promise<SupportDistributionRebalanceResult> {
  const db = getFirestoreInstance();
  const [ticketsSnap, agentsSnap] = await Promise.all([
    db.collection(TICKETS_COL).get(),
    db.collection(AGENTS_COL).get(),
  ]);

  const agentMap = new Map<string, SupportAgent>();
  for (const d of agentsSnap.docs) {
    agentMap.set(d.id, mapRawAgent(d.id, d.data() || {}));
  }

  const nowMs = Date.now();
  const candidates: Array<{ ticket: SupportTicket; isSlaBreached: boolean; isOfflineAssignee: boolean }> = [];

  for (const d of ticketsSnap.docs) {
    const raw = d.data() || {};
    const ticket = { ...raw, id: d.id } as SupportTicket;
    if (ticket.estado === 'resolvido') continue;
    if (params.tenant_id && params.tenant_id !== 'todos' && ticket.tenant_id !== params.tenant_id) continue;
    if (params.departamento_id && params.departamento_id !== 'todos' && ticket.departamento_id !== params.departamento_id)
      continue;

    const slaResMs = ticket.sla_resolucao_em ? new Date(ticket.sla_resolucao_em).getTime() : NaN;
    const slaRespMs = ticket.sla_resposta_em ? new Date(ticket.sla_resposta_em).getTime() : NaN;
    const isSlaBreached =
      (!ticket.primeira_resposta_em && !Number.isNaN(slaRespMs) && nowMs > slaRespMs) ||
      (!Number.isNaN(slaResMs) && nowMs > slaResMs);

    const assignee = ticket.responsavel_id ? agentMap.get(ticket.responsavel_id) : null;
    const isOfflineAssignee = Boolean(
      ticket.responsavel_id &&
        (!assignee ||
          assignee.estado !== 'activo' ||
          (assignee.tipo === 'humano' && assignee.disponibilidade === 'offline'))
    );

    const needsRouting =
      !ticket.responsavel_id ||
      (params.reatribuir_offline && isOfflineAssignee) ||
      (params.incluir_alertas_sla && isSlaBreached && (!ticket.responsavel_id || ticket.responsavel_tipo === 'ia'));

    if (needsRouting) {
      candidates.push({ ticket, isSlaBreached, isOfflineAssignee });
    }
  }

  // Prioritize SLA breached and urgent tickets first
  const priorityScore: Record<SupportTicketPriority, number> = {
    urgente: 4,
    alta: 3,
    normal: 2,
    baixa: 1,
  };
  candidates.sort((a, b) => {
    if (a.isSlaBreached !== b.isSlaBreached) return a.isSlaBreached ? -1 : 1;
    const pa = priorityScore[a.ticket.prioridade] || 0;
    const pb = priorityScore[b.ticket.prioridade] || 0;
    if (pa !== pb) return pb - pa;
    return new Date(a.ticket.data_abertura).getTime() - new Date(b.ticket.data_abertura).getTime();
  });

  const batchSlice = candidates.slice(0, Math.min(100, Math.max(1, params.limite)));
  const detalhes: SupportDistributionRebalanceResult['detalhes'] = [];
  let atribuidos = 0;
  let escalonadosSla = 0;
  let semElegivel = 0;

  for (const item of batchSlice) {
    const { ticket, isSlaBreached } = item;

    if (params.dry_run) {
      const sim = await simulateSupportDistribution({
        tenant_id: ticket.tenant_id,
        categoria: ticket.categoria,
        prioridade: ticket.prioridade,
        canal: ticket.canal,
        departamento_id: ticket.departamento_id,
        assunto: ticket.assunto,
        mensagem: ticket.ultima_mensagem_preview || '',
      });
      let previewAssignee = sim.responsavel_selecionado;
      let previewDeptNome = sim.destino_departamento_nome;
      let previewMotivo = sim.motivo;

      if (!previewAssignee && !sim.matched_rule) {
        const fbPlan = await computeSelectionPlan({
          rule: {
            metodo: 'menor_carga',
            destino_departamento_id: ticket.departamento_id,
            destino_agent_id: null,
            escalonar_para_humano_se_ia_falhar: true,
            respeitar_horario_atendimento: true,
            exigir_disponibilidade_online: true,
            permitir_ocupado_se_sem_online: true,
          },
          ticket: {
            tenant_id: ticket.tenant_id,
            categoria: ticket.categoria,
            departamento_id: ticket.departamento_id,
            departamento_nome: ticket.departamento_nome,
          },
        });
        if (fbPlan.selectedAgent) {
          previewAssignee = {
            id: fbPlan.selectedAgent.id,
            nome: fbPlan.selectedAgent.nome,
            tipo: fbPlan.selectedAgent.tipo,
          };
          previewDeptNome = fbPlan.departamentoNome;
          previewMotivo = fbPlan.reason;
        }
      }

      if (previewAssignee) {
        atribuidos += 1;
        if (isSlaBreached) escalonadosSla += 1;
        detalhes.push({
          ticket_id: ticket.id,
          codigo: ticket.codigo,
          acao: isSlaBreached ? 'reencaminhado_sla' : 'atribuido',
          responsavel_nome: previewAssignee.nome,
          departamento_nome: previewDeptNome,
          motivo: previewMotivo,
        });
      } else {
        semElegivel += 1;
        detalhes.push({
          ticket_id: ticket.id,
          codigo: ticket.codigo,
          acao: 'sem_elegivel',
          responsavel_nome: null,
          departamento_nome: previewDeptNome,
          motivo: previewMotivo,
        });
      }
      continue;
    }

    const res = await distributeTicketAutomatically({
      ticketId: ticket.id,
      fallbackStrategy: 'menor_carga',
      requireMatchedRule: false,
      slaEscalation: isSlaBreached,
      actor: params.actor,
      meta: params.meta,
    });

    if (res && res.atribuido) {
      atribuidos += 1;
      if (isSlaBreached) escalonadosSla += 1;
      detalhes.push({
        ticket_id: ticket.id,
        codigo: ticket.codigo,
        acao: isSlaBreached ? 'reencaminhado_sla' : res.responsavel_id ? 'atribuido' : 'fila_atualizada',
        responsavel_nome: res.responsavel_nome || null,
        departamento_nome: res.departamento_nome,
        motivo: res.motivo,
      });
    } else {
      semElegivel += 1;
      detalhes.push({
        ticket_id: ticket.id,
        codigo: ticket.codigo,
        acao: 'sem_elegivel',
        responsavel_nome: null,
        departamento_nome: ticket.departamento_nome || 'Geral',
        motivo: res?.motivo || 'Sem regra aplicável ou agente disponível.',
      });
    }
  }

  if (!params.dry_run) {
    await recordAuditLog({
      actor_id: params.actor.uid,
      actor_email: params.actor.email,
      actor_role: params.actor.role,
      action: 'update',
      entity: 'support_distribution_rebalance',
      entity_id: params.departamento_id || params.tenant_id || 'global',
      tenant_id: params.tenant_id || 'global',
      metadata: {
        processados: batchSlice.length,
        atribuidos,
        escalonados_sla: escalonadosSla,
        sem_elegivel: semElegivel,
      },
      ip: params.meta?.ip,
      user_agent: params.meta?.userAgent,
    });
  }

  return {
    processados: batchSlice.length,
    atribuidos,
    escalonados_sla: escalonadosSla,
    sem_elegivel: semElegivel,
    dry_run: params.dry_run,
    detalhes,
  };
}

// ============================================================================
// VISÃO GERAL DE DISTRIBUIÇÃO (CONTAGENS REAIS)
// ============================================================================

export async function getDistributionOverview(tenantId?: string): Promise<SupportDistributionOverview> {
  const db = getFirestoreInstance();
  const [rulesSnap, ticketsSnap, agentsSnap] = await Promise.all([
    db.collection(RULES_COL).get(),
    db.collection(TICKETS_COL).get(),
    db.collection(AGENTS_COL).get(),
  ]);

  let totalRegras = 0;
  let regrasActivas = 0;
  for (const r of rulesSnap.docs) {
    const rd = r.data() || {};
    if (tenantId && tenantId !== 'todos' && rd.tenant_id !== 'global' && rd.tenant_id !== tenantId) continue;
    totalRegras += 1;
    if (rd.ativo !== false) regrasActivas += 1;
  }

  const nowMs = Date.now();
  let ticketsSemResponsavel = 0;
  let ticketsAlertasSla = 0;
  for (const t of ticketsSnap.docs) {
    const td = t.data() || {};
    if (td.estado === 'resolvido') continue;
    if (tenantId && tenantId !== 'todos' && td.tenant_id !== tenantId) continue;
    if (!td.responsavel_id) ticketsSemResponsavel += 1;

    const slaResMs = td.sla_resolucao_em ? new Date(td.sla_resolucao_em).getTime() : NaN;
    const slaRespMs = td.sla_resposta_em ? new Date(td.sla_resposta_em).getTime() : NaN;
    if (
      (!td.primeira_resposta_em && !Number.isNaN(slaRespMs) && nowMs > slaRespMs) ||
      (!Number.isNaN(slaResMs) && nowMs > slaResMs)
    ) {
      ticketsAlertasSla += 1;
    }
  }

  let equipaOnlineDisponivel = 0;
  let capacidadeLivreHumanos = 0;
  let agentesIaActivos = 0;

  for (const a of agentsSnap.docs) {
    const ad = a.data() || {};
    if (ad.estado !== 'activo') continue;
    if (tenantId && tenantId !== 'todos' && ad.tenant_id !== 'global' && ad.tenant_id !== tenantId) continue;
    if (ad.tipo === 'ia') {
      agentesIaActivos += 1;
    } else {
      const cap = Math.max(0, Number(ad.limite_simultaneo ?? 10) - Number(ad.carga_actual ?? 0));
      capacidadeLivreHumanos += cap;
      if (ad.disponibilidade === 'online' && cap > 0) {
        equipaOnlineDisponivel += 1;
      }
    }
  }

  return {
    totalRegras,
    regrasActivas,
    ticketsSemResponsavel,
    ticketsAlertasSla,
    equipaOnlineDisponivel,
    capacidadeLivreHumanos,
    agentesIaActivos,
  };
}
