/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Helpdesk: Tickets, Conversas, Notas Internas, Transferências e Avaliações (Fase 3)
 * - Isolamento multi-tenant estrito e controlo de acesso por escopo/permissões
 * - Notas internas invisíveis para o utilizador final em toda e qualquer resposta do portal
 * - Anexos validados por magic-bytes com descarga autenticada e isolada
 * - Alertas automáticos de SLA e solicitações sem resposta calculados em tempo real
 * - Recálculo automático de carga_actual nos agentes humanos atribuídos
 * - Integração directa com o sistema de notificações existente e audit_logs
 */

import crypto from 'crypto';
import { AuthenticatedUser, getFirestoreInstance } from '../middleware/auth';
import { canAccessTicketScope, SupportAuthContext } from '../middleware/supportAuth';
import { recordAuditLog } from '../security/audit';
import { validateFileMagicBytes } from '../security/fileValidator';
import { listSupportDepartments } from './supportTeamService';
import type {
  SupportAgent,
  SupportAssignmentRecord,
  SupportAttachment,
  SupportDepartment,
  SupportEvent,
  SupportMessage,
  SupportMessageType,
  SupportRating,
  SupportSenderType,
  SupportSlaStatus,
  SupportTicket,
  SupportTicketInboxSummary,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../src/types';

const TICKETS_COL = 'support_tickets';
const MESSAGES_COL = 'support_messages';
const ASSIGNMENTS_COL = 'support_assignments';
const RATINGS_COL = 'support_ratings';
const EVENTS_COL = 'support_events';
const ATTACHMENTS_COL = 'support_attachments';
const DEPARTMENTS_COL = 'support_departments';
const AGENTS_COL = 'support_agents';
const NOTIFICATIONS_COL = 'notificacoes';
const TENANTS_COL = 'tenants';
const FAQ_CATEGORIES_COL = 'faq_categories';
const IDEMPOTENCY_COL = 'idempotency_keys';

const MAX_ATTACHMENT_BYTES = 700 * 1024; // 700 KB per file

function getActorDisplayName(actor: AuthenticatedUser, fallback = 'Utilizador'): string {
  return String((actor as any).nome || (actor as any).name || actor.email || fallback);
}

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isTenantAdminRole(role?: string): boolean {
  const r = String(role || '').toLowerCase().trim();
  return ['admin', 'tenant_admin', 'director', 'administrador', 'super_admin', 'superadmin'].includes(r);
}

function isSuperAdminRole(role?: string): boolean {
  const r = String(role || '').toLowerCase().trim();
  return r === 'super_admin' || r === 'superadmin';
}

function generateTicketCode(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TK-${y}${m}${d}-${suffix}`;
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

async function createSupportNotification(params: {
  tenantId: string;
  destinatarioId: string;
  destinatarioRole?: string;
  titulo: string;
  mensagem: string;
  tipo?: 'info' | 'aviso' | 'sucesso' | 'urgente';
  ticketId: string;
  linkTab?: string;
}): Promise<void> {
  if (!params.destinatarioId) return;
  try {
    const db = getFirestoreInstance();
    await db.collection(NOTIFICATIONS_COL).add({
      tenant_id: params.tenantId || 'global',
      destinatario_id: params.destinatarioId,
      destinatario_role: params.destinatarioRole || 'all',
      titulo: params.titulo,
      mensagem: params.mensagem,
      tipo: params.tipo || 'info',
      lido: false,
      ticket_id: params.ticketId,
      link_tab: params.linkTab || 'support_portal',
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('[SupportTickets] Falha não bloqueante ao emitir notificação:', err?.message);
  }
}

async function recordTicketEvent(params: {
  ticketId: string;
  tenantId: string;
  tipo: SupportEvent['tipo'];
  descricao: string;
  actorId: string;
  actorNome: string;
  metadata?: Record<string, any>;
}): Promise<SupportEvent> {
  const db = getFirestoreInstance();
  const ref = db.collection(EVENTS_COL).doc();
  const event: SupportEvent = {
    id: ref.id,
    ticket_id: params.ticketId,
    tenant_id: params.tenantId,
    tipo: params.tipo,
    descricao: params.descricao,
    actor_id: params.actorId,
    actor_nome: params.actorNome,
    metadata: params.metadata || {},
    created_at: new Date().toISOString(),
  };
  await ref.set(event);
  return event;
}

export async function recalculateSupportAgentLoad(agentId?: string | null): Promise<void> {
  if (!agentId) return;
  try {
    const db = getFirestoreInstance();
    const agentRef = db.collection(AGENTS_COL).doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return;

    const ticketsSnap = await db.collection(TICKETS_COL).where('responsavel_id', '==', agentId).get();
    let activeCount = 0;
    for (const d of ticketsSnap.docs) {
      const st = String(d.data()?.estado || '');
      if (st !== 'resolvido') {
        activeCount++;
      }
    }
    await agentRef.update({
      carga_actual: activeCount,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('[SupportTickets] Falha ao recalcular carga_actual:', err?.message);
  }
}

async function resolveDepartmentByIdOrDefault(departamentoId?: string): Promise<SupportDepartment> {
  const db = getFirestoreInstance();
  if (departamentoId && departamentoId.trim()) {
    const snap = await db.collection(DEPARTMENTS_COL).doc(departamentoId.trim()).get();
    if (snap.exists) {
      const data = snap.data() || {};
      return {
        id: snap.id,
        tenant_id: String(data.tenant_id || 'global'),
        nome: String(data.nome || 'Atendimento Geral'),
        slug: String(data.slug || 'geral'),
        sla_resposta_minutos: Number(data.sla_resposta_minutos ?? 60),
        sla_resolucao_horas: Number(data.sla_resolucao_horas ?? 24),
        ordem: Number(data.ordem ?? 0),
        ativo: data.ativo !== false,
        padrao: Boolean(data.padrao),
        created_at: String(data.created_at || ''),
        updated_at: String(data.updated_at || ''),
        created_by: String(data.created_by || ''),
        updated_by: String(data.updated_by || ''),
      };
    }
  }

  const all = await listSupportDepartments({ includeInactive: false });
  const chosen = all.find((d) => d.padrao) || all[0];
  if (chosen) return chosen;

  return {
    id: 'geral',
    tenant_id: 'global',
    nome: 'Atendimento Geral',
    slug: 'atendimento-geral',
    sla_resposta_minutos: 60,
    sla_resolucao_horas: 24,
    ordem: 0,
    ativo: true,
    padrao: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'system',
    updated_by: 'system',
  };
}

async function resolveTenantDisplayName(tenantId: string): Promise<string> {
  if (!tenantId || tenantId === 'global') return 'Global / Plataforma SGE';
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection(TENANTS_COL).doc(tenantId).get();
    if (snap.exists) {
      return String(snap.data()?.nome || snap.data()?.name || tenantId);
    }
  } catch {}
  return tenantId;
}

function enrichTicketLiveMetrics(raw: Record<string, any>, docId: string, nowMs = Date.now()): SupportTicket {
  const estado = (raw.estado || 'aberto') as SupportTicketStatus;
  const dataAbertura = String(raw.data_abertura || raw.created_at || new Date(nowMs).toISOString());
  const ultimaInteracao = String(raw.ultima_interacao || dataAbertura);
  const slaRespEm = String(raw.sla_resposta_em || new Date(new Date(dataAbertura).getTime() + 60 * 60_000).toISOString());
  const slaResEm = String(raw.sla_resolucao_em || new Date(new Date(dataAbertura).getTime() + 24 * 3600_000).toISOString());
  const primeiraResp = raw.primeira_resposta_em ? String(raw.primeira_resposta_em) : null;
  const ultimaPor = (raw.ultima_mensagem_por || 'utilizador') as SupportSenderType;

  let slaStatus: SupportSlaStatus = 'ok';
  let semRespostaAlerta = false;
  let semRespostaMin = 0;

  if (estado !== 'resolvido') {
    const aberturaMs = new Date(dataAbertura).getTime() || nowMs;
    const respMs = new Date(slaRespEm).getTime() || aberturaMs + 60 * 60_000;
    const resMs = new Date(slaResEm).getTime() || aberturaMs + 24 * 3600_000;
    const lastMs = new Date(ultimaInteracao).getTime() || aberturaMs;

    if (ultimaPor === 'utilizador') {
      semRespostaMin = Math.max(0, Math.floor((nowMs - lastMs) / 60_000));
    }

    const waitingFirstReply = !primeiraResp;
    const activeDeadline = waitingFirstReply ? Math.min(respMs, resMs) : resMs;
    const totalWindow = Math.max(60_000, activeDeadline - aberturaMs);
    const remaining = activeDeadline - nowMs;

    if (remaining <= 0) {
      slaStatus = 'violado';
    } else if (remaining <= Math.max(20 * 60_000, totalWindow * 0.25)) {
      slaStatus = 'em_risco';
    }

    const respSlaThresholdMin = Math.max(15, Math.floor((respMs - aberturaMs) / 60_000 * 0.75));
    if (
      (ultimaPor === 'utilizador' && semRespostaMin >= respSlaThresholdMin) ||
      slaStatus !== 'ok'
    ) {
      semRespostaAlerta = true;
    }
  }

  return {
    id: docId,
    codigo: String(raw.codigo || docId.slice(0, 8).toUpperCase()),
    tenant_id: String(raw.tenant_id || 'global'),
    tenant_nome: raw.tenant_nome ? String(raw.tenant_nome) : undefined,
    solicitante_id: String(raw.solicitante_id || ''),
    solicitante_nome: String(raw.solicitante_nome || 'Utilizador'),
    solicitante_email: String(raw.solicitante_email || ''),
    solicitante_role: String(raw.solicitante_role || 'user'),
    assunto: String(raw.assunto || ''),
    categoria: String(raw.categoria || 'Geral'),
    departamento_id: String(raw.departamento_id || 'geral'),
    departamento_nome: raw.departamento_nome ? String(raw.departamento_nome) : undefined,
    responsavel_id: raw.responsavel_id ? String(raw.responsavel_id) : null,
    responsavel_nome: raw.responsavel_nome ? String(raw.responsavel_nome) : null,
    responsavel_tipo: raw.responsavel_tipo || null,
    prioridade: (raw.prioridade || 'normal') as SupportTicketPriority,
    estado,
    canal: raw.canal || 'portal',
    total_mensagens: Number(raw.total_mensagens ?? 1),
    ultima_mensagem_por: ultimaPor,
    ultima_mensagem_preview: raw.ultima_mensagem_preview ? String(raw.ultima_mensagem_preview) : '',
    data_abertura: dataAbertura,
    ultima_interacao: ultimaInteracao,
    primeira_resposta_em: primeiraResp,
    resolvido_em: raw.resolvido_em ? String(raw.resolvido_em) : null,
    reaberto_em: raw.reaberto_em ? String(raw.reaberto_em) : null,
    sla_resposta_em: slaRespEm,
    sla_resolucao_em: slaResEm,
    sla_status: slaStatus,
    sem_resposta_alerta: semRespostaAlerta,
    sem_resposta_ha_minutos: semRespostaMin,
    avaliacao_nota: typeof raw.avaliacao_nota === 'number' ? raw.avaliacao_nota : null,
    avaliacao_comentario: raw.avaliacao_comentario ? String(raw.avaliacao_comentario) : null,
    avaliado_em: raw.avaliado_em ? String(raw.avaliado_em) : null,
    created_at: String(raw.created_at || dataAbertura),
    updated_at: String(raw.updated_at || ultimaInteracao),
  };
}

function canPortalUserAccessTicket(user: AuthenticatedUser, ticket: SupportTicket): boolean {
  if (isSuperAdminRole(user.role)) return true;
  if (!user.tenant_id || ticket.tenant_id !== user.tenant_id) return false;
  if (isTenantAdminRole(user.role)) return true;
  if (ticket.solicitante_id && ticket.solicitante_id === user.uid) return true;
  if (
    user.email &&
    ticket.solicitante_email &&
    ticket.solicitante_email.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// ANEXOS DE TICKETS (MAGIC BYTES + ISOLAMENTO)
// ============================================================================

export async function uploadSupportAttachment(
  input: {
    fileName: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
    base64Data: string;
    ticketId?: string;
  },
  actor: AuthenticatedUser
): Promise<SupportAttachment> {
  const cleanB64 = String(input.base64Data || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanB64) {
    throw new Error('Conteúdo de ficheiro em base64 ausente.');
  }

  const buffer = Buffer.from(cleanB64, 'base64');
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Ficheiro excede o limite de ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB por anexo.`);
  }

  const safeName = String(input.fileName || 'anexo')
    .replace(/[^\w.\-()\s]/g, '_')
    .slice(0, 160);
  const validation = validateFileMagicBytes(buffer, safeName, input.mimeType);
  if (!validation.valid) {
    throw new Error(validation.error || 'Formato de ficheiro rejeitado pela verificação de assinatura binária.');
  }

  const finalName = validation.sanitizedFilename || safeName;
  const detectedMime = validation.mimeType || input.mimeType;
  const kind: 'image' | 'pdf' = detectedMime === 'application/pdf' ? 'pdf' : 'image';
  const tenantId = actor.tenant_id || 'global';

  const db = getFirestoreInstance();
  const ref = db.collection(ATTACHMENTS_COL).doc();
  const now = new Date().toISOString();

  await ref.set({
    id: ref.id,
    tenant_id: tenantId,
    ticket_id: input.ticketId || null,
    uploaded_by: actor.uid,
    nome: finalName,
    tipo: kind,
    mime_type: detectedMime,
    tamanho_bytes: buffer.length,
    data_base64: cleanB64,
    created_at: now,
  });

  return {
    id: ref.id,
    nome: finalName,
    tipo: kind,
    mime_type: detectedMime,
    tamanho_bytes: buffer.length,
    url: `/api/support/attachments/${ref.id}`,
  };
}

