/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Teste de Carga k6 — SGE Multi-Tenant (Fase 7 Observabilidade & SLO)
 *
 * Cenários reais simulados em paralelo:
 *   1. thousands_concurrent_users : Entrada em massa de utilizadores simultâneos (leituras principais).
 *   2. abertura_matriculas        : Pico de abertura de matrículas (consulta de capacidade/quotas + enfileiramento assíncrono).
 *   3. lancamento_notas           : Pico de lançamento de notas e recálculo de agregados analíticos via fila assíncrona.
 *   4. notificacoes_em_massa      : Disparo idempotente de notificações em massa ("Notificar Aula pendente" / comunicados).
 *
 * Metas SLO obrigatórias:
 *   - p95 < 500 ms nas leituras principais (`http_req_duration{kind:read}`)
 *   - 0 perda de dados sob carga (`sge_data_loss_count == 0`, toda escrita crítica aceite com HTTP 202 + jobId persistido)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.SGE_BASE_URL || 'http://127.0.0.1:3000';
const AUTH_TOKEN = __ENV.SGE_AUTH_TOKEN || '';
const TENANT_IDS = (__ENV.SGE_TENANT_IDS || 'tenant_escola_a,tenant_escola_b,tenant_univ_c')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SCALE_FACTOR = Number(__ENV.SGE_SCALE_FACTOR || '1');

export const mainReadDuration = new Trend('sge_main_read_duration', true);
export const enqueueDuration = new Trend('sge_async_enqueue_duration', true);
export const dataLossCounter = new Counter('sge_data_loss_count');
export const idempotentAcceptedRate = new Rate('sge_idempotent_accepted_rate');

