import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Download,
  RefreshCw,
  ShieldAlert,
  Star,
  User,
  X,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import type { SupportAnalyticsReport, SupportDepartment } from '../../types';
import type { SupportContextSnapshot } from './AssistantManagementModule';

interface SupportAnalyticsPanelProps {
  supportContext?: SupportContextSnapshot | null;
  departments: SupportDepartment[];
  showNotification?: (message: string, type?: 'sucesso' | 'erro' | 'info') => void;
  tenantsList?: Array<{ id: string; nome: string }>;
}

async function buildAdminHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const csrfToken = getCookie('sysedu_csrf_token') || localStorage.getItem('sysedu_csrf_token') || '';
  const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  if (sessId) headers['x-session-id'] = sessId;

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch {}
  }
  return headers;
}

const PERIOD_OPTIONS: Array<{ days: 7 | 30 | 90 | 365; key: string }> = [
  { days: 7, key: 'analytics.period_7' },
  { days: 30, key: 'analytics.period_30' },
  { days: 90, key: 'analytics.period_90' },
  { days: 365, key: 'analytics.period_365' },
];

export const SupportAnalyticsPanel: React.FC<SupportAnalyticsPanelProps> = ({
  supportContext,
  departments,
  showNotification,
  tenantsList = [],
}) => {
  const { t } = useTranslation('common');
  const canViewAnalytics = Boolean(
    supportContext?.isSuperAdmin || supportContext?.permissions?.consultar_analytics
  );
  const canSwitchTenants = Boolean(
    supportContext?.isSuperAdmin || !supportContext?.agent?.tenant_id || supportContext.agent.tenant_id === 'global'
  );

  const [days, setDays] = useState<7 | 30 | 90 | 365>(30);
  const [tenantId, setTenantId] = useState('todos');
  const [departmentId, setDepartmentId] = useState('todos');
  const [canal, setCanal] = useState<'todos' | 'portal' | 'superadmin' | 'ia'>('todos');

  const [report, setReport] = useState<SupportAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('days', String(days));
    if (tenantId && tenantId !== 'todos') params.set('tenant_id', tenantId);
    if (departmentId && departmentId !== 'todos') params.set('departamento_id', departmentId);
    if (canal && canal !== 'todos') params.set('canal', canal);
    return params.toString();
  }, [days, tenantId, departmentId, canal]);

  const fetchReport = useCallback(async () => {
    if (!canViewAnalytics) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders();
      const res = await fetch(`/api/superadmin/assistant/analytics?${buildQueryString()}`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Erro ao carregar Analytics.');
      }
      setReport(data as SupportAnalyticsReport);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar métricas de atendimento.');
    } finally {
      setLoading(false);
    }
  }, [canViewAnalytics, buildQueryString]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    if (!canViewAnalytics || exporting) return;
    setExporting(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders();
      const res = await fetch(`/api/superadmin/assistant/analytics/export?${buildQueryString()}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao exportar relatório CSV.');
      }
      const csvText = await res.text();
      const disp = res.headers.get('content-disposition') || '';
      const nameMatch = disp.match(/filename="?([^"]+)"?/i);
      const filename = nameMatch?.[1] || `sge-suporte-analytics-${new Date().toISOString().slice(0, 10)}.csv`;

      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('Relatório CSV exportado com sucesso.', 'sucesso');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao exportar relatório CSV.');
    } finally {
      setExporting(false);
    }
  };

  const hasChartActivity = useMemo(() => {
    if (!report) return false;
    return report.serieDiaria.some((d) => d.abertos > 0 || d.resolvidos > 0 || d.iaRespostas > 0);
  }, [report]);

  const tenantNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of tenantsList) {
      m.set(item.id, item.nome);
    }
    return m;
  }, [tenantsList]);

  if (!canViewAnalytics) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('analytics.no_permission')}</p>
      </div>
    );
  }

  const resumo = report?.resumo || {
    totalSolicitacoes: 0,
    solicitacoesAbertasAgora: 0,
    solicitacoesResolvidas: 0,
    taxaResolucaoPct: 0,
    tempoMedioPrimeiraRespostaMin: 0,
    tempoMedioResolucaoHoras: 0,
    taxaCumprimentoSlaPct: 100,
    alertasSlaEmAberto: 0,
    avaliacaoMedia: 0,
    totalAvaliacoes: 0,
    totalInteracoesIa: 0,
    totalEscalonamentosIa: 0,
    taxaResolucaoIaPct: 0,
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 hover:opacity-70 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Export Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period segmented buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setDays(opt.days)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  days === opt.days
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>

          {canSwitchTenants && (
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="todos">{t('analytics.filter_all_tenants')}</option>
              {tenantsList.map((tn) => (
                <option key={tn.id} value={tn.id}>
                  {tn.nome}
                </option>
              ))}
            </select>
          )}

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('analytics.filter_all_departments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>

          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as 'todos' | 'portal' | 'superadmin' | 'ia')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('analytics.filter_all_channels')}</option>
            <option value="portal">Portal</option>
            <option value="superadmin">Superadmin</option>
            <option value="ia">IA</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchReport()}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('analytics.refresh')}</span>
          </button>

          <button
            type="button"
            disabled={exporting || loading}
            onClick={() => void handleExportCsv()}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? t('analytics.exporting') : t('analytics.export_csv')}</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('analytics.kpi_total')}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {resumo.totalSolicitacoes}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_open_now', { count: resumo.solicitacoesAbertasAgora })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('analytics.kpi_resolution')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
            {resumo.taxaResolucaoPct}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_resolved_count', { count: resumo.solicitacoesResolvidas })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {t('analytics.kpi_first_response')}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {resumo.tempoMedioPrimeiraRespostaMin} min
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_avg_resolution', { hours: resumo.tempoMedioResolucaoHoras })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('analytics.kpi_sla')}</p>
          <p
            className={`text-2xl font-bold mt-1.5 tabular-nums ${
              resumo.taxaCumprimentoSlaPct >= 90
                ? 'text-emerald-600 dark:text-emerald-400'
                : resumo.taxaCumprimentoSlaPct >= 75
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {resumo.taxaCumprimentoSlaPct}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_sla_alerts', { count: resumo.alertasSlaEmAberto })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('analytics.kpi_csat')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
            {resumo.totalAvaliacoes > 0 ? `${resumo.avaliacaoMedia}/5` : '-'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_csat_count', { count: resumo.totalAvaliacoes })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {t('analytics.kpi_ai_resolution')}
          </p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 tabular-nums">
            {resumo.taxaResolucaoIaPct}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('analytics.kpi_ai_interactions', {
              interactions: resumo.totalInteracoesIa,
              escalations: resumo.totalEscalonamentosIa,
            })}
          </p>
        </div>
      </div>

      {/* Main Volume Time Series Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.chart_volume_title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('analytics.chart_volume_subtitle')}</p>
          </div>
          {report && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {report.periodo.start_date} — {report.periodo.end_date}
            </p>
          )}
        </div>

        {loading && !report ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500">{t('loading')}</div>
        ) : !hasChartActivity ? (
          <div className="h-56 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <BarChart3 className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('analytics.chart_empty')}</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report!.serieDiaria} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="abertos"
                  name={t('analytics.chart_opened')}
                  stroke="#0284c7"
                  fill="rgba(2, 132, 199, 0.14)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="resolvidos"
                  name={t('analytics.chart_resolved')}
                  stroke="#16a34a"
                  fill="rgba(22, 163, 74, 0.14)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="iaRespostas"
                  name={t('analytics.chart_ai_replies')}
                  stroke="#4f46e5"
                  fill="rgba(79, 70, 229, 0.12)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category Distribution + Satisfaction Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Categories Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.categories_title')}</h3>
          {!report || report.porCategoria.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {t('analytics.categories_empty')}
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.porCategoria.slice(0, 7)}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Bar dataKey="total" name={t('analytics.col_total')} fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolvidos" name={t('analytics.col_resolved')} fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Satisfaction 1-5 Breakdown & Recent Comments */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.satisfaction_title')}</h3>
          {!report || report.resumo.totalAvaliacoes === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {t('analytics.satisfaction_empty')}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {report.distribuicaoAvaliacoes.map((row) => (
                  <div key={row.nota} className="flex items-center gap-3 text-xs">
                    <span className="w-10 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 tabular-nums">
                      <span>{row.nota}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                      {row.count} ({row.pct}%)
                    </span>
                  </div>
                ))}
              </div>

              {report.recentesComentarios.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('analytics.recent_feedback_title')}
                  </p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {report.recentesComentarios.slice(0, 4).map((fb) => (
                      <div
                        key={fb.id}
                        className="text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {fb.codigo} · {fb.nota}/5
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {tenantNameMap.get(fb.tenant_id) || fb.tenant_id}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">"{fb.comentario}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Staff & AI Agent Productivity Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.agents_title')}</h3>
        </div>
        {!report || report.porAgente.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">Sem actividade atribuída neste período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t('analytics.col_name')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('analytics.col_type')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('analytics.col_department')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_assigned')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_resolved')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_first_resp')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_rating')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_load')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.porAgente.map((ag) => (
                  <tr key={ag.agent_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                      <span className="inline-flex items-center gap-1.5">
                        {ag.tipo === 'ia' ? (
                          <Bot className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span>{ag.nome}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 uppercase text-slate-500 text-[11px]">{ag.tipo}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{ag.departamento_nome}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {ag.totalAtribuidos}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                      {ag.resolvidos}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {ag.tempoMedioRespostaMin > 0 ? `${ag.tempoMedioRespostaMin} min` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {ag.totalAvaliacoes > 0 ? `${ag.avaliacaoMedia}/5 (${ag.totalAvaliacoes})` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {ag.cargaActual}/{ag.limiteSimultaneo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Department Performance & FAQ Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Department Queue Performance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.departments_title')}</h3>
          </div>
          {!report || report.porDepartamento.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">Sem departamentos registados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{t('analytics.col_department')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_total')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_open')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_resolved')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('analytics.col_sla')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.porDepartamento.map((dep) => (
                    <tr key={dep.departamento_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{dep.nome}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{dep.total}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {dep.abertos}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {dep.resolvidos}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{dep.slaCumpridoPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FAQ Knowledge Base Insights */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('analytics.faq_title')}</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">{t('analytics.faq_published')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {report?.faqInsights.totalPublicados ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">{t('analytics.faq_ai_usable')}</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
                {report?.faqInsights.totalUtilizavelIa ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">{t('analytics.faq_views')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {report?.faqInsights.totalVisualizacoes ?? 0}
              </p>
            </div>
          </div>

          {report && report.faqInsights.topArtigos.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {report.faqInsights.topArtigos.map((art) => (
                <div key={art.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{art.titulo}</p>
                    <p className="text-[11px] text-slate-500">
                      {art.categoria_nome} · {art.utilizavel_ia ? 'IA activa' : 'Manual'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                    {art.visualizacoes} views
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">Sem artigos publicados.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportAnalyticsPanel;
