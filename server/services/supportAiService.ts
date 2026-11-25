/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Agentes de IA & Motor Automatizado de Atendimento (Fase 4)
 * - CRUD sincronizado entre support_agents (tipo: 'ia') e ai_agent_configs
 * - Protecção estrita contra SSRF em URLs de webhooks externos (n8n)
 * - Grounding na Base de Conhecimento (apenas FAQ publicadas com flag utilizavel_ia = true e visibilidade respeitada)
 * - Execução server-side via @google/genai (structured JSON) e/ou webhook n8n assinado HMAC-SHA256
 * - Escalonamento automático para equipa humana por palavras-chave, baixa confiança ou limite de turnos IA
 * - Sem respostas simuladas: falhas de configuração/upstream são reportadas explicitamente
 */

import crypto from 'crypto';
import net from 'net';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { AuthenticatedUser, getFirestoreInstance } from '../middleware/auth';
import { recordAuditLog } from '../security/audit';
import { timingSafeCompare } from '../security/authManager';
import { canRoleViewArticle, extractPlainText, normalizeTextForSearch } from './faqService';
import { recalculateSupportAgentLoad } from './supportTicketService';
import type {
  FaqArticle,
  FaqVisibilidade,
  SupportAgent,
  SupportAgentStatus,
  SupportAiAgentConfig,
  SupportAiAgentWithConfig,
  SupportAiExecutionMode,
  SupportAiFaqReference,
  SupportAiModel,
  SupportAiProviderStatus,
  SupportAiSandboxResult,
  SupportAiTicketExecutionResult,
  SupportMessage,
  SupportTicket,
} from '../../src/types';

const AGENTS_COL = 'support_agents';
const AI_CONFIGS_COL = 'ai_agent_configs';
const DEPARTMENTS_COL = 'support_departments';
const TICKETS_COL = 'support_tickets';
const MESSAGES_COL = 'support_messages';
const ASSIGNMENTS_COL = 'support_assignments';
const EVENTS_COL = 'support_events';
const FAQ_ARTICLES_COL = 'faq_articles';
const FAQ_CATEGORIES_COL = 'faq_categories';
const NOTIFICATIONS_COL = 'notificacoes';
const IDEMPOTENCY_COL = 'idempotency_keys';

export const DEFAULT_AI_MODEL: SupportAiModel = 'gemini-4-hydrogen';