export async function getSupportAttachmentForCaller(
  attachmentId: string,
  caller: AuthenticatedUser,
  supportContext?: SupportAuthContext | null
): Promise<{ nome: string; mime_type: string; buffer: Buffer } | null> {
  const db = getFirestoreInstance();
  const snap = await db.collection(ATTACHMENTS_COL).doc(attachmentId).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  const attTenant = String(data.tenant_id || 'global');

  let allowed = false;
  if (supportContext?.isSuperAdmin) {
    allowed = true;
  } else if (supportContext?.agent && supportContext.agent.estado === 'activo') {
    const staffTenant = supportContext.agent.tenant_id || 'global';
    allowed = staffTenant === 'global' || staffTenant === attTenant;
  } else if (caller.tenant_id && (caller.tenant_id === attTenant || data.uploaded_by === caller.uid)) {
    allowed = true;
  }

  if (!allowed) {
    throw new Error('FORBIDDEN_ATTACHMENT');
  }

  const b64 = String(data.data_base64 || '');
  if (!b64) return null;
  return {
    nome: String(data.nome || 'anexo'),
    mime_type: String(data.mime_type || 'application/octet-stream'),
    buffer: Buffer.from(b64, 'base64'),
  };
}

// ============================================================================
// METADADOS DO PORTAL DE SUPORTE (DEPARTAMENTOS + CATEGORIAS)
// ============================================================================

