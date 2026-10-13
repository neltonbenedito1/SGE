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

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD_MS = 25 * 60 * 1000;  // 25 minutes (5 min warning)

export function useAuthSecurityCheck(onSessionRevoked?: () => void): AuthSecurityStatus {
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);

  // Inactivity tracking states
  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowInactivityWarning(false);
    setSecondsRemaining(300);
    // Ping server to update lastActivity in server session
    fetch('/api/auth/session/verify').catch(() => {});
  }, []);

  // Track user activity events
  useEffect(() => {
    const handleUserActivity = () => {
      // Only update if not currently showing warning modal to prevent accidental dismissal by background moves
      if (!showInactivityWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Inactivity check interval every 5 seconds
    timerRef.current = setInterval(() => {
      const session = getUserSessionCookie();
      if (!session) return;

      const idleTime = Date.now() - lastActivityRef.current;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        // Expired: log out user
        console.warn('[InactivityTracker] Sessão encerrada após 30 minutos de inatividade.');
        deleteCookie('user_session');
        fetch('/api/auth/session/logout', { method: 'POST' }).catch(() => {});
        if (auth.currentUser) {
          auth.signOut().catch(() => {});
        }
        setShowInactivityWarning(false);
        onSessionRevoked?.();
      } else if (idleTime >= WARNING_THRESHOLD_MS) {
        // Show warning
        setShowInactivityWarning(true);
        const remaining = Math.max(0, Math.floor((INACTIVITY_TIMEOUT_MS - idleTime) / 1000));
        setSecondsRemaining(remaining);
      } else {
        setShowInactivityWarning(false);
      }
    }, 3000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showInactivityWarning, onSessionRevoked]);

  // Firestore & Token Claims listener
  useEffect(() => {
    const session = getUserSessionCookie();
    const currentUid = session?.id || auth.currentUser?.uid;

    if (!currentUid) {
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    // Check token claims directly for must_reset_password
    if (auth.currentUser) {
      auth.currentUser.getIdTokenResult().then((tokenResult) => {
        if (tokenResult.claims.must_reset_password) {
          setMustChangePassword(true);
        }
      }).catch(() => {});
    }

    // Listen to real-time changes in users/{uid}
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

        // Mandatory password change check
        const needsChange = !!(data.mustChangePassword || data.requer_alteracao_senha);
        setMustChangePassword(needsChange);

        // Session Revocation Check
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
