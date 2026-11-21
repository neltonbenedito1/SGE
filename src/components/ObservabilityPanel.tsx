/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/asyncJobsClient';
import { fetchWithRetry, classifyNetworkErrorPt } from '../lib/resilientFetch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ModuleSkeleton } from './Skeletons';

interface LatencySummary {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

interface TenantMetricRow {
  tenantId: string;
  requests: number;
  reads: number;
  writes: number;
  errors5xx: number;
  errors4xx: number;
  rateLimited429: number;
  errorRate5xxPct: number;
  slowQueriesCount: number;
  latency: LatencySummary;
  mainReadsLatency: LatencySummary;
  sloReadP95Compliant: boolean;
  lastActiveAt: string;
}

interface RouteMetricRow {
  route: string;
  requests: number;
  errors5xx: number;
  errors429: number;
  latency: LatencySummary;
}

interface SlowQueryItem {
  id: string;
  timestamp: string;
  tenantId: string;
  source: 'http' | 'firestore' | 'worker' | 'external';
  operation: string;
  durationMs: number;
  thresholdMs: number;
}

interface DegradationAlertItem {
  id: string;
  severity: 'aviso' | 'critico';
  code: string;
  scope: string;
  tenantId?: string;
  title: string;
  description: string;
  currentValue: number;
  thresholdValue: number;
  unit: string;
  detectedAt: string;
}

interface ObservabilitySnapshotResponse {
  scope: 'global' | 'tenant';
  tenantId?: string;
  generatedAt: string;
  sloTargets: {
    MAIN_READ_P95_MS: number;
    SLOW_QUERY_THRESHOLD_MS: number;
  };
  summary: {
    totalRequests: number;
    mainReadsCount: number;
    writesCount: number;
    errors5xx: number;
    errors4xx: number;
    rateLimited429: number;
    errorRate5xxPct: number;
    approxRps: number;
    sloReadP95Compliant: boolean;
    latency: LatencySummary;
    mainReadsLatency: LatencySummary;
    jobExecutionLatency: LatencySummary;
  };
  resources: {
    pid?: number;
    uptimeSeconds?: number;
    cpuPercent?: number;
    cpuCores?: number;
    loadAvg1m?: number;
    rssMb?: number;
    heapUsedMb?: number;
    heapTotalMb?: number;
    heapLimitMb?: number;
    heapUsedPct?: number;
    eventLoopP95Ms?: number;
    eventLoopP99Ms?: number;
  };
  queue: {
    totalQueued: number;
    pendente: number;
    emProcessamento: number;
    falhadoReintento: number;
    deadLetterCount: number;
    workerActiveJobs?: number;
    workerMaxConcurrent?: number;
  };
  circuitBreakers?: Record<
    string,
    {
      name: string;
      state: string;
      totalCalls: number;
      totalFailures: number;
    }
  >;
  tenants: TenantMetricRow[];
  routes: RouteMetricRow[];
  slowQueries: SlowQueryItem[];
  slowQueriesLast5Min: number;
  alerts: DegradationAlertItem[];
}

export const ObservabilityPanel: React.FC = () => {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tenantFilter, setTenantFilter] = useState('');
  const debouncedTenantFilter = useDebouncedValue(tenantFilter, 250);