function scaled(vus) {
  return Math.max(1, Math.round(vus * SCALE_FACTOR));
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    // 1. Entrada simultânea de milhares de utilizadores (leituras principais)
    thousands_concurrent_users: {
      executor: 'ramping-vus',
      exec: 'scenarioConcurrentUsers',
      startVUs: 0,
      stages: [
        { duration: '30s', target: scaled(250) },
        { duration: '1m', target: scaled(1000) },
        { duration: '1m', target: scaled(2000) },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },

    // 2. Pico de abertura de matrículas (leitura de vagas/quotas + geração de resumo assíncrono)
    abertura_matriculas: {
      executor: 'ramping-arrival-rate',
      exec: 'scenarioAberturaMatriculas',
      startRate: scaled(10),
      timeUnit: '1s',
      preAllocatedVUs: scaled(50),
      maxVUs: scaled(400),
      stages: [
        { duration: '20s', target: scaled(40) },
        { duration: '1m', target: scaled(120) },
        { duration: '30s', target: scaled(10) },
      ],
    },

    // 3. Pico de lançamento de notas e actualização de pautas/agregados
    lancamento_notas: {
      executor: 'constant-arrival-rate',
      exec: 'scenarioLancamentoNotas',
      rate: scaled(60),
      timeUnit: '1s',
      duration: '1m30s',
      preAllocatedVUs: scaled(40),
      maxVUs: scaled(300),
      startTime: '15s',
    },

    // 4. Disparo de notificações em massa com garantia de zero perda (HTTP 202 + jobId)
    notificacoes_em_massa: {
      executor: 'per-vu-iterations',
      exec: 'scenarioNotificacoesEmMassa',
      vus: scaled(30),
      iterations: 5,
      startTime: '20s',
      maxDuration: '2m',
    },
  },
  thresholds: {
    // Meta principal da Fase 7: p95 abaixo de 500 ms nas leituras principais
    'http_req_duration{kind:read}': ['p(95)<500', 'p(99)<1200'],
    'sge_main_read_duration': ['p(95)<500'],
    'sge_async_enqueue_duration': ['p(95)<800'],
    // Meta de fiabilidade: zero perda de dados sob carga
    'sge_data_loss_count': ['count==0'],
    'sge_idempotent_accepted_rate': ['rate>0.99'],
    'http_req_failed{critical:yes}': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

function pickTenant() {
  const idx = (__VU + __ITER) % TENANT_IDS.length;
  return TENANT_IDS[idx];
}

function buildHeaders(tenantId, idempotencyKey) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Tenant-Id': tenantId,
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return headers;
}

function assertReadOk(res, name) {
  mainReadDuration.add(res.timings.duration);
  const ok = check(res, {
    [`${name}: status 200 ou auth controlado (401 sem token)`]: (r) =>
      AUTH_TOKEN ? r.status === 200 : (r.status === 200 || r.status === 401),
    [`${name}: sem erro 5xx`]: (r) => r.status < 500,
  });
  return ok;
}

function assertAsyncAccepted(res, name) {
  enqueueDuration.add(res.timings.duration);
  if (!AUTH_TOKEN) {
    check(res, {
      [`${name}: fail-closed sem erro 5xx`]: (r) => r.status === 401 || r.status === 403,
    });
    idempotentAcceptedRate.add(true);
    return null;
  }

  let jobId = null;
  if (res.status === 202 || res.status === 200) {
    try {
      const parsed = res.json();
      jobId = parsed && (parsed.jobId || (parsed.job && parsed.job.id));
    } catch (_) {
      jobId = null;
    }
  }

  const accepted = (res.status === 202 || res.status === 200) && Boolean(jobId);
  const throttledGracefully = res.status === 429; // Backpressure por quota sem corrupção

  if (!accepted && !throttledGracefully) {
    dataLossCounter.add(1);
    idempotentAcceptedRate.add(false);
  } else {
    idempotentAcceptedRate.add(true);
  }

  check(res, {
    [`${name}: aceite (202 com jobId) ou throttle limpo (429)`]: () => accepted || throttledGracefully,
    [`${name}: sem erro interno 5xx`]: (r) => r.status < 500,
  });

  return jobId;
}

export function scenarioConcurrentUsers() {
  const tenantId = pickTenant();
  const headers = buildHeaders(tenantId);

  group('Leituras Principais do Portal', () => {
    const readyRes = http.get(`${BASE_URL}/ready`, {
      tags: { kind: 'read', critical: 'yes', scenario: 'concurrent_users' },
    });
    mainReadDuration.add(readyRes.timings.duration);
    check(readyRes, {
      'ready status 200': (r) => r.status === 200,
    });

    const quotaRes = http.get(`${BASE_URL}/api/tenant/quota-status`, {
      headers,
      tags: { kind: 'read', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'concurrent_users' },
    });
    assertReadOk(quotaRes, 'quota-status');

    const jobsRes = http.get(`${BASE_URL}/api/jobs?limit=20`, {
      headers,
      tags: { kind: 'read', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'concurrent_users' },
    });
    assertReadOk(jobsRes, 'jobs-list');
  });

  sleep(0.5);
}

export function scenarioAberturaMatriculas() {
  const tenantId = pickTenant();
  const idemKey = `k6_matricula_${tenantId}_${__VU}_${__ITER}`;
  const headers = buildHeaders(tenantId, idemKey);

  // 1. Verificar quota do plano antes da matrícula
  const quotaRes = http.get(`${BASE_URL}/api/tenant/quota-status`, {
    headers,
    tags: { kind: 'read', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'abertura_matriculas' },
  });
  assertReadOk(quotaRes, 'abertura-quota');

  // 2. Enfileirar recálculo de capacidade/vagas do curso (evita contenção em documento quente)
  const payload = JSON.stringify({
    scope: 'analytics_recompute',
    tenantId,
    idempotencyKey: idemKey,
  });

  const enqueueRes = http.post(`${BASE_URL}/api/reports/generate`, payload, {
    headers,
    tags: { kind: 'write', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'abertura_matriculas' },
  });
  const jobId = assertAsyncAccepted(enqueueRes, 'matricula-analytics-recompute');

  // 3. Reenviar exatamente com a mesma chave de idempotência para provar zero duplicação
  if (AUTH_TOKEN && jobId) {
    const replayRes = http.post(`${BASE_URL}/api/reports/generate`, payload, {
      headers,
      tags: { kind: 'write', critical: 'yes', scenario: 'abertura_matriculas_idempotency' },
    });
    let replayJobId = null;
    try {
      replayJobId = replayRes.json('jobId');
    } catch (_) {
      replayJobId = null;
    }
    check(replayRes, {
      'idempotência matrícula preserva mesmo jobId': () =>
        replayRes.status === 429 || replayJobId === jobId,
    });
  }
}

export function scenarioLancamentoNotas() {
  const tenantId = pickTenant();
  const idemKey = `k6_notas_${tenantId}_${__VU}_${__ITER}`;
  const headers = buildHeaders(tenantId, idemKey);

  // Leitura de painel de métricas/ocupação antes do lançamento
  const metricsRes = http.get(`${BASE_URL}/api/observability/metrics`, {
    headers,
    tags: { kind: 'read', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'lancamento_notas' },
  });
  assertReadOk(metricsRes, 'notas-observability-read');

  // Enfileiramento assíncrono da consolidação de pauta mensal / exportação
  const reportPayload = JSON.stringify({
    scope: 'monthly_report',
    tenantId,
    idempotencyKey: idemKey,
    monthName: 'Novembro',
    year: 2026,
    kpis: {
      total_alunos: 1200,
      media_geral: 14.8,
      taxa_aprovacao: 89.4,
      taxa_assiduidade: 94.1,
    },
  });

  const postRes = http.post(`${BASE_URL}/api/reports/generate`, reportPayload, {
    headers,
    tags: { kind: 'write', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'lancamento_notas' },
  });
  const jobId = assertAsyncAccepted(postRes, 'notas-pauta-generate');

  // Consultar estado persistido do job para confirmar zero perda em fila
  if (AUTH_TOKEN && jobId) {
    const statusRes = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
      headers,
      tags: { kind: 'read', critical: 'yes', scenario: 'lancamento_notas_job_poll' },
    });
    mainReadDuration.add(statusRes.timings.duration);
    const persisted = check(statusRes, {
      'job de notas persistido na fila (status 200)': (r) => r.status === 200,
    });
    if (!persisted && statusRes.status !== 429) {
      dataLossCounter.add(1);
    }
  }
}

