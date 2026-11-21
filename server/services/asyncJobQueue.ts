/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Fila Assíncrona Persistente (SGE — Fase 4)
 * - Persistência em Firestore (`async_jobs` + `async_jobs_dlq`)
 * - Idempotência determinística por chave (`idempotency_key`)
 * - Concorrência limitada com lease distribuído (`locked_until`)
 * - Reintentos automáticos com backoff exponencial + jitter
 * - Dead-Letter Queue (`async_jobs_dlq`) após exceder `max_attempts`
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { getFirestoreInstance } from '../middleware/auth';
import { logSecurityEvent } from '../security/logger';
import { recordJobExecutionMetric, QueueMetricsInput } from './observability';

export const asyncJobEvents = new EventEmitter();
asyncJobEvents.setMaxListeners(500);

function emitJobEvent(job: AsyncJobRecord | undefined): void {
  if (!job) return;
  try {
    asyncJobEvents.emit('job:update', job);
    asyncJobEvents.emit(`job:${job.id}`, job);
    asyncJobEvents.emit(`tenant:${job.tenant_id}`, job);
  } catch {
    // Nunca interrompe o worker por falha de listener
  }
}

export type AsyncJobType =
  | 'bulk_notification'
  | 'email_send'
  | 'report_generate'
  | 'pdf_generate'
  | 'ai_task'
  | 'stripe_webhook';

export type AsyncJobStatus =
  | 'pendente'
  | 'em_processamento'
  | 'concluido'
  | 'falhado_reintento'
  | 'dead_letter';

export interface AsyncJobRecord<TPayload = Record<string, any>, TResult = any> {
  id: string;
  tenant_id: string;
  type: AsyncJobType;
  title: string;
  status: AsyncJobStatus;
  progress: number;
  progress_message: string;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  next_run_at: number;
  locked_until: number;
  worker_id?: string | null;
  payload: TPayload;
  result?: TResult | null;
  last_error?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  dead_lettered_at?: string | null;
}

export interface JobExecutionContext {
  job: AsyncJobRecord;
  signal: AbortSignal;
  updateProgress: (progress: number, message: string) => Promise<void>;
}

export type AsyncJobHandler = (ctx: JobExecutionContext) => Promise<any>;

