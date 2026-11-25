import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SLO_TARGETS,
  getHttpSlowThresholdMs,
  recordHttpMetric,
  recordSlowQuery,
  recordJobExecutionMetric,
  evaluateDegradationAlerts,
  getObservabilitySnapshot,
  getSystemResourcesSnapshot,
  summarizeLatencies,
  renderPrometheusMetrics,
  resetObservabilityForTests,
} from '../server/services/observability';

describe('Fase 7 — Observabilidade, Métricas por Tenant & Alertas SLO', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  afterEach(() => {
    resetObservabilityForTests();
  });

  it('calcula exactamente p50, p95 e p99 com ring buffer limitado e sem fuga de memória', () => {
    // Gerar 1600 amostras (acima de MAX_GLOBAL_SAMPLES = 1500) para validar janela limitada
    for (let i = 1; i <= 1600; i += 1) {
      recordHttpMetric({
        method: 'GET',
        path: '/api/jobs',
        tenantId: 'tenant_alpha',
        statusCode: 200,
        durationMs: i <= 1520 ? 120 : 420,
      });
    }

    const snap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: {
        totalQueued: 0,
        pendente: 0,
        emProcessamento: 0,
        falhadoReintento: 0,
        deadLetterCount: 0,
        perTenant: {},
      },
      circuitBreakers: {},
    });

    expect(snap.sloTargets.MAIN_READ_P95_MS).toBe(500);
    expect(snap.summary.mainReadsLatency.p50Ms).toBe(120);
    expect(snap.summary.mainReadsLatency.p95Ms).toBe(420);
    expect(snap.summary.mainReadsLatency.p99Ms).toBe(420);
    expect(snap.summary.totalRequests).toBe(1600);
    // Janela do ring buffer mantém-se limitada a 1500 amostras globais
    expect(snap.summary.mainReadsLatency.count).toBeLessThanOrEqual(1500);
    // Como p95 = 420ms < 500ms e erro = 0%, estado deve cumprir SLO
    expect(snap.summary.sloReadP95Compliant).toBe(true);
  });

  it('garante isolamento estrito entre tenants no snapshot e alertas', () => {
    for (let i = 0; i < 25; i += 1) {
      recordHttpMetric({
        method: 'GET',
        path: '/api/jobs',
        tenantId: 'tenant_alpha',
        statusCode: 200,
        durationMs: 85,
      });
      recordHttpMetric({
        method: 'GET',
        path: '/api/jobs',
        tenantId: 'tenant_beta',
        statusCode: 500,
        durationMs: 910,
      });
    }

    recordSlowQuery({
      operation: 'beta_heavy_query',
      tenantId: 'tenant_beta',
      durationMs: 780,
      source: 'firestore',
    });

    const sharedQueue = {
      totalQueued: 17,
      pendente: 15,
      emProcessamento: 2,
      falhadoReintento: 0,
      deadLetterCount: 4,
      perTenant: {
        tenant_alpha: { pendente: 3, emProcessamento: 1, falhadoReintento: 0, deadLetter: 0 },
        tenant_beta: { pendente: 12, emProcessamento: 1, falhadoReintento: 0, deadLetter: 4 },
      },
    };

    const alphaSnap = getObservabilitySnapshot({
      callerRole: 'admin',
      callerTenantId: 'tenant_alpha',
      queue: sharedQueue,
      circuitBreakers: {},
    });

    expect(alphaSnap.scope).toBe('tenant');
    expect(alphaSnap.tenantId).toBe('tenant_alpha');
    expect(alphaSnap.tenants.length).toBe(1);
    expect(alphaSnap.tenants[0].tenantId).toBe('tenant_alpha');
    // Alpha não deve ver métricas, filas nem slow queries de Beta
    expect(alphaSnap.summary.totalRequests).toBe(25);
    expect(alphaSnap.queue.pendente).toBe(3);
    expect(alphaSnap.queue.deadLetterCount).toBe(0);
    expect(alphaSnap.slowQueries.length).toBe(0);
    expect(alphaSnap.alerts.every((a) => !a.tenantId || a.tenantId === 'tenant_alpha')).toBe(true);

    // SuperAdmin vê todos os tenants e filas globais
    const superSnap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: sharedQueue,
      circuitBreakers: {},
    });

    expect(superSnap.scope).toBe('global');
    expect(superSnap.tenants.map((t) => t.tenantId).sort()).toEqual(['tenant_alpha', 'tenant_beta']);
    expect(superSnap.slowQueries.some((q) => q.tenantId === 'tenant_beta')).toBe(true);
  });

  it('dispara alertas de degradação para SLO p95 > 500ms, DLQ não vazia, taxa 5xx e circuit breaker OPEN', () => {
    for (let i = 0; i < 20; i += 1) {
      recordHttpMetric({
        method: 'GET',
        path: '/api/reports/overview',
        tenantId: 'tenant_sobrecarga',
        statusCode: i < 3 ? 503 : 200, // 15% 5xx
        durationMs: 680, // > 500ms SLO
      });
    }

    const highLat = summarizeLatencies(Array.from({ length: 20 }, () => 680));
    const alerts = evaluateDegradationAlerts({
      globalMainReads: highLat,
      globalErrorRate5xxPct: 15,
      globalRequests: 20,
      tenants: [
        {
          tenantId: 'tenant_sobrecarga',
          requests: 20,
          reads: 20,
          writes: 0,
          errors5xx: 3,
          errors4xx: 0,
          rateLimited429: 0,
          errorRate5xxPct: 15,
          slowQueriesCount: 20,
          latency: highLat,
          mainReadsLatency: highLat,
          sloReadP95Compliant: false,
          lastActiveAt: new Date().toISOString(),
        },
      ],
      slowQueriesLast5Min: 20,
      queue: {
        totalQueued: 7,
        pendente: 5,
        emProcessamento: 1,
        falhadoReintento: 1,
        deadLetterCount: 2,
        perTenant: {
          tenant_sobrecarga: { pendente: 5, emProcessamento: 1, falhadoReintento: 1, deadLetter: 2 },
        },
      },
      resources: getSystemResourcesSnapshot(),
      circuitBreakers: {
        stripe: {
          name: 'stripe_api',
          state: 'OPEN',
          totalFailures: 6,
        },
      },
      emitLogs: false,
    });

    const codes = new Set(alerts.map((a) => a.code));
    expect(codes.has('SLO_READ_LATENCY_HIGH')).toBe(true);
    expect(codes.has('TENANT_LATENCY_DEGRADATION')).toBe(true);
    expect(codes.has('HIGH_5XX_ERROR_RATE')).toBe(true);
    expect(codes.has('DLQ_NON_EMPTY')).toBe(true);
    expect(codes.has('CIRCUIT_BREAKER_OPEN')).toBe(true);
  });

  it('regista rotas HTTP lentas automaticamente em slowQueries, métricas de jobs e Prometheus', () => {
    recordHttpMetric({
      method: 'POST',
      path: '/api/notifications/bulk',
      tenantId: 'tenant_gamma',
      statusCode: 202,
      durationMs: SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS + 100,
    });
    recordJobExecutionMetric({
      jobType: 'bulk_notification',
      tenantId: 'tenant_gamma',
      outcome: 'concluido',
      durationMs: 240,
    });
    recordJobExecutionMetric({
      jobType: 'email_send',
      tenantId: 'tenant_gamma',
      outcome: 'dead_letter',
      durationMs: 95,
    });

    const snap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: {
        totalQueued: 6,
        pendente: 4,
        emProcessamento: 2,
        falhadoReintento: 0,
        deadLetterCount: 1,
        perTenant: {},
      },
      circuitBreakers: {},
    });

    expect(snap.slowQueries.some((q) => q.operation.includes('/api/notifications/bulk'))).toBe(true);
    expect(snap.summary.jobExecutionLatency.count).toBe(2);

    const promText = renderPrometheusMetrics(snap);
    expect(promText).toContain('sge_main_reads_latency_ms{quantile="p95"}');
    expect(promText).toContain('sge_queue_depth{status="dead_letter"} 1');
    expect(promText).toContain('tenant_id="tenant_gamma"');
  });

  it('calcula heapUsedPct sobre o limite máximo V8 (heapLimitMb) sem falso positivo HIGH_HEAP_USAGE', () => {
    const res = getSystemResourcesSnapshot();
    expect(res.heapLimitMb).toBeGreaterThanOrEqual(res.heapTotalMb);
    expect(res.heapUsedPct).toBeLessThan(SLO_TARGETS.HEAP_USAGE_WARN_PCT);

    const alerts = evaluateDegradationAlerts({
      globalMainReads: summarizeLatencies([45, 50]),
      globalErrorRate5xxPct: 0,
      globalRequests: 2,
      tenants: [],
      slowQueriesLast5Min: 0,
      queue: {
        totalQueued: 0,
        pendente: 0,
        emProcessamento: 0,
        falhadoReintento: 0,
        deadLetterCount: 0,
      },
      resources: res,
      emitLogs: false,
    });

    expect(alerts.some((a) => a.code === 'HIGH_HEAP_USAGE')).toBe(false);
  });

  it('aplica limiar externo para rotas de auth/email e regista slow_query_detected em WARN em vez de ERROR', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getHttpSlowThresholdMs('/api/auth/session/create')).toBe(SLO_TARGETS.EXTERNAL_HTTP_SLOW_THRESHOLD_MS);
    expect(getHttpSlowThresholdMs('/api/send-email')).toBe(SLO_TARGETS.EXTERNAL_HTTP_SLOW_THRESHOLD_MS);
    expect(getHttpSlowThresholdMs('/api/notifications/bulk')).toBe(SLO_TARGETS.SLOW_QUERY_THRESHOLD_MS);

    // 1500ms numa rota de sessão/email não deve gerar falso slow_query sob limiar DB de 350ms
    recordHttpMetric({
      method: 'POST',
      path: '/api/auth/session/create',
      tenantId: 'anonymous',
      statusCode: 200,
      durationMs: 1500,
    });
    recordHttpMetric({
      method: 'POST',
      path: '/api/send-email',
      tenantId: 'super-admin',
      statusCode: 202,
      durationMs: 1400,
    });

    let snap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: { totalQueued: 0, pendente: 0, emProcessamento: 0, falhadoReintento: 0, deadLetterCount: 0 },
    });
    expect(snap.slowQueries.length).toBe(0);
    expect(errSpy).not.toHaveBeenCalled();

    // Acima de EXTERNAL_HTTP_SLOW_THRESHOLD_MS emite slow_query_detected como WARN (nunca ERROR)
    recordHttpMetric({
      method: 'POST',
      path: '/api/send-email',
      tenantId: 'super-admin',
      statusCode: 202,
      durationMs: SLO_TARGETS.EXTERNAL_HTTP_SLOW_THRESHOLD_MS + 250,
    });

    snap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: { totalQueued: 0, pendente: 0, emProcessamento: 0, falhadoReintento: 0, deadLetterCount: 0 },
    });
    expect(snap.slowQueries.some((q) => q.operation === 'POST /api/send-email')).toBe(true);
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('regista alertas de degradação de latência em WARN (não ERROR) mesmo quando severidade é critico', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 6; i += 1) {
      recordHttpMetric({
        method: 'GET',
        path: '/api/superadmin/assistant/overview',
        tenantId: 'super-admin',
        statusCode: 200,
        durationMs: 780,
      });
    }

    const snap = getObservabilitySnapshot({
      callerRole: 'super_admin',
      callerTenantId: 'global',
      queue: { totalQueued: 0, pendente: 0, emProcessamento: 0, falhadoReintento: 0, deadLetterCount: 0 },
      emitAlertLogs: true,
    });

    expect(snap.alerts.some((a) => a.code === 'SLO_READ_LATENCY_HIGH' && a.severity === 'critico')).toBe(true);
    expect(snap.alerts.some((a) => a.code === 'TENANT_LATENCY_DEGRADATION' && a.severity === 'critico')).toBe(true);
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
