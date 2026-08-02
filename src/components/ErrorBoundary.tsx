import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-4 my-6">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
              {this.props.fallbackTitle || 'Ocorreu um erro ao carregar este módulo'}
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">
              Ocorreu um problema inesperado ao processar a visualização. Pode tentar recarregar o módulo.
            </p>
            {this.state.error?.message && (
              <p className="text-[10px] text-rose-500 font-mono mt-2 bg-rose-100/50 dark:bg-rose-900/30 p-2 rounded max-w-lg mx-auto truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
