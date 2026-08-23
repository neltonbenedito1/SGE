import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getUserSessionCookie, deleteCookie } from '../lib/cookies';

export interface AuthSecurityStatus {
  mustChangePassword: boolean;
  loading: boolean;
  userProfile: any | null;
}

export function useAuthSecurityCheck(onSessionRevoked?: () => void) {
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);

  useEffect(() => {
    const session = getUserSessionCookie();
    const currentUid = session?.id || auth.currentUser?.uid;

    if (!currentUid) {
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    const sessionStartTime = Date.now();

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

        // 1. Mandatory password change check
        const needsChange = !!(data.mustChangePassword || data.requer_alteracao_senha);
        setMustChangePassword(needsChange);

        // 2. Session Revocation Check (Compare sessionsRevokedAt with session creation)
        if (data.sessionsRevokedAt) {
          const revokedAtMs = typeof data.sessionsRevokedAt.toMillis === 'function' 
            ? data.sessionsRevokedAt.toMillis() 
            : new Date(data.sessionsRevokedAt).getTime();

          // If session was initialized before the revocation timestamp
          if (session?.createdAt && session.createdAt < revokedAtMs) {
            console.warn('[AuthSecurity] Sessão revogada por alteração de senha ou encerramento administrativo.');
            deleteCookie('user_session');
            if (onSessionRevoked) {
              onSessionRevoked();
            }
          }
        }

        setLoading(false);
      },
      (error) => {
        console.warn('[AuthSecurity] Snapshot listener warning:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [onSessionRevoked]);

  return { mustChangePassword, loading, userProfile };
}
export default useAuthSecurityCheck;