  const loadMetrics = useCallback(async (isBackground = false) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMsg('Sem ligação à Internet. Aguardar restabelecimento da rede.');
      setLoading(false);
      return;
    }
    if (!isBackground) {
      setRefreshing(true);
    }
    try {
      const headers = await buildAuthHeaders();
      const res = await fetchWithRetry('/api/observability/metrics', {
        method: 'GET',
        headers,
        credentials: 'include',
        maxRetries: 1,
        timeoutMs: 8000,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ObservabilitySnapshotResponse;
      setSnapshot(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(classifyNetworkErrorPt(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics(false);
  }, [loadMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void loadMetrics(true);
    }, 15_000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadMetrics]);

  const filteredTenants = useMemo(() => {
    const list = snapshot?.tenants || [];
    const term = debouncedTenantFilter.trim().toLowerCase();
    if (!term) return list;
    return list.filter((t) => t.tenantId.toLowerCase().includes(term));
  }, [snapshot?.tenants, debouncedTenantFilter]);

  if (loading && !snapshot) {
    return <ModuleSkeleton title="A carregar telemetria de sistema e SLO por tenant..." rows={6} />;
  }

  const s = snapshot?.summary;
  const r = snapshot?.resources;
  const q = snapshot?.queue;
  const sloTarget = snapshot?.sloTargets?.MAIN_READ_P95_MS ?? 500;
  const alerts = snapshot?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho e controlos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Observabilidade, Métricas por Tenant e Alertas SLO
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Meta principal: p95 abaixo de {sloTarget} ms nas leituras · Atualizado em{' '}
            {snapshot?.generatedAt
              ? new Date(snapshot.generatedAt).toLocaleTimeString('pt-PT')
              : '--:--:--'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoRefresh
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            {autoRefresh ? 'Atualização 15s ativa' : 'Atualização manual'}
          </button>
          <button
            type="button"
            onClick={() => void loadMetrics(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar Métricas
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadMetrics(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer shrink-0"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Alertas Ativos de Degradação */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Alertas de Degradação em Tempo Real ({alerts.length})
          </h3>
          <span
            className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
              alerts.some((a) => a.severity === 'critico')
                ? 'text-rose-600 dark:text-rose-400'
                : alerts.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {alerts.length === 0 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Todos os SLOs nominais
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Degradação detetada
              </>
            )}
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum alerta ativo. Latência p95 de leituras, taxa de erro, fila assíncrona e recursos de instância dentro das metas definidas.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {alerts.map((alert) => (
              <div key={alert.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className={
                        alert.severity === 'critico'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {alert.severity === 'critico' ? 'CRÍTICO' : 'AVISO'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                      /
                    </span>
                    <span className="text-slate-900 dark:text-slate-100">{alert.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{alert.description}</p>
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  {alert.currentValue} {alert.unit} (limiar: {alert.thresholdValue} {alert.unit})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cartões Principais de Telemetria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Latência Leituras Principais */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Leituras Principais (SLO &lt; {sloTarget} ms)</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                s?.sloReadP95Compliant
                  ? 'text-slate-900 dark:text-white'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {s?.mainReadsLatency.p95Ms ?? 0} ms
            </span>
            <span className="text-xs text-slate-500">p95</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            p50: {s?.mainReadsLatency.p50Ms ?? 0} ms · p99: {s?.mainReadsLatency.p99Ms ?? 0} ms · n=
            {s?.mainReadsCount ?? 0}
          </div>
        </div>

        {/* Card 2: Tráfego & Erros */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pedidos HTTP e Taxa 5xx</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                (s?.errorRate5xxPct ?? 0) >= 2
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {s?.errorRate5xxPct ?? 0}%
            </span>
            <span className="text-xs text-slate-500">erros 5xx</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Total: {s?.totalRequests ?? 0} · 429: {s?.rateLimited429 ?? 0} · {s?.approxRps ?? 0} req/s
          </div>
        </div>

        {/* Card 3: Filas & DLQ */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Fila Assíncrona e DLQ</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {q?.totalQueued ?? 0}
            </span>
            <span className="text-xs text-slate-500">em fila · DLQ: {q?.deadLetterCount ?? 0}</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Pendente: {q?.pendente ?? 0} · Ativos: {q?.workerActiveJobs ?? 0}/{q?.workerMaxConcurrent ?? 4} · Retry:{' '}
            {q?.falhadoReintento ?? 0}
          </div>
        </div>

        {/* Card 4: CPU, Memória e Event Loop */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>CPU, Memória e Event Loop</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {r?.cpuPercent ?? 0}%
            </span>
            <span className="text-xs text-slate-500">CPU · RSS {r?.rssMb ?? 0} MB</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Heap: {r?.heapUsedMb ?? 0}/{r?.heapLimitMb ?? r?.heapTotalMb ?? 0} MB ({r?.heapUsedPct ?? 0}%) · Loop p95: {r?.eventLoopP95Ms ?? 0} ms
          </div>
        </div>
      </div>

      {/* Circuit Breakers Externos */}
      {snapshot?.circuitBreakers && Object.keys(snapshot.circuitBreakers).length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Estado dos Circuit Breakers (Serviços Externos)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(snapshot.circuitBreakers).map(([key, b]) => (
              <div
                key={key}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{b.name}</p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500">
                    Chamadas: {b.totalCalls} · Falhas: {b.totalFailures}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    b.state === 'CLOSED'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : b.state === 'HALF_OPEN'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {b.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas por Tenant */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Latência e Erros por Tenant
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Percentis calculados na janela ativa por identificador de tenant
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              placeholder="Filtrar por tenant_id..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {filteredTenants.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Sem tráfego registado nesta instância para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Tenant ID</th>
                  <th className="py-2.5 px-4 text-right">Pedidos</th>
                  <th className="py-2.5 px-4 text-right">Leituras p50</th>
                  <th className="py-2.5 px-4 text-right">Leituras p95</th>
                  <th className="py-2.5 px-4 text-right">Leituras p99</th>
                  <th className="py-2.5 px-4 text-right">5xx %</th>
                  <th className="py-2.5 px-4 text-right">429</th>
                  <th className="py-2.5 px-4 text-right">Queries Lentas</th>
                  <th className="py-2.5 px-4 text-right">SLO (&lt;{sloTarget}ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredTenants.map((t) => (
                  <tr key={t.tenantId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {t.tenantId}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.requests}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.mainReadsLatency.p50Ms} ms
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        t.sloReadP95Compliant
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.mainReadsLatency.p95Ms} ms
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.mainReadsLatency.p99Ms} ms
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.errorRate5xxPct}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.rateLimited429}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {t.slowQueriesCount}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-semibold ${
                        t.sloReadP95Compliant
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.sloReadP95Compliant ? 'Dentro da meta' : 'Acima do limite'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rotas Mais Lentas & Queries Lentas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Latência por Endpoint HTTP
            </h3>
          </div>
          {(snapshot?.routes || []).length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Sem pedidos HTTP registados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 px-4">Rota</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-right">p50</th>
                    <th className="py-2 px-3 text-right">p95</th>
                    <th className="py-2 px-3 text-right">5xx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {snapshot!.routes.slice(0, 15).map((rt) => (
                    <tr key={rt.route} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                        {rt.route}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{rt.requests}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{rt.latency.p50Ms} ms</td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                          rt.latency.p95Ms >= sloTarget
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {rt.latency.p95Ms} ms
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{rt.errors5xx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              Queries e Operações Lentas ({snapshot?.slowQueriesLast5Min ?? 0} nos últimos 5 min)
            </h3>
          </div>
          {(snapshot?.slowQueries || []).length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma query lenta registada acima de {snapshot?.sloTargets?.SLOW_QUERY_THRESHOLD_MS ?? 350} ms.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 px-4">Operação</th>
                    <th className="py-2 px-3">Tenant</th>
                    <th className="py-2 px-3">Origem</th>
                    <th className="py-2 px-3 text-right">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {snapshot!.slowQueries.slice(0, 15).map((sq) => (
                    <tr key={sq.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {sq.operation}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {sq.tenantId}
                      </td>
                      <td className="py-2 px-3 text-[11px] uppercase text-slate-500">{sq.source}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                        {sq.durationMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObservabilityPanel;
