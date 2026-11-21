/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Estado Distribuído Externo para Escala Horizontal (SGE — Fase 5)
 * Remove dependência exclusiva da RAM do processo para:
 * - Bloqueio distribuído contra brute-force de login (`auth_lockouts`)
 * - Idempotência distribuída de webhooks do Stripe (`stripe_events`)
 * - Cota horária de IA por tenant e planos (`tenant_quotas`)
 */

import crypto from 'crypto';
import { getFirestoreInstance } from '../middleware/auth';
import { logSecurityEvent } from '../security/logger';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface FailedLoginTracker {
  attempts: number;
  lockoutUntil: number;
  updatedAt: number;
}

const l1LockoutCache = new Map<string, FailedLoginTracker>();

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 32);
}

export async function checkLoginLockout(
  lockKey: string
): Promise<{ locked: boolean; remainingMinutes: number; attempts: number }> {
  const now = Date.now();
  const docId = `lock_${hashKey(lockKey)}`;

  // 1. Leitura rápida L1 se ainda válida
  const cached = l1LockoutCache.get(docId);
  if (cached && cached.lockoutUntil > now) {
    return {
      locked: true,
      remainingMinutes: Math.max(1, Math.ceil((cached.lockoutUntil - now) / 60_000)),
      attempts: cached.attempts,
    };
  }

  // 2. Consulta partilhada em Firestore para sincronização entre instâncias
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection('auth_lockouts').doc(docId).get();
    if (snap.exists) {
      const data = snap.data() as FailedLoginTracker;
      l1LockoutCache.set(docId, data);
      if (data.lockoutUntil && data.lockoutUntil > now) {
        return {
          locked: true,
          remainingMinutes: Math.max(1, Math.ceil((data.lockoutUntil - now) / 60_000)),
          attempts: data.attempts || MAX_FAILED_ATTEMPTS,
        };
      }
      return { locked: false, remainingMinutes: 0, attempts: data.attempts || 0 };
    }
  } catch {
    // Fallback não bloqueante para L1
  }

  return { locked: false, remainingMinutes: 0, attempts: cached?.attempts || 0 };
}

export async function recordFailedLoginAttempt(
  lockKey: string
): Promise<{ lockedNow: boolean; attempts: number; lockoutUntil: number }> {
  const now = Date.now();
  const docId = `lock_${hashKey(lockKey)}`;
  const db = getFirestoreInstance();

  try {
    const ref = db.collection('auth_lockouts').doc(docId);
    const result = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const prev: FailedLoginTracker = snap.exists
        ? (snap.data() as FailedLoginTracker)
        : { attempts: 0, lockoutUntil: 0, updatedAt: now };

      // Se o lockout anterior já expirou há mais de 30m, reinicia contagem
      const baseAttempts =
        prev.lockoutUntil > 0 && now > prev.lockoutUntil
          ? 0
          : prev.updatedAt && now - prev.updatedAt > 30 * 60_000
          ? 0
          : prev.attempts || 0;

      const attempts = baseAttempts + 1;
      const lockedNow = attempts >= MAX_FAILED_ATTEMPTS;
      const lockoutUntil = lockedNow ? now + LOCKOUT_DURATION_MS : 0;

      const updated: FailedLoginTracker = { attempts, lockoutUntil, updatedAt: now };
      tx.set(ref, updated, { merge: true });
      return { lockedNow, attempts, lockoutUntil, updated };
    });

    l1LockoutCache.set(docId, result.updated);
    return {
      lockedNow: result.lockedNow,
      attempts: result.attempts,
      lockoutUntil: result.lockoutUntil,
    };
  } catch {
    const prev = l1LockoutCache.get(docId) || { attempts: 0, lockoutUntil: 0, updatedAt: now };
    const attempts = prev.attempts + 1;
    const lockedNow = attempts >= MAX_FAILED_ATTEMPTS;
    const lockoutUntil = lockedNow ? now + LOCKOUT_DURATION_MS : 0;
    l1LockoutCache.set(docId, { attempts, lockoutUntil, updatedAt: now });
    return { lockedNow, attempts, lockoutUntil };
  }
}

