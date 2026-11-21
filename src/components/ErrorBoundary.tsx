import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { isDynamicImportError } from '../lib/lazyWithRetry';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    if (isDynamicImportError(this.state.error) && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      const isModuleError = isDynamicImportError(this.state.error);
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      return (
        <div
          className={`${
            this.props.compact ? 'p-5 my-3' : 'p-8 my-6'
          } bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-4`}
        >
          <div className="w-11 h-11 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            {isOffline ? <WifiOff className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
              {isOffline
                ? 'Sem ligação à Internet'
                : this.props.fallbackTitle || 'Ocorreu um erro ao carregar este módulo'}
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">
              {isOffline
                ? 'Este módulo ainda não estava disponível em cache local. Verifique os dados móveis ou Wi-Fi e tente novamente.'
                : isModuleError
                  ? 'Foi detetada uma atualização do sistema ou uma falha temporária de rede ao descarregar o módulo. Clique abaixo para recarregar.'
                  : 'Ocorreu um problema inesperado ao processar esta visualização. Pode tentar recarregar o módulo.'}
            </p>
            {this.state.error?.message && (
              <p className="text-[10px] text-rose-500 font-mono mt-2 bg-rose-100/50 dark:bg-rose-900/30 p-2 rounded max-w-lg mx-auto truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />{' '}
            {isModuleError && !isOffline ? 'Recarregar Aplicação' : 'Tentar Novamente'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ModuleErrorBoundary: React.FC<{ title?: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <ErrorBoundary fallbackTitle={title ? `Erro no módulo "${title}"` : undefined} compact>
    {children}
  </ErrorBoundary>
);