export async function getSupportPortalMeta(tenantId?: string): Promise<{
  departments: Array<{ id: string; nome: string; sla_resposta_minutos: number; sla_resolucao_horas: number }>;
  categories: string[];
}> {
  const db = getFirestoreInstance();
  const [depts, faqCatSnap] = await Promise.all([
    listSupportDepartments({ tenantId, includeInactive: false }),
    db.collection(FAQ_CATEGORIES_COL).get(),
  ]);

  const catSet = new Set<string>([
    'Matrículas e Admissões',
    'Pagamentos e Propinas',
    'Pautas e Avaliações',
    'Acesso e Credenciais',
    'Suporte Técnico',
    'Geral',
  ]);

  for (const d of faqCatSnap.docs) {
    const data = d.data() || {};
    if (data.ativo === false) continue;
    const catTenant = String(data.tenant_id || 'global');
    if (catTenant === 'global' || (tenantId && catTenant === tenantId)) {
      if (data.nome) catSet.add(String(data.nome));
    }
  }

  return {
    departments: depts.map((d) => ({
      id: d.id,
      nome: d.nome,
      sla_resposta_minutos: d.sla_resposta_minutos,
      sla_resolucao_horas: d.sla_resolucao_horas,
    })),
    categories: Array.from(catSet),
  };
}

// ============================================================================
// CRIAÇÃO E LISTAGEM DE TICKETS
// ============================================================================

