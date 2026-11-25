/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Analytics & Métricas da Central de Atendimento (Fase 6)
 * - Agregações reais sobre support_tickets, support_ratings, support_events,
 *   support_agents, support_departments e faq_articles
 * - Isolamento multi-tenant e restrição por departamentos autorizados no servidor
 * - Exportação CSV protegida contra CSV/Formula Injection e auditada
 */

import { AuthenticatedUser, getFirestoreInstance } from '../middleware/auth';
import type { SupportAuthContext } from '../middleware/supportAuth';
import { recordAuditLog } from '../security/audit';
import type {
  FaqArticle,
  SupportAgent,
  SupportAnalyticsAgentStat,
  SupportAnalyticsCategoryStat,
  SupportAnalyticsDailyPoint,
  SupportAnalyticsDepartmentStat,
  SupportAnalyticsFaqInsight,
  SupportAnalyticsFeedbackItem,
  SupportAnalyticsRatingDist,
  SupportAnalyticsReport,
  SupportDepartment,
  SupportEvent,
  SupportRating,
  SupportTicket,
} from '../../src/types';

const TICKETS_COL = 'support_tickets';
const AGENTS_COL = 'support_agents';
const DEPARTMENTS_COL = 'support_departments';
const RATINGS_COL = 'support_ratings';
const EVENTS_COL = 'support_events';
const FAQ_ARTICLES_COL = 'faq_articles';

export interface AnalyticsFilterInput {
  days?: number;
  start_date?: string;
  end_date?: string;
  tenant_id?: string;
  departamento_id?: string;
  canal?: 'todos' | 'portal' | 'superadmin' | 'ia';
}

function toUtcDayKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatShortDayLabel(dayKey: string): string {
  const [, mm, dd] = dayKey.split('-');
  if (!mm || !dd) return dayKey;
  return `${dd}/${mm}`;
}

function roundOne(val: number): number {
  return Math.round(val * 10) / 10;
}

function resolveDateRange(filters: AnalyticsFilterInput): {
  days: number;
  startMs: number;
  endMs: number;
  startDay: string;
  endDay: string;
} {
  const now = new Date();
  let endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  if (filters.end_date) {
    const parsedEnd = new Date(filters.end_date);
    if (!Number.isNaN(parsedEnd.getTime())) {
      endDate = new Date(
        Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), parsedEnd.getUTCDate(), 23, 59, 59, 999)
      );
    }
  }

  let days = Math.min(365, Math.max(1, Number(filters.days || 30)));
  let startDate: Date;

  if (filters.start_date) {
    const parsedStart = new Date(filters.start_date);
    if (!Number.isNaN(parsedStart.getTime())) {
      startDate = new Date(
        Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), parsedStart.getUTCDate(), 0, 0, 0, 0)
      );
      if (startDate.getTime() > endDate.getTime()) {
        const tmp = startDate;
        startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth(), tmp.getUTCDate(), 23, 59, 59, 999));
      }
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      days = Math.min(365, Math.max(1, diffDays));
    } else {
      startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      startDate.setUTCHours(0, 0, 0, 0);
    }
  } else {
    startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    startDate.setUTCHours(0, 0, 0, 0);
  }

  return {
    days,
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
    startDay: startDate.toISOString().slice(0, 10),
    endDay: endDate.toISOString().slice(0, 10),
  };
}