export function scenarioNotificacoesEmMassa() {
  const tenantId = pickTenant();
  const idemKey = `k6_notif_massa_${tenantId}_${__VU}_${__ITER}`;
  const headers = buildHeaders(tenantId, idemKey);

  // Simular lote de 50 destinatários por disparo para validar escrita em batch + fila
  const recipients = [];
  for (let i = 0; i < 50; i += 1) {
    recipients.push({
      destinatario_id: `estudante_${tenantId}_${(__VU * 100) + i}`,
      destinatario_role: 'estudante',
      titulo: 'Aviso Académico em Massa',
      mensagem: 'Calendário de avaliações actualizado no portal.',
    });
  }

  const bulkPayload = JSON.stringify({
    action: 'broadcast_recipients',
    idempotencyKey: idemKey,
    titulo: 'Comunicado Geral do Semestre',
    mensagem: 'Verifique a pauta e os horários actualizados.',
    tipo: 'info',
    modulo: 'academico',
    recipients,
  });

  const bulkRes = http.post(`${BASE_URL}/api/notifications/bulk`, bulkPayload, {
    headers,
    tags: { kind: 'write', critical: AUTH_TOKEN ? 'yes' : 'no', scenario: 'notificacoes_em_massa' },
  });
  const jobId = assertAsyncAccepted(bulkRes, 'notificacoes-bulk');

  if (AUTH_TOKEN && jobId) {
    const verifyRes = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
      headers,
      tags: { kind: 'read', critical: 'yes', scenario: 'notificacoes_verify' },
    });
    mainReadDuration.add(verifyRes.timings.duration);
    if (verifyRes.status >= 500 || verifyRes.status === 404) {
      dataLossCounter.add(1);
    }
  }

  sleep(0.3);
}
