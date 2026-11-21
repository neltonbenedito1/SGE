/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getUserSessionCookie, deleteCookie } from '../lib/cookies';

export interface AuthSecurityStatus {
  mustChangePassword: boolean;
  loading: boolean;
  userProfile: any | null;
  showInactivityWarning: boolean;
  secondsRemaining: number;
  extendSession: () => void;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const WARNING_THRESHOLD_MS = 25 * 60 * 1000;  // 25 minutos (aviso de 5 min)

export function useAuthSecurityCheck(onSessionRevoked?: () => void): AuthSecurityStatus {
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);

  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showWarningRef = useRef<boolean>(false);

  const evaluateInactivity = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const session = getUserSessionCookie();
    if (!session) {
      // Sem sessão ativa: verificar esporadicamente sem despertar a cada 3s
      timerRef.current = setTimeout(evaluateInactivity, 30_000);
      return;
    }

    const idleTime = Date.now() - lastActivityRef.current;

    if (idleTime >= INACTIVITY_TIMEOUT_MS) {
      console.warn('[InactivityTracker] Sessão encerrada após 30 minutos de inatividade.');
      deleteCookie('user_session');
      fetch('/api/auth/session/logout', { method: 'POST' }).catch(() => {});
      if (auth.currentUser) {
        auth.signOut().catch(() => {});
      }
      showWarningRef.current = false;
      setShowInactivityWarning(false);
      onSessionRevoked?.();
      return;
    }

    if (idleTime >= WARNING_THRESHOLD_MS) {
      showWarningRef.current = true;
      setShowInactivityWarning(true);
      const remaining = Math.max(0, Math.floor((INACTIVITY_TIMEOUT_MS - idleTime) / 1000));
      setSecondsRemaining(remaining);
      // Atualiza contador apenas enquanto o aviso estiver visível
      timerRef.current = setTimeout(evaluateInactivity, 1000);
      return;
    }

    if (showWarningRef.current) {
      showWarningRef.current = false;
      setShowInactivityWarning(false);
    }

    // Agenda exatamente para o limiar de aviso (evita polling contínuo a cada 3s)
    const msUntilWarning = Math.max(5_000, WARNING_THRESHOLD_MS - idleTime);
    timerRef.current = setTimeout(evaluateInactivity, Math.min(msUntilWarning, 60_000));
  }, [onSessionRevoked]);

  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    showWarningRef.current = false;
    setShowInactivityWarning(false);
    setSecondsRemaining(300);
    fetch('/api/auth/session/verify').catch(() => {});
    evaluateInactivity();
  }, [evaluateInactivity]);

  // Monitoriza atividade real sem causar re-renders nem timers constantes
  useEffect(() => {
    const handleUserActivity = () => {
      if (!showWarningRef.current) {
        lastActivityRef.current = Date.now();
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        evaluateInactivity();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    evaluateInactivity();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [evaluateInactivity]);

  // Firestore & Token Claims listener em tempo real (sem polling)
  useEffect(() => {
    const session = getUserSessionCookie();
    const currentUid = session?.id || auth.currentUser?.uid;

    if (!currentUid) {
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    if (auth.currentUser) {
      auth.currentUser.getIdTokenResult().then((tokenResult) => {
        if (tokenResult.claims.must_reset_password) {
          setMustChangePassword(true);
        }
      }).catch(() => {});
    }

    const userDocRef = doc(db, 'users', currentUid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        setUserProfile({ id: snapshot.id, ...data });

        const needsChange = !!(data.mustChangePassword || data.requer_alteracao_senha);
        setMustChangePassword(needsChange);

        if (data.sessionsRevokedAt) {
          const revokedAtMs = typeof data.sessionsRevokedAt.toMillis === 'function'
            ? data.sessionsRevokedAt.toMillis()
            : new Date(data.sessionsRevokedAt).getTime();

          if (session?.createdAt && session.createdAt < revokedAtMs) {
            console.warn('[AuthSecurity] Sessão revogada por alteração de senha.');
            deleteCookie('user_session');
            onSessionRevoked?.();
          }
        }

        setLoading(false);
      },
      (error) => {
        console.warn('[AuthSecurity] Snapshot listener note:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [onSessionRevoked]);

  return {
    mustChangePassword,
    loading,
    userProfile,
    showInactivityWarning,
    secondsRemaining,
    extendSession,
  };
}

export default useAuthSecurityCheck;