export function sanitizeCsvCell(raw: unknown): string {
  const str = raw === null || raw === undefined ? '' : String(raw);
  const cleaned = str.replace(/\r?\n/g, ' ').trim();
  const safe = /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
  if (/[",]/.test(safe) || safe.startsWith("'")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function getSupportAnalyticsReport(
  filters: AnalyticsFilterInput,
  ctx: SupportAuthContext
): Promise<SupportAnalyticsReport> {
  const db = getFirestoreInstance();
  const { days, startMs, endMs, startDay, endDay } = resolveDateRange(filters);

  // Strict server-side multi-tenant pinning for non-global support staff
  const requestedTenant = (filters.tenant_id || 'todos').trim();
  const effectiveTenantId =
    !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
      ? ctx.agent.tenant_id
      : requestedTenant || 'todos';

  const requestedDept = (filters.departamento_id || 'todos').trim();
  const restrictByAuthorizedDepts =
    !ctx.isSuperAdmin &&
    ctx.agent?.funcao === 'assistente' &&
    !ctx.authorizedDepartmentIds.includes('*');

  const effectiveDeptId =
    restrictByAuthorizedDepts &&
    requestedDept !== 'todos' &&
    !ctx.authorizedDepartmentIds.includes(requestedDept)
      ? ctx.authorizedDepartmentIds[0] || 'todos'
      : requestedDept || 'todos';

  const effectiveCanal = filters.canal || 'todos';

  const [ticketsSnap, agentsSnap, deptsSnap, ratingsSnap, eventsSnap, faqSnap] = await Promise.all([
    db.collection(TICKETS_COL).get(),
    db.collection(AGENTS_COL).get(),
    db.collection(DEPARTMENTS_COL).get(),
    db.collection(RATINGS_COL).get(),
    db.collection(EVENTS_COL).get(),
    db.collection(FAQ_ARTICLES_COL).get(),
  ]);

  const deptMap = new Map<string, SupportDepartment>();
  for (const d of deptsSnap.docs) {
    const dep = { ...(d.data() || {}), id: d.id } as SupportDepartment;
    if (effectiveTenantId !== 'todos' && dep.tenant_id !== 'global' && dep.tenant_id !== effectiveTenantId) continue;
    deptMap.set(d.id, dep);
  }

  const agentMap = new Map<string, SupportAgent>();
  for (const d of agentsSnap.docs) {
    const ag = { ...(d.data() || {}), id: d.id } as SupportAgent;
    if (ag.estado === 'arquivado') continue;
    if (effectiveTenantId !== 'todos' && ag.tenant_id !== 'global' && ag.tenant_id !== effectiveTenantId) continue;
    if (effectiveDeptId !== 'todos' && ag.departamento_id !== effectiveDeptId && !ag.departamentos_autorizados?.includes(effectiveDeptId)) {
      continue;
    }
    agentMap.set(d.id, ag);
  }

  const allMatchingTickets: SupportTicket[] = [];
  for (const d of ticketsSnap.docs) {
    const t = { ...(d.data() || {}), id: d.id } as SupportTicket;
    if (effectiveTenantId !== 'todos' && t.tenant_id !== effectiveTenantId) continue;
    if (effectiveDeptId !== 'todos' && t.departamento_id !== effectiveDeptId) continue;
    if (restrictByAuthorizedDepts && !ctx.authorizedDepartmentIds.includes(t.departamento_id) && t.responsavel_id !== ctx.agent?.id) {
      continue;
    }
    if (effectiveCanal !== 'todos' && t.canal !== effectiveCanal) continue;
    allMatchingTickets.push(t);
  }

  // Filter tickets opened within the selected date window
  const periodTickets = allMatchingTickets.filter((t) => {
    const openMs = new Date(t.data_abertura || t.created_at).getTime();
    return !Number.isNaN(openMs) && openMs >= startMs && openMs <= endMs;
  });

  // Currently open backlog & SLA alerts (across matching tenant/dept/channel)
  const nowMs = Date.now();
  let solicitacoesAbertasAgora = 0;
  let alertasSlaEmAberto = 0;
  for (const t of allMatchingTickets) {
    if (t.estado === 'resolvido') continue;
    solicitacoesAbertasAgora += 1;
    const slaRespMs = t.sla_resposta_em ? new Date(t.sla_resposta_em).getTime() : NaN;
    const slaResMs = t.sla_resolucao_em ? new Date(t.sla_resolucao_em).getTime() : NaN;
    if (
      t.sla_status === 'violado' ||
      t.sla_status === 'em_risco' ||
      (!t.primeira_resposta_em && !Number.isNaN(slaRespMs) && nowMs > slaRespMs) ||
      (!Number.isNaN(slaResMs) && nowMs > slaResMs)
    ) {
      alertasSlaEmAberto += 1;
    }
  }

  // Filter events for matching tickets & date window
  const matchingTicketIds = new Set(allMatchingTickets.map((t) => t.id));
  const ticketById = new Map(allMatchingTickets.map((t) => [t.id, t]));

  let totalInteracoesIa = 0;
  let totalEscalonamentosIa = 0;
  const iaTouchedTicketIds = new Set<string>();
  const iaEscalatedTicketIds = new Set<string>();

  const dailyBuckets = new Map<string, SupportAnalyticsDailyPoint>();
  const cursor = new Date(startMs);
  while (cursor.getTime() <= endMs && dailyBuckets.size <= 366) {
    const key = cursor.toISOString().slice(0, 10);
    dailyBuckets.set(key, {
      data: key,
      label: formatShortDayLabel(key),
      abertos: 0,
      resolvidos: 0,
      iaRespostas: 0,
      escalonamentos: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const eDoc of eventsSnap.docs) {
    const ev = { ...(eDoc.data() || {}), id: eDoc.id } as SupportEvent;
    if (effectiveTenantId !== 'todos' && ev.tenant_id !== effectiveTenantId) continue;
    if (ev.ticket_id && !matchingTicketIds.has(ev.ticket_id)) continue;
    const evMs = new Date(ev.created_at).getTime();
    if (Number.isNaN(evMs) || evMs < startMs || evMs > endMs) continue;
    const dayKey = toUtcDayKey(ev.created_at);
    const point = dailyBuckets.get(dayKey);

    if (ev.tipo === 'ia_resposta') {
      totalInteracoesIa += 1;
      if (ev.ticket_id) iaTouchedTicketIds.add(ev.ticket_id);
      if (point) point.iaRespostas += 1;
    } else if (ev.tipo === 'escalado_humano') {
      totalEscalonamentosIa += 1;
      if (ev.ticket_id) iaEscalatedTicketIds.add(ev.ticket_id);
      if (point) point.escalonamentos += 1;
    }
  }

  // Daily opened & resolved counts
  for (const t of allMatchingTickets) {
    const openMs = new Date(t.data_abertura || t.created_at).getTime();
    if (!Number.isNaN(openMs) && openMs >= startMs && openMs <= endMs) {
      const openPoint = dailyBuckets.get(toUtcDayKey(t.data_abertura || t.created_at));
      if (openPoint) openPoint.abertos += 1;
    }
    if (t.resolvido_em) {
      const resMs = new Date(t.resolvido_em).getTime();
      if (!Number.isNaN(resMs) && resMs >= startMs && resMs <= endMs) {
        const resPoint = dailyBuckets.get(toUtcDayKey(t.resolvido_em));
        if (resPoint) resPoint.resolvidos += 1;
      }
    }
  }

  // Core KPIs across periodTickets
  let solicitacoesResolvidas = 0;
  let firstRespSumMin = 0;
  let firstRespCount = 0;
  let resolutionSumHours = 0;
  let resolutionCount = 0;
  let slaCompliantCount = 0;

  const catMap = new Map<string, { total: number; abertos: number; resolvidos: number }>();
  const deptStatMap = new Map<
    string,
    {
      nome: string;
      total: number;
      abertos: number;
      resolvidos: number;
      respSumMin: number;
      respCount: number;
      slaOk: number;
    }
  >();

  // Initialize departments so active empty queues still show cleanly
  for (const dep of deptMap.values()) {
    if (effectiveDeptId !== 'todos' && dep.id !== effectiveDeptId) continue;
    deptStatMap.set(dep.id, {
      nome: dep.nome,
      total: 0,
      abertos: 0,
      resolvidos: 0,
      respSumMin: 0,
      respCount: 0,
      slaOk: 0,
    });
  }

  const agentStatMap = new Map<
    string,
    {
      nome: string;
      tipo: 'humano' | 'ia';
      departamento_nome: string;
      totalAtribuidos: number;
      resolvidos: number;
      cargaActual: number;
      limiteSimultaneo: number;
      ratingSum: number;
      ratingCount: number;
      respSumMin: number;
      respCount: number;
    }
  >();

  for (const ag of agentMap.values()) {
    agentStatMap.set(ag.id, {
      nome: ag.nome,
      tipo: ag.tipo,
      departamento_nome: ag.departamento_nome || deptMap.get(ag.departamento_id)?.nome || 'Geral',
      totalAtribuidos: 0,
      resolvidos: 0,
      cargaActual: Number(ag.carga_actual || 0),
      limiteSimultaneo: Number(ag.limite_simultaneo || 10),
      ratingSum: 0,
      ratingCount: 0,
      respSumMin: 0,
      respCount: 0,
    });
  }

  let iaResolvedCount = 0;
  let iaCandidateCount = 0;

  for (const t of periodTickets) {
    const isResolved = t.estado === 'resolvido';
    if (isResolved) solicitacoesResolvidas += 1;

    const openMs = new Date(t.data_abertura || t.created_at).getTime();
    let respMinutes = 0;
    let hasResp = false;
    if (t.primeira_resposta_em && !Number.isNaN(openMs)) {
      const respMs = new Date(t.primeira_resposta_em).getTime();
      if (!Number.isNaN(respMs) && respMs >= openMs) {
        respMinutes = (respMs - openMs) / 60000;
        firstRespSumMin += respMinutes;
        firstRespCount += 1;
        hasResp = true;
      }
    }

    if (isResolved && t.resolvido_em && !Number.isNaN(openMs)) {
      const resMs = new Date(t.resolvido_em).getTime();
      if (!Number.isNaN(resMs) && resMs >= openMs) {
        resolutionSumHours += (resMs - openMs) / (60 * 60 * 1000);
        resolutionCount += 1;
      }
    }

    // SLA compliance check for period ticket
    const slaRespMs = t.sla_resposta_em ? new Date(t.sla_resposta_em).getTime() : NaN;
    const slaResMs = t.sla_resolucao_em ? new Date(t.sla_resolucao_em).getTime() : NaN;
    const respBreached =
      !Number.isNaN(slaRespMs) &&
      (t.primeira_resposta_em ? new Date(t.primeira_resposta_em).getTime() > slaRespMs : !isResolved && nowMs > slaRespMs);
    const resBreached =
      !Number.isNaN(slaResMs) &&
      (isResolved && t.resolvido_em ? new Date(t.resolvido_em).getTime() > slaResMs : !isResolved && nowMs > slaResMs);
    const slaOk = t.sla_status !== 'violado' && !respBreached && !resBreached;
    if (slaOk) slaCompliantCount += 1;

    // IA resolution tracking
    const touchedByAi = t.responsavel_tipo === 'ia' || iaTouchedTicketIds.has(t.id);
    if (touchedByAi) {
      iaCandidateCount += 1;
      if (isResolved && (t.responsavel_tipo === 'ia' || !iaEscalatedTicketIds.has(t.id))) {
        iaResolvedCount += 1;
      }
    }

    // Category aggregation
    const catKey = (t.categoria || 'Geral').trim();
    const catEntry = catMap.get(catKey) || { total: 0, abertos: 0, resolvidos: 0 };
    catEntry.total += 1;
    if (isResolved) catEntry.resolvidos += 1;
    else catEntry.abertos += 1;
    catMap.set(catKey, catEntry);

    // Department aggregation
    const dId = t.departamento_id || 'geral';
    const dEntry = deptStatMap.get(dId) || {
      nome: t.departamento_nome || deptMap.get(dId)?.nome || dId,
      total: 0,
      abertos: 0,
      resolvidos: 0,
      respSumMin: 0,
      respCount: 0,
      slaOk: 0,
    };
    dEntry.total += 1;
    if (isResolved) dEntry.resolvidos += 1;
    else dEntry.abertos += 1;
    if (hasResp) {
      dEntry.respSumMin += respMinutes;
      dEntry.respCount += 1;
    }
    if (slaOk) dEntry.slaOk += 1;
    deptStatMap.set(dId, dEntry);

    // Agent aggregation
    if (t.responsavel_id) {
      const aEntry = agentStatMap.get(t.responsavel_id) || {
        nome: t.responsavel_nome || t.responsavel_id,
        tipo: t.responsavel_tipo === 'ia' ? 'ia' : 'humano',
        departamento_nome: t.departamento_nome || 'Geral',
        totalAtribuidos: 0,
        resolvidos: 0,
        cargaActual: 0,
        limiteSimultaneo: 10,
        ratingSum: 0,
        ratingCount: 0,
        respSumMin: 0,
        respCount: 0,
      };
      aEntry.totalAtribuidos += 1;
      if (isResolved) aEntry.resolvidos += 1;
      if (hasResp) {
        aEntry.respSumMin += respMinutes;
        aEntry.respCount += 1;
      }
      agentStatMap.set(t.responsavel_id, aEntry);
    }
  }

  // Ratings aggregation (from support_ratings + ticket embedded ratings fallback)
  const ratingCounts = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ]);
  const ratedTicketIds = new Set<string>();
  const feedbackItems: SupportAnalyticsFeedbackItem[] = [];
  let ratingSum = 0;
  let totalAvaliacoes = 0;

  for (const rDoc of ratingsSnap.docs) {
    const r = { ...(rDoc.data() || {}), id: rDoc.id } as SupportRating;
    if (effectiveTenantId !== 'todos' && r.tenant_id !== effectiveTenantId) continue;
    const tMatch = r.ticket_id ? ticketById.get(r.ticket_id) : undefined;
    if ((effectiveDeptId !== 'todos' || effectiveCanal !== 'todos') && !tMatch) continue;
    if (r.ticket_id && !matchingTicketIds.has(r.ticket_id) && effectiveDeptId !== 'todos') continue;

    const rMs = new Date(r.created_at).getTime();
    if (Number.isNaN(rMs) || rMs < startMs || rMs > endMs) continue;

    const nota = Math.min(5, Math.max(1, Math.round(Number(r.nota || 0))));
    ratingCounts.set(nota, (ratingCounts.get(nota) || 0) + 1);
    ratingSum += nota;
    totalAvaliacoes += 1;
    if (r.ticket_id) ratedTicketIds.add(r.ticket_id);

    const agentId = r.responsavel_id || tMatch?.responsavel_id;
    if (agentId && agentStatMap.has(agentId)) {
      const ag = agentStatMap.get(agentId)!;
      ag.ratingSum += nota;
      ag.ratingCount += 1;
    }

    if (r.comentario && r.comentario.trim()) {
      feedbackItems.push({
        id: r.id,
        ticket_id: r.ticket_id,
        codigo: tMatch?.codigo || r.ticket_id,
        assunto: tMatch?.assunto || 'Atendimento',
        tenant_id: r.tenant_id,
        nota,
        comentario: r.comentario.trim(),
        responsavel_nome: tMatch?.responsavel_nome || null,
        created_at: r.created_at,
      });
    }
  }

  // Fallback for tickets rated directly on ticket document without separate rating doc
  for (const t of periodTickets) {
    if (t.avaliacao_nota && !ratedTicketIds.has(t.id)) {
      const nota = Math.min(5, Math.max(1, Math.round(Number(t.avaliacao_nota))));
      ratingCounts.set(nota, (ratingCounts.get(nota) || 0) + 1);
      ratingSum += nota;
      totalAvaliacoes += 1;
      if (t.responsavel_id && agentStatMap.has(t.responsavel_id)) {
        const ag = agentStatMap.get(t.responsavel_id)!;
        ag.ratingSum += nota;
        ag.ratingCount += 1;
      }
      if (t.avaliacao_comentario && t.avaliacao_comentario.trim()) {
        feedbackItems.push({
          id: `tk_${t.id}`,
          ticket_id: t.id,
          codigo: t.codigo,
          assunto: t.assunto,
          tenant_id: t.tenant_id,
          nota,
          comentario: t.avaliacao_comentario.trim(),
          responsavel_nome: t.responsavel_nome || null,
          created_at: t.avaliado_em || t.updated_at,
        });
      }
    }
  }

  feedbackItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const distribuicaoAvaliacoes: SupportAnalyticsRatingDist[] = [5, 4, 3, 2, 1].map((nota) => {
    const count = ratingCounts.get(nota) || 0;
    return {
      nota,
      count,
      pct: totalAvaliacoes > 0 ? roundOne((count / totalAvaliacoes) * 100) : 0,
    };
  });

  // FAQ Insights
  let totalPublicados = 0;
  let totalUtilizavelIa = 0;
  let totalVisualizacoes = 0;
  const faqList: SupportAnalyticsFaqInsight['topArtigos'] = [];

  for (const fDoc of faqSnap.docs) {
    const art = { ...(fDoc.data() || {}), id: fDoc.id } as FaqArticle;
    if (effectiveTenantId !== 'todos' && art.tenant_id !== 'global' && art.tenant_id !== effectiveTenantId) continue;
    if (art.estado === 'publicado') {
      totalPublicados += 1;
      if (art.utilizavel_ia) totalUtilizavelIa += 1;
      const views = Number(art.visualizacoes || 0);
      totalVisualizacoes += views;
      faqList.push({
        id: art.id,
        titulo: art.titulo,
        categoria_nome: art.categoria_nome || 'Geral',
        visualizacoes: views,
        utilizavel_ia: Boolean(art.utilizavel_ia),
      });
    }
  }
  faqList.sort((a, b) => b.visualizacoes - a.visualizacoes);

  const totalSolicitacoes = periodTickets.length;
  const taxaResolucaoPct = totalSolicitacoes > 0 ? roundOne((solicitacoesResolvidas / totalSolicitacoes) * 100) : 0;
  const tempoMedioPrimeiraRespostaMin = firstRespCount > 0 ? roundOne(firstRespSumMin / firstRespCount) : 0;
  const tempoMedioResolucaoHoras = resolutionCount > 0 ? roundOne(resolutionSumHours / resolutionCount) : 0;
  const taxaCumprimentoSlaPct =
    totalSolicitacoes > 0 ? roundOne((slaCompliantCount / totalSolicitacoes) * 100) : 100;
  const avaliacaoMedia = totalAvaliacoes > 0 ? roundOne(ratingSum / totalAvaliacoes) : 0;
  const taxaResolucaoIaPct =
    iaCandidateCount > 0 ? roundOne((iaResolvedCount / iaCandidateCount) * 100) : 0;

  const porCategoria: SupportAnalyticsCategoryStat[] = Array.from(catMap.entries())
    .map(([categoria, s]) => ({
      categoria,
      total: s.total,
      abertos: s.abertos,
      resolvidos: s.resolvidos,
      taxaResolucaoPct: s.total > 0 ? roundOne((s.resolvidos / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const porDepartamento: SupportAnalyticsDepartmentStat[] = Array.from(deptStatMap.entries())
    .map(([departamento_id, s]) => ({
      departamento_id,
      nome: s.nome,
      total: s.total,
      abertos: s.abertos,
      resolvidos: s.resolvidos,
      tempoMedioRespostaMin: s.respCount > 0 ? roundOne(s.respSumMin / s.respCount) : 0,
      slaCumpridoPct: s.total > 0 ? roundOne((s.slaOk / s.total) * 100) : 100,
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt'));

  const porAgente: SupportAnalyticsAgentStat[] = Array.from(agentStatMap.entries())
    .map(([agent_id, s]) => ({
      agent_id,
      nome: s.nome,
      tipo: s.tipo,
      departamento_nome: s.departamento_nome,
      totalAtribuidos: s.totalAtribuidos,
      resolvidos: s.resolvidos,
      cargaActual: s.cargaActual,
      limiteSimultaneo: s.limiteSimultaneo,
      avaliacaoMedia: s.ratingCount > 0 ? roundOne(s.ratingSum / s.ratingCount) : 0,
      totalAvaliacoes: s.ratingCount,
      tempoMedioRespostaMin: s.respCount > 0 ? roundOne(s.respSumMin / s.respCount) : 0,
    }))
    .sort((a, b) => b.totalAtribuidos - a.totalAtribuidos || b.resolvidos - a.resolvidos || a.nome.localeCompare(b.nome, 'pt'));

  return {
    periodo: {
      days,
      start_date: startDay,
      end_date: endDay,
      tenant_id: effectiveTenantId,
      departamento_id: effectiveDeptId,
      canal: effectiveCanal,
    },
    resumo: {
      totalSolicitacoes,
      solicitacoesAbertasAgora,
      solicitacoesResolvidas,
      taxaResolucaoPct,
      tempoMedioPrimeiraRespostaMin,
      tempoMedioResolucaoHoras,
      taxaCumprimentoSlaPct,
      alertasSlaEmAberto,
      avaliacaoMedia,
      totalAvaliacoes,
      totalInteracoesIa,
      totalEscalonamentosIa,
      taxaResolucaoIaPct,
    },
    serieDiaria: Array.from(dailyBuckets.values()),
    porCategoria,
    porDepartamento,
    porAgente,
    distribuicaoAvaliacoes,
    recentesComentarios: feedbackItems.slice(0, 8),
    faqInsights: {
      totalPublicados,
      totalUtilizavelIa,
      totalVisualizacoes,
      topArtigos: faqList.slice(0, 6),
    },
  };
}

export async function exportSupportAnalyticsCsv(
  filters: AnalyticsFilterInput,
  ctx: SupportAuthContext,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ filename: string; csv: string }> {
  const report = await getSupportAnalyticsReport(filters, ctx);
  const lines: string[] = [];

  const row = (cells: unknown[]) => lines.push(cells.map(sanitizeCsvCell).join(','));

  row(['Relatório de Analytics do Suporte SGE']);
  row([
    'Período',
    `${report.periodo.start_date} a ${report.periodo.end_date}`,
    'Instituição',
    report.periodo.tenant_id,
    'Departamento',
    report.periodo.departamento_id,
    'Canal',
    report.periodo.canal,
  ]);
  lines.push('');

  row(['Indicador Geral', 'Valor']);
  row(['Total de Solicitações (Período)', report.resumo.totalSolicitacoes]);
  row(['Solicitações Abertas Agora', report.resumo.solicitacoesAbertasAgora]);
  row(['Solicitações Resolvidas', report.resumo.solicitacoesResolvidas]);
  row(['Taxa de Resolução (%)', report.resumo.taxaResolucaoPct]);
  row(['Tempo Médio 1.ª Resposta (min)', report.resumo.tempoMedioPrimeiraRespostaMin]);
  row(['Tempo Médio Resolução (horas)', report.resumo.tempoMedioResolucaoHoras]);
  row(['Cumprimento SLA (%)', report.resumo.taxaCumprimentoSlaPct]);
  row(['Alertas SLA em Aberto', report.resumo.alertasSlaEmAberto]);
  row(['Avaliação Média (1-5)', report.resumo.avaliacaoMedia]);
  row(['Total de Avaliações', report.resumo.totalAvaliacoes]);
  row(['Interacções IA', report.resumo.totalInteracoesIa]);
  row(['Escalonamentos IA', report.resumo.totalEscalonamentosIa]);
  row(['Taxa de Resolução via IA (%)', report.resumo.taxaResolucaoIaPct]);
  lines.push('');

  row(['Desempenho por Departamento', 'Total', 'Abertos', 'Resolvidos', '1.ª Resposta Média (min)', 'SLA Cumprido (%)']);
  for (const d of report.porDepartamento) {
    row([d.nome, d.total, d.abertos, d.resolvidos, d.tempoMedioRespostaMin, d.slaCumpridoPct]);
  }
  lines.push('');

  row(['Desempenho por Agente / IA', 'Tipo', 'Departamento', 'Atribuídos', 'Resolvidos', 'Carga Actual', '1.ª Resposta Média (min)', 'Avaliação Média']);
  for (const a of report.porAgente) {
    row([
      a.nome,
      a.tipo,
      a.departamento_nome,
      a.totalAtribuidos,
      a.resolvidos,
      `${a.cargaActual}/${a.limiteSimultaneo}`,
      a.tempoMedioRespostaMin,
      a.avaliacaoMedia,
    ]);
  }
  lines.push('');

  row(['Solicitações por Categoria', 'Total', 'Abertos', 'Resolvidos', 'Taxa de Resolução (%)']);
  for (const c of report.porCategoria) {
    row([c.categoria, c.total, c.abertos, c.resolvidos, c.taxaResolucaoPct]);
  }

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'support_analytics_export',
    entity_id: `${report.periodo.tenant_id}_${report.periodo.start_date}_${report.periodo.end_date}`,
    tenant_id: report.periodo.tenant_id,
    metadata: {
      days: report.periodo.days,
      departamento_id: report.periodo.departamento_id,
      canal: report.periodo.canal,
      totalSolicitacoes: report.resumo.totalSolicitacoes,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    filename: `sge-suporte-analytics-${dateTag}.csv`,
    csv: `\uFEFF${lines.join('\n')}`,
  };
}
