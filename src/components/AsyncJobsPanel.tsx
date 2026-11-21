/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Painel discreto de Tarefas em Segundo Plano (Fase 4)
 * Mostra ao utilizador os estados em tempo real:
 * Pendente -> Em processamento -> Concluído / Falha (DLQ)
 */

import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Layers,
} from 'lucide-react';
import {
  useAsyncJobs,
  getStatusLabelPt,
  dismissTrackedJob,
  clearCompletedJobs,
  retryFailedJob,
  isTerminalJobStatus,
  ClientAsyncJob,
} from '../lib/asyncJobsClient';

interface AsyncJobsPanelProps {
  tenantId?: string;
}

export const AsyncJobsPanel: React.FC<AsyncJobsPanelProps> = ({ tenantId }) => {
  const jobs = useAsyncJobs(tenantId);
  const [collapsed, setCollapsed] = useState(false);

  if (!jobs || jobs.length === 0) return null;

  const activeCount = jobs.filter((j) => !isTerminalJobStatus(j.status)).length;
  const completedCount = jobs.filter((j) => j.status === 'concluido').length;
  const failedCount = jobs.filter((j) => j.status === 'dead_letter').length;

  const renderStatusIcon = (job: ClientAsyncJob) => {
    switch (job.status) {
      case 'pendente':
        return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'em_processamento':
      case 'falhado_reintento':
        return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />;
      case 'concluido':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'dead_letter':
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const getBadgeClasses = (status: ClientAsyncJob['status']) => {
    switch (status) {
      case 'pendente':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case 'em_processamento':
      case 'falhado_reintento':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800';
      case 'concluido':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'dead_letter':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9000] w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {activeCount > 0 ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : failedCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-bold truncate">
            {activeCount > 0
              ? `Processamento Assíncrono (${activeCount} em curso)`
              : `Tarefas em Segundo Plano (${jobs.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={() => clearCompletedJobs(tenantId)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Limpar concluídas"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 transition cursor-pointer"
            title={collapsed ? 'Expandir' : 'Minimizar'}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Job list */}
      {!collapsed && (
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {jobs.slice(0, 6).map((job) => {
            const pct = Math.min(100, Math.max(0, job.progress ?? (job.status === 'concluido' ? 100 : 10)));
            return (
              <div key={job.id} className="p-3 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5">{renderStatusIcon(job)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100 truncate" title={job.title}>
                        {job.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {job.progress_message || getStatusLabelPt(job.status)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissTrackedJob(job.id)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer shrink-0"
                    title="Dispensar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      job.status === 'concluido'
                        ? 'bg-emerald-500'
                        : job.status === 'dead_letter'
                        ? 'bg-rose-500'
                        : job.status === 'pendente'
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Footer status badge + action */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${getBadgeClasses(
                      job.status
                    )}`}
                  >
                    {getStatusLabelPt(job.status)} ({pct}%)
                  </span>

                  <div className="flex items-center gap-1.5">
                    {job.status === 'dead_letter' && (
                      <button
                        type="button"
                        onClick={() => void retryFailedJob(job.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Reprocessar
                      </button>
                    )}
                    {job.status === 'concluido' && job.onDownloadReady && (
                      <button
                        type="button"
                        onClick={() => job.onDownloadReady?.()}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 cursor-pointer"
                      >
                        <Download className="w-3 h-3" /> Descarregar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AsyncJobsPanel;