export class SupportAiError extends Error {
  code: string;
  httpStatus: number;
  constructor(message: string, code = 'support_ai_error', httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function getAiProviderStatus(): SupportAiProviderStatus {
  return {
    geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    n8nSecretConfigured: Boolean((process.env.N8N_WEBHOOK_SECRET || '').trim()),
    defaultModel: DEFAULT_AI_MODEL,
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new SupportAiError(
      'Serviço Gemini AI indisponível: variável GEMINI_API_KEY não configurada no servidor.',
      'ai_provider_unconfigured',
      422
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// ============================================================================
// PROTECÇÃO ANTI-SSRF PARA WEBHOOKS EXTERNOS (n8n)
// ============================================================================

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Cloud metadata / link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIp(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  const ipVer = net.isIP(clean);
  if (!ipVer) return false;
  if (ipVer === 4) return isPrivateOrReservedIpv4(clean);
  // IPv6 loopback, unspecified, link-local, unique-local, IPv4-mapped
  if (clean === '::' || clean === '::1') return true;
  if (clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) return true;
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (net.isIP(mapped) === 4) return isPrivateOrReservedIpv4(mapped);
  }
  return false;
}

export function assertSafeWebhookUrl(rawUrl?: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SupportAiError('URL do webhook n8n inválido.', 'invalid_webhook_url', 400);
  }

  if (parsed.protocol !== 'https:') {
    throw new SupportAiError(
      'Por segurança, o webhook n8n externo deve utilizar protocolo HTTPS.',
      'insecure_webhook_protocol',
      400
    );
  }

  if (parsed.username || parsed.password) {
    throw new SupportAiError('URLs de webhook com credenciais embutidas não são permitidos.', 'invalid_webhook_url', 400);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain') ||
    host === 'metadata.google.internal' ||
    isPrivateOrReservedIp(host)
  ) {
    throw new SupportAiError(
      'URL de webhook bloqueado pela política anti-SSRF (endereços locais ou privados não são permitidos).',
      'ssrf_blocked_url',
      400
    );
  }

  return parsed.toString();
}

// ============================================================================
// IDEMPOTÊNCIA E HELPERS
// ============================================================================

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

function mapAiConfigDoc(id: string, data: any, deptNameMap?: Map<string, string>): SupportAiAgentConfig {
  const fbDeptId = data.fallback_departamento_id ? String(data.fallback_departamento_id) : '';
  return {
    id,
    agent_id: String(data.agent_id || id),
    tenant_id: String(data.tenant_id || 'global'),
    modelo: (data.modelo === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen') as SupportAiModel,
    modo_execucao: (['gemini_direct', 'n8n_webhook', 'hibrido'].includes(data.modo_execucao)
      ? data.modo_execucao
      : 'gemini_direct') as SupportAiExecutionMode,
    prompt_sistema: String(data.prompt_sistema || ''),
    personalidade: String(data.personalidade || 'Profissional, objectivo e claro'),
    idioma_padrao: String(data.idioma_padrao || 'pt'),
    limiar_confianca: Number(data.limiar_confianca ?? 0.7),
    usar_apenas_faq_autorizada: data.usar_apenas_faq_autorizada !== false,
    max_turnos_ia: Number(data.max_turnos_ia ?? 4),
    auto_responder_tickets: Boolean(data.auto_responder_tickets),
    palavras_chave_escalonamento: Array.isArray(data.palavras_chave_escalonamento)
      ? data.palavras_chave_escalonamento.map(String).filter(Boolean)
      : ['humano', 'urgente', 'reclamação'],
    n8n_webhook_url: data.n8n_webhook_url ? String(data.n8n_webhook_url) : '',
    fallback_departamento_id: fbDeptId,
    fallback_departamento_nome: (fbDeptId && deptNameMap?.get(fbDeptId)) || String(data.fallback_departamento_nome || ''),
    total_interacoes: Number(data.total_interacoes ?? 0),
    total_escalonamentos: Number(data.total_escalonamentos ?? 0),
    ultima_execucao_em: data.ultima_execucao_em ? String(data.ultima_execucao_em) : null,
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    updated_by: String(data.updated_by || ''),
  };
}

function mapIaAgentDoc(id: string, data: any, deptNameMap?: Map<string, string>): SupportAgent {
  const deptId = String(data.departamento_id || '');
  const authDepts = Array.isArray(data.departamentos_autorizados)
    ? Array.from(new Set([deptId, ...data.departamentos_autorizados.map(String)].filter(Boolean)))
    : deptId
    ? [deptId]
    : [];

  return {
    id,
    tenant_id: String(data.tenant_id || 'global'),
    tipo: 'ia',
    nome: String(data.nome || ''),
    email: String(data.email || ''),
    departamento_id: deptId,
    departamento_nome: deptNameMap?.get(deptId) || String(data.departamento_nome || ''),
    departamentos_autorizados: authDepts,
    funcao: 'assistente',
    estado: (data.estado || 'activo') as SupportAgentStatus,
    disponibilidade: data.estado === 'activo' ? 'online' : 'offline',
    limite_simultaneo: Number(data.limite_simultaneo ?? 100),
    carga_actual: Number(data.carga_actual ?? 0),
    horario_atendimento: data.horario_atendimento || { ativo: false, timezone: 'Africa/Maputo', dias: [] },
    regras_atribuicao: data.regras_atribuicao || {
      auto_atribuir: true,
      apenas_horario: false,
      prioridade_atribuicao: 80,
      categorias_especialidade: [],
    },
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    created_by: String(data.created_by || ''),
    updated_by: String(data.updated_by || ''),
  };
}

// ============================================================================
// CRUD DE AGENTES DE IA
// ============================================================================

export async function listSupportAiAgents(params?: {
  tenantId?: string;
  estado?: SupportAgentStatus | 'todos';
  departamento_id?: string;
  q?: string;
}): Promise<{
  items: SupportAiAgentWithConfig[];
  providerStatus: SupportAiProviderStatus;
}> {
  const db = getFirestoreInstance();
  const [agentSnap, cfgSnap, deptSnap] = await Promise.all([
    db.collection(AGENTS_COL).get(),
    db.collection(AI_CONFIGS_COL).get(),
    db.collection(DEPARTMENTS_COL).get(),
  ]);

  const deptNameMap = new Map<string, string>();
  for (const d of deptSnap.docs) {
    deptNameMap.set(d.id, String(d.data()?.nome || ''));
  }

  const cfgMap = new Map<string, SupportAiAgentConfig>();
  for (const c of cfgSnap.docs) {
    const data = c.data() || {};
    const aid = String(data.agent_id || c.id);
    cfgMap.set(aid, mapAiConfigDoc(c.id, data, deptNameMap));
  }

  const items: SupportAiAgentWithConfig[] = [];
  const qNorm = normalizeTextForSearch(params?.q || '');

  for (const d of agentSnap.docs) {
    const raw = d.data() || {};
    if (raw.tipo !== 'ia') continue;

    const agent = mapIaAgentDoc(d.id, raw, deptNameMap);
    const config =
      cfgMap.get(d.id) ||
      mapAiConfigDoc(d.id, { agent_id: d.id, tenant_id: agent.tenant_id, created_at: agent.created_at, updated_at: agent.updated_at }, deptNameMap);

    if (params?.tenantId && params.tenantId !== 'todos') {
      if (agent.tenant_id !== params.tenantId && agent.tenant_id !== 'global') continue;
    }
    if (params?.estado && params.estado !== 'todos' && agent.estado !== params.estado) {
      continue;
    }
    if (params?.departamento_id && params.departamento_id !== 'todos') {
      if (
        agent.departamento_id !== params.departamento_id &&
        !agent.departamentos_autorizados.includes(params.departamento_id)
      ) {
        continue;
      }
    }
    if (qNorm) {
      const hay = normalizeTextForSearch(
        `${agent.nome} ${agent.email} ${agent.departamento_nome || ''} ${config.modelo} ${config.modo_execucao}`
      );
      if (!hay.includes(qNorm)) continue;
    }

    items.push({ agent, config });
  }

  items.sort((a, b) => a.agent.nome.localeCompare(b.agent.nome, 'pt'));
  return {
    items,
    providerStatus: getAiProviderStatus(),
  };
}

export async function getSupportAiAgentById(id: string): Promise<SupportAiAgentWithConfig | null> {
  const db = getFirestoreInstance();
  const [agentSnap, cfgSnap, deptSnap] = await Promise.all([
    db.collection(AGENTS_COL).doc(id).get(),
    db.collection(AI_CONFIGS_COL).doc(id).get(),
    db.collection(DEPARTMENTS_COL).get(),
  ]);

  if (!agentSnap.exists) return null;
  const rawAgent = agentSnap.data() || {};
  if (rawAgent.tipo !== 'ia') return null;

  const deptNameMap = new Map<string, string>();
  for (const d of deptSnap.docs) {
    deptNameMap.set(d.id, String(d.data()?.nome || ''));
  }

  const agent = mapIaAgentDoc(agentSnap.id, rawAgent, deptNameMap);
  const config = cfgSnap.exists
    ? mapAiConfigDoc(cfgSnap.id, cfgSnap.data() || {}, deptNameMap)
    : mapAiConfigDoc(agentSnap.id, { agent_id: agentSnap.id, tenant_id: agent.tenant_id }, deptNameMap);

  return { agent, config };
}

export async function createSupportAiAgent(
  input: {
    tenant_id: string;
    nome: string;
    email?: string;
    departamento_id: string;
    departamentos_autorizados?: string[];
    estado: SupportAgentStatus;
    limite_simultaneo: number;
    modelo: SupportAiModel;
    modo_execucao: SupportAiExecutionMode;
    prompt_sistema: string;
    personalidade: string;
    idioma_padrao: string;
    limiar_confianca: number;
    usar_apenas_faq_autorizada: boolean;
    max_turnos_ia: number;
    auto_responder_tickets: boolean;
    palavras_chave_escalonamento: string[];
    n8n_webhook_url?: string;
    fallback_departamento_id?: string;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ item: SupportAiAgentWithConfig; idempotent: boolean }> {
  const idem = await getIdempotentResult<SupportAiAgentWithConfig>('sup_ai_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { item: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.departamento_id).get();
  if (!deptSnap.exists) {
    throw new SupportAiError('Departamento principal seleccionado não existe.', 'department_not_found', 400);
  }
  const deptNome = String(deptSnap.data()?.nome || '');

  let fallbackDeptNome = '';
  if (input.fallback_departamento_id) {
    const fbSnap = await db.collection(DEPARTMENTS_COL).doc(input.fallback_departamento_id).get();
    if (!fbSnap.exists) {
      throw new SupportAiError('Departamento de escalonamento seleccionado não existe.', 'fallback_department_not_found', 400);
    }
    fallbackDeptNome = String(fbSnap.data()?.nome || '');
  }

  const safeWebhookUrl = assertSafeWebhookUrl(input.n8n_webhook_url);
  if ((input.modo_execucao === 'n8n_webhook' || input.modo_execucao === 'hibrido') && !safeWebhookUrl) {
    throw new SupportAiError(
      'Indique um URL HTTPS válido do webhook n8n para o modo seleccionado.',
      'webhook_url_required',
      400
    );
  }

  const allDeptsSnap = await db.collection(DEPARTMENTS_COL).get();
  const validDeptIds = new Set<string>(allDeptsSnap.docs.map((d: any) => d.id));
  const authDepts = Array.from(
    new Set([input.departamento_id, ...(input.departamentos_autorizados || [])].filter((id) => validDeptIds.has(id)))
  );
  if (!authDepts.includes(input.departamento_id)) {
    authDepts.unshift(input.departamento_id);
  }

  const id = `supia_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const cleanEmail =
    (input.email || '').trim().toLowerCase() || `ia-${id}@assistente.sge.local`;

  const agentDoc: SupportAgent = {
    id,
    tenant_id: input.tenant_id || 'global',
    tipo: 'ia',
    nome: input.nome.trim(),
    email: cleanEmail,
    departamento_id: input.departamento_id,
    departamento_nome: deptNome,
    departamentos_autorizados: authDepts,
    funcao: 'assistente',
    estado: input.estado || 'activo',
    disponibilidade: input.estado === 'activo' ? 'online' : 'offline',
    limite_simultaneo: Number(input.limite_simultaneo ?? 100),
    carga_actual: 0,
    horario_atendimento: { ativo: false, timezone: 'Africa/Maputo', dias: [] },
    regras_atribuicao: {
      auto_atribuir: true,
      apenas_horario: false,
      prioridade_atribuicao: 80,
      categorias_especialidade: [],
    },
    created_at: nowIso,
    updated_at: nowIso,
    created_by: actor.email || actor.uid,
    updated_by: actor.email || actor.uid,
  };

  const keywords = Array.from(
    new Set((input.palavras_chave_escalonamento || []).map((k) => k.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 40);

  const configDoc: SupportAiAgentConfig = {
    id,
    agent_id: id,
    tenant_id: agentDoc.tenant_id,
    modelo: input.modelo || DEFAULT_AI_MODEL,
    modo_execucao: input.modo_execucao || 'gemini_direct',
    prompt_sistema: input.prompt_sistema.trim(),
    personalidade: (input.personalidade || 'Profissional, objectivo e claro').trim(),
    idioma_padrao: input.idioma_padrao || 'pt',
    limiar_confianca: Number(input.limiar_confianca ?? 0.7),
    usar_apenas_faq_autorizada: input.usar_apenas_faq_autorizada !== false,
    max_turnos_ia: Number(input.max_turnos_ia ?? 4),
    auto_responder_tickets: Boolean(input.auto_responder_tickets),
    palavras_chave_escalonamento: keywords,
    n8n_webhook_url: safeWebhookUrl,
    fallback_departamento_id: input.fallback_departamento_id || input.departamento_id,
    fallback_departamento_nome: fallbackDeptNome || deptNome,
    total_interacoes: 0,
    total_escalonamentos: 0,
    ultima_execucao_em: null,
    created_at: nowIso,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  const batch = db.batch();
  batch.set(db.collection(AGENTS_COL).doc(id), agentDoc);
  batch.set(db.collection(AI_CONFIGS_COL).doc(id), configDoc);
  await batch.commit();

  const item: SupportAiAgentWithConfig = { agent: agentDoc, config: configDoc };
  await saveIdempotentResult('sup_ai_create', input.idempotencyKey, item);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'ai_agent_config',
    entity_id: id,
    tenant_id: agentDoc.tenant_id,
    after_state: {
      id,
      nome: agentDoc.nome,
      modelo: configDoc.modelo,
      modo_execucao: configDoc.modo_execucao,
      limiar_confianca: configDoc.limiar_confianca,
      usar_apenas_faq_autorizada: configDoc.usar_apenas_faq_autorizada,
      departamento_id: agentDoc.departamento_id,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { item, idempotent: false };
}

export async function updateSupportAiAgent(
  id: string,
  input: Partial<{
    nome: string;
    email: string;
    departamento_id: string;
    departamentos_autorizados: string[];
    estado: SupportAgentStatus;
    limite_simultaneo: number;
    modelo: SupportAiModel;
    modo_execucao: SupportAiExecutionMode;
    prompt_sistema: string;
    personalidade: string;
    idioma_padrao: string;
    limiar_confianca: number;
    usar_apenas_faq_autorizada: boolean;
    max_turnos_ia: number;
    auto_responder_tickets: boolean;
    palavras_chave_escalonamento: string[];
    n8n_webhook_url: string;
    fallback_departamento_id: string;
  }>,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<SupportAiAgentWithConfig | null> {
  const existing = await getSupportAiAgentById(id);
  if (!existing) return null;

  const db = getFirestoreInstance();
  const { agent: beforeAgent, config: beforeConfig } = existing;

  let nextDeptId = beforeAgent.departamento_id;
  let nextDeptNome = beforeAgent.departamento_nome || '';
  if (input.departamento_id && input.departamento_id !== beforeAgent.departamento_id) {
    const deptSnap = await db.collection(DEPARTMENTS_COL).doc(input.departamento_id).get();
    if (!deptSnap.exists) {
      throw new SupportAiError('Departamento principal seleccionado não existe.', 'department_not_found', 400);
    }
    nextDeptId = input.departamento_id;
    nextDeptNome = String(deptSnap.data()?.nome || '');
  }

  let nextFallbackId = beforeConfig.fallback_departamento_id || nextDeptId;
  let nextFallbackNome = beforeConfig.fallback_departamento_nome || nextDeptNome;
  if (input.fallback_departamento_id !== undefined) {
    if (input.fallback_departamento_id) {
      const fbSnap = await db.collection(DEPARTMENTS_COL).doc(input.fallback_departamento_id).get();
      if (!fbSnap.exists) {
        throw new SupportAiError('Departamento de escalonamento seleccionado não existe.', 'fallback_department_not_found', 400);
      }
      nextFallbackId = input.fallback_departamento_id;
      nextFallbackNome = String(fbSnap.data()?.nome || '');
    } else {
      nextFallbackId = nextDeptId;
      nextFallbackNome = nextDeptNome;
    }
  }

  const nextModo = input.modo_execucao || beforeConfig.modo_execucao;
  const nextWebhookUrl =
    input.n8n_webhook_url !== undefined
      ? assertSafeWebhookUrl(input.n8n_webhook_url)
      : beforeConfig.n8n_webhook_url || '';

  if ((nextModo === 'n8n_webhook' || nextModo === 'hibrido') && !nextWebhookUrl) {
    throw new SupportAiError(
      'Indique um URL HTTPS válido do webhook n8n para o modo seleccionado.',
      'webhook_url_required',
      400
    );
  }

  const authDepts =
    input.departamentos_autorizados !== undefined || input.departamento_id !== undefined
      ? Array.from(new Set([nextDeptId, ...(input.departamentos_autorizados || beforeAgent.departamentos_autorizados)].filter(Boolean)))
      : beforeAgent.departamentos_autorizados;

  const nextEstado = input.estado || beforeAgent.estado;
  const nowIso = new Date().toISOString();

  const updatedAgent: SupportAgent = {
    ...beforeAgent,
    id,
    nome: input.nome !== undefined ? input.nome.trim() : beforeAgent.nome,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : beforeAgent.email,
    departamento_id: nextDeptId,
    departamento_nome: nextDeptNome,
    departamentos_autorizados: authDepts,
    estado: nextEstado,
    disponibilidade: nextEstado === 'activo' ? 'online' : 'offline',
    limite_simultaneo:
      input.limite_simultaneo !== undefined ? Number(input.limite_simultaneo) : beforeAgent.limite_simultaneo,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  const updatedConfig: SupportAiAgentConfig = {
    ...beforeConfig,
    id,
    agent_id: id,
    modelo: input.modelo || beforeConfig.modelo,
    modo_execucao: nextModo,
    prompt_sistema: input.prompt_sistema !== undefined ? input.prompt_sistema.trim() : beforeConfig.prompt_sistema,
    personalidade: input.personalidade !== undefined ? input.personalidade.trim() : beforeConfig.personalidade,
    idioma_padrao: input.idioma_padrao || beforeConfig.idioma_padrao,
    limiar_confianca:
      input.limiar_confianca !== undefined ? Number(input.limiar_confianca) : beforeConfig.limiar_confianca,
    usar_apenas_faq_autorizada:
      input.usar_apenas_faq_autorizada !== undefined
        ? Boolean(input.usar_apenas_faq_autorizada)
        : beforeConfig.usar_apenas_faq_autorizada,
    max_turnos_ia: input.max_turnos_ia !== undefined ? Number(input.max_turnos_ia) : beforeConfig.max_turnos_ia,
    auto_responder_tickets:
      input.auto_responder_tickets !== undefined
        ? Boolean(input.auto_responder_tickets)
        : beforeConfig.auto_responder_tickets,
    palavras_chave_escalonamento:
      input.palavras_chave_escalonamento !== undefined
        ? Array.from(new Set(input.palavras_chave_escalonamento.map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 40)
        : beforeConfig.palavras_chave_escalonamento,
    n8n_webhook_url: nextWebhookUrl,
    fallback_departamento_id: nextFallbackId,
    fallback_departamento_nome: nextFallbackNome,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  const batch = db.batch();
  batch.set(db.collection(AGENTS_COL).doc(id), updatedAgent, { merge: true });
  batch.set(db.collection(AI_CONFIGS_COL).doc(id), updatedConfig, { merge: true });
  await batch.commit();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'update',
    entity: 'ai_agent_config',
    entity_id: id,
    tenant_id: updatedAgent.tenant_id,
    before_state: {
      nome: beforeAgent.nome,
      estado: beforeAgent.estado,
      modelo: beforeConfig.modelo,
      modo_execucao: beforeConfig.modo_execucao,
      limiar_confianca: beforeConfig.limiar_confianca,
      usar_apenas_faq_autorizada: beforeConfig.usar_apenas_faq_autorizada,
    },
    after_state: {
      nome: updatedAgent.nome,
      estado: updatedAgent.estado,
      modelo: updatedConfig.modelo,
      modo_execucao: updatedConfig.modo_execucao,
      limiar_confianca: updatedConfig.limiar_confianca,
      usar_apenas_faq_autorizada: updatedConfig.usar_apenas_faq_autorizada,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { agent: updatedAgent, config: updatedConfig };
}

export async function deleteSupportAiAgent(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ deleted: boolean; conflict?: boolean; error?: string }> {
  const existing = await getSupportAiAgentById(id);
  if (!existing) {
    return { deleted: false, error: 'Agente IA não encontrado.' };
  }

  const db = getFirestoreInstance();
  const ticketSnap = await db.collection(TICKETS_COL).where('responsavel_id', '==', id).limit(1).get().catch(() => null);
  if (ticketSnap && !ticketSnap.empty) {
    return {
      deleted: false,
      conflict: true,
      error: 'Este agente IA tem histórico de tickets atribuídos. Altere o estado para "Arquivado" para preservar a auditoria.',
    };
  }

  const batch = db.batch();
  batch.delete(db.collection(AGENTS_COL).doc(id));
  batch.delete(db.collection(AI_CONFIGS_COL).doc(id));
  await batch.commit();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'ai_agent_config',
    entity_id: id,
    tenant_id: existing.agent.tenant_id,
    before_state: { id, nome: existing.agent.nome, modelo: existing.config.modelo },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { deleted: true };
}

// ============================================================================
// GROUNDING NA BASE DE CONHECIMENTO (APENAS FAQ PUBLICADAS + utilizavel_ia)
// ============================================================================

const STOPWORDS = new Set([
  'para', 'como', 'com', 'que', 'uma', 'uns', 'umas', 'dos', 'das', 'nos', 'nas',
  'por', 'pelo', 'pela', 'este', 'esta', 'isso', 'aqui', 'muito', 'mais', 'sem',
  'nao', 'não', 'sim', 'sobre', 'onde', 'qual', 'quais', 'quando', 'favor', 'ajuda',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'how', 'what',
]);

export async function retrieveRelevantFaqForAi(params: {
  queryText: string;
  tenantId: string;
  requesterRole?: string;
  limit?: number;
}): Promise<{
  references: SupportAiFaqReference[];
  snippets: Array<{ id: string; titulo: string; categoria: string; texto: string }>;
}> {
  const db = getFirestoreInstance();
  const [artSnap, catSnap] = await Promise.all([
    db.collection(FAQ_ARTICLES_COL).get(),
    db.collection(FAQ_CATEGORIES_COL).get(),
  ]);

  const activeCategoryMap = new Map<string, string>();
  for (const c of catSnap.docs) {
    const cd = c.data() || {};
    if (cd.ativo !== false) {
      activeCategoryMap.set(c.id, String(cd.nome || ''));
    }
  }

  const tokens = Array.from(
    new Set(
      normalizeTextForSearch(params.queryText)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    )
  );

  const scored: Array<{
    article: FaqArticle;
    categoryName: string;
    score: number;
  }> = [];

  for (const d of artSnap.docs) {
    const raw = d.data() || {};
    // Strict security & business flags: ONLY published + utilizavel_ia === true
    if (raw.estado !== 'publicado') continue;
    if (raw.utilizavel_ia !== true) continue;

    const artTenant = String(raw.tenant_id || 'global');
    if (artTenant !== 'global' && params.tenantId && artTenant !== params.tenantId) {
      continue;
    }

    const visibilidade = (raw.visibilidade || 'todos') as FaqVisibilidade;
    if (!canRoleViewArticle(visibilidade, params.requesterRole)) {
      continue;
    }

    const catId = String(raw.categoria_id || '');
    if (catId && activeCategoryMap.size > 0 && !activeCategoryMap.has(catId)) {
      continue;
    }
    const categoryName = activeCategoryMap.get(catId) || String(raw.categoria_nome || '');

    const titleNorm = normalizeTextForSearch(`${raw.titulo || ''} ${raw.pergunta || ''}`);
    const kwNorm = normalizeTextForSearch(Array.isArray(raw.palavras_chave) ? raw.palavras_chave.join(' ') : '');
    const bodyText = String(raw.resposta_texto || extractPlainText(String(raw.resposta_html || '')));
    const bodyNorm = normalizeTextForSearch(bodyText);

    let score = Number(raw.prioridade ?? 50) * 0.01;
    for (const tk of tokens) {
      if (titleNorm.includes(tk)) score += 3;
      if (kwNorm.includes(tk)) score += 2.5;
      if (bodyNorm.includes(tk)) score += 1;
    }

    scored.push({
      article: {
        id: d.id,
        tenant_id: artTenant,
        tipo: raw.tipo || 'faq',
        titulo: String(raw.titulo || ''),
        pergunta: String(raw.pergunta || raw.titulo || ''),
        resposta_html: String(raw.resposta_html || ''),
        resposta_texto: bodyText,
        categoria_id: catId,
        categoria_nome: categoryName,
        palavras_chave: Array.isArray(raw.palavras_chave) ? raw.palavras_chave.map(String) : [],
        anexos: [],
        estado: 'publicado',
        prioridade: Number(raw.prioridade ?? 50),
        visibilidade,
        utilizavel_ia: true,
        visualizacoes: Number(raw.visualizacoes ?? 0),
        autor_id: String(raw.autor_id || ''),
        autor_nome: String(raw.autor_nome || ''),
        autor_email: String(raw.autor_email || ''),
        historico_alteracoes: [],
        created_at: String(raw.created_at || ''),
        updated_at: String(raw.updated_at || ''),
        updated_by: String(raw.updated_by || ''),
      },
      categoryName,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, params.limit || 5);

  return {
    references: top.map((t) => ({
      id: t.article.id,
      titulo: t.article.titulo,
      categoria_nome: t.categoryName,
      score: Number(t.score.toFixed(2)),
    })),
    snippets: top.map((t) => ({
      id: t.article.id,
      titulo: t.article.titulo,
      categoria: t.categoryName || 'Geral',
      texto: t.article.resposta_texto.slice(0, 1200),
    })),
  };
}

// ============================================================================
// MOTOR DE RESPOSTA IA (GEMINI STRUCTURED OUTPUT + N8N OUTBOUND)
// ============================================================================

interface StructuredAiModelReply {
  resposta: string;
  confianca: number;
  escalonar_humano: boolean;
  motivo_escalonamento?: string;
  artigos_referenciados?: string[];
}

async function invokeGeminiStructured(params: {
  config: SupportAiAgentConfig;
  agent: SupportAgent;
  subject: string;
  conversationText: string;
  faqSnippets: Array<{ id: string; titulo: string; categoria: string; texto: string }>;
}): Promise<StructuredAiModelReply> {
  const ai = getGeminiClient();

  const kbBlock =
    params.faqSnippets.length > 0
      ? params.faqSnippets
          .map(
            (s, idx) =>
              `[ARTIGO ${idx + 1}: "${s.titulo}" | Categoria: ${s.categoria}]\n${s.texto}`
          )
          .join('\n\n')
      : '[Nenhum artigo FAQ publicado marcado como utilizável pela IA correspondeu directamente a este pedido.]';

  const strictKbRule = params.config.usar_apenas_faq_autorizada
    ? 'REGRA CRÍTICA: Responda APENAS com factos presentes nos ARTIGOS FAQ fornecidos abaixo. Se a base de conhecimento não contiver informação suficiente para responder com segurança, defina "confianca" abaixo de 0.45 e "escalonar_humano": true.'
    : 'Utilize os ARTIGOS FAQ como fonte prioritária. Se houver dúvida operacional, fiscal, de alteração de dados críticos ou falta de contexto, defina "escalonar_humano": true.';

  const systemInstruction = [
    `És "${params.agent.nome}", agente virtual de atendimento do Sistema de Gestão Escolar (SGE).`,
    `Personalidade: ${params.config.personalidade}.`,
    `Idioma obrigatório de resposta: ${params.config.idioma_padrao || 'pt'} (Português claro e profissional, sem emojis).`,
    params.config.prompt_sistema,
    strictKbRule,
    'Nunca invente credenciais, notas académicas, pagamentos ou alterações em base de dados.',
    'Devolva exclusivamente JSON válido conforme o esquema definido.',
  ].join('\n\n');

  const userPrompt = [
    `ASSUNTO DO PEDIDO: ${params.subject}`,
    `HISTÓRICO DA CONVERSA:\n${params.conversationText}`,
    `BASE DE CONHECIMENTO AUTORIZADA (FAQ PUBLICADA PARA IA):\n${kbBlock}`,
  ].join('\n\n---\n\n');

  const modelName = params.config.modelo || DEFAULT_AI_MODEL;

  const generateWithRetry = async () => {
    const maxAttempts = 3;
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                resposta: {
                  type: Type.STRING,
                  description: 'Resposta factual e educada para o utilizador final, sem emojis.',
                },
                confianca: {
                  type: Type.NUMBER,
                  description: 'Pontuação de confiança entre 0.0 e 1.0.',
                },
                escalonar_humano: {
                  type: Type.BOOLEAN,
                  description: 'Verdadeiro se exigir intervenção humana.',
                },
                motivo_escalonamento: {
                  type: Type.STRING,
                  description: 'Motivo sucinto quando escalonar_humano é verdadeiro.',
                },
                artigos_referenciados: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Títulos dos artigos FAQ utilizados.',
                },
              },
              required: ['resposta', 'confianca', 'escalonar_humano'],
            },
          },
        });
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || err?.statusCode || 0);
        const rawMsg = String(err?.message || '');
        const isTransient =
          status === 429 ||
          status === 503 ||
          status === 504 ||
          /timeout|ECONNRESET|ETIMEDOUT|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(rawMsg);
        if (!isTransient || attempt >= maxAttempts) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }
    throw lastError;
  };

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await generateWithRetry();
  } catch (err: any) {
    if (err instanceof SupportAiError) throw err;
    const status = Number(err?.status || err?.statusCode || 0);
    const rawMsg = String(err?.message || '');
    if (status === 400 || /API_KEY_INVALID/i.test(rawMsg)) {
      throw new SupportAiError(
        'Chave ou parâmetro inválido ao contactar o serviço Gemini AI.',
        'ai_invalid_request',
        400
      );
    }
    if (status === 403 || /PERMISSION_DENIED/i.test(rawMsg)) {
      throw new SupportAiError(
        'Permissão negada pelo serviço Gemini AI para esta operação.',
        'ai_permission_denied',
        403
      );
    }
    if (status === 404 || /NOT_FOUND/i.test(rawMsg)) {
      throw new SupportAiError(
        `Modelo Gemini "${modelName}" indisponível ou não encontrado.`,
        'ai_model_not_found',
        400
      );
    }
    if (status === 429 || /RESOURCE_EXHAUSTED/i.test(rawMsg)) {
      throw new SupportAiError(
        'Limite de utilização do serviço Gemini AI atingido temporariamente. Tente novamente em instantes.',
        'ai_quota_exceeded',
        429
      );
    }
    throw new SupportAiError(
      'Não foi possível obter resposta do serviço Gemini AI neste momento.',
      'ai_upstream_error',
      502
    );
  }

  const rawText = (response.text || '').trim();
  if (!rawText) {
    throw new SupportAiError('O modelo Gemini devolveu uma resposta vazia.', 'ai_empty_response', 502);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new SupportAiError('Resposta estruturada inválida do modelo Gemini.', 'ai_invalid_json', 502);
  }

  return {
    resposta: String(parsed.resposta || '').trim(),
    confianca: Math.max(0, Math.min(1, Number(parsed.confianca ?? 0.5))),
    escalonar_humano: Boolean(parsed.escalonar_humano),
    motivo_escalonamento: parsed.motivo_escalonamento ? String(parsed.motivo_escalonamento).trim() : '',
    artigos_referenciados: Array.isArray(parsed.artigos_referenciados)
      ? parsed.artigos_referenciados.map(String)
      : [],
  };
}

async function invokeN8nWebhook(params: {
  webhookUrl: string;
  payload: Record<string, any>;
}): Promise<StructuredAiModelReply> {
  const safeUrl = assertSafeWebhookUrl(params.webhookUrl);
  if (!safeUrl) {
    throw new SupportAiError('URL do webhook n8n não configurado neste agente.', 'webhook_url_required', 400);
  }

  const secret = (process.env.N8N_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    throw new SupportAiError(
      'N8N_WEBHOOK_SECRET não está configurado no servidor para assinar pedidos n8n.',
      'n8n_secret_unconfigured',
      422
    );
  }

  const bodyStr = JSON.stringify(params.payload);
  const hmacHex = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SGE-Signature': `sha256=${hmacHex}`,
    'X-SGE-Timestamp': String(Date.now()),
  };
  const n8nApiKey = (process.env.N8N_API_KEY || '').trim();
  if (n8nApiKey) {
    headers['Authorization'] = `Bearer ${n8nApiKey}`;
  }

  let res: globalThis.Response;
  try {
    res = await fetch(safeUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err: any) {
    throw new SupportAiError(
      `Falha ao contactar webhook n8n: ${err?.message || 'timeout ou erro de rede'}`,
      'n8n_unreachable',
      502
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new SupportAiError(
      `Webhook n8n respondeu com HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`,
      'n8n_http_error',
      502
    );
  }

  const data: any = await res.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    throw new SupportAiError('Webhook n8n não devolveu um objecto JSON válido.', 'n8n_invalid_response', 502);
  }

  const resposta = String(data.resposta || data.reply || data.output || '').trim();
  if (!resposta && !data.escalonar_humano) {
    throw new SupportAiError('Webhook n8n não devolveu texto de resposta nem pedido de escalonamento.', 'n8n_empty_reply', 502);
  }

  return {
    resposta,
    confianca: Math.max(0, Math.min(1, Number(data.confianca ?? data.confidence ?? 0.85))),
    escalonar_humano: Boolean(data.escalonar_humano ?? data.escalate ?? false),
    motivo_escalonamento: String(data.motivo_escalonamento || data.reason || '').trim(),
    artigos_referenciados: Array.isArray(data.artigos_referenciados)
      ? data.artigos_referenciados.map(String)
      : [],
  };
}

// ============================================================================
// SANDBOX DE TESTE DO AGENTE IA
// ============================================================================

export async function testSupportAiSandbox(
  agentId: string,
  input: {
    mensagem: string;
    assunto?: string;
    tenant_id?: string;
    role?: string;
  }
): Promise<SupportAiSandboxResult | null> {
  const found = await getSupportAiAgentById(agentId);
  if (!found) return null;

  const { agent, config } = found;
  const startedAt = Date.now();

  const kb = await retrieveRelevantFaqForAi({
    queryText: `${input.assunto || ''} ${input.mensagem}`,
    tenantId: input.tenant_id || agent.tenant_id || 'global',
    requesterRole: input.role || 'tenant_admin',
    limit: 5,
  });

  // Evaluate keyword escalation rule immediately
  const combinedNorm = normalizeTextForSearch(`${input.assunto || ''} ${input.mensagem}`);
  const matchedKw = (config.palavras_chave_escalonamento || []).find((kw) =>
    combinedNorm.includes(normalizeTextForSearch(kw))
  );

  if (matchedKw) {
    return {
      agent_id: agent.id,
      agent_nome: agent.nome,
      modo_usado: config.modo_execucao,
      modelo: config.modelo,
      resposta: 'Solicitação identificada para encaminhamento directo à equipa humana.',
      confianca: 0,
      escalonar_humano: true,
      motivo_escalonamento: `Palavra-chave crítica detectada: "${matchedKw}"`,
      artigos_faq_usados: kb.references,
      latencia_ms: Date.now() - startedAt,
    };
  }

  let modeUsed: SupportAiExecutionMode = config.modo_execucao;
  let aiReply: StructuredAiModelReply;

  if (config.modo_execucao === 'n8n_webhook') {
    aiReply = await invokeN8nWebhook({
      webhookUrl: config.n8n_webhook_url || '',
      payload: {
        sandbox: true,
        agent_id: agent.id,
        agent_nome: agent.nome,
        tenant_id: input.tenant_id || 'global',
        assunto: input.assunto || 'Consulta de teste',
        mensagem: input.mensagem,
        artigos_faq: kb.snippets,
      },
    });
  } else if (config.modo_execucao === 'hibrido' && config.n8n_webhook_url) {
    try {
      aiReply = await invokeN8nWebhook({
        webhookUrl: config.n8n_webhook_url,
        payload: {
          sandbox: true,
          agent_id: agent.id,
          agent_nome: agent.nome,
          tenant_id: input.tenant_id || 'global',
          assunto: input.assunto || 'Consulta de teste',
          mensagem: input.mensagem,
          artigos_faq: kb.snippets,
        },
      });
      modeUsed = 'n8n_webhook';
    } catch {
      aiReply = await invokeGeminiStructured({
        config,
        agent,
        subject: input.assunto || 'Consulta de teste',
        conversationText: `[Utilizador]: ${input.mensagem}`,
        faqSnippets: kb.snippets,
      });
      modeUsed = 'gemini_direct';
    }
  } else {
    aiReply = await invokeGeminiStructured({
      config,
      agent,
      subject: input.assunto || 'Consulta de teste',
      conversationText: `[Utilizador]: ${input.mensagem}`,
      faqSnippets: kb.snippets,
    });
    modeUsed = 'gemini_direct';
  }

  const belowThreshold = aiReply.confianca < config.limiar_confianca;
  const strictKbMissing = config.usar_apenas_faq_autorizada && kb.references.length === 0 && aiReply.confianca < 0.85;
  const shouldEscalate = aiReply.escalonar_humano || belowThreshold || strictKbMissing;

  let motivo = aiReply.motivo_escalonamento || '';
  if (!motivo && belowThreshold) {
    motivo = `Confiança (${aiReply.confianca.toFixed(2)}) abaixo do limiar configurado (${config.limiar_confianca.toFixed(2)}).`;
  } else if (!motivo && strictKbMissing) {
    motivo = 'Sem cobertura suficiente na base de conhecimento FAQ autorizada para a IA.';
  }

  return {
    agent_id: agent.id,
    agent_nome: agent.nome,
    modo_usado: modeUsed,
    modelo: config.modelo,
    resposta: aiReply.resposta,
    confianca: aiReply.confianca,
    escalonar_humano: shouldEscalate,
    motivo_escalonamento: shouldEscalate ? motivo : undefined,
    artigos_faq_usados: kb.references,
    latencia_ms: Date.now() - startedAt,
  };
}

// ============================================================================
// EXECUÇÃO EM TICKETS REAIS & ESCALONAMENTO AUTOMÁTICO PARA EQUIPA HUMANA
// ============================================================================

async function resolveDefaultAiAgentForTicket(ticket: SupportTicket, explicitAgentId?: string): Promise<SupportAiAgentWithConfig | null> {
  if (explicitAgentId) {
    const chosen = await getSupportAiAgentById(explicitAgentId);
    if (!chosen) {
      throw new SupportAiError('Agente IA seleccionado não encontrado.', 'ai_agent_not_found', 404);
    }
    if (chosen.agent.estado !== 'activo') {
      throw new SupportAiError('O agente IA seleccionado não está activo.', 'ai_agent_inactive', 400);
    }
    return chosen;
  }

  if (ticket.responsavel_id && ticket.responsavel_tipo === 'ia') {
    const assigned = await getSupportAiAgentById(ticket.responsavel_id);
    if (assigned && assigned.agent.estado === 'activo') return assigned;
  }

  const { items } = await listSupportAiAgents({ estado: 'activo' });
  const deptMatch = items.find(
    (item) =>
      (item.agent.tenant_id === 'global' || item.agent.tenant_id === ticket.tenant_id) &&
      (item.agent.departamento_id === ticket.departamento_id ||
        item.agent.departamentos_autorizados.includes(ticket.departamento_id))
  );
  if (deptMatch) return deptMatch;

  return (
    items.find((item) => item.agent.tenant_id === 'global' || item.agent.tenant_id === ticket.tenant_id) || null
  );
}

async function applyAiReplyOrEscalationToTicket(params: {
  ticket: SupportTicket;
  agent: SupportAgent;
  config: SupportAiAgentConfig;
  reply: StructuredAiModelReply;
  faqReferences: SupportAiFaqReference[];
  modeUsed: SupportAiExecutionMode;
  actor: AuthenticatedUser;
  forceEscalateReason?: string;
}): Promise<SupportAiTicketExecutionResult> {
  const db = getFirestoreInstance();
  const { ticket, agent, config, reply, faqReferences, modeUsed, actor } = params;
  const nowIso = new Date().toISOString();

  const belowThreshold = reply.confianca < config.limiar_confianca;
  const strictKbMissing =
    config.usar_apenas_faq_autorizada && faqReferences.length === 0 && reply.confianca < 0.85;
  const mustEscalate = Boolean(params.forceEscalateReason) || reply.escalonar_humano || belowThreshold || strictKbMissing;

  if (mustEscalate) {
    const motivo =
      params.forceEscalateReason ||
      reply.motivo_escalonamento ||
      (belowThreshold
        ? `Confiança (${reply.confianca.toFixed(2)}) abaixo do limiar mínimo (${config.limiar_confianca.toFixed(2)}).`
        : 'Necessária verificação por especialista humano.');

    const targetDeptId = config.fallback_departamento_id || ticket.departamento_id;
    let targetDeptNome = config.fallback_departamento_nome || ticket.departamento_nome || 'Atendimento Geral';
    if (targetDeptId) {
      const dSnap = await db.collection(DEPARTMENTS_COL).doc(targetDeptId).get().catch(() => null);
      if (dSnap?.exists) targetDeptNome = String(dSnap.data()?.nome || targetDeptNome);
    }

    // 1) Internal note for human staff (NEVER shown to portal user)
    const internalRef = db.collection(MESSAGES_COL).doc();
    const internalNote: SupportMessage = {
      id: internalRef.id,
      ticket_id: ticket.id,
      tenant_id: ticket.tenant_id,
      remetente_id: agent.id,
      remetente_nome: agent.nome,
      remetente_tipo: 'ia',
      tipo: 'nota_interna',
      conteudo: `[Escalonamento Automático IA · Modo: ${modeUsed} · Confiança: ${reply.confianca.toFixed(2)}]\nMotivo: ${motivo}${
        faqReferences.length > 0
          ? `\nArtigos consultados: ${faqReferences.map((r) => r.titulo).join('; ')}`
          : ''
      }`,
      anexos: [],
      created_at: nowIso,
    };

    // 2) Public polite handoff message to user
    const handoffText =
      'A sua solicitação foi encaminhada para um especialista da nossa equipa de atendimento, que dará continuidade em breve.';
    const publicRef = db.collection(MESSAGES_COL).doc();
    const publicMsg: SupportMessage = {
      id: publicRef.id,
      ticket_id: ticket.id,
      tenant_id: ticket.tenant_id,
      remetente_id: agent.id,
      remetente_nome: agent.nome,
      remetente_tipo: 'ia',
      tipo: 'mensagem',
      conteudo: handoffText,
      anexos: [],
      created_at: new Date(Date.now() + 1).toISOString(),
    };

    const assignRef = db.collection(ASSIGNMENTS_COL).doc();
    const eventRef = db.collection(EVENTS_COL).doc();
    const ticketRef = db.collection(TICKETS_COL).doc(ticket.id);

    const batch = db.batch();
    batch.set(internalRef, internalNote);
    batch.set(publicRef, publicMsg);
    batch.set(assignRef, {
      id: assignRef.id,
      ticket_id: ticket.id,
      tenant_id: ticket.tenant_id,
      de_responsavel_id: ticket.responsavel_id || agent.id,
      de_responsavel_nome: ticket.responsavel_nome || agent.nome,
      para_responsavel_id: null,
      para_responsavel_nome: null,
      de_departamento_id: ticket.departamento_id,
      de_departamento_nome: ticket.departamento_nome || '',
      para_departamento_id: targetDeptId,
      para_departamento_nome: targetDeptNome,
      motivo: `Escalonamento automático IA: ${motivo}`,
      actor_id: actor.uid,
      actor_email: actor.email || 'ia-engine',
      created_at: nowIso,
    });
    batch.set(eventRef, {
      id: eventRef.id,
      ticket_id: ticket.id,
      tenant_id: ticket.tenant_id,
      tipo: 'escalado_humano',
      descricao: `Agente IA "${agent.nome}" escalonou o pedido para fila humana (${targetDeptNome}): ${motivo}`,
      actor_id: agent.id,
      actor_nome: agent.nome,
      metadata: {
        confianca: reply.confianca,
        motivo,
        departamento_destino: targetDeptId,
        modo: modeUsed,
      },
      created_at: nowIso,
    });
    batch.update(ticketRef, {
      departamento_id: targetDeptId,
      departamento_nome: targetDeptNome,
      responsavel_id: null,
      responsavel_nome: null,
      responsavel_tipo: null,
      estado: 'aberto',
      total_mensagens: Number(ticket.total_mensagens || 1) + 2,
      ultima_mensagem_por: 'ia',
      ultima_mensagem_preview: handoffText.slice(0, 180),
      ultima_interacao: nowIso,
      updated_at: nowIso,
    });
    batch.set(
      db.collection(AI_CONFIGS_COL).doc(agent.id),
      {
        total_interacoes: Number(config.total_interacoes || 0) + 1,
        total_escalonamentos: Number(config.total_escalonamentos || 0) + 1,
        ultima_execucao_em: nowIso,
        updated_at: nowIso,
      },
      { merge: true }
    );
    await batch.commit();

    if (ticket.responsavel_id === agent.id) {
      await recalculateSupportAgentLoad(agent.id);
    }

    // Notify Superadmin / support queue about escalated ticket
    try {
      await db.collection(NOTIFICATIONS_COL).add({
        tenant_id: 'global',
        destinatario_id: 'super_admin',
        destinatario_role: 'super_admin',
        titulo: `Ticket ${ticket.codigo} escalonado pela IA`,
        mensagem: `Agente "${agent.nome}" encaminhou "${ticket.assunto}" para ${targetDeptNome}: ${motivo}`,
        tipo: 'aviso',
        lido: false,
        ticket_id: ticket.id,
        link_tab: 'assistant_tickets',
        created_at: nowIso,
      });
    } catch {}

    const refreshed = await ticketRef.get();
    return {
      ticket: { ...ticket, ...(refreshed.data() || {}), id: ticket.id } as SupportTicket,
      message: publicMsg,
      escalonado: true,
      motivo_escalonamento: motivo,
      confianca: reply.confianca,
      artigos_faq_usados: faqReferences,
      modo_usado: modeUsed,
    };
  }

  // Confident AI Reply -> Publish message to ticket thread
  const msgRef = db.collection(MESSAGES_COL).doc();
  const aiMessage: SupportMessage = {
    id: msgRef.id,
    ticket_id: ticket.id,
    tenant_id: ticket.tenant_id,
    remetente_id: agent.id,
    remetente_nome: agent.nome,
    remetente_email: agent.email,
    remetente_tipo: 'ia',
    tipo: 'mensagem',
    conteudo: reply.resposta,
    anexos: [],
    created_at: nowIso,
  };

  const eventRef = db.collection(EVENTS_COL).doc();
  const ticketRef = db.collection(TICKETS_COL).doc(ticket.id);
  const ticketUpdates: Record<string, any> = {
    ultima_interacao: nowIso,
    ultima_mensagem_por: 'ia',
    ultima_mensagem_preview: reply.resposta.replace(/\s+/g, ' ').trim().slice(0, 180),
    total_mensagens: Number(ticket.total_mensagens || 1) + 1,
    updated_at: nowIso,
  };

  if (!ticket.primeira_resposta_em) {
    ticketUpdates.primeira_resposta_em = nowIso;
  }
  if (ticket.estado === 'aberto' || ticket.estado === 'reaberto') {
    ticketUpdates.estado = 'em_atendimento';
  }
  if (!ticket.responsavel_id) {
    ticketUpdates.responsavel_id = agent.id;
    ticketUpdates.responsavel_nome = agent.nome;
    ticketUpdates.responsavel_tipo = 'ia';
  }

  const batch = db.batch();
  batch.set(msgRef, aiMessage);
  batch.set(eventRef, {
    id: eventRef.id,
    ticket_id: ticket.id,
    tenant_id: ticket.tenant_id,
    tipo: 'ia_resposta',
    descricao: `Agente IA "${agent.nome}" respondeu (confiança ${Math.round(reply.confianca * 100)}%).`,
    actor_id: agent.id,
    actor_nome: agent.nome,
    metadata: {
      confianca: reply.confianca,
      modo: modeUsed,
      artigos_faq: faqReferences.map((r) => r.titulo),
    },
    created_at: nowIso,
  });
  batch.update(ticketRef, ticketUpdates);
  batch.set(
    db.collection(AI_CONFIGS_COL).doc(agent.id),
    {
      total_interacoes: Number(config.total_interacoes || 0) + 1,
      ultima_execucao_em: nowIso,
      updated_at: nowIso,
    },
    { merge: true }
  );
  await batch.commit();

  await recalculateSupportAgentLoad(agent.id);

  // Notify portal requester
  if (ticket.solicitante_id) {
    try {
      await db.collection(NOTIFICATIONS_COL).add({
        tenant_id: ticket.tenant_id,
        destinatario_id: ticket.solicitante_id,
        destinatario_role: ticket.solicitante_role || 'user',
        titulo: `Nova resposta no pedido ${ticket.codigo}`,
        mensagem: `${agent.nome} respondeu ao pedido "${ticket.assunto}".`,
        tipo: 'info',
        lido: false,
        ticket_id: ticket.id,
        link_tab: 'support_portal',
        created_at: nowIso,
      });
    } catch {}
  }

  const refreshed = await ticketRef.get();
  return {
    ticket: { ...ticket, ...(refreshed.data() || {}), id: ticket.id } as SupportTicket,
    message: aiMessage,
    escalonado: false,
    confianca: reply.confianca,
    artigos_faq_usados: faqReferences,
    modo_usado: modeUsed,
  };
}

export async function runSupportAiForTicket(params: {
  ticketId: string;
  agentId?: string;
  actor: AuthenticatedUser;
  idempotencyKey?: string;
}): Promise<SupportAiTicketExecutionResult | null> {
  const idem = await getIdempotentResult<SupportAiTicketExecutionResult>(
    `sup_ai_ticket_${params.ticketId}`,
    params.idempotencyKey
  );
  if (idem.hit && idem.data) {
    return idem.data;
  }

  const db = getFirestoreInstance();
  const ticketSnap = await db.collection(TICKETS_COL).doc(params.ticketId).get();
  if (!ticketSnap.exists) return null;

  const ticket = { ...(ticketSnap.data() || {}), id: ticketSnap.id } as SupportTicket;
  if (ticket.estado === 'resolvido') {
    throw new SupportAiError('Não é possível executar agente IA num ticket já resolvido.', 'ticket_resolved', 400);
  }

  const agentBundle = await resolveDefaultAiAgentForTicket(ticket, params.agentId);
  if (!agentBundle) {
    throw new SupportAiError(
      'Nenhum agente IA activo encontrado para este departamento.',
      'no_active_ai_agent',
      404
    );
  }

  const { agent, config } = agentBundle;

  const msgSnap = await db.collection(MESSAGES_COL).where('ticket_id', '==', ticket.id).get();
  const allMsgs = msgSnap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }) as SupportMessage)
    .filter((m: SupportMessage) => m.tipo === 'mensagem')
    .sort((a: SupportMessage, b: SupportMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const iaTurnCount = allMsgs.filter((m) => m.remetente_tipo === 'ia').length;
  const lastUserMsg = [...allMsgs].reverse().find((m) => m.remetente_tipo === 'utilizador')?.conteudo || ticket.assunto;

  // 1) Check IA Turn Limit
  if (iaTurnCount >= config.max_turnos_ia) {
    const escalated = await applyAiReplyOrEscalationToTicket({
      ticket,
      agent,
      config,
      reply: { resposta: '', confianca: 0, escalonar_humano: true },
      faqReferences: [],
      modeUsed: config.modo_execucao,
      actor: params.actor,
      forceEscalateReason: `Limite máximo de turnos automáticos IA atingido (${iaTurnCount}/${config.max_turnos_ia}).`,
    });
    await saveIdempotentResult(`sup_ai_ticket_${params.ticketId}`, params.idempotencyKey, escalated);
    return escalated;
  }

  // 2) Check Escalation Keywords
  const combinedNorm = normalizeTextForSearch(`${ticket.assunto} ${lastUserMsg}`);
  const matchedKw = (config.palavras_chave_escalonamento || []).find((kw) =>
    combinedNorm.includes(normalizeTextForSearch(kw))
  );
  if (matchedKw) {
    const escalated = await applyAiReplyOrEscalationToTicket({
      ticket,
      agent,
      config,
      reply: { resposta: '', confianca: 0, escalonar_humano: true },
      faqReferences: [],
      modeUsed: config.modo_execucao,
      actor: params.actor,
      forceEscalateReason: `Palavra-chave de escalonamento detectada: "${matchedKw}".`,
    });
    await saveIdempotentResult(`sup_ai_ticket_${params.ticketId}`, params.idempotencyKey, escalated);
    return escalated;
  }

  // 3) Retrieve Published AI-Usable Knowledge Base
  const kb = await retrieveRelevantFaqForAi({
    queryText: `${ticket.assunto} ${ticket.categoria} ${lastUserMsg}`,
    tenantId: ticket.tenant_id,
    requesterRole: ticket.solicitante_role,
    limit: 5,
  });

  const conversationText = allMsgs
    .slice(-10)
    .map((m) => `[${m.remetente_tipo === 'utilizador' ? 'Utilizador' : m.remetente_nome}]: ${m.conteudo}`)
    .join('\n');

  let modeUsed: SupportAiExecutionMode = config.modo_execucao;
  let aiReply: StructuredAiModelReply;

  if (config.modo_execucao === 'n8n_webhook') {
    aiReply = await invokeN8nWebhook({
      webhookUrl: config.n8n_webhook_url || '',
      payload: {
        sandbox: false,
        ticket_id: ticket.id,
        codigo: ticket.codigo,
        tenant_id: ticket.tenant_id,
        agent_id: agent.id,
        agent_nome: agent.nome,
        assunto: ticket.assunto,
        categoria: ticket.categoria,
        conversa: conversationText,
        artigos_faq: kb.snippets,
      },
    });
  } else if (config.modo_execucao === 'hibrido' && config.n8n_webhook_url) {
    try {
      aiReply = await invokeN8nWebhook({
        webhookUrl: config.n8n_webhook_url,
        payload: {
          sandbox: false,
          ticket_id: ticket.id,
          codigo: ticket.codigo,
          tenant_id: ticket.tenant_id,
          agent_id: agent.id,
          agent_nome: agent.nome,
          assunto: ticket.assunto,
          categoria: ticket.categoria,
          conversa: conversationText,
          artigos_faq: kb.snippets,
        },
      });
      modeUsed = 'n8n_webhook';
    } catch {
      aiReply = await invokeGeminiStructured({
        config,
        agent,
        subject: ticket.assunto,
        conversationText,
        faqSnippets: kb.snippets,
      });
      modeUsed = 'gemini_direct';
    }
  } else {
    aiReply = await invokeGeminiStructured({
      config,
      agent,
      subject: ticket.assunto,
      conversationText,
      faqSnippets: kb.snippets,
    });
    modeUsed = 'gemini_direct';
  }

  const executionResult = await applyAiReplyOrEscalationToTicket({
    ticket,
    agent,
    config,
    reply: aiReply,
    faqReferences: kb.references,
    modeUsed,
    actor: params.actor,
  });

  await saveIdempotentResult(`sup_ai_ticket_${params.ticketId}`, params.idempotencyKey, executionResult);
  return executionResult;
}

// ============================================================================
// WEBHOOK INBOUND ASSINADO (CALLBACK N8N -> SGE)
// ============================================================================

export function verifyN8nWebhookRequest(params: {
  rawBody: Buffer | string;
  signatureHeader?: string;
  bearerHeader?: string;
  secretHeader?: string;
}): { ok: boolean; status: number; error?: string } {
  const configuredSecret = (process.env.N8N_WEBHOOK_SECRET || '').trim();
  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      error: 'N8N_WEBHOOK_SECRET não está configurado no servidor.',
    };
  }

  const sig = String(params.signatureHeader || '').trim();
  if (sig) {
    const providedHex = sig.startsWith('sha256=') ? sig.slice(7).trim() : sig;
    const expectedHex = crypto
      .createHmac('sha256', configuredSecret)
      .update(params.rawBody)
      .digest('hex');

    if (providedHex && timingSafeCompare(providedHex, expectedHex)) {
      return { ok: true, status: 200 };
    }
    return { ok: false, status: 401, error: 'Assinatura HMAC X-SGE-Signature inválida.' };
  }

  const bearer = String(params.bearerHeader || '').startsWith('Bearer ')
    ? String(params.bearerHeader).slice(7).trim()
    : '';
  const altSecret = String(params.secretHeader || '').trim();
  const token = bearer || altSecret;

  if (token && timingSafeCompare(token, configuredSecret)) {
    return { ok: true, status: 200 };
  }

  return { ok: false, status: 401, error: 'Credenciais ou assinatura do webhook n8n ausentes ou inválidas.' };
}

export async function handleN8nInboundReply(input: {
  ticket_id: string;
  agent_id: string;
  resposta?: string;
  confianca: number;
  escalonar_humano: boolean;
  motivo_escalonamento?: string;
  artigos_referenciados?: string[];
  idempotencyKey?: string;
}): Promise<SupportAiTicketExecutionResult | null> {
  const idem = await getIdempotentResult<SupportAiTicketExecutionResult>(
    `sup_n8n_in_${input.ticket_id}`,
    input.idempotencyKey
  );
  if (idem.hit && idem.data) {
    return idem.data;
  }

  const db = getFirestoreInstance();
  const [ticketSnap, agentBundle] = await Promise.all([
    db.collection(TICKETS_COL).doc(input.ticket_id).get(),
    getSupportAiAgentById(input.agent_id),
  ]);

  if (!ticketSnap.exists || !agentBundle) {
    return null;
  }

  const ticket = { ...(ticketSnap.data() || {}), id: ticketSnap.id } as SupportTicket;
  if (!input.escalonar_humano && !String(input.resposta || '').trim()) {
    throw new SupportAiError(
      'O callback n8n deve fornecer uma resposta ou definir escalonar_humano=true.',
      'n8n_invalid_payload',
      400
    );
  }

  const refs: SupportAiFaqReference[] = (input.artigos_referenciados || []).map((t, i) => ({
    id: `n8n_ref_${i}`,
    titulo: t,
    score: 1,
  }));

  const res = await applyAiReplyOrEscalationToTicket({
    ticket,
    agent: agentBundle.agent,
    config: agentBundle.config,
    reply: {
      resposta: String(input.resposta || '').trim(),
      confianca: input.confianca,
      escalonar_humano: input.escalonar_humano,
      motivo_escalonamento: input.motivo_escalonamento,
      artigos_referenciados: input.artigos_referenciados,
    },
    faqReferences: refs,
    modeUsed: 'n8n_webhook',
    actor: {
      uid: agentBundle.agent.id,
      email: 'n8n-webhook@sge.local',
      role: 'system',
      tenant_id: ticket.tenant_id,
    },
  });

  await saveIdempotentResult(`sup_n8n_in_${input.ticket_id}`, input.idempotencyKey, res);
  return res;
}
