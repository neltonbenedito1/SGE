/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Observabilidade, Métricas Multi-Tenant e Alertas de SLO (SGE — Fase 7)
 * - Percentis p50 / p95 / p99 globais, por rota, para leituras principais e por tenant_id
 * - Registo de queries lentas (HTTP, Firestore, Worker e serviços externos)
 * - Amostragem real de CPU, Memória e Event Loop Lag com buffers limitados O(1)
 * - Avaliador de alertas de degradação com deduplicação e logs estruturados
 * - Exportação Prometheus `/metrics` e JSON segmentado por tenant
 */

import os from 'os';
import v8 from 'v8';
import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';
import { logSecurityEvent } from '../security/logger';

export const SLO_TARGETS = {
  MAIN_READ_P95_MS: Math.max(100, Number(process.env.SLO_READ_P95_TARGET_MS || 500)),
  MAIN_READ_WARN_P95_MS: Math.max(80, Number(process.env.SLO_READ_WARN_P95_MS || 400)),
  SLOW_QUERY_THRESHOLD_MS: Math.max(50, Number(process.env.SLOW_QUERY_THRESHOLD_MS || 350)),
  ERROR_RATE_5XX_WARN_PCT: 2,
  ERROR_RATE_5XX_CRIT_PCT: 5,
  QUEUE_BACKLOG_WARN: 50,
  QUEUE_BACKLOG_CRIT: 200,
  HEAP_USAGE_WARN_PCT: 85,
  EVENT_LOOP_LAG_WARN_MS: 100,
};

const MAX_GLOBAL_SAMPLES = 1500;
const MAX_TENANT_SAMPLES = 300;
const MAX_ROUTE_SAMPLES = 300;
const MAX_SLOW_QUERIES = 100;
const MAX_TRACKED_TENANTS = 500;
const MAX_TRACKED_ROUTES = 120;
const ALERT_LOG_COOLDOWN_MS = 60_000;

export interface LatencySummary {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface TenantMetricsSummary {
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

export interface RouteMetricsSummary {
  route: string;
  requests: number;
  errors5xx: number;
  errors429: number;
  latency: LatencySummary;
}

export interface SlowQueryEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  source: 'http' | 'firestore' | 'worker' | 'external';
  operation: string;
  durationMs: number;
  thresholdMs: number;
  requestId?: string;
}

export interface DegradationAlert {
  id: string;
  severity: 'aviso' | 'critico';
  code: string;
  scope: 'global' | 'tenant' | 'queue' | 'infra';
  tenantId?: string;
  title: string;
  description: string;
  currentValue: number;
  thresholdValue: number;
  unit: string;
  detectedAt: string;
}

export interface QueueMetricsInput {
  totalQueued: number;
  pendente: number;
  emProcessamento: number;
  falhadoReintento: number;
  deadLetterCount: number;
  workerActiveJobs?: number;
  workerMaxConcurrent?: number;
  perTenant?: Record<
    string,
    {
      pendente: number;
      emProcessamento: number;
      falhadoReintento: number;
      deadLetter: number;
    }
  >;
}

interface MetricBucket {
  requests: number;
  reads: number;
  writes: number;
  errors5xx: number;
  errors4xx: number;
  rateLimited429: number;
  slowQueriesCount: number;
  durations: number[];
  readDurations: number[];
  lastActiveAt: string;
}

function createBucket(): MetricBucket {
  return {
    requests: 0,
    reads: 0,
    writes: 0,
    errors5xx: 0,
    errors4xx: 0,
    rateLimited429: 0,
    slowQueriesCount: 0,
    durations: [],
    readDurations: [],
    lastActiveAt: new Date().toISOString(),
  };
}

function pushBounded(arr: number[], value: number, maxLen: number): void {
  arr.push(value);
  if (arr.length > maxLen) {
    arr.shift();
  }
}

export function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  const clamped = Math.max(0, Math.min(sortedValues.length - 1, idx));
  return Number(sortedValues[clamped].toFixed(2));
}