const JOBS_COLLECTION = 'async_jobs';
const DLQ_COLLECTION = 'async_jobs_dlq';
const WORKER_ID = `worker_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
const MAX_CONCURRENT_JOBS = 4;
const DEFAULT_MAX_ATTEMPTS = 5;
const LEASE_DURATION_MS = 90_000;
const BASE_BACKOFF_MS = 4_000;
const MAX_BACKOFF_MS = 300_000;
const JOB_TIMEOUT_MS: Record<AsyncJobType, number> = {
  email_send: 15_000,
  bulk_notification: 45_000,
  report_generate: 45_000,
  pdf_generate: 35_000,
  ai_task: 25_000,
  stripe_webhook: 35_000,
};

const jobHandlers = new Map<AsyncJobType, AsyncJobHandler>();
const activeJobIds = new Set<string>();
// Cache/fallback L1 apenas para resiliência se Firestore estiver inacessível
const l1JobsCache = new Map<string, AsyncJobRecord>();

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isDraining = false;
let isTickRunning = false;
let pendingWakeup = false;

export function registerJobHandler(type: AsyncJobType, handler: AsyncJobHandler): void {
  jobHandlers.set(type, handler);
}

export function deriveDeterministicJobId(
  tenantId: string,
  type: AsyncJobType,
  idempotencyKey?: string
): { docId: string; normalizedKey: string } {
  if (idempotencyKey && idempotencyKey.trim().length > 0) {
    const cleanKey = idempotencyKey.trim().slice(0, 180);
    const digest = crypto
      .createHash('sha256')
      .update(`${tenantId}::${type}::${cleanKey}`)
      .digest('hex')
      .slice(0, 28);
    return {
      docId: `job_${digest}`,
      normalizedKey: cleanKey,
    };
  }
  const randomKey = `${type}_${Date.now()}_${crypto.randomUUID()}`;
  return {
    docId: `job_${crypto.randomBytes(12).toString('hex')}`,
    normalizedKey: randomKey,
  };
}

function defaultTitleForType(type: AsyncJobType): string {
  switch (type) {
    case 'bulk_notification':
      return 'Envio de notificações em massa';
    case 'email_send':
      return 'Envio assíncrono de e-mail';
    case 'report_generate':
      return 'Consolidação de relatório';
    case 'pdf_generate':
      return 'Preparação de documento PDF';
    case 'ai_task':
      return 'Processamento com Inteligência Artificial';
    case 'stripe_webhook':
      return 'Processamento de evento de pagamento';
    default:
      return 'Tarefa em segundo plano';
  }
}

export function computeExponentialBackoffMs(attempts: number): number {
  const safeAttempts = Math.max(1, attempts);
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, safeAttempts - 1));
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

export async function enqueueJob<TPayload = Record<string, any>>(params: {
  tenantId: string;
  type: AsyncJobType;
  payload: TPayload;
  title?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
  createdBy?: string;
}): Promise<{ job: AsyncJobRecord<TPayload>; idempotent: boolean }> {
  const db = getFirestoreInstance();
  const tenantId = params.tenantId || 'global';
  const { docId, normalizedKey } = deriveDeterministicJobId(tenantId, params.type, params.idempotencyKey);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const candidateJob: AsyncJobRecord<TPayload> = {
    id: docId,
    tenant_id: tenantId,
    type: params.type,
    title: params.title?.trim() || defaultTitleForType(params.type),
    status: 'pendente',
    progress: 0,
    progress_message: 'Na fila para processamento.',
    idempotency_key: normalizedKey,
    attempts: 0,
    max_attempts: Math.min(Math.max(1, params.maxAttempts || DEFAULT_MAX_ATTEMPTS), 10),
    next_run_at: nowMs,
    locked_until: 0,
    worker_id: null,
    payload: params.payload,
    result: null,
    last_error: null,
    created_by: params.createdBy || 'system',
    created_at: nowIso,
    updated_at: nowIso,
    started_at: null,
    completed_at: null,
    dead_lettered_at: null,
  };

  try {
    const jobRef = db.collection(JOBS_COLLECTION).doc(docId);
    const txResult = await db.runTransaction(async (tx: any) => {
      const existing = await tx.get(jobRef);
      if (existing.exists) {
        const data = existing.data() as AsyncJobRecord<TPayload>;
        // Se já estiver pendente, em processamento ou concluído, devolve de forma idempotente
        if (data.status !== 'dead_letter') {
          return { job: { ...data, id: existing.id }, idempotent: true };
        }
      }
      tx.set(jobRef, candidateJob);
      return { job: candidateJob, idempotent: false };
    });

    l1JobsCache.set(docId, txResult.job);
    emitJobEvent(txResult.job);
    if (!txResult.idempotent) {
      wakeUpAsyncWorker();
    }
    return txResult;
  } catch (err: any) {
    // Fallback não bloqueante caso transação Firestore falhe temporariamente
    const existingL1 = l1JobsCache.get(docId);
    if (existingL1 && existingL1.status !== 'dead_letter') {
      return { job: existingL1 as AsyncJobRecord<TPayload>, idempotent: true };
    }
    try {
      await db.collection(JOBS_COLLECTION).doc(docId).set(candidateJob, { merge: false });
    } catch {
      // L1 segura o job e executa em memória se Firestore estiver sem ligação
    }
    l1JobsCache.set(docId, candidateJob);
    logSecurityEvent('WARN', 'async_job_enqueue_fallback', {
      jobId: docId,
      type: params.type,
      tenantId,
      error: err?.message,
    });
    wakeUpAsyncWorker();
    return { job: candidateJob, idempotent: false };
  }
}

export async function getJobById(
  jobId: string,
  callerTenantId: string,
  isSuperAdmin: boolean
): Promise<AsyncJobRecord | null> {
  if (!jobId) return null;
  const cached = l1JobsCache.get(jobId);

  try {
    const db = getFirestoreInstance();
    const snap = await db.collection(JOBS_COLLECTION).doc(jobId).get();
    if (snap.exists) {
      const job = { ...(snap.data() as AsyncJobRecord), id: snap.id };
      if (!isSuperAdmin && job.tenant_id !== callerTenantId) {
        return null;
      }
      l1JobsCache.set(jobId, job);
      return job;
    }
  } catch {
    // fallback L1
  }

  if (cached && (isSuperAdmin || cached.tenant_id === callerTenantId)) {
    return cached;
  }
  return null;
}

export async function listTenantJobs(
  tenantId: string,
  limitCount = 25
): Promise<{ jobs: AsyncJobRecord[]; dlqCount: number }> {
  const safeLimit = Math.min(Math.max(1, limitCount), 50);
  try {
    const db = getFirestoreInstance();
    let jobsSnap: any;
    try {
      jobsSnap = await db
        .collection(JOBS_COLLECTION)
        .where('tenant_id', '==', tenantId)
        .orderBy('created_at', 'desc')
        .limit(safeLimit)
        .get();
    } catch {
      jobsSnap = await db
        .collection(JOBS_COLLECTION)
        .where('tenant_id', '==', tenantId)
        .limit(safeLimit)
        .get();
    }

    const jobs: AsyncJobRecord[] = jobsSnap.docs
      .map((d: any) => ({ ...(d.data() as AsyncJobRecord), id: d.id }))
      .sort((a: AsyncJobRecord, b: AsyncJobRecord) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );

    let dlqCount = jobs.filter((j) => j.status === 'dead_letter').length;
    try {
      const dlqAgg = await db
        .collection(DLQ_COLLECTION)
        .where('tenant_id', '==', tenantId)
        .count();
      dlqCount = dlqAgg.data().count;
    } catch {
      // ignore if count index missing
    }

    return { jobs, dlqCount };
  } catch {
    const localJobs = Array.from(l1JobsCache.values())
      .filter((j) => j.tenant_id === tenantId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, safeLimit);
    return {
      jobs: localJobs,
      dlqCount: localJobs.filter((j) => j.status === 'dead_letter').length,
    };
  }
}

export async function retryDeadLetterJob(
  jobId: string,
  callerTenantId: string,
  isSuperAdmin: boolean
): Promise<AsyncJobRecord | null> {
  const db = getFirestoreInstance();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const snap = await jobRef.get();
  if (!snap.exists) {
    const cached = l1JobsCache.get(jobId);
    if (!cached) return null;
    if (!isSuperAdmin && cached.tenant_id !== callerTenantId) return null;
    const resetJob: AsyncJobRecord = {
      ...cached,
      status: 'pendente',
      attempts: 0,
      progress: 0,
      progress_message: 'Reenfileirado manualmente para processamento.',
      next_run_at: nowMs,
      locked_until: 0,
      last_error: null,
      dead_lettered_at: null,
      updated_at: nowIso,
    };
    l1JobsCache.set(jobId, resetJob);
    wakeUpAsyncWorker();
    return resetJob;
  }

  const data = snap.data() as AsyncJobRecord;
  if (!isSuperAdmin && data.tenant_id !== callerTenantId) {
    return null;
  }

  const updates = {
    status: 'pendente' as AsyncJobStatus,
    attempts: 0,
    progress: 0,
    progress_message: 'Reenfileirado manualmente a partir da Dead-Letter Queue.',
    next_run_at: nowMs,
    locked_until: 0,
    worker_id: null,
    last_error: null,
    dead_lettered_at: null,
    updated_at: nowIso,
  };

  await jobRef.update(updates);
  await db.collection(DLQ_COLLECTION).doc(jobId).delete().catch(() => {});

  const updatedJob: AsyncJobRecord = { ...data, ...updates, id: jobId };
  l1JobsCache.set(jobId, updatedJob);
  emitJobEvent(updatedJob);
  wakeUpAsyncWorker();
  return updatedJob;
}

async function updateJobDocument(jobId: string, patch: Partial<AsyncJobRecord>): Promise<void> {
  const updatedAt = new Date().toISOString();
  const existing = l1JobsCache.get(jobId);
  if (existing) {
    const merged = { ...existing, ...patch, updated_at: updatedAt };
    l1JobsCache.set(jobId, merged);
    emitJobEvent(merged);
  }
  try {
    const db = getFirestoreInstance();
    await db
      .collection(JOBS_COLLECTION)
      .doc(jobId)
      .set({ ...patch, updated_at: updatedAt }, { merge: true });
  } catch {
    // Mantém L1 consistente caso escrita intermitente falhe
  }
}

async function moveToDeadLetterQueue(job: AsyncJobRecord, error: Error): Promise<void> {
  const nowIso = new Date().toISOString();
  const lastError = (error?.message || String(error) || 'Erro desconhecido').slice(0, 1000);

  const dlqEntry = {
    job_id: job.id,
    tenant_id: job.tenant_id,
    type: job.type,
    title: job.title,
    idempotency_key: job.idempotency_key,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    payload: job.payload,
    last_error: lastError,
    stack_trace: (error?.stack || '').slice(0, 2000),
    created_by: job.created_by,
    created_at: job.created_at,
    failed_at: nowIso,
  };

  try {
    const db = getFirestoreInstance();
    await db.collection(DLQ_COLLECTION).doc(job.id).set(dlqEntry);
  } catch (dlqErr: any) {
    logSecurityEvent('ERROR', 'async_job_dlq_write_failed', {
      jobId: job.id,
      error: dlqErr?.message,
    });
  }

  await updateJobDocument(job.id, {
    status: 'dead_letter',
    progress: 100,
    progress_message: `Falhou após ${job.attempts} tentativa(s) e foi movido para Dead-Letter Queue.`,
    last_error: lastError,
    locked_until: 0,
    worker_id: null,
    dead_lettered_at: nowIso,
  });

  logSecurityEvent('ERROR', 'async_job_dead_lettered', {
    jobId: job.id,
    tenantId: job.tenant_id,
    type: job.type,
    attempts: job.attempts,
    error: lastError,
  });
}

async function tryClaimJob(candidate: AsyncJobRecord): Promise<AsyncJobRecord | null> {
  if (activeJobIds.has(candidate.id)) return null;
  const nowMs = Date.now();
  if ((candidate.next_run_at || 0) > nowMs) return null;
  if ((candidate.locked_until || 0) > nowMs) return null;

  const db = getFirestoreInstance();
  const jobRef = db.collection(JOBS_COLLECTION).doc(candidate.id);
  const nowIso = new Date(nowMs).toISOString();
  const nextAttempt = (candidate.attempts || 0) + 1;

  try {
    const claimed = await db.runTransaction(async (tx: any) => {
      const freshSnap = await tx.get(jobRef);
      if (!freshSnap.exists) return null;
      const fresh = freshSnap.data() as AsyncJobRecord;
      const tNow = Date.now();
      if (fresh.status !== 'pendente' && fresh.status !== 'falhado_reintento') return null;
      if ((fresh.next_run_at || 0) > tNow) return null;
      if ((fresh.locked_until || 0) > tNow) return null;

      const updated: AsyncJobRecord = {
        ...fresh,
        id: freshSnap.id,
        status: 'em_processamento',
        attempts: (fresh.attempts || 0) + 1,
        locked_until: tNow + LEASE_DURATION_MS,
        worker_id: WORKER_ID,
        progress: Math.max(fresh.progress || 0, 10),
        progress_message: 'Em processamento pelo worker...',
        started_at: fresh.started_at || nowIso,
        updated_at: nowIso,
      };
      tx.set(jobRef, updated, { merge: true });
      return updated;
    });

    if (claimed) {
      l1JobsCache.set(claimed.id, claimed);
      emitJobEvent(claimed);
    }
    return claimed;
  } catch {
    // Fallback em processo único se transação não disponível
    const updated: AsyncJobRecord = {
      ...candidate,
      status: 'em_processamento',
      attempts: nextAttempt,
      locked_until: nowMs + LEASE_DURATION_MS,
      worker_id: WORKER_ID,
      progress: Math.max(candidate.progress || 0, 10),
      progress_message: 'Em processamento pelo worker...',
      started_at: candidate.started_at || nowIso,
      updated_at: nowIso,
    };
    l1JobsCache.set(updated.id, updated);
    return updated;
  }
}

async function executeClaimedJob(job: AsyncJobRecord): Promise<void> {
  activeJobIds.add(job.id);
  const handler = jobHandlers.get(job.type);

  if (!handler) {
    await moveToDeadLetterQueue(job, new Error(`Nenhum handler registado para tarefa do tipo "${job.type}".`));
    activeJobIds.delete(job.id);
    return;
  }

  const timeoutMs = JOB_TIMEOUT_MS[job.type] || 30_000;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort(new Error(`Timeout de ${timeoutMs}ms atingido no processamento da tarefa.`));
  }, timeoutMs);

  let lastProgressWrite = 0;
  const updateProgress = async (progress: number, message: string) => {
    const now = Date.now();
    const clamped = Math.min(99, Math.max(10, Math.round(progress)));
    // Evita escritas excessivas em progresso rápido, salvo mudanças significativas
    if (now - lastProgressWrite < 250 && clamped < 95) {
      const cached = l1JobsCache.get(job.id);
      if (cached) {
        l1JobsCache.set(job.id, { ...cached, progress: clamped, progress_message: message });
      }
      return;
    }
    lastProgressWrite = now;
    await updateJobDocument(job.id, {
      status: 'em_processamento',
      progress: clamped,
      progress_message: message,
      locked_until: Date.now() + LEASE_DURATION_MS,
    });
  };

  const jobStartHr = process.hrtime.bigint();
  try {
    const result = await Promise.race([
      handler({ job, signal: controller.signal, updateProgress }),
      new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(controller.signal.reason || new Error('Execução cancelada por timeout.')),
          { once: true }
        );
      }),
    ]);

    clearTimeout(timeoutTimer);
    const durationMs = Number(process.hrtime.bigint() - jobStartHr) / 1_000_000;
    recordJobExecutionMetric({
      tenantId: job.tenant_id,
      jobType: job.type,
      durationMs,
      outcome: 'concluido',
    });

    const completedIso = new Date().toISOString();
    await updateJobDocument(job.id, {
      status: 'concluido',
      progress: 100,
      progress_message: 'Tarefa concluída com sucesso.',
      result: result ?? { success: true },
      last_error: null,
      locked_until: 0,
      worker_id: null,
      completed_at: completedIso,
    });
  } catch (err: any) {
    clearTimeout(timeoutTimer);
    const durationMs = Number(process.hrtime.bigint() - jobStartHr) / 1_000_000;
    const errObj = err instanceof Error ? err : new Error(String(err));
    const maxAttempts = job.max_attempts || DEFAULT_MAX_ATTEMPTS;

    if (job.attempts >= maxAttempts) {
      recordJobExecutionMetric({
        tenantId: job.tenant_id,
        jobType: job.type,
        durationMs,
        outcome: 'dead_letter',
      });
      await moveToDeadLetterQueue(job, errObj);
    } else {
      recordJobExecutionMetric({
        tenantId: job.tenant_id,
        jobType: job.type,
        durationMs,
        outcome: 'falhado_reintento',
      });
      const backoffMs = computeExponentialBackoffMs(job.attempts);
      const nextRunMs = Date.now() + backoffMs;
      await updateJobDocument(job.id, {
        status: 'falhado_reintento',
        progress: Math.max(5, Math.min(80, job.progress || 10)),
        progress_message: `Falha transitória (${job.attempts}/${maxAttempts}). Nova tentativa em ${Math.round(backoffMs / 1000)}s.`,
        last_error: errObj.message.slice(0, 1000),
        next_run_at: nextRunMs,
        locked_until: 0,
        worker_id: null,
      });

      logSecurityEvent('WARN', 'async_job_retry_scheduled', {
        jobId: job.id,
        tenantId: job.tenant_id,
        type: job.type,
        attempt: job.attempts,
        maxAttempts,
        nextRetryInMs: backoffMs,
        error: errObj.message,
      });
    }
  } finally {
    activeJobIds.delete(job.id);
  }
}

async function fetchDueCandidates(maxSlots: number): Promise<AsyncJobRecord[]> {
  if (maxSlots <= 0) return [];
  const nowMs = Date.now();
  const candidatesMap = new Map<string, AsyncJobRecord>();

  // 1. Verificar L1 primeiro (jobs recém-enfileirados neste nó)
  for (const job of l1JobsCache.values()) {
    if (
      (job.status === 'pendente' || job.status === 'falhado_reintento') &&
      (job.next_run_at || 0) <= nowMs &&
      (job.locked_until || 0) <= nowMs &&
      !activeJobIds.has(job.id)
    ) {
      candidatesMap.set(job.id, job);
    }
  }

  // 2. Consultar Firestore por jobs pendentes ou para retry em fila distribuída
  try {
    const db = getFirestoreInstance();
    const statuses: AsyncJobStatus[] = ['pendente', 'falhado_reintento'];
    for (const status of statuses) {
      let snap: any;
      try {
        snap = await db
          .collection(JOBS_COLLECTION)
          .where('status', '==', status)
          .where('next_run_at', '<=', nowMs)
          .limit(maxSlots * 2)
          .get();
      } catch {
        // Fallback caso o índice composto ainda esteja a propagar
        snap = await db
          .collection(JOBS_COLLECTION)
          .where('status', '==', status)
          .limit(maxSlots * 2)
          .get();
      }

      for (const d of snap.docs) {
        const data = { ...(d.data() as AsyncJobRecord), id: d.id };
        if ((data.next_run_at || 0) <= nowMs && (data.locked_until || 0) <= nowMs && !activeJobIds.has(d.id)) {
          candidatesMap.set(d.id, data);
        }
      }
    }
  } catch {
    // Usa candidatos já recolhidos do L1
  }

  return Array.from(candidatesMap.values())
    .sort((a, b) => (a.next_run_at || 0) - (b.next_run_at || 0))
    .slice(0, maxSlots);
}

async function processWorkerTick(): Promise<void> {
  if (isDraining) return;
  if (isTickRunning) {
    pendingWakeup = true;
    return;
  }

  isTickRunning = true;
  try {
    const availableSlots = MAX_CONCURRENT_JOBS - activeJobIds.size;
    if (availableSlots <= 0) return;

    const candidates = await fetchDueCandidates(availableSlots);
    if (candidates.length === 0) return;

    const tasks: Promise<void>[] = [];
    for (const candidate of candidates) {
      if (isDraining || activeJobIds.size >= MAX_CONCURRENT_JOBS) break;
      const claimed = await tryClaimJob(candidate);
      if (claimed) {
        tasks.push(executeClaimedJob(claimed));
      }
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  } finally {
    isTickRunning = false;
    if (pendingWakeup && !isDraining) {
      pendingWakeup = false;
      setImmediate(() => {
        void processWorkerTick();
      });
    }
  }
}

export function wakeUpAsyncWorker(): void {
  if (isDraining) return;
  setImmediate(() => {
    void processWorkerTick();
  });
}

export function startAsyncWorkerLoop(pollIntervalMs = 4000): void {
  if (workerTimer) return;
  isDraining = false;

  // Pequena limpeza inicial do cache L1 para evitar crescimento infinito
  workerTimer = setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, job] of l1JobsCache.entries()) {
      if (
        (job.status === 'concluido' || job.status === 'dead_letter') &&
        new Date(job.updated_at).getTime() < cutoff
      ) {
        l1JobsCache.delete(id);
      }
    }
    void processWorkerTick();
  }, pollIntervalMs);

  // Trigger inicial rápido após arranque
  setTimeout(() => {
    void processWorkerTick();
  }, 600);

  console.log(`[AsyncWorker] Loop assíncrono iniciado (worker=${WORKER_ID}, poll=${pollIntervalMs}ms, concorrência=${MAX_CONCURRENT_JOBS}).`);
}

export function getAsyncWorkerStats() {
  return {
    workerId: WORKER_ID,
    running: workerTimer !== null && !isDraining,
    draining: isDraining,
    activeJobs: activeJobIds.size,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
    registeredHandlers: Array.from(jobHandlers.keys()),
  };
}

let cachedQueueMetrics: { snapshot: QueueMetricsInput; cachedAt: number } | null = null;

export async function getQueueMetricsSnapshot(): Promise<QueueMetricsInput> {
  const now = Date.now();
  if (cachedQueueMetrics && now - cachedQueueMetrics.cachedAt < 10_000) {
    return {
      ...cachedQueueMetrics.snapshot,
      workerActiveJobs: activeJobIds.size,
      workerMaxConcurrent: MAX_CONCURRENT_JOBS,
    };
  }

  let pendente = 0;
  let emProcessamento = 0;
  let falhadoReintento = 0;
  let deadLetterCount = 0;
  const perTenant: Record<
    string,
    { pendente: number; emProcessamento: number; falhadoReintento: number; deadLetter: number }
  > = {};

  const ensureTenant = (tid: string) => {
    const key = tid || 'global';
    if (!perTenant[key]) {
      perTenant[key] = { pendente: 0, emProcessamento: 0, falhadoReintento: 0, deadLetter: 0 };
    }
    return perTenant[key];
  };

  try {
    const db = getFirestoreInstance();
    const activeStatuses: AsyncJobStatus[] = ['pendente', 'em_processamento', 'falhado_reintento', 'dead_letter'];
    for (const status of activeStatuses) {
      const snap = await db.collection(JOBS_COLLECTION).where('status', '==', status).limit(300).get();
      for (const d of snap.docs) {
        const data = d.data() as Partial<AsyncJobRecord>;
        const bucket = ensureTenant(data.tenant_id || 'global');
        if (status === 'pendente') {
          pendente += 1;
          bucket.pendente += 1;
        } else if (status === 'em_processamento') {
          emProcessamento += 1;
          bucket.emProcessamento += 1;
        } else if (status === 'falhado_reintento') {
          falhadoReintento += 1;
          bucket.falhadoReintento += 1;
        } else if (status === 'dead_letter') {
          deadLetterCount += 1;
          bucket.deadLetter += 1;
        }
      }
    }
  } catch {
    // Fallback para cache L1 local se Firestore não responder
    for (const job of l1JobsCache.values()) {
      const bucket = ensureTenant(job.tenant_id || 'global');
      if (job.status === 'pendente') {
        pendente += 1;
        bucket.pendente += 1;
      } else if (job.status === 'em_processamento') {
        emProcessamento += 1;
        bucket.emProcessamento += 1;
      } else if (job.status === 'falhado_reintento') {
        falhadoReintento += 1;
        bucket.falhadoReintento += 1;
      } else if (job.status === 'dead_letter') {
        deadLetterCount += 1;
        bucket.deadLetter += 1;
      }
    }
  }

  const snapshot: QueueMetricsInput = {
    totalQueued: pendente + emProcessamento + falhadoReintento,
    pendente,
    emProcessamento,
    falhadoReintento,
    deadLetterCount,
    workerActiveJobs: activeJobIds.size,
    workerMaxConcurrent: MAX_CONCURRENT_JOBS,
    perTenant,
  };
  cachedQueueMetrics = { snapshot, cachedAt: now };
  return snapshot;
}

export async function stopAsyncWorkerLoop(): Promise<void> {
  isDraining = true;
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  const deadline = Date.now() + 8000;
  while (activeJobIds.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }
}
