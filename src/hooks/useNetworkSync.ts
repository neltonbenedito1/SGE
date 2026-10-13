import { useState, useEffect, useCallback } from 'react';

export interface NetworkSyncState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  pendingSyncCount: number;
}

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnlineAt(new Date());
    if (wasOffline) {
      console.log('[NetworkSync] Conexão com a Internet restabelecida. Sincronizando dados pendentes...');
    }
  }, [wasOffline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    console.warn('[NetworkSync] Conexão com a Internet perdida. O sistema operará em modo offline resiliente (cache do Firestore).');
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const incrementPending = useCallback(() => {
    setPendingSyncCount(prev => prev + 1);
  }, []);

  const decrementPending = useCallback(() => {
    setPendingSyncCount(prev => Math.max(0, prev - 1));
  }, []);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    pendingSyncCount,
    incrementPending,
    decrementPending,
    resetWasOffline,
  };
}
