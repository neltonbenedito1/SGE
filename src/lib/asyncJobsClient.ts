/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cliente de Filas Assíncronas e Acompanhamento via SSE Push + Fallback Resiliente (SGE — Fases 4 & 6)
 * - Dispara pedidos não-bloqueantes (HTTP 202) para o backend
 * - Recebe atualizações instantâneas via Server-Sent Events (`/api/jobs/:id/stream`)
 * - Só usa polling com backoff em fallback caso o stream SSE seja interrompido em rede móvel instável
 * - Mantém estrito isolamento por tenant_id
 */

import { useSyncExternalStore } from 'react';
import { auth } from './firebase';
import { fetchWithRetry } from './resilientFetch';

export type ClientJobStatus =
  | 'pendente'
  | 'em_processamento'
  | 'concluido'
  | 'falhado_reintento'
  | 'dead_letter';

export type ClientJobType =
  | 'bulk_notification'
  | 'email_send'
  | 'report_generate'
  | 'pdf_generate'
  | 'ai_task'
  | 'stripe_webhook';

export interface ClientAsyncJob {
  id: string;
  tenant_id: string;
  type: ClientJobType;
  title: string;
  status: ClientJobStatus;
  progress: number;
  progress_message: string;
  attempts?: number;
  max_attempts?: number;
  last_error?: string | null;
  result?: any;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  localFallback?: boolean;
  onDownloadReady?: () => void;
}

const jobsMap = new Map<string, ClientAsyncJob>();
const listeners = new Set<() => void>();
const jobWatchers = new Map<string, () => void>();
let cachedSnapshot: ClientAsyncJob[] = [];

function emitStoreChange(): void {
  cachedSnapshot = Array.from(jobsMap.values()).sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || '')
  );
  listeners.forEach((fn) => fn());
}

export function isTerminalJobStatus(status: ClientJobStatus): boolean {
  return status === 'concluido' || status === 'dead_letter';
}

export function getStatusLabelPt(status: ClientJobStatus): string {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'em_processamento':
      return 'Em processamento';
    case 'falhado_reintento':
      return 'A aguardar nova tentativa';
    case 'concluido':
      return 'Concluído';
    case 'dead_letter':
      return 'Falha definitiva (DLQ)';
    default:
      return status;
  }
}

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Segue com cookies de sessão HttpOnly caso disponíveis
  }
  return headers;
}

export function upsertTrackedJob(job: ClientAsyncJob): void {
  const existing = jobsMap.get(job.id);
  jobsMap.set(job.id, {
    ...existing,
    ...job,
    onDownloadReady: job.onDownloadReady || existing?.onDownloadReady,
  });
  emitStoreChange();
}

export function dismissTrackedJob(jobId: string): void {
  const stop = jobWatchers.get(jobId);
  if (stop) {
    stop();
    jobWatchers.delete(jobId);
  }
  if (jobsMap.delete(jobId)) {
    emitStoreChange();
  }
}

export function clearCompletedJobs(tenantId?: string): void {
  let changed = false;
  for (const [id, job] of jobsMap.entries()) {
    if (isTerminalJobStatus(job.status) && (!tenantId || job.tenant_id === tenantId)) {
      const stop = jobWatchers.get(id);
      if (stop) {
        stop();
        jobWatchers.delete(id);
      }
      jobsMap.delete(id);
      changed = true;
    }
  }
  if (changed) emitStoreChange();
}

