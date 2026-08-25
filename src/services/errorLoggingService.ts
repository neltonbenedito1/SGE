/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LogErro, ErrorSeverity, ErrorStatus, ErrorOrigem } from '../types';

const STORAGE_KEY = 'sysedu_system_error_logs';
const MAX_LOCAL_LOGS = 200;

type ErrorListener = (logs: LogErro[]) => void;
const listeners: Set<ErrorListener> = new Set();

/**
 * Reads local cached error logs
 */
export function getLocalErrorLogs(): LogErro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves local cached error logs
 */
function saveLocalErrorLogs(logs: LogErro[]): void {
  try {
    const trimmed = logs.slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    listeners.forEach(fn => fn(trimmed));
  } catch (e) {
    console.warn('[ErrorLogger] Failed to save error logs locally:', e);
  }
}

/**
 * Subscribe to error logs updates
 */
export function subscribeToErrorLogs(callback: ErrorListener): () => void {
  listeners.add(callback);
  callback(getLocalErrorLogs());
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Central logger for system errors across SuperAdmin, Tenants, API, and Global Handlers
 */
export async function logSystemError(params: {
  origem: ErrorOrigem;
  mensagem: string;
  severidade?: ErrorSeverity;
  modulo?: string;
  acao?: string;
  tenant_id?: string;
  tenant_nome?: string;
  usuario_id?: string;
  usuario_email?: string;
  usuario_nome?: string;
  usuario_tipo?: string;
  stack_trace?: string;
  detalhes?: Record<string, any>;
}): Promise<LogErro> {
  const newLog: LogErro = {
    id: 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    origem: params.origem || 'sistema',
    mensagem: params.mensagem || 'Erro desconhecido',
    severidade: params.severidade || 'erro',
    status: 'aberto',
    modulo: params.modulo || 'Geral',
    acao: params.acao || 'Execução',
    tenant_id: params.tenant_id,
    tenant_nome: params.tenant_nome,
    usuario_id: params.usuario_id,
    usuario_email: params.usuario_email,
    usuario_nome: params.usuario_nome,
    usuario_tipo: params.usuario_tipo,
    stack_trace: params.stack_trace || (new Error().stack),
    url: typeof window !== 'undefined' ? window.location.href : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    detalhes: params.detalhes || {},
    created_at: new Date().toISOString()
  };

  // 1. Immediately store in local cache so it is never lost even if network drops or offline
  const currentLogs = getLocalErrorLogs();
  const updatedLogs = [newLog, ...currentLogs.filter(l => l.id !== newLog.id)];
  saveLocalErrorLogs(updatedLogs);

  // 2. Persist to Firestore asynchronously
  try {
    const docRef = await addDoc(collection(db, 'logs_erros'), {
      ...newLog,
      persisted_at: new Date().toISOString()
    });
    newLog.id = docRef.id;
  } catch (firestoreErr) {
    console.warn('[ErrorLogger] Could not persist error log to Firestore (will remain in local storage):', firestoreErr);
  }

  return newLog;
}

/**
 * Fetches all system error logs (from Firestore or local fallback)
 */
export async function fetchSystemErrors(): Promise<LogErro[]> {
  try {
    const q = query(collection(db, 'logs_erros'), orderBy('created_at', 'desc'), limit(150));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const firestoreLogs: LogErro[] = snapshot.docs.map(docSnap => ({
        ...(docSnap.data() as LogErro),
        id: docSnap.id
      }));

      // Merge with local logs in case there were un-synced logs
      const local = getLocalErrorLogs();
      const map = new Map<string, LogErro>();
      
      firestoreLogs.forEach(l => map.set(l.id, l));
      local.forEach(l => {
        if (!map.has(l.id)) map.set(l.id, l);
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      saveLocalErrorLogs(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[ErrorLogger] Error fetching from Firestore, falling back to local logs:', err);
  }

  return getLocalErrorLogs();
}

/**
 * Updates status of an error (e.g. mark as resolved, investigating)
 */
export async function updateErrorStatus(
  id: string, 
  status: ErrorStatus, 
  resolvedBy?: string, 
  notes?: string
): Promise<void> {
  const localLogs = getLocalErrorLogs();
  const idx = localLogs.findIndex(l => l.id === id);
  if (idx !== -1) {
    localLogs[idx] = {
      ...localLogs[idx],
      status,
      resolvido_por: resolvedBy || 'Super Admin',
      resolvido_em: status === 'resolvido' ? new Date().toISOString() : localLogs[idx].resolvido_em,
      notas_resolucao: notes !== undefined ? notes : localLogs[idx].notas_resolucao
    };
    saveLocalErrorLogs(localLogs);
  }

  try {
    const docRef = doc(db, 'logs_erros', id);
    await updateDoc(docRef, {
      status,
      resolvido_por: resolvedBy || 'Super Admin',
      resolvido_em: status === 'resolvido' ? new Date().toISOString() : null,
      notas_resolucao: notes || null
    });
  } catch (e) {
    console.warn('[ErrorLogger] Could not update error in Firestore:', e);
  }
}

/**
 * Deletes a single error log
 */
export async function deleteErrorLog(id: string): Promise<void> {
  const localLogs = getLocalErrorLogs().filter(l => l.id !== id);
  saveLocalErrorLogs(localLogs);

  try {
    await deleteDoc(doc(db, 'logs_erros', id));
  } catch (e) {
    console.warn('[ErrorLogger] Could not delete error from Firestore:', e);
  }
}

/**
 * Clears all resolved or all error logs
 */
export async function clearResolvedErrors(): Promise<void> {
  const localLogs = getLocalErrorLogs();
  const remaining = localLogs.filter(l => l.status !== 'resolvido');
  saveLocalErrorLogs(remaining);

  const resolved = localLogs.filter(l => l.status === 'resolvido');
  for (const log of resolved) {
    try {
      await deleteDoc(doc(db, 'logs_erros', log.id));
    } catch {
      // ignore
    }
  }
}

/**
 * Exports error logs to JSON format
 */
export function exportErrorsToJson(logs: LogErro[]): void {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sysedu_error_logs_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Exports error logs to CSV format
 */
export function exportErrorsToCsv(logs: LogErro[]): void {
  const headers = ['ID', 'Data/Hora', 'Origem', 'Severidade', 'Status', 'Módulo', 'Ação', 'Mensagem', 'Tenant', 'Usuário', 'URL'];
  const rows = logs.map(l => [
    `"${l.id}"`,
    `"${new Date(l.created_at).toLocaleString('pt-BR')}"`,
    `"${l.origem}"`,
    `"${l.severidade}"`,
    `"${l.status}"`,
    `"${(l.modulo || '').replace(/"/g, '""')}"`,
    `"${(l.acao || '').replace(/"/g, '""')}"`,
    `"${(l.mensagem || '').replace(/"/g, '""')}"`,
    `"${(l.tenant_nome || l.tenant_id || '').replace(/"/g, '""')}"`,
    `"${(l.usuario_email || l.usuario_nome || '').replace(/"/g, '""')}"`,
    `"${(l.url || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `sysedu_error_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Global runtime error interceptor initialization
 */
let listenersInitialized = false;

export function initGlobalErrorListeners(): void {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  // Window error event handler
  window.addEventListener('error', (event) => {
    const msg = event.message || 'Erro de execução JavaScript';
    
    // Filter benign / third-party noise
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('Script error.') ||
      msg.includes('chrome-extension') ||
      msg.includes('safari-extension')
    ) {
      return;
    }

    logSystemError({
      origem: 'sistema',
      severidade: 'erro',
      modulo: 'Runtime / Script',
      acao: 'Window Error Handler',
      mensagem: msg,
      stack_trace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      detalhes: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' 
      ? reason 
      : reason?.message || JSON.stringify(reason) || 'Unhandled Promise Rejection';

    // Ignore benign cancellation or ResizeObserver
    if (
      msg.includes('ResizeObserver') || 
      msg.includes('AbortError') || 
      msg.includes('canceled')
    ) {
      return;
    }

    logSystemError({
      origem: 'sistema',
      severidade: msg.includes('network') || msg.includes('fetch') ? 'aviso' : 'erro',
      modulo: 'Async / Promise',
      acao: 'Unhandled Rejection',
      mensagem: msg,
      stack_trace: reason?.stack || String(reason)
    });
  });

  console.log('[ErrorLogger] Global error and rejection interceptors initialized.');
}