export async function clearFailedLoginAttempts(lockKey: string): Promise<void> {
  const docId = `lock_${hashKey(lockKey)}`;
  l1LockoutCache.delete(docId);
  try {
    const db = getFirestoreInstance();
    await db.collection('auth_lockouts').doc(docId).delete();
  } catch {
    // non-fatal
  }
}

// ============================================================================
// IDEMPOTÊNCIA DISTRIBUÍDA DE EVENTOS STRIPE
// ============================================================================
const l1StripeEvents = new Set<string>();

export async function claimStripeEventIdempotently(
  eventId: string,
  eventType: string
): Promise<{ alreadyProcessed: boolean }> {
  if (!eventId) return { alreadyProcessed: false };
  if (l1StripeEvents.has(eventId)) {
    return { alreadyProcessed: true };
  }

  try {
    const db = getFirestoreInstance();
    const eventRef = db.collection('stripe_events').doc(eventId);
    const claimed = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(eventRef);
      if (snap.exists) {
        return true;
      }
      tx.set(eventRef, {
        id: eventId,
        type: eventType,
        status: 'queued',
        received_at: new Date().toISOString(),
      });
      return false;
    });

    l1StripeEvents.add(eventId);
    if (l1StripeEvents.size > 5000) {
      const first = l1StripeEvents.values().next().value;
      if (first) l1StripeEvents.delete(first);
    }
    return { alreadyProcessed: claimed };
  } catch (err: any) {
    logSecurityEvent('WARN', 'stripe_idempotency_fallback', { eventId, error: err?.message });
    l1StripeEvents.add(eventId);
    return { alreadyProcessed: false };
  }
}

// ============================================================================
// COTA DISTRIBUÍDA DE IA POR TENANT (HORÁRIA)
// ============================================================================
const l1AiQuotaCache = new Map<string, { bucket: string; count: number; syncedAt: number }>();

export async function consumeDistributedTenantAiQuota(
  tenantId: string,
  hourlyLimit: number
): Promise<{ allowed: boolean; used: number; limit: number; resetAtIso: string }> {
  const safeTenant = tenantId || 'global';
  const now = Date.now();
  const hourIndex = Math.floor(now / 3_600_000);
  const resetAtIso = new Date((hourIndex + 1) * 3_600_000).toISOString();
  const bucketKey = `ai_${safeTenant}_${hourIndex}`;

  const l1 = l1AiQuotaCache.get(bucketKey);
  if (l1 && l1.count >= hourlyLimit) {
    return { allowed: false, used: l1.count, limit: hourlyLimit, resetAtIso };
  }

  try {
    const db = getFirestoreInstance();
    const ref = db.collection('tenant_quotas').doc(bucketKey);
    const txRes = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? Number(snap.data()?.count || 0) : 0;
      if (current >= hourlyLimit) {
        return { allowed: false, used: current };
      }
      const nextCount = current + 1;
      tx.set(
        ref,
        {
          tenant_id: safeTenant,
          quota_type: 'ai_hourly',
          hour_index: hourIndex,
          count: nextCount,
          limit: hourlyLimit,
          updated_at: new Date(now).toISOString(),
          expires_at: resetAtIso,
        },
        { merge: true }
      );
      return { allowed: true, used: nextCount };
    });

    l1AiQuotaCache.set(bucketKey, { bucket: bucketKey, count: txRes.used, syncedAt: now });
    if (l1AiQuotaCache.size > 2000) {
      const oldest = l1AiQuotaCache.keys().next().value;
      if (oldest) l1AiQuotaCache.delete(oldest);
    }

    return { allowed: txRes.allowed, used: txRes.used, limit: hourlyLimit, resetAtIso };
  } catch {
    const next = (l1?.count || 0) + 1;
    l1AiQuotaCache.set(bucketKey, { bucket: bucketKey, count: next, syncedAt: now });
    return {
      allowed: next <= hourlyLimit,
      used: next,
      limit: hourlyLimit,
      resetAtIso,
    };
  }
}