export async function fetchJobStatus(jobId: string): Promise<ClientAsyncJob | null> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetchWithRetry(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers,
      credentials: 'include',
      maxRetries: 1,
      timeoutMs: 8000,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.job) {
      upsertTrackedJob(data.job);
      return data.job as ClientAsyncJob;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Monitoriza o estado de uma tarefa em tempo real via Server-Sent Events (SSE) push.
 * Recorre a backoff lento apenas como fallback se o stream SSE não puder ser mantido.
 */
export function watchAsyncJob(
  initialJob: ClientAsyncJob,
  onUpdate?: (job: ClientAsyncJob) => void
): () => void {
  upsertTrackedJob(initialJob);
  if (initialJob.localFallback || isTerminalJobStatus(initialJob.status)) {
    onUpdate?.(initialJob);
    return () => {};
  }

  // Cancela qualquer watcher anterior para o mesmo job
  const previousStop = jobWatchers.get(initialJob.id);
  if (previousStop) {
    previousStop();
    jobWatchers.delete(initialJob.id);
  }

  let cancelled = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let streamController: AbortController | null = null;
  let reachedTerminal = false;

  const stopAll = () => {
    cancelled = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
    jobWatchers.delete(initialJob.id);
  };

  jobWatchers.set(initialJob.id, stopAll);

  const handleIncomingJob = (job: ClientAsyncJob) => {
    if (cancelled) return;
    upsertTrackedJob(job);
    onUpdate?.(job);
    if (isTerminalJobStatus(job.status)) {
      reachedTerminal = true;
      stopAll();
    }
  };

  const startFallbackBackoff = () => {
    let attempts = 0;
    const scheduleNext = (delayMs: number) => {
      if (cancelled || reachedTerminal) return;
      fallbackTimer = setTimeout(async () => {
        if (cancelled || reachedTerminal) return;
        if (typeof document !== 'undefined' && document.hidden) {
          scheduleNext(5000);
          return;
        }
        attempts++;
        const updated = await fetchJobStatus(initialJob.id);
        if (updated) {
          handleIncomingJob(updated);
          if (isTerminalJobStatus(updated.status)) return;
        }
        if (attempts < 20 && !cancelled && !reachedTerminal) {
          const nextDelay = attempts < 4 ? 1800 : attempts < 10 ? 3500 : 6000;
          scheduleNext(nextDelay);
        } else {
          stopAll();
        }
      }, delayMs);
    };
    scheduleNext(1000);
  };

  const connectSseStream = async () => {
    try {
      const headers = await buildAuthHeaders();
      headers['Accept'] = 'text/event-stream';
      streamController = new AbortController();

      const res = await fetch(`/api/jobs/${encodeURIComponent(initialJob.id)}/stream`, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: streamController.signal,
      });

      if (!res.ok || !res.body) {
        if (!cancelled && !reachedTerminal) startFallbackBackoff();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled && !reachedTerminal) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          const lines = rawEvent.split('\n');
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length > 0) {
            try {
              const parsed = JSON.parse(dataLines.join('\n'));
              if (parsed?.job) {
                handleIncomingJob(parsed.job as ClientAsyncJob);
              }
            } catch {
              // Ignora heartbeat ou payload parcial
            }
          }
        }
      }

      if (!cancelled && !reachedTerminal) {
        startFallbackBackoff();
      }
    } catch {
      if (!cancelled && !reachedTerminal) {
        startFallbackBackoff();
      }
    }
  };

  void connectSseStream();

  return stopAll;
}

export async function waitForAsyncJob(
  initialJob: ClientAsyncJob,
  options?: { onUpdate?: (job: ClientAsyncJob) => void; timeoutMs?: number }
): Promise<ClientAsyncJob> {
  if (isTerminalJobStatus(initialJob.status)) {
    upsertTrackedJob(initialJob);
    options?.onUpdate?.(initialJob);
    return initialJob;
  }

  const timeoutMs = options?.timeoutMs ?? 35_000;
  return new Promise<ClientAsyncJob>((resolve, reject) => {
    let settled = false;
    const stopTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        unwatch();
        reject(new Error('Tempo limite excedido ao aguardar processamento da tarefa.'));
      }
    }, timeoutMs);

    const unwatch = watchAsyncJob(initialJob, (latest) => {
      options?.onUpdate?.(latest);
      if (!settled && isTerminalJobStatus(latest.status)) {
        settled = true;
        clearTimeout(stopTimer);
        unwatch();
        if (latest.status === 'dead_letter') {
          reject(new Error(latest.last_error || 'Falha no processamento da tarefa.'));
        } else {
          resolve(latest);
        }
      }
    });
  });
}

export async function retryFailedJob(jobId: string): Promise<ClientAsyncJob | null> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetchWithRetry(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      headers,
      credentials: 'include',
      maxRetries: 1,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.job) {
      watchAsyncJob(data.job);
      return data.job as ClientAsyncJob;
    }
    return null;
  } catch {
    return null;
  }
}