export function summarizeLatencies(samples: number[]): LatencySummary {
  if (samples.length === 0) {
    return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i];
  }
  return {
    count: sorted.length,
    avgMs: Number((sum / sorted.length).toFixed(2)),
    p50Ms: computePercentile(sorted, 50),
    p95Ms: computePercentile(sorted, 95),
    p99Ms: computePercentile(sorted, 99),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

export function normalizeRoutePath(method: string, rawPath: string): string {
  const clean = rawPath.split('?')[0] || '/';
  const normalized = clean
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/(?:job_|tx_|usr_|tenant_|esc_|al_|doc_)[a-zA-Z0-9_-]+/g, '/:id')
    .replace(/\/[A-Za-z0-9_-]{16,}/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:num');
  return `${method.toUpperCase()} ${normalized}`;
}

export function isMainReadEndpoint(method: string, rawPath: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  const clean = rawPath.split('?')[0];
  // Exclui streams long-lived SSE para não distorcer p95 de leituras REST curtas
  if (clean.endsWith('/stream')) return false;
  return (
    clean.startsWith('/api/') ||
    clean === '/health' ||
    clean === '/ready'
  );
}

// Estado interno limitado (janela deslizante em memória por instância)
const startedAtMs = Date.now();
let globalBucket = createBucket();
const tenantBuckets = new Map<string, MetricBucket>();
const routeBuckets = new Map<string, MetricBucket>();
const jobDurationSamples: number[] = [];
const jobTenantStats = new Map<
  string,
  { completed: number; failed: number; deadLettered: number; durations: number[] }
>();
const slowQueriesRing: SlowQueryEntry[] = [];
const alertLastLoggedAt = new Map<string, number>();

// Amostragem de CPU e Event Loop Lag
let lastCpuUsage = process.cpuUsage();
let lastCpuSampleHr = process.hrtime.bigint();
let currentCpuPercent = 0;
let eventLoopMonitor: IntervalHistogram | null = null;
let cpuSamplerTimer: ReturnType<typeof setInterval> | null = null;

function ensureSystemMonitors(): void {
  if (!eventLoopMonitor) {
    try {
      eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      eventLoopMonitor.enable();
    } catch {
      eventLoopMonitor = null;
    }
  }
  if (!cpuSamplerTimer) {
    cpuSamplerTimer = setInterval(() => {
      const nowHr = process.hrtime.bigint();
      const elapsedMicros = Number(nowHr - lastCpuSampleHr) / 1000;
      const diff = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();
      lastCpuSampleHr = nowHr;

      if (elapsedMicros > 0) {
        const cpuTotalMicros = diff.user + diff.system;
        const cores = Math.max(1, os.cpus().length || 1);
        const pct = (cpuTotalMicros / (elapsedMicros * cores)) * 100;
        currentCpuPercent = Number(Math.min(100, Math.max(0, pct)).toFixed(2));
      }
    }, 5000);
    cpuSamplerTimer.unref();
  }
}

if (process.env.NODE_ENV !== 'test') {
  ensureSystemMonitors();
}

function getOrCreateTenantBucket(tenantId: string): MetricBucket {
  let bucket = tenantBuckets.get(tenantId);
  if (!bucket) {
    if (tenantBuckets.size >= MAX_TRACKED_TENANTS) {
      // Remove o tenant mais antigo para manter consumo de memória estritamente limitado
      const oldestKey = tenantBuckets.keys().next().value;
      if (oldestKey) tenantBuckets.delete(oldestKey);
    }
    bucket = createBucket();
    tenantBuckets.set(tenantId, bucket);
  }
  return bucket;
}

function getOrCreateRouteBucket(routeKey: string): MetricBucket {
  let bucket = routeBuckets.get(routeKey);
  if (!bucket) {
    if (routeBuckets.size >= MAX_TRACKED_ROUTES) {
      const oldestKey = routeBuckets.keys().next().value;
      if (oldestKey) routeBuckets.delete(oldestKey);
    }
    bucket = createBucket();
    routeBuckets.set(routeKey, bucket);
  }
  return bucket;
}

export function recordSlowQuery(params: {
  tenantId: string;
  source: 'http' | 'firestore' | 'worker' | 'external';
  operation: string;
  durationMs: number;
  thresholdMs?: number;
  requestId?: string;
}): void {
  const tenantId = (params.tenantId || 'anonymous').trim() || 'anonymous';
  const thresholdMs = params.thresholdMs ?? SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS;
  const roundedMs = Number(Math.max(0, params.durationMs).toFixed(2));
  const entry: SlowQueryEntry = {
    id: `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    tenantId,
    source: params.source,
    operation: params.operation.slice(0, 140),
    durationMs: roundedMs,
    thresholdMs,
    requestId: params.requestId,
  };

  slowQueriesRing.unshift(entry);
  if (slowQueriesRing.length > MAX_SLOW_QUERIES) {
    slowQueriesRing.pop();
  }

  globalBucket.slowQueriesCount += 1;
  if (tenantBuckets.has(tenantId)) {
    tenantBuckets.get(tenantId)!.slowQueriesCount += 1;
  }

  logSecurityEvent(roundedMs >= 1000 ? 'ERROR' : 'WARN', 'slow_query_detected', {
    tenantId,
    source: params.source,
    operation: entry.operation,
    durationMs: roundedMs,
    thresholdMs,
    ...(params.requestId ? { requestId: params.requestId } : {}),
  });
}

export function recordHttpMetric(params: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  tenantId?: string;
  requestId?: string;
}): void {
  ensureSystemMonitors();

  const tenantId = (params.tenantId || 'anonymous').trim() || 'anonymous';
  const durationMs = Math.max(0, Number(params.durationMs.toFixed(2)));
  const isRead = isMainReadEndpoint(params.method, params.path);
  const routeKey = normalizeRoutePath(params.method, params.path);
  const nowIso = new Date().toISOString();

  const applyToBucket = (b: MetricBucket, maxSamples: number) => {
    b.requests += 1;
    if (isRead) {
      b.reads += 1;
      pushBounded(b.readDurations, durationMs, maxSamples);
    } else {
      b.writes += 1;
    }
    if (params.statusCode >= 500) b.errors5xx += 1;
    else if (params.statusCode === 429) b.rateLimited429 += 1;
    else if (params.statusCode >= 400) b.errors4xx += 1;
    pushBounded(b.durations, durationMs, maxSamples);
    b.lastActiveAt = nowIso;
  };

  applyToBucket(globalBucket, MAX_GLOBAL_SAMPLES);
  applyToBucket(getOrCreateTenantBucket(tenantId), MAX_TENANT_SAMPLES);
  applyToBucket(getOrCreateRouteBucket(routeKey), MAX_ROUTE_SAMPLES);

  if (durationMs >= SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS && !params.path.endsWith('/stream')) {
    recordSlowQuery({
      tenantId,
      source: 'http',
      operation: routeKey,
      durationMs,
      thresholdMs: SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS,
      requestId: params.requestId,
    });
  }
}

export function recordJobExecutionMetric(params: {
  tenantId: string;
  jobType: string;
  durationMs: number;
  outcome: 'concluido' | 'falhado_reintento' | 'dead_letter';
}): void {
  const tenantId = (params.tenantId || 'global').trim() || 'global';
  const durationMs = Math.max(0, Number(params.durationMs.toFixed(2)));
  pushBounded(jobDurationSamples, durationMs, 500);

  let tStat = jobTenantStats.get(tenantId);
  if (!tStat) {
    tStat = { completed: 0, failed: 0, deadLettered: 0, durations: [] };
    jobTenantStats.set(tenantId, tStat);
  }
  if (params.outcome === 'concluido') tStat.completed += 1;
  else if (params.outcome === 'dead_letter') tStat.deadLettered += 1;
  else tStat.failed += 1;
  pushBounded(tStat.durations, durationMs, 150);

  if (durationMs >= 5000) {
    recordSlowQuery({
      tenantId,
      source: 'worker',
      operation: `job:${params.jobType}`,
      durationMs,
      thresholdMs: 5000,
    });
  }
}

export function getSystemResourcesSnapshot() {
  ensureSystemMonitors();
  const mem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const rssMb = Number((mem.rss / 1024 / 1024).toFixed(1));
  const heapUsedMb = Number((mem.heapUsed / 1024 / 1024).toFixed(1));
  const heapTotalMb = Number((mem.heapTotal / 1024 / 1024).toFixed(1));
  const heapLimitMb = Number(
    ((heapStats.heap_size_limit > 0 ? heapStats.heap_size_limit : mem.heapTotal) / 1024 / 1024).toFixed(1)
  );
  // Medir contra o limite máximo da V8 (heap_size_limit) para evitar falsos positivos
  // quando o V8 mantém heapTotal alocado ligeiramente acima de heapUsed (~95%).
  const heapUsedPct = heapLimitMb > 0 ? Number(((heapUsedMb / heapLimitMb) * 100).toFixed(1)) : 0;
  const externalMb = Number((mem.external / 1024 / 1024).toFixed(1));

  let eventLoopP95Ms = 0;
  let eventLoopP99Ms = 0;
  if (eventLoopMonitor) {
    eventLoopP95Ms = Number((eventLoopMonitor.percentile(95) / 1e6).toFixed(2));
    eventLoopP99Ms = Number((eventLoopMonitor.percentile(99) / 1e6).toFixed(2));
    if (isNaN(eventLoopP95Ms)) eventLoopP95Ms = 0;
    if (isNaN(eventLoopP99Ms)) eventLoopP99Ms = 0;
  }

  return {
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    cpuPercent: currentCpuPercent,
    cpuCores: Math.max(1, os.cpus().length || 1),
    loadAvg1m: Number((os.loadavg()[0] || 0).toFixed(2)),
    rssMb,
    heapUsedMb,
    heapTotalMb,
    heapLimitMb,
    heapUsedPct,
    externalMb,
    eventLoopP95Ms,
    eventLoopP99Ms,
  };
}

function toTenantSummary(tenantId: string, b: MetricBucket): TenantMetricsSummary {
  const latency = summarizeLatencies(b.durations);
  const mainReadsLatency = summarizeLatencies(b.readDurations);
  const errorRate5xxPct = b.requests > 0 ? Number(((b.errors5xx / b.requests) * 100).toFixed(2)) : 0;
  return {
    tenantId,
    requests: b.requests,
    reads: b.reads,
    writes: b.writes,
    errors5xx: b.errors5xx,
    errors4xx: b.errors4xx,
    rateLimited429: b.rateLimited429,
    errorRate5xxPct,
    slowQueriesCount: b.slowQueriesCount,
    latency,
    mainReadsLatency,
    sloReadP95Compliant: mainReadsLatency.count === 0 || mainReadsLatency.p95Ms < SLO_TARGETS.MAIN_READ_P95_MS,
    lastActiveAt: b.lastActiveAt,
  };
}

export function evaluateDegradationAlerts(params: {
  globalMainReads: LatencySummary;
  globalErrorRate5xxPct: number;
  globalRequests: number;
  tenants: TenantMetricsSummary[];
  slowQueriesLast5Min: number;
  queue: QueueMetricsInput;
  resources: ReturnType<typeof getSystemResourcesSnapshot>;
  circuitBreakers?: Record<string, { name: string; state: string; totalFailures?: number }>;
  emitLogs?: boolean;
}): DegradationAlert[] {
  const alerts: DegradationAlert[] = [];
  const nowIso = new Date().toISOString();

  // 1. Meta principal: p95 < 500ms nas leituras principais
  if (params.globalMainReads.count >= 5 && params.globalMainReads.p95Ms >= SLO_TARGETS.MAIN_READ_WARN_P95_MS) {
    const isCrit = params.globalMainReads.p95Ms >= SLO_TARGETS.MAIN_READ_P95_MS;
    alerts.push({
      id: 'slo_global_read_p95',
      severity: isCrit ? 'critico' : 'aviso',
      code: 'SLO_READ_LATENCY_HIGH',
      scope: 'global',
      title: isCrit
        ? `Latência p95 de leituras acima da meta (${SLO_TARGETS.MAIN_READ_P95_MS} ms)`
        : 'Latência p95 de leituras próxima do limite SLO',
      description: `O percentil p95 global das leituras principais atingiu ${params.globalMainReads.p95Ms} ms (meta < ${SLO_TARGETS.MAIN_READ_P95_MS} ms).`,
      currentValue: params.globalMainReads.p95Ms,
      thresholdValue: SLO_TARGETS.MAIN_READ_P95_MS,
      unit: 'ms',
      detectedAt: nowIso,
    });
  }

  // 2. Degradação isolada por tenant (p95 >= 500ms)
  for (const t of params.tenants) {
    if (t.tenantId !== 'anonymous' && t.mainReadsLatency.count >= 5 && t.mainReadsLatency.p95Ms >= SLO_TARGETS.MAIN_READ_P95_MS) {
      alerts.push({
        id: `slo_tenant_read_p95_${t.tenantId}`,
        severity: 'critico',
        code: 'TENANT_LATENCY_DEGRADATION',
        scope: 'tenant',
        tenantId: t.tenantId,
        title: `Degradação de latência no tenant ${t.tenantId}`,
        description: `Leituras principais do tenant ${t.tenantId} com p95 de ${t.mainReadsLatency.p95Ms} ms (meta < ${SLO_TARGETS.MAIN_READ_P95_MS} ms).`,
        currentValue: t.mainReadsLatency.p95Ms,
        thresholdValue: SLO_TARGETS.MAIN_READ_P95_MS,
        unit: 'ms',
        detectedAt: nowIso,
      });
    }
  }

  // 3. Taxa de erro HTTP 5xx
  if (params.globalRequests >= 10 && params.globalErrorRate5xxPct >= SLO_TARGETS.ERROR_RATE_5XX_WARN_PCT) {
    const isCrit = params.globalErrorRate5xxPct >= SLO_TARGETS.ERROR_RATE_5XX_CRIT_PCT;
    alerts.push({
      id: 'slo_http_5xx_rate',
      severity: isCrit ? 'critico' : 'aviso',
      code: 'HIGH_5XX_ERROR_RATE',
      scope: 'global',
      title: isCrit ? 'Taxa crítica de erros HTTP 5xx' : 'Aumento da taxa de erros HTTP 5xx',
      description: `Taxa atual de falhas 5xx em ${params.globalErrorRate5xxPct}% (${params.globalRequests} pedidos analisados).`,
      currentValue: params.globalErrorRate5xxPct,
      thresholdValue: isCrit ? SLO_TARGETS.ERROR_RATE_5XX_CRIT_PCT : SLO_TARGETS.ERROR_RATE_5XX_WARN_PCT,
      unit: '%',
      detectedAt: nowIso,
    });
  }

  // 4. Profundidade de fila e Dead-Letter Queue (DLQ)
  const backlog = (params.queue.pendente || 0) + (params.queue.falhadoReintento || 0);
  if (backlog >= SLO_TARGETS.QUEUE_BACKLOG_WARN) {
    const isCrit = backlog >= SLO_TARGETS.QUEUE_BACKLOG_CRIT;
    alerts.push({
      id: 'queue_backlog_high',
      severity: isCrit ? 'critico' : 'aviso',
      code: 'QUEUE_BACKLOG_GROWING',
      scope: 'queue',
      title: isCrit ? 'Congestionamento crítico na fila assíncrona' : 'Acumulação na fila de processamento',
      description: `Existem ${backlog} tarefas aguardando execução ou reintento nos workers.`,
      currentValue: backlog,
      thresholdValue: isCrit ? SLO_TARGETS.QUEUE_BACKLOG_CRIT : SLO_TARGETS.QUEUE_BACKLOG_WARN,
      unit: 'jobs',
      detectedAt: nowIso,
    });
  }

  if ((params.queue.deadLetterCount || 0) > 0) {
    alerts.push({
      id: 'queue_dlq_non_empty',
      severity: params.queue.deadLetterCount >= 10 ? 'critico' : 'aviso',
      code: 'DLQ_NON_EMPTY',
      scope: 'queue',
      title: 'Tarefas na Dead-Letter Queue (DLQ)',
      description: `${params.queue.deadLetterCount} tarefa(s) excederam as tentativas e aguardam reprocessamento ou inspeção.`,
      currentValue: params.queue.deadLetterCount,
      thresholdValue: 0,
      unit: 'jobs',
      detectedAt: nowIso,
    });
  }

  // 5. Pico de queries lentas nos últimos 5 minutos
  if (params.slowQueriesLast5Min >= 5) {
    alerts.push({
      id: 'slow_queries_spike',
      severity: params.slowQueriesLast5Min >= 20 ? 'critico' : 'aviso',
      code: 'SLOW_QUERY_SPIKE',
      scope: 'global',
      title: 'Pico de operações/queries lentas',
      description: `${params.slowQueriesLast5Min} operações excederam ${SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS} ms nos últimos 5 minutos.`,
      currentValue: params.slowQueriesLast5Min,
      thresholdValue: 5,
      unit: 'ops',
      detectedAt: nowIso,
    });
  }

  // 6. Recursos da instância (Heap contra heap_size_limit real e Event Loop Lag)
  if (params.resources.heapUsedPct >= SLO_TARGETS.HEAP_USAGE_WARN_PCT) {
    alerts.push({
      id: 'infra_heap_high',
      severity: params.resources.heapUsedPct >= 93 ? 'critico' : 'aviso',
      code: 'HIGH_HEAP_USAGE',
      scope: 'infra',
      title: 'Pressão de memória Heap Node.js',
      description: `Uso da Heap em ${params.resources.heapUsedPct}% (${params.resources.heapUsedMb} MB / limite ${params.resources.heapLimitMb} MB).`,
      currentValue: params.resources.heapUsedPct,
      thresholdValue: SLO_TARGETS.HEAP_USAGE_WARN_PCT,
      unit: '%',
      detectedAt: nowIso,
    });
  }

  if (params.resources.eventLoopP95Ms >= SLO_TARGETS.EVENT_LOOP_LAG_WARN_MS) {
    alerts.push({
      id: 'infra_event_loop_lag',
      severity: params.resources.eventLoopP95Ms >= 250 ? 'critico' : 'aviso',
      code: 'EVENT_LOOP_SATURATION',
      scope: 'infra',
      title: 'Saturação do Event Loop do servidor',
      description: `Event loop delay p95 em ${params.resources.eventLoopP95Ms} ms (limite recomendado < ${SLO_TARGETS.EVENT_LOOP_LAG_WARN_MS} ms).`,
      currentValue: params.resources.eventLoopP95Ms,
      thresholdValue: SLO_TARGETS.EVENT_LOOP_LAG_WARN_MS,
      unit: 'ms',
      detectedAt: nowIso,
    });
  }

  // 7. Circuit breakers abertos
  if (params.circuitBreakers) {
    for (const [key, breaker] of Object.entries(params.circuitBreakers)) {
      if (breaker && (breaker.state === 'OPEN' || breaker.state === 'HALF_OPEN')) {
        alerts.push({
          id: `breaker_open_${key}`,
          severity: breaker.state === 'OPEN' ? 'critico' : 'aviso',
          code: 'CIRCUIT_BREAKER_OPEN',
          scope: 'infra',
          title: `Circuit Breaker "${breaker.name}" em estado ${breaker.state}`,
          description: `Integração externa degradada: circuito em ${breaker.state} após falhas consecutivas.`,
          currentValue: breaker.totalFailures || 1,
          thresholdValue: 0,
          unit: 'falhas',
          detectedAt: nowIso,
        });
      }
    }
  }

  if (params.emitLogs) {
    const nowMs = Date.now();
    for (const alert of alerts) {
      const logKey = `${alert.id}:${alert.severity}`;
      const last = alertLastLoggedAt.get(logKey) || 0;
      if (nowMs - last >= ALERT_LOG_COOLDOWN_MS) {
        alertLastLoggedAt.set(logKey, nowMs);
        logSecurityEvent(
          alert.severity === 'critico' ? 'ERROR' : 'WARN',
          'observability_degradation_alert',
          {
            alertCode: alert.code,
            severity: alert.severity,
            scope: alert.scope,
            tenantId: alert.tenantId || 'global',
            currentValue: alert.currentValue,
            thresholdValue: alert.thresholdValue,
            unit: alert.unit,
            title: alert.title,
          }
        );
      }
    }
  }

  return alerts;
}

export function getObservabilitySnapshot(options: {
  callerRole: string;
  callerTenantId: string;
  queue: QueueMetricsInput;
  circuitBreakers?: Record<string, any>;
  emitAlertLogs?: boolean;
}) {
  const isSuper = options.callerRole === 'super_admin' || options.callerRole === 'superadmin';
  const resources = getSystemResourcesSnapshot();
  const uptimeSec = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
  const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;

  if (isSuper) {
    const globalLatency = summarizeLatencies(globalBucket.durations);
    const globalMainReads = summarizeLatencies(globalBucket.readDurations);
    const globalErrorRate5xxPct =
      globalBucket.requests > 0
        ? Number(((globalBucket.errors5xx / globalBucket.requests) * 100).toFixed(2))
        : 0;

    const tenants = Array.from(tenantBuckets.entries())
      .map(([tid, b]) => toTenantSummary(tid, b))
      .sort((a, b) => b.requests - a.requests);

    const routes: RouteMetricsSummary[] = Array.from(routeBuckets.entries())
      .map(([route, b]) => ({
        route,
        requests: b.requests,
        errors5xx: b.errors5xx,
        errors429: b.rateLimited429,
        latency: summarizeLatencies(b.durations),
      }))
      .sort((a, b) => b.latency.p95Ms - a.latency.p95Ms)
      .slice(0, 30);

    const slowQueriesLast5Min = slowQueriesRing.filter(
      (q) => new Date(q.timestamp).getTime() >= fiveMinutesAgoMs
    ).length;

    const alerts = evaluateDegradationAlerts({
      globalMainReads,
      globalErrorRate5xxPct,
      globalRequests: globalBucket.requests,
      tenants,
      slowQueriesLast5Min,
      queue: options.queue,
      resources,
      circuitBreakers: options.circuitBreakers,
      emitLogs: options.emitAlertLogs,
    });

    return {
      scope: 'global' as const,
      generatedAt: new Date().toISOString(),
      sloTargets: SLO_TARGETS,
      summary: {
        totalRequests: globalBucket.requests,
        mainReadsCount: globalBucket.reads,
        writesCount: globalBucket.writes,
        errors5xx: globalBucket.errors5xx,
        errors4xx: globalBucket.errors4xx,
        rateLimited429: globalBucket.rateLimited429,
        errorRate5xxPct: globalErrorRate5xxPct,
        approxRps: Number((globalBucket.requests / uptimeSec).toFixed(2)),
        sloReadP95Compliant:
          globalMainReads.count === 0 || globalMainReads.p95Ms < SLO_TARGETS.MAIN_READ_P95_MS,
        latency: globalLatency,
        mainReadsLatency: globalMainReads,
        jobExecutionLatency: summarizeLatencies(jobDurationSamples),
      },
      resources,
      queue: options.queue,
      circuitBreakers: options.circuitBreakers || {},
      tenants,
      routes,
      slowQueries: slowQueriesRing.slice(0, 40),
      slowQueriesLast5Min,
      alerts,
    };
  }

  // Escopo estritamente isolado por tenant (um tenant nunca vê métricas ou alertas de outro tenant)
  const scopedTenantId = options.callerTenantId;
  const tBucket = tenantBuckets.get(scopedTenantId) || createBucket();
  const tenantSummary = toTenantSummary(scopedTenantId, tBucket);
  const tenantSlowQueries = slowQueriesRing.filter((q) => q.tenantId === scopedTenantId);
  const tenantSlowLast5Min = tenantSlowQueries.filter(
    (q) => new Date(q.timestamp).getTime() >= fiveMinutesAgoMs
  ).length;
  const tenantQueueStats = options.queue.perTenant?.[scopedTenantId] || {
    pendente: 0,
    emProcessamento: 0,
    falhadoReintento: 0,
    deadLetter: 0,
  };
  const scopedQueue: QueueMetricsInput = {
    totalQueued:
      tenantQueueStats.pendente +
      tenantQueueStats.emProcessamento +
      tenantQueueStats.falhadoReintento,
    pendente: tenantQueueStats.pendente,
    emProcessamento: tenantQueueStats.emProcessamento,
    falhadoReintento: tenantQueueStats.falhadoReintento,
    deadLetterCount: tenantQueueStats.deadLetter,
    workerActiveJobs: options.queue.workerActiveJobs,
    workerMaxConcurrent: options.queue.workerMaxConcurrent,
  };
  const tenantJobStat = jobTenantStats.get(scopedTenantId);

  const alerts = evaluateDegradationAlerts({
    globalMainReads: tenantSummary.mainReadsLatency,
    globalErrorRate5xxPct: tenantSummary.errorRate5xxPct,
    globalRequests: tenantSummary.requests,
    tenants: [tenantSummary],
    slowQueriesLast5Min: tenantSlowLast5Min,
    queue: scopedQueue,
    resources,
    emitLogs: false,
  });

  return {
    scope: 'tenant' as const,
    tenantId: scopedTenantId,
    generatedAt: new Date().toISOString(),
    sloTargets: SLO_TARGETS,
    summary: {
      totalRequests: tenantSummary.requests,
      mainReadsCount: tenantSummary.reads,
      writesCount: tenantSummary.writes,
      errors5xx: tenantSummary.errors5xx,
      errors4xx: tenantSummary.errors4xx,
      rateLimited429: tenantSummary.rateLimited429,
      errorRate5xxPct: tenantSummary.errorRate5xxPct,
      approxRps: Number((tenantSummary.requests / uptimeSec).toFixed(2)),
      sloReadP95Compliant: tenantSummary.sloReadP95Compliant,
      latency: tenantSummary.latency,
      mainReadsLatency: tenantSummary.mainReadsLatency,
      jobExecutionLatency: summarizeLatencies(tenantJobStat?.durations || []),
    },
    resources: {
      uptimeSeconds: resources.uptimeSeconds,
      eventLoopP95Ms: resources.eventLoopP95Ms,
    },
    queue: scopedQueue,
    tenants: [tenantSummary],
    routes: [],
    slowQueries: tenantSlowQueries.slice(0, 25),
    slowQueriesLast5Min: tenantSlowLast5Min,
    alerts,
  };
}

export function renderPrometheusMetrics(snapshot: ReturnType<typeof getObservabilitySnapshot>): string {
  const lines: string[] = [];
  const s = snapshot.summary;
  const r = snapshot.resources as ReturnType<typeof getSystemResourcesSnapshot>;
  const q = snapshot.queue;

  lines.push('# HELP sge_http_requests_total Total de pedidos HTTP registados na janela de observabilidade.');
  lines.push('# TYPE sge_http_requests_total counter');
  lines.push(`sge_http_requests_total ${s.totalRequests}`);

  lines.push('# HELP sge_http_errors_5xx_total Total de respostas HTTP 5xx.');
  lines.push('# TYPE sge_http_errors_5xx_total counter');
  lines.push(`sge_http_errors_5xx_total ${s.errors5xx}`);

  lines.push('# HELP sge_http_rate_limited_429_total Total de pedidos limitados por quota ou rate limiter.');
  lines.push('# TYPE sge_http_rate_limited_429_total counter');
  lines.push(`sge_http_rate_limited_429_total ${s.rateLimited429}`);

  lines.push('# HELP sge_http_latency_ms Percentis de latência HTTP global em milissegundos.');
  lines.push('# TYPE sge_http_latency_ms gauge');
  lines.push(`sge_http_latency_ms{quantile="p50"} ${s.latency.p50Ms}`);
  lines.push(`sge_http_latency_ms{quantile="p95"} ${s.latency.p95Ms}`);
  lines.push(`sge_http_latency_ms{quantile="p99"} ${s.latency.p99Ms}`);

  lines.push('# HELP sge_main_reads_latency_ms Percentis das leituras principais (meta SLO p95 < 500ms).');
  lines.push('# TYPE sge_main_reads_latency_ms gauge');
  lines.push(`sge_main_reads_latency_ms{quantile="p50"} ${s.mainReadsLatency.p50Ms}`);
  lines.push(`sge_main_reads_latency_ms{quantile="p95"} ${s.mainReadsLatency.p95Ms}`);
  lines.push(`sge_main_reads_latency_ms{quantile="p99"} ${s.mainReadsLatency.p99Ms}`);

  lines.push('# HELP sge_slo_read_p95_compliant Indica se o p95 das leituras está abaixo da meta (1=sim, 0=não).');
  lines.push('# TYPE sge_slo_read_p95_compliant gauge');
  lines.push(`sge_slo_read_p95_compliant ${s.sloReadP95Compliant ? 1 : 0}`);

  lines.push('# HELP sge_queue_depth Tamanho atual das filas assíncronas por estado.');
  lines.push('# TYPE sge_queue_depth gauge');
  lines.push(`sge_queue_depth{status="pendente"} ${q.pendente}`);
  lines.push(`sge_queue_depth{status="em_processamento"} ${q.emProcessamento}`);
  lines.push(`sge_queue_depth{status="falhado_reintento"} ${q.falhadoReintento}`);
  lines.push(`sge_queue_depth{status="dead_letter"} ${q.deadLetterCount}`);

  if (typeof r.cpuPercent === 'number') {
    lines.push('# HELP sge_process_cpu_percent Uso estimado de CPU do processo Node.js (%).');
    lines.push('# TYPE sge_process_cpu_percent gauge');
    lines.push(`sge_process_cpu_percent ${r.cpuPercent}`);
  }
  if (typeof r.rssMb === 'number') {
    lines.push('# HELP sge_process_memory_rss_mb Memória RSS do processo em MB.');
    lines.push('# TYPE sge_process_memory_rss_mb gauge');
    lines.push(`sge_process_memory_rss_mb ${r.rssMb}`);
    lines.push(`sge_process_memory_heap_used_mb ${r.heapUsedMb}`);
  }
  lines.push('# HELP sge_event_loop_delay_p95_ms Atraso p95 do Event Loop Node.js em milissegundos.');
  lines.push('# TYPE sge_event_loop_delay_p95_ms gauge');
  lines.push(`sge_event_loop_delay_p95_ms ${r.eventLoopP95Ms}`);

  lines.push('# HELP sge_active_alerts_total Número de alertas de degradação ativos.');
  lines.push('# TYPE sge_active_alerts_total gauge');
  lines.push(`sge_active_alerts_total ${snapshot.alerts.length}`);

  if (snapshot.tenants.length > 0) {
    lines.push('# HELP sge_tenant_read_p95_ms Latência p95 de leituras por tenant em milissegundos.');
    lines.push('# TYPE sge_tenant_read_p95_ms gauge');
    lines.push('# HELP sge_tenant_requests_total Pedidos registados por tenant.');
    lines.push('# TYPE sge_tenant_requests_total counter');
    for (const t of snapshot.tenants.slice(0, 100)) {
      const safeTid = t.tenantId.replace(/"/g, '\\"');
      lines.push(`sge_tenant_read_p95_ms{tenant_id="${safeTid}"} ${t.mainReadsLatency.p95Ms}`);
      lines.push(`sge_tenant_requests_total{tenant_id="${safeTid}"} ${t.requests}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function stopObservabilityMonitors(): void {
  if (cpuSamplerTimer) {
    clearInterval(cpuSamplerTimer);
    cpuSamplerTimer = null;
  }
  if (eventLoopMonitor) {
    try {
      eventLoopMonitor.disable();
    } catch {
      // ignora
    }
    eventLoopMonitor = null;
  }
}

export function resetObservabilityForTests(): void {
  globalBucket = createBucket();
  tenantBuckets.clear();
  routeBuckets.clear();
  jobDurationSamples.length = 0;
  jobTenantStats.clear();
  slowQueriesRing.length = 0;
  alertLastLoggedAt.clear();
}
