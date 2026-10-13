/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminInstance, getFirestoreInstance } from '../middleware/auth';

export interface UserClaimsData {
  role: string;
  tenant_id: string;
  must_reset_password?: boolean;
}

/**
 * Assigns Custom Claims to a user in Firebase Authentication.
 * Tokens refreshed on next client exchange will reflect these claims.
 */
export async function setUserCustomClaims(uid: string, claims: UserClaimsData): Promise<void> {
  const admin = getFirebaseAdminInstance();
  const auth = getAuth(admin);

  const cleanClaims = {
    role: claims.role || 'estudante',
    tenant_id: claims.tenant_id || 'default',
    must_reset_password: Boolean(claims.must_reset_password),
  };

  await auth.setCustomUserClaims(uid, cleanClaims);
  console.log(`[CustomClaims] Assigned claims to ${uid}: role=${cleanClaims.role}, tenant=${cleanClaims.tenant_id}`);
}

/**
 * Migration utility: reads existing users in the `users` collection in Firestore,
 * and provisions custom claims in Firebase Authentication.
 */
export async function migrateExistingUsersClaims(options: { dryRun?: boolean; limit?: number; tenantId?: string }) {
  const admin = getFirebaseAdminInstance();
  const db = getFirestoreInstance();
  const auth = getAuth(admin);

  const dryRun = options.dryRun !== false;
  const maxLimit = options.limit || 100;

  let query: FirebaseFirestore.Query = db.collection('users');
  if (options.tenantId) {
    query = query.where('tenant_id', '==', options.tenantId);
  }
  const snapshot = await query.limit(maxLimit).get();

  const results: Array<{
    uid: string;
    email: string;
    role: string;
    tenant_id: string;
    must_reset: boolean;
    status: 'migrated' | 'skipped' | 'error' | 'dry_run_ready';
    details?: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const uid = doc.id;
    const email = data.email || '';
    const role = data.tipo || data.role || (email === 'neltonbenedito1@gmail.com' ? 'super_admin' : 'estudante');
    const tenant_id = data.tenant_id || data.tenantId || 'default';
    const must_reset = Boolean(data.mustChangePassword || data.requer_alteracao_senha);

    if (dryRun) {
      results.push({
        uid,
        email,
        role,
        tenant_id,
        must_reset,
        status: 'dry_run_ready',
        details: 'Simulação de atribuição de claims concluída com sucesso.',
      });
      continue;
    }

    try {
      // Find or verify user in Firebase Auth
      let authUser;
      try {
        authUser = await auth.getUser(uid);
      } catch (err: any) {
        if (email) {
          authUser = await auth.getUserByEmail(email).catch(() => null);
        }
      }

      const targetAuthUid = authUser ? authUser.uid : uid;

      if (authUser) {
        await setUserCustomClaims(targetAuthUid, {
          role,
          tenant_id,
          must_reset_password: must_reset,
        });

        // Also update user document with claimsSyncedAt timestamp
        await doc.ref.set(
          {
            claimsSyncedAt: new Date().toISOString(),
            role,
            tenant_id,
          },
          { merge: true }
        );

        results.push({
          uid: targetAuthUid,
          email,
          role,
          tenant_id,
          must_reset,
          status: 'migrated',
        });
      } else {
        results.push({
          uid,
          email,
          role,
          tenant_id,
          must_reset,
          status: 'skipped',
          details: 'Usuário não existe no Firebase Auth (necessita primeiro cadastro)',
        });
      }
    } catch (e: any) {
      results.push({
        uid,
        email,
        role,
        tenant_id,
        must_reset,
        status: 'error',
        details: e.message || String(e),
      });
    }
  }

  return {
    totalChecked: snapshot.size,
    dryRun,
    migratedCount: results.filter((r) => r.status === 'migrated').length,
    skippedCount: results.filter((r) => r.status === 'skipped').length,
    results,
  };
}