export async function enqueuePendingLessonNotification(payload: {
  tenantId: string;
  planoAulaId: string;
  docenteId: string;
  targetUserId: string;
  teacherName: string;
  teacherEmail?: string;
  disciplinaId: string;
  disciplinaNome: string;
  topico: string;
  periodoLabel: string;
  dataPrevista?: string;
  createdByName?: string;
}): Promise<{ queuedViaApi: boolean; job?: ClientAsyncJob }> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetchWithRetry('/api/notifications/bulk', {
      method: 'POST',
      headers,
      credentials: 'include',
      maxRetries: 2,
      body: JSON.stringify({
        action: 'notificar_aula_pendente',
        idempotencyKey: `notify_pending_lesson:${payload.tenantId}:${payload.planoAulaId}`,
        planoAulaId: payload.planoAulaId,
        docenteId: payload.docenteId,
        targetUserId: payload.targetUserId,
        teacherName: payload.teacherName,
        teacherEmail: payload.teacherEmail || '',
        disciplinaId: payload.disciplinaId,
        disciplinaNome: payload.disciplinaNome,
        topico: payload.topico,
        periodoLabel: payload.periodoLabel,
        dataPrevista: payload.dataPrevista || '',
      }),
    });

    if (res.status === 202 || res.ok) {
      const data = await res.json();
      const job: ClientAsyncJob = {
        id: data.jobId,
        tenant_id: payload.tenantId,
        type: 'bulk_notification',
        title: `Notificar Aula Pendente: ${payload.topico}`,
        status: data.status || 'pendente',
        progress: data.progress ?? 10,
        progress_message: 'Notificação em fila para envio...',
        created_at: new Date().toISOString(),
      };
      watchAsyncJob(job);
      return { queuedViaApi: true, job };
    }
  } catch {
    // fallback será acionado no módulo chamador
  }
  return { queuedViaApi: false };
}

export async function enqueuePdfExportJob(payload: {
  tenantId: string;
  reportType: 'bi_consolidado' | 'relatorio_mensal';
  reportId?: string;
  title: string;
  actorName?: string;
  metadata?: Record<string, any>;
  onDownloadReady?: () => void;
}): Promise<{ queuedViaApi: boolean; job?: ClientAsyncJob }> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetchWithRetry('/api/reports/export-pdf', {
      method: 'POST',
      headers,
      credentials: 'include',
      maxRetries: 2,
      body: JSON.stringify({
        reportType: payload.reportType,
        reportId: payload.reportId,
        title: payload.title,
        metadata: payload.metadata,
      }),
    });

    if (res.status === 202 || res.ok) {
      const data = await res.json();
      const job: ClientAsyncJob = {
        id: data.jobId,
        tenant_id: payload.tenantId,
        type: 'pdf_generate',
        title: `PDF: ${payload.title}`,
        status: data.status || 'pendente',
        progress: data.progress ?? 15,
        progress_message: 'A preparar exportação PDF...',
        created_at: new Date().toISOString(),
        onDownloadReady: payload.onDownloadReady,
      };
      watchAsyncJob(job);
      return { queuedViaApi: true, job };
    }
  } catch {
    // Fallback local
  }
  return { queuedViaApi: false };
}

export async function enqueueMonthlyReportJob(payload: {
  tenantId: string;
  monthName: string;
  year: number;
  kpis: {
    total_alunos: number;
    media_geral: number;
    taxa_aprovacao: number;
    taxa_assiduidade: number;
  };
  resumoTexto: string;
  authorName?: string;
}): Promise<{ queuedViaApi: boolean; job?: ClientAsyncJob }> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetchWithRetry('/api/reports/generate', {
      method: 'POST',
      headers,
      credentials: 'include',
      maxRetries: 2,
      body: JSON.stringify({
        scope: 'monthly_report',
        tenantId: payload.tenantId,
        monthName: payload.monthName,
        year: payload.year,
        kpis: payload.kpis,
        resumoTexto: payload.resumoTexto,
      }),
    });

    if (res.status === 202 || res.ok) {
      const data = await res.json();
      const job: ClientAsyncJob = {
        id: data.jobId,
        tenant_id: payload.tenantId,
        type: 'report_generate',
        title: `Relatório Mensal (${payload.monthName} ${payload.year})`,
        status: data.status || 'pendente',
        progress: data.progress ?? 15,
        progress_message: 'A consolidar relatório em segundo plano...',
        created_at: new Date().toISOString(),
      };
      watchAsyncJob(job);
      return { queuedViaApi: true, job };
    }
  } catch {
    // Fallback local
  }
  return { queuedViaApi: false };
}

export function useAsyncJobs(tenantId?: string): ClientAsyncJob[] {
  const allJobs = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => cachedSnapshot
  );

  if (!tenantId) return allJobs;
  return allJobs.filter((j) => j.tenant_id === tenantId || j.tenant_id === 'global');
}
