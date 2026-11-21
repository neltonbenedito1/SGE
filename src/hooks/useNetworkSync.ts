import { useState, useEffect, useCallback, useRef } from 'react';
import { getNetworkCapabilities, ConnectionQuality } from '../lib/resilientFetch';

export interface NetworkSyncState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  pendingSyncCount: number;
  connectionQuality: ConnectionQuality;
  isSlowConnection: boolean;
  saveData: boolean;
  effectiveType?: string;
}

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => new Date());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [capabilities, setCapabilities] = useState(() => getNetworkCapabilities());

  const refreshCapabilities = useCallback(() => {
    setCapabilities(getNetworkCapabilities());
  }, []);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnlineAt(new Date());
    refreshCapabilities();
    if (wasOfflineRef.current) {
      window.dispatchEvent(new CustomEvent('sge-network-reconnected'));
    }
  }, [refreshCapabilities]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    wasOfflineRef.current = true;
    refreshCapabilities();
  }, [refreshCapabilities]);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', refreshCapabilities);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', refreshCapabilities);
      }
    };
  }, [handleOnline, handleOffline, refreshCapabilities]);

  const incrementPending = useCallback(() => {
    setPendingSyncCount((prev) => prev + 1);
  }, []);

  const decrementPending = useCallback(() => {
    setPendingSyncCount((prev) => Math.max(0, prev - 1));
  }, []);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
    wasOfflineRef.current = false;
  }, []);

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    pendingSyncCount,
    connectionQuality: isOnline ? capabilities.quality : 'offline',
    isSlowConnection: isOnline && capabilities.quality === 'slow',
    saveData: capabilities.saveData,
    effectiveType: capabilities.effectiveType,
    incrementPending,
    decrementPending,
    resetWasOffline,
  };
}
