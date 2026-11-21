import React from 'react';

interface ModuleSkeletonProps {
  title?: string;
  rows?: number;
  variant?: 'default' | 'table' | 'cards' | 'compact';
}

/**
 * Esqueleto de carregamento não-bloqueante para módulos lazy e listas grandes (Fase 6).
 */
export const ModuleSkeleton: React.FC<ModuleSkeletonProps> = ({
  title,
  rows = 6,
  variant = 'default',
}) => {
  if (variant === 'compact') {
    return (
      <div
        role="status"
        aria-label={title || 'A carregar módulo'}
        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
      >
        <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        role="status"
        aria-label={title || 'A carregar cartões'}
        className="space-y-5"
      >
        {title && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {title}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: Math.max(3, Math.min(rows, 9)) }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        role="status"
        aria-label={title || 'A carregar tabela'}
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse ml-auto" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <div className="h-3.5 w-4/5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse hidden sm:block" />
              <div className="h-6 w-20 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={title || 'A carregar módulo'}
      className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          {title ? (
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{title}</p>
          ) : (
            <div className="h-3 w-72 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
          )}
        </div>
        <div className="h-9 w-36 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
};

export default ModuleSkeleton;
