import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkSync } from '../hooks/useNetworkSync';

export const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, wasOffline, resetWasOffline } = useNetworkSync();
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);

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

  if (isOnline && !showReconnectedBanner) {
    return null;
  }

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-md animate-fadeIn"
    >
      {!isOnline ? (
        <div className="flex items-center gap-3 bg-amber-500/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg border border-amber-400/40 text-xs font-medium">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-100" />
          <div className="flex-1">
            <p className="font-bold">Modo Offline Ativo</p>
            <p className="text-amber-100 text-[11px] mt-0.5">
              Conexão com a rede perdida. Suas operações continuam sendo salvas no cache local.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-emerald-600/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500/40 text-xs font-medium">
          <Wifi className="w-4 h-4 shrink-0 text-emerald-100" />
          <div className="flex-1">
            <p className="font-bold">Conexão Restabelecida</p>
            <p className="text-emerald-100 text-[11px] mt-0.5 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin inline" /> Sincronizando dados com o servidor...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