export async function createSupportTicket(
  input: {
    tenant_id?: string;
    assunto: string;
    categoria?: string;
    departamento_id?: string;
    prioridade?: SupportTicketPriority;
    mensagem: string;
    anexos?: SupportAttachment[];
    solicitante_id?: string;
    solicitante_nome?: string;
    solicitante_email?: string;
    responsavel_id?: string | null;
    canal?: 'portal' | 'superadmin' | 'ia';
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ ticket: SupportTicket; message: SupportMessage; idempotent: boolean }> {
  const idem = await getIdempotentResult<{ ticket: SupportTicket; message: SupportMessage }>(
    'sup_ticket_create',
    input.idempotencyKey
  );
  if (idem.hit && idem.data) {
    return { ...idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const targetTenant = (input.tenant_id || actor.tenant_id || '').trim();
  if (!targetTenant) {
    throw new Error('Identificador da instituição (tenant_id) obrigatório para abrir solicitação.');
  }

  const dept = await resolveDepartmentByIdOrDefault(input.departamento_id);
  const tenantNome = await resolveTenantDisplayName(targetTenant);

  let responsavelId: string | null = null;
  let responsavelNome: string | null = null;
  let responsavelTipo: 'humano' | 'ia' | null = null;
  let assigneeUid: string | null = null;

  if (input.responsavel_id) {
    const agentSnap = await db.collection(AGENTS_COL).doc(input.responsavel_id).get();
    if (!agentSnap.exists) {
      throw new Error('Responsável seleccionado não encontrado.');
    }
    const agentData = agentSnap.data() || {};
    if (agentData.estado !== 'activo') {
      throw new Error('Não é possível atribuir um ticket a um funcionário inactivo ou arquivado.');
    }
    responsavelId = agentSnap.id;
    responsavelNome = String(agentData.nome || agentData.email || '');
    responsavelTipo = agentData.tipo === 'ia' ? 'ia' : 'humano';
    assigneeUid = agentData.uid ? String(agentData.uid) : null;
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const slaRespMin = Number(dept.sla_resposta_minutos || 60);
  const slaResHoras = Number(dept.sla_resolucao_horas || 24);
  const slaRespostaEm = new Date(nowDate.getTime() + slaRespMin * 60_000).toISOString();
  const slaResolucaoEm = new Date(nowDate.getTime() + slaResHoras * 3600_000).toISOString();

  const canal = input.canal || 'portal';
  const isStaffOpening = canal === 'superadmin';
  const solicitanteId = input.solicitante_id || actor.uid;
  const solicitanteNome = input.solicitante_nome || getActorDisplayName(actor, 'Utilizador');
  const solicitanteEmail = input.solicitante_email || actor.email || '';
  const initialSenderType: SupportSenderType = isStaffOpening ? 'funcionario' : 'utilizador';
  const initialEstado: SupportTicketStatus = responsavelId ? 'em_atendimento' : 'aberto';

  const ticketRef = db.collection(TICKETS_COL).doc();
  const codigo = generateTicketCode();
  const attachments = Array.isArray(input.anexos) ? input.anexos : [];
  const preview = String(input.mensagem || '').replace(/\s+/g, ' ').trim().slice(0, 180);

  const ticketDoc: Record<string, any> = {
    id: ticketRef.id,
    codigo,
    tenant_id: targetTenant,
    tenant_nome: tenantNome,
    solicitante_id: solicitanteId,
    solicitante_nome: solicitanteNome,
    solicitante_email: solicitanteEmail,
    solicitante_role: actor.role || 'user',
    assunto: String(input.assunto || '').trim(),
    categoria: String(input.categoria || 'Geral').trim(),
    departamento_id: dept.id,
    departamento_nome: dept.nome,
    responsavel_id: responsavelId,
    responsavel_nome: responsavelNome,
    responsavel_tipo: responsavelTipo,
    prioridade: input.prioridade || 'normal',
    estado: initialEstado,
    canal,
    total_mensagens: 1,
    ultima_mensagem_por: initialSenderType,
    ultima_mensagem_preview: preview,
    data_abertura: nowIso,
    ultima_interacao: nowIso,
    primeira_resposta_em: isStaffOpening ? nowIso : null,
    resolvido_em: null,
    reaberto_em: null,
    sla_resposta_em: slaRespostaEm,
    sla_resolucao_em: slaResolucaoEm,
    avaliacao_nota: null,
    avaliacao_comentario: null,
    avaliado_em: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await ticketRef.set(ticketDoc);

  const msgRef = db.collection(MESSAGES_COL).doc();
  const initialMessage: SupportMessage = {
    id: msgRef.id,
    ticket_id: ticketRef.id,
    tenant_id: targetTenant,
    remetente_id: actor.uid,
    remetente_nome: isStaffOpening ? getActorDisplayName(actor, 'Equipa de Suporte') : solicitanteNome,
    remetente_email: actor.email || solicitanteEmail,
    remetente_tipo: initialSenderType,
    tipo: 'mensagem',
    conteudo: String(input.mensagem || '').trim(),
    anexos: attachments,
    created_at: nowIso,
  };
  await msgRef.set(initialMessage);

  if (responsavelId) {
    const assignRef = db.collection(ASSIGNMENTS_COL).doc();
    await assignRef.set({
      id: assignRef.id,
      ticket_id: ticketRef.id,
      tenant_id: targetTenant,
      de_responsavel_id: null,
      de_responsavel_nome: null,
      para_responsavel_id: responsavelId,
      para_responsavel_nome: responsavelNome,
      de_departamento_id: null,
      de_departamento_nome: null,
      para_departamento_id: dept.id,
      para_departamento_nome: dept.nome,
      motivo: 'Atribuição inicial na criação da solicitação',
      actor_id: actor.uid,
      actor_email: actor.email || 'system',
      created_at: nowIso,
    });
    await recalculateSupportAgentLoad(responsavelId);
  }

  await recordTicketEvent({
    ticketId: ticketRef.id,
    tenantId: targetTenant,
    tipo: 'ticket_criado',
    descricao: `Solicitação ${codigo} aberta na fila ${dept.nome}.`,
    actorId: actor.uid,
    actorNome: getActorDisplayName(actor, solicitanteNome),
    metadata: { prioridade: ticketDoc.prioridade, departamento_id: dept.id },
  });

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email || 'unknown',
    actor_role: actor.role || 'user',
    action: 'create',
    entity: 'support_tickets',
    entity_id: ticketRef.id,
    tenant_id: targetTenant,
    metadata: { codigo, assunto: ticketDoc.assunto, departamento: dept.nome, prioridade: ticketDoc.prioridade },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  // Notify Superadmin / Assignee when ticket opened by user
  if (!isStaffOpening) {
    await createSupportNotification({
      tenantId: 'global',
      destinatarioId: 'super_admin',
      destinatarioRole: 'super_admin',
      titulo: `Nova solicitação de suporte (${codigo})`,
      mensagem: `${solicitanteNome} (${tenantNome}) abriu o pedido "${ticketDoc.assunto}".`,
      tipo: ticketDoc.prioridade === 'urgente' ? 'urgente' : 'info',
      ticketId: ticketRef.id,
      linkTab: 'assistant_tickets',
    });
  }
  if (assigneeUid && assigneeUid !== actor.uid) {
    await createSupportNotification({
      tenantId: 'global',
      destinatarioId: assigneeUid,
      destinatarioRole: 'suporte',
      titulo: `Novo ticket atribuído (${codigo})`,
      mensagem: `A solicitação "${ticketDoc.assunto}" foi atribuída a si.`,
      tipo: 'info',
      ticketId: ticketRef.id,
      linkTab: 'assistant_tickets',
    });
  }

  let finalTicket = enrichTicketLiveMetrics(ticketDoc, ticketRef.id);
  if (!responsavelId) {
    const { autoDistributeNewTicketSafe } = await import('./supportDistributionService');
    const afterDist = await autoDistributeNewTicketSafe(
      finalTicket,
      String(input.mensagem || ''),
      actor,
      meta
    );
    finalTicket = enrichTicketLiveMetrics(afterDist, ticketRef.id);
  }

  await saveIdempotentResult('sup_ticket_create', input.idempotencyKey, {
    ticket: finalTicket,
    message: initialMessage,
  });

  return { ticket: finalTicket, message: initialMessage, idempotent: false };
}

export async function listSupportTicketsForAdmin(
  ctx: SupportAuthContext,
  filters?: {
    tenant_id?: string;
    estado?: SupportTicketStatus | 'todos';
    prioridade?: SupportTicketPriority | 'todas';
    departamento_id?: string;
    responsavel_id?: string;
    categoria?: string;
    data_inicio?: string;
    data_fim?: string;
    apenas_alertas?: boolean;
    q?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: SupportTicketInboxSummary;
}> {
  const db = getFirestoreInstance();
  const snap = await db.collection(TICKETS_COL).get();
  const nowMs = Date.now();

  const accessible: SupportTicket[] = [];
  for (const d of snap.docs) {
    const ticket = enrichTicketLiveMetrics(d.data() || {}, d.id, nowMs);
    if (!canAccessTicketScope(ctx, ticket)) continue;
    accessible.push(ticket);
  }

  // Compute live summary across all accessible tickets
  const summary: SupportTicketInboxSummary = {
    total: accessible.length,
    abertos: 0,
    emAtendimento: 0,
    pendentes: 0,
    resolvidos: 0,
    reabertos: 0,
    alertasSla: 0,
    semResposta: 0,
  };
  for (const t of accessible) {
    if (t.estado === 'aberto') summary.abertos++;
    else if (t.estado === 'em_atendimento') summary.emAtendimento++;
    else if (t.estado === 'pendente') summary.pendentes++;
    else if (t.estado === 'resolvido') summary.resolvidos++;
    else if (t.estado === 'reaberto') summary.reabertos++;

    if (t.estado !== 'resolvido') {
      if (t.sla_status !== 'ok') summary.alertasSla++;
      if (t.sem_resposta_alerta) summary.semResposta++;
    }
  }

  const qNorm = normalizeText(filters?.q || '');
  const startMs = filters?.data_inicio ? new Date(filters.data_inicio).getTime() : NaN;
  const endMs = filters?.data_fim ? new Date(`${filters.data_fim}T23:59:59.999Z`).getTime() : NaN;

  const filtered = accessible.filter((t) => {
    if (filters?.tenant_id && filters.tenant_id !== 'todos' && t.tenant_id !== filters.tenant_id) return false;
    if (filters?.estado && filters.estado !== 'todos' && t.estado !== filters.estado) return false;
    if (filters?.prioridade && filters.prioridade !== 'todas' && t.prioridade !== filters.prioridade) return false;
    if (filters?.departamento_id && filters.departamento_id !== 'todos' && t.departamento_id !== filters.departamento_id)
      return false;
    if (filters?.responsavel_id && filters.responsavel_id !== 'todos') {
      if (filters.responsavel_id === '__unassigned__') {
        if (t.responsavel_id) return false;
      } else if (t.responsavel_id !== filters.responsavel_id) {
        return false;
      }
    }
    if (filters?.categoria && filters.categoria !== 'todas' && normalizeText(t.categoria) !== normalizeText(filters.categoria)) {
      return false;
    }
    if (filters?.apenas_alertas) {
      if (t.estado === 'resolvido') return false;
      if (t.sla_status === 'ok' && !t.sem_resposta_alerta) return false;
    }
    if (!Number.isNaN(startMs)) {
      const opened = new Date(t.data_abertura).getTime();
      if (opened < startMs) return false;
    }
    if (!Number.isNaN(endMs)) {
      const opened = new Date(t.data_abertura).getTime();
      if (opened > endMs) return false;
    }
    if (qNorm) {
      const hay = normalizeText(
        `${t.codigo} ${t.assunto} ${t.categoria} ${t.solicitante_nome} ${t.solicitante_email} ${t.tenant_nome || ''} ${t.responsavel_nome || ''}`
      );
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  });

  // Sort: SLA violated / urgent open first, then most recent interaction desc
  const priorityOrder: Record<SupportTicketPriority, number> = { urgente: 4, alta: 3, normal: 2, baixa: 1 };
  filtered.sort((a, b) => {
    const aOpen = a.estado !== 'resolvido' ? 1 : 0;
    const bOpen = b.estado !== 'resolvido' ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;

    const aSla = a.sla_status === 'violado' ? 2 : a.sla_status === 'em_risco' ? 1 : 0;
    const bSla = b.sla_status === 'violado' ? 2 : b.sla_status === 'em_risco' ? 1 : 0;
    if (aSla !== bSla) return bSla - aSla;

    const lastDiff = new Date(b.ultima_interacao).getTime() - new Date(a.ultima_interacao).getTime();
    if (lastDiff !== 0) return lastDiff;
    return priorityOrder[b.prioridade] - priorityOrder[a.prioridade];
  });

  const page = Math.max(1, Number(filters?.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(filters?.pageSize || 20)));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: filtered.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
    summary,
  };
}

export async function listPortalTicketsForUser(
  caller: AuthenticatedUser,
  filters?: {
    estado?: SupportTicketStatus | 'todos';
    q?: string;
    scope?: 'own' | 'tenant';
    page?: number;
    pageSize?: number;
  }
): Promise<{
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  canViewTenantScope: boolean;
}> {
  if (!caller.tenant_id) {
    throw new Error('Instituição do utilizador não identificada.');
  }

  const db = getFirestoreInstance();
  const snap = await db.collection(TICKETS_COL).where('tenant_id', '==', caller.tenant_id).get();
  const nowMs = Date.now();

  const canViewTenantScope = isTenantAdminRole(caller.role);
  const viewWholeTenant = canViewTenantScope && filters?.scope === 'tenant';
  const qNorm = normalizeText(filters?.q || '');

  const rows: SupportTicket[] = [];
  for (const d of snap.docs) {
    const ticket = enrichTicketLiveMetrics(d.data() || {}, d.id, nowMs);
    if (!viewWholeTenant) {
      const isOwner =
        ticket.solicitante_id === caller.uid ||
        (caller.email &&
          ticket.solicitante_email &&
          ticket.solicitante_email.toLowerCase() === caller.email.toLowerCase());
      if (!isOwner) continue;
    }
    if (filters?.estado && filters.estado !== 'todos' && ticket.estado !== filters.estado) continue;
    if (qNorm) {
      const hay = normalizeText(`${ticket.codigo} ${ticket.assunto} ${ticket.categoria}`);
      if (!hay.includes(qNorm)) continue;
    }
    rows.push(ticket);
  }

  rows.sort((a, b) => new Date(b.ultima_interacao).getTime() - new Date(a.ultima_interacao).getTime());

  const page = Math.max(1, Number(filters?.page || 1));
  const pageSize = Math.min(50, Math.max(5, Number(filters?.pageSize || 15)));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: rows.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
    canViewTenantScope,
  };
}

// ============================================================================
// DETALHE DO TICKET + MENSAGENS (COM FILTRO ESTRITO DE NOTAS INTERNAS)
// ============================================================================

export async function getSupportTicketDetail(params: {
  ticketId: string;
  caller: AuthenticatedUser;
  supportContext?: SupportAuthContext | null;
}): Promise<{
  ticket: SupportTicket;
  messages: SupportMessage[];
  assignments: SupportAssignmentRecord[];
  events: SupportEvent[];
  rating: SupportRating | null;
} | null> {
  const db = getFirestoreInstance();
  const snap = await db.collection(TICKETS_COL).doc(params.ticketId).get();
  if (!snap.exists) return null;

  const ticket = enrichTicketLiveMetrics(snap.data() || {}, snap.id);

  let isSupportViewer = false;
  if (params.supportContext) {
    if (!canAccessTicketScope(params.supportContext, ticket)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
    isSupportViewer = true;
  } else {
    if (!canPortalUserAccessTicket(params.caller, ticket)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
  }

  const [msgSnap, assignSnap, eventSnap, ratingSnap] = await Promise.all([
    db.collection(MESSAGES_COL).where('ticket_id', '==', ticket.id).get(),
    isSupportViewer ? db.collection(ASSIGNMENTS_COL).where('ticket_id', '==', ticket.id).get() : Promise.resolve(null),
    db.collection(EVENTS_COL).where('ticket_id', '==', ticket.id).get(),
    db.collection(RATINGS_COL).doc(`rate_${ticket.id}`).get(),
  ]);

  const messages: SupportMessage[] = [];
  for (const d of msgSnap.docs) {
    const raw = d.data() || {};
    const msgType = (raw.tipo || 'mensagem') as SupportMessageType;
    // CRITICAL SECURITY INVARIANT: Portal users MUST NEVER receive internal notes
    if (!isSupportViewer && msgType === 'nota_interna') {
      continue;
    }
    messages.push({
      id: d.id,
      ticket_id: String(raw.ticket_id || ticket.id),
      tenant_id: String(raw.tenant_id || ticket.tenant_id),
      remetente_id: String(raw.remetente_id || ''),
      remetente_nome: String(raw.remetente_nome || 'Sistema'),
      remetente_email: isSupportViewer ? raw.remetente_email : undefined,
      remetente_tipo: (raw.remetente_tipo || 'utilizador') as SupportSenderType,
      tipo: msgType,
      conteudo: String(raw.conteudo || ''),
      anexos: Array.isArray(raw.anexos) ? raw.anexos : [],
      created_at: String(raw.created_at || ''),
    });
  }
  messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const assignments: SupportAssignmentRecord[] = [];
  if (assignSnap) {
    for (const d of assignSnap.docs) {
      const r = d.data() || {};
      assignments.push({
        id: d.id,
        ticket_id: String(r.ticket_id || ticket.id),
        tenant_id: String(r.tenant_id || ticket.tenant_id),
        de_responsavel_id: r.de_responsavel_id || null,
        de_responsavel_nome: r.de_responsavel_nome || null,
        para_responsavel_id: r.para_responsavel_id || null,
        para_responsavel_nome: r.para_responsavel_nome || null,
        de_departamento_id: r.de_departamento_id || null,
        de_departamento_nome: r.de_departamento_nome || null,
        para_departamento_id: r.para_departamento_id || null,
        para_departamento_nome: r.para_departamento_nome || null,
        motivo: r.motivo || '',
        actor_id: String(r.actor_id || ''),
        actor_email: String(r.actor_email || ''),
        created_at: String(r.created_at || ''),
      });
    }
    assignments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const events: SupportEvent[] = [];
  for (const d of eventSnap.docs) {
    const r = d.data() || {};
    if (!isSupportViewer && r.tipo === 'nota_interna') continue;
    events.push({
      id: d.id,
      ticket_id: String(r.ticket_id || ticket.id),
      tenant_id: String(r.tenant_id || ticket.tenant_id),
      tipo: r.tipo,
      descricao: String(r.descricao || ''),
      actor_id: String(r.actor_id || ''),
      actor_nome: String(r.actor_nome || ''),
      metadata: isSupportViewer ? r.metadata : undefined,
      created_at: String(r.created_at || ''),
    });
  }
  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  let rating: SupportRating | null = null;
  if (ratingSnap.exists) {
    const rd = ratingSnap.data() || {};
    rating = {
      id: ratingSnap.id,
      ticket_id: String(rd.ticket_id || ticket.id),
      tenant_id: String(rd.tenant_id || ticket.tenant_id),
      solicitante_id: String(rd.solicitante_id || ''),
      responsavel_id: rd.responsavel_id || null,
      nota: Number(rd.nota || 5),
      comentario: rd.comentario ? String(rd.comentario) : '',
      created_at: String(rd.created_at || ''),
      updated_at: String(rd.updated_at || ''),
    };
  }

  return { ticket, messages, assignments, events, rating };
}

// ============================================================================
// MENSAGENS & NOTAS INTERNAS
// ============================================================================

export async function addSupportTicketMessage(params: {
  ticketId: string;
  conteudo: string;
  tipo?: SupportMessageType;
  anexos?: SupportAttachment[];
  caller: AuthenticatedUser;
  supportContext?: SupportAuthContext | null;
  idempotencyKey?: string;
  meta?: { ip?: string; userAgent?: string };
}): Promise<{ ticket: SupportTicket; message: SupportMessage; idempotent: boolean } | null> {
  const idem = await getIdempotentResult<{ ticket: SupportTicket; message: SupportMessage }>(
    `sup_msg_${params.ticketId}`,
    params.idempotencyKey
  );
  if (idem.hit && idem.data) {
    return { ...idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const ticketRef = db.collection(TICKETS_COL).doc(params.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return null;

  const current = enrichTicketLiveMetrics(ticketSnap.data() || {}, ticketSnap.id);

  const isSupportActor = Boolean(params.supportContext);
  if (isSupportActor) {
    if (!canAccessTicketScope(params.supportContext!, current)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
  } else {
    if (!canPortalUserAccessTicket(params.caller, current)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
  }

  // Portal users CANNOT create internal notes
  const finalMsgType: SupportMessageType = isSupportActor
    ? params.tipo === 'nota_interna'
      ? 'nota_interna'
      : 'mensagem'
    : 'mensagem';

  const senderType: SupportSenderType = isSupportActor ? 'funcionario' : 'utilizador';
  const senderName =
    params.supportContext?.agent?.nome ||
    getActorDisplayName(params.caller, isSupportActor ? 'Equipa de Suporte' : 'Utilizador');

  const nowIso = new Date().toISOString();
  const msgRef = db.collection(MESSAGES_COL).doc();
  const message: SupportMessage = {
    id: msgRef.id,
    ticket_id: current.id,
    tenant_id: current.tenant_id,
    remetente_id: params.caller.uid,
    remetente_nome: senderName,
    remetente_email: params.caller.email || '',
    remetente_tipo: senderType,
    tipo: finalMsgType,
    conteudo: String(params.conteudo || '').trim(),
    anexos: Array.isArray(params.anexos) ? params.anexos : [],
    created_at: nowIso,
  };
  await msgRef.set(message);

  const ticketUpdates: Record<string, any> = {
    updated_at: nowIso,
    total_mensagens: Number(current.total_mensagens || 0) + 1,
  };

  if (finalMsgType !== 'nota_interna') {
    ticketUpdates.ultima_interacao = nowIso;
    ticketUpdates.ultima_mensagem_por = senderType;
    ticketUpdates.ultima_mensagem_preview = message.conteudo.replace(/\s+/g, ' ').trim().slice(0, 180);

    if (isSupportActor) {
      if (!current.primeira_resposta_em) {
        ticketUpdates.primeira_resposta_em = nowIso;
      }
      if (current.estado === 'aberto' || current.estado === 'reaberto') {
        ticketUpdates.estado = 'em_atendimento';
      }
      if (!current.responsavel_id && params.supportContext?.agent?.id) {
        ticketUpdates.responsavel_id = params.supportContext.agent.id;
        ticketUpdates.responsavel_nome = params.supportContext.agent.nome;
        ticketUpdates.responsavel_tipo = 'humano';
      }
    } else {
      if (current.estado === 'pendente') {
        ticketUpdates.estado = 'em_atendimento';
      }
    }
  }

  await ticketRef.update(ticketUpdates);
  const updatedSnap = await ticketRef.get();
  const updatedTicket = enrichTicketLiveMetrics(updatedSnap.data() || {}, ticketRef.id);

  if (!current.responsavel_id && updatedTicket.responsavel_id) {
    await recalculateSupportAgentLoad(updatedTicket.responsavel_id);
  }

  await recordTicketEvent({
    ticketId: current.id,
    tenantId: current.tenant_id,
    tipo: finalMsgType === 'nota_interna' ? 'nota_interna' : 'mensagem_enviada',
    descricao:
      finalMsgType === 'nota_interna'
        ? `${senderName} registou uma nota interna.`
        : `${senderName} enviou uma resposta.`,
    actorId: params.caller.uid,
    actorNome: senderName,
  });

  // Notifications (NEVER send notification to user on internal note)
  if (finalMsgType === 'mensagem') {
    if (isSupportActor && current.solicitante_id && current.solicitante_id !== params.caller.uid) {
      await createSupportNotification({
        tenantId: current.tenant_id,
        destinatarioId: current.solicitante_id,
        destinatarioRole: current.solicitante_role,
        titulo: `Nova resposta no pedido ${current.codigo}`,
        mensagem: `${senderName} respondeu ao pedido "${current.assunto}".`,
        tipo: 'info',
        ticketId: current.id,
        linkTab: 'support_portal',
      });
    } else if (!isSupportActor) {
      let targetNotifUid = 'super_admin';
      let targetRole = 'super_admin';
      if (updatedTicket.responsavel_id) {
        const agSnap = await db.collection(AGENTS_COL).doc(updatedTicket.responsavel_id).get();
        if (agSnap.exists && agSnap.data()?.uid) {
          targetNotifUid = String(agSnap.data()!.uid);
          targetRole = 'suporte';
        }
      }
      await createSupportNotification({
        tenantId: 'global',
        destinatarioId: targetNotifUid,
        destinatarioRole: targetRole,
        titulo: `Nova resposta do utilizador (${current.codigo})`,
        mensagem: `${senderName} enviou uma nova mensagem em "${current.assunto}".`,
        tipo: 'info',
        ticketId: current.id,
        linkTab: 'assistant_tickets',
      });
    }
  }

  await saveIdempotentResult(`sup_msg_${params.ticketId}`, params.idempotencyKey, {
    ticket: updatedTicket,
    message,
  });

  return { ticket: updatedTicket, message, idempotent: false };
}

// ============================================================================
// TRANSFERÊNCIA ENTRE DEPARTAMENTOS / FUNCIONÁRIOS
// ============================================================================

export async function transferSupportTicket(params: {
  ticketId: string;
  departamento_id: string;
  responsavel_id?: string | null;
  motivo?: string;
  ctx: SupportAuthContext;
  meta?: { ip?: string; userAgent?: string };
}): Promise<{ ticket: SupportTicket; assignment: SupportAssignmentRecord } | null> {
  const db = getFirestoreInstance();
  const ticketRef = db.collection(TICKETS_COL).doc(params.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return null;

  const current = enrichTicketLiveMetrics(ticketSnap.data() || {}, ticketSnap.id);
  if (!canAccessTicketScope(params.ctx, current)) {
    throw new Error('FORBIDDEN_TICKET_SCOPE');
  }

  const targetDeptSnap = await db.collection(DEPARTMENTS_COL).doc(params.departamento_id).get();
  if (!targetDeptSnap.exists) {
    throw new Error('Departamento de destino não encontrado.');
  }
  const targetDept = targetDeptSnap.data() || {};
  const targetDeptNome = String(targetDept.nome || params.departamento_id);

  let nextAgentId: string | null = null;
  let nextAgentName: string | null = null;
  let nextAgentType: 'humano' | 'ia' | null = null;
  let nextAgentUid: string | null = null;

  if (params.responsavel_id && params.responsavel_id.trim()) {
    const agSnap = await db.collection(AGENTS_COL).doc(params.responsavel_id.trim()).get();
    if (!agSnap.exists) {
      throw new Error('Funcionário/agente de destino não encontrado.');
    }
    const ag = agSnap.data() || {};
    if (ag.estado !== 'activo') {
      throw new Error('Não é possível transferir para um membro inactivo, suspenso ou arquivado.');
    }
    nextAgentId = agSnap.id;
    nextAgentName = String(ag.nome || ag.email || '');
    nextAgentType = ag.tipo === 'ia' ? 'ia' : 'humano';
    nextAgentUid = ag.uid ? String(ag.uid) : null;
  }

  const nowIso = new Date().toISOString();
  const prevAgentId = current.responsavel_id || null;
  const actorName = params.ctx.agent?.nome || getActorDisplayName(params.ctx.caller, 'Superadmin');

  const nextState: SupportTicketStatus =
    current.estado === 'resolvido'
      ? 'resolvido'
      : nextAgentId
      ? 'em_atendimento'
      : 'aberto';

  await ticketRef.update({
    departamento_id: targetDeptSnap.id,
    departamento_nome: targetDeptNome,
    responsavel_id: nextAgentId,
    responsavel_nome: nextAgentName,
    responsavel_tipo: nextAgentType,
    estado: nextState,
    ultima_interacao: nowIso,
    updated_at: nowIso,
  });

  const assignRef = db.collection(ASSIGNMENTS_COL).doc();
  const assignment: SupportAssignmentRecord = {
    id: assignRef.id,
    ticket_id: current.id,
    tenant_id: current.tenant_id,
    de_responsavel_id: prevAgentId,
    de_responsavel_nome: current.responsavel_nome || null,
    para_responsavel_id: nextAgentId,
    para_responsavel_nome: nextAgentName,
    de_departamento_id: current.departamento_id,
    de_departamento_nome: current.departamento_nome || null,
    para_departamento_id: targetDeptSnap.id,
    para_departamento_nome: targetDeptNome,
    motivo: String(params.motivo || '').trim(),
    actor_id: params.ctx.caller.uid,
    actor_email: params.ctx.caller.email || 'system',
    created_at: nowIso,
  };
  await assignRef.set(assignment);

  const sysMsgRef = db.collection(MESSAGES_COL).doc();
  const destLabel = nextAgentName ? `${nextAgentName} (${targetDeptNome})` : `fila ${targetDeptNome}`;
  const sysText = assignment.motivo
    ? `Solicitação transferida para ${destLabel}. Motivo: ${assignment.motivo}`
    : `Solicitação transferida para ${destLabel}.`;

  await sysMsgRef.set({
    id: sysMsgRef.id,
    ticket_id: current.id,
    tenant_id: current.tenant_id,
    remetente_id: params.ctx.caller.uid,
    remetente_nome: actorName,
    remetente_tipo: 'sistema',
    tipo: 'sistema',
    conteudo: sysText,
    anexos: [],
    created_at: nowIso,
  });

  await recordTicketEvent({
    ticketId: current.id,
    tenantId: current.tenant_id,
    tipo: 'transferido',
    descricao: sysText,
    actorId: params.ctx.caller.uid,
    actorNome: actorName,
    metadata: {
      de_departamento: current.departamento_id,
      para_departamento: targetDeptSnap.id,
      de_responsavel: prevAgentId,
      para_responsavel: nextAgentId,
    },
  });

  await recordAuditLog({
    actor_id: params.ctx.caller.uid,
    actor_email: params.ctx.caller.email || 'unknown',
    actor_role: params.ctx.caller.role || 'support',
    action: 'update',
    entity: 'support_tickets_transfer',
    entity_id: current.id,
    tenant_id: current.tenant_id,
    metadata: {
      codigo: current.codigo,
      de_departamento: current.departamento_id,
      para_departamento: targetDeptSnap.id,
      para_responsavel: nextAgentId,
    },
    ip: params.meta?.ip,
    user_agent: params.meta?.userAgent,
  });

  await Promise.all([
    prevAgentId && prevAgentId !== nextAgentId ? recalculateSupportAgentLoad(prevAgentId) : Promise.resolve(),
    nextAgentId ? recalculateSupportAgentLoad(nextAgentId) : Promise.resolve(),
  ]);

  if (nextAgentUid && nextAgentUid !== params.ctx.caller.uid) {
    await createSupportNotification({
      tenantId: 'global',
      destinatarioId: nextAgentUid,
      destinatarioRole: 'suporte',
      titulo: `Ticket transferido para si (${current.codigo})`,
      mensagem: `${actorName} transferiu a solicitação "${current.assunto}" para a sua responsabilidade.`,
      tipo: 'info',
      ticketId: current.id,
      linkTab: 'assistant_tickets',
    });
  }

  const updatedSnap = await ticketRef.get();
  return {
    ticket: enrichTicketLiveMetrics(updatedSnap.data() || {}, ticketRef.id),
    assignment,
  };
}

// ============================================================================
// ALTERAÇÃO DE ESTADO (ENCERRAR / REABRIR / PENDENTE / EM ATENDIMENTO)
// ============================================================================

export async function updateSupportTicketStatus(params: {
  ticketId: string;
  estado: SupportTicketStatus;
  motivo?: string;
  caller: AuthenticatedUser;
  supportContext?: SupportAuthContext | null;
  meta?: { ip?: string; userAgent?: string };
}): Promise<SupportTicket | null> {
  const db = getFirestoreInstance();
  const ticketRef = db.collection(TICKETS_COL).doc(params.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return null;

  const current = enrichTicketLiveMetrics(ticketSnap.data() || {}, ticketSnap.id);
  const isSupportActor = Boolean(params.supportContext);

  if (isSupportActor) {
    if (!canAccessTicketScope(params.supportContext!, current)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
    if (
      params.estado === 'resolvido' &&
      !params.supportContext!.isSuperAdmin &&
      !params.supportContext!.permissions.encerrar
    ) {
      throw new Error('FORBIDDEN_CLOSE_PERMISSION');
    }
  } else {
    if (!canPortalUserAccessTicket(params.caller, current)) {
      throw new Error('FORBIDDEN_TICKET_SCOPE');
    }
    if (params.estado !== 'reaberto') {
      throw new Error('FORBIDDEN_STATUS_TRANSITION');
    }
    if (current.estado !== 'resolvido') {
      throw new Error('Apenas pedidos já resolvidos podem ser reabertos pelo utilizador.');
    }
  }

  const nowIso = new Date().toISOString();
  const actorName =
    params.supportContext?.agent?.nome ||
    getActorDisplayName(params.caller, 'Sistema');

  const updates: Record<string, any> = {
    estado: params.estado,
    ultima_interacao: nowIso,
    updated_at: nowIso,
  };

  if (params.estado === 'resolvido') {
    updates.resolvido_em = nowIso;
  } else if (params.estado === 'reaberto') {
    updates.reaberto_em = nowIso;
    updates.resolvido_em = null;
  }

  await ticketRef.update(updates);

  const sysMsgRef = db.collection(MESSAGES_COL).doc();
  const reasonText = params.motivo ? ` (${params.motivo})` : '';
  const statusLabelMap: Record<SupportTicketStatus, string> = {
    aberto: 'Aberto',
    em_atendimento: 'Em Atendimento',
    pendente: 'Pendente',
    resolvido: 'Resolvido',
    reaberto: 'Reaberto',
  };
  const desc = `Estado alterado para "${statusLabelMap[params.estado]}" por ${actorName}${reasonText}.`;

  await sysMsgRef.set({
    id: sysMsgRef.id,
    ticket_id: current.id,
    tenant_id: current.tenant_id,
    remetente_id: params.caller.uid,
    remetente_nome: actorName,
    remetente_tipo: 'sistema',
    tipo: 'sistema',
    conteudo: desc,
    anexos: [],
    created_at: nowIso,
  });

  await recordTicketEvent({
    ticketId: current.id,
    tenantId: current.tenant_id,
    tipo: 'estado_alterado',
    descricao: desc,
    actorId: params.caller.uid,
    actorNome: actorName,
    metadata: { estado_anterior: current.estado, estado_novo: params.estado },
  });

  await recordAuditLog({
    actor_id: params.caller.uid,
    actor_email: params.caller.email || 'unknown',
    actor_role: params.caller.role || 'user',
    action: 'update',
    entity: 'support_tickets_status',
    entity_id: current.id,
    tenant_id: current.tenant_id,
    metadata: { codigo: current.codigo, de: current.estado, para: params.estado, motivo: params.motivo || '' },
    ip: params.meta?.ip,
    user_agent: params.meta?.userAgent,
  });

  if (current.responsavel_id) {
    await recalculateSupportAgentLoad(current.responsavel_id);
  }

  // Notifications on status change
  if (isSupportActor && current.solicitante_id && current.solicitante_id !== params.caller.uid) {
    await createSupportNotification({
      tenantId: current.tenant_id,
      destinatarioId: current.solicitante_id,
      destinatarioRole: current.solicitante_role,
      titulo:
        params.estado === 'resolvido'
          ? `Pedido ${current.codigo} resolvido`
          : `Actualização no pedido ${current.codigo}`,
      mensagem:
        params.estado === 'resolvido'
          ? `O pedido "${current.assunto}" foi marcado como resolvido. Pode avaliar o atendimento no portal.`
          : `O estado do seu pedido "${current.assunto}" foi actualizado para ${statusLabelMap[params.estado]}.`,
      tipo: params.estado === 'resolvido' ? 'sucesso' : 'info',
      ticketId: current.id,
      linkTab: 'support_portal',
    });
  } else if (!isSupportActor && params.estado === 'reaberto') {
    await createSupportNotification({
      tenantId: 'global',
      destinatarioId: 'super_admin',
      destinatarioRole: 'super_admin',
      titulo: `Pedido reaberto (${current.codigo})`,
      mensagem: `${actorName} reabriu o pedido "${current.assunto}".`,
      tipo: 'aviso',
      ticketId: current.id,
      linkTab: 'assistant_tickets',
    });
  }

  const updatedSnap = await ticketRef.get();
  return enrichTicketLiveMetrics(updatedSnap.data() || {}, ticketRef.id);
}

// ============================================================================
// AVALIAÇÃO DO ATENDIMENTO (1 A 5)
// ============================================================================

export async function submitSupportTicketRating(params: {
  ticketId: string;
  nota: number;
  comentario?: string;
  caller: AuthenticatedUser;
}): Promise<{ ticket: SupportTicket; rating: SupportRating } | null> {
  const db = getFirestoreInstance();
  const ticketRef = db.collection(TICKETS_COL).doc(params.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return null;

  const current = enrichTicketLiveMetrics(ticketSnap.data() || {}, ticketSnap.id);
  if (!canPortalUserAccessTicket(params.caller, current)) {
    throw new Error('FORBIDDEN_TICKET_SCOPE');
  }

  if (current.estado !== 'resolvido') {
    throw new Error('Só é possível avaliar solicitações já resolvidas.');
  }

  const ratingDocId = `rate_${current.id}`;
  const ratingRef = db.collection(RATINGS_COL).doc(ratingDocId);
  const existing = await ratingRef.get();
  const nowIso = new Date().toISOString();

  const rating: SupportRating = {
    id: ratingDocId,
    ticket_id: current.id,
    tenant_id: current.tenant_id,
    solicitante_id: params.caller.uid,
    responsavel_id: current.responsavel_id || null,
    nota: Number(params.nota),
    comentario: String(params.comentario || '').trim(),
    created_at: existing.exists ? String(existing.data()?.created_at || nowIso) : nowIso,
    updated_at: nowIso,
  };

  await ratingRef.set(rating);
  await ticketRef.update({
    avaliacao_nota: rating.nota,
    avaliacao_comentario: rating.comentario,
    avaliado_em: nowIso,
    updated_at: nowIso,
  });

  const actorName = getActorDisplayName(params.caller, 'Utilizador');
  await recordTicketEvent({
    ticketId: current.id,
    tenantId: current.tenant_id,
    tipo: 'avaliado',
    descricao: `Atendimento avaliado com ${rating.nota}/5 por ${actorName}.`,
    actorId: params.caller.uid,
    actorNome: actorName,
    metadata: { nota: rating.nota },
  });

  const updatedSnap = await ticketRef.get();
  return {
    ticket: enrichTicketLiveMetrics(updatedSnap.data() || {}, ticketRef.id),
    rating,
  };
}
