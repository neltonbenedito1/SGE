import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useNetworkSync } from '../hooks/useNetworkSync';

export const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, wasOffline, isSlowConnection, saveData, effectiveType, resetWasOffline } = useNetworkSync();
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [slowBannerDismissed, setSlowBannerDismissed] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedBanner(true);
      const timer = setTimeout(() => {
        setShowReconnectedBanner(false);
        resetWasOffline();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, resetWasOffline]);

  useEffect(() => {
    if (!isSlowConnection) {
      setSlowBannerDismissed(false);
    }
  }, [isSlowConnection]);

  if (isOnline && !showReconnectedBanner && (!isSlowConnection || slowBannerDismissed)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm"
    >
      {!isOnline ? (
        <div className="flex items-center gap-3 bg-amber-600 text-white px-4 py-3 rounded-xl shadow-lg border border-amber-400/40 text-xs font-medium">
          <WifiOff className="w-4 h-4 shrink-0 text-amber-100" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">Modo Offline Ativo</p>
            <p className="text-amber-100 text-[11px] mt-0.5">
              Sem ligação à rede. As alterações ficam guardadas em cache local e sincronizam ao reconectar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
            title="Tentar reconectar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : showReconnectedBanner ? (
        <div className="flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500/40 text-xs font-medium">
          <Wifi className="w-4 h-4 shrink-0 text-emerald-100" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">Ligação Restabelecida</p>
            <p className="text-emerald-100 text-[11px] mt-0.5">
              A sincronizar dados pendentes com o servidor.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-slate-900 text-slate-100 px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">Ligação Lenta {effectiveType ? `(${effectiveType.toUpperCase()})` : ''}</p>
            <p className="text-slate-300 text-[11px] mt-0.5">
              {saveData
                ? 'Modo de poupança de dados ativo. Atualizações automáticas reduzidas.'
                : 'A adaptar o carregamento e o cache local para maior estabilidade.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSlowBannerDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer shrink-0"
            aria-label="Fechar aviso de ligação lenta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
