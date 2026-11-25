/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rate Limiting por Tenant & Utilizador + Quotas por Plano (SGE — Fase 5)
 * - Protecção distribuída contra abuso entre múltiplas réplicas
 * - Quotas diferenciadas por plano SaaS (Básico, Pro, Enterprise/Plus)
 * - Cabeçalhos padrão X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Tenant-Plan
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getFirestoreInstance } from '../middleware/auth';
import { verifyStatelessSessionToken } from '../security/authManager';
import { logSecurityEvent } from '../security/logger';

export interface PlanQuotaPolicy {
  planId: string;
  planName: string;
  apiRpmTenant: number;
  apiRpmUser: number;
  aiPerHourTenant: number;
  emailsPer5MinTenant: number;
  authPer15MinIp: number;
  maxAlunos: number;
  maxDocentes: number;
  maxEscolas: number;
}

const DEFAULT_PLAN_POLICIES: Record<string, PlanQuotaPolicy> = {
  'plano-basico': {
    planId: 'plano-basico',
    planName: 'Plano Básico',
    apiRpmTenant: 240,
    apiRpmUser: 90,
    aiPerHourTenant: 60,
    emailsPer5MinTenant: 40,
    authPer15MinIp: 60,
    maxAlunos: 600,
    maxDocentes: 60,
    maxEscolas: 2,
  },
  'plano-pro': {
    planId: 'plano-pro',
    planName: 'Plano Profissional',
    apiRpmTenant: 600,
    apiRpmUser: 180,
    aiPerHourTenant: 160,
    emailsPer5MinTenant: 120,
    authPer15MinIp: 80,
    maxAlunos: 2500,
    maxDocentes: 250,
    maxEscolas: 10,
  },
  'plano-enterprise': {
    planId: 'plano-enterprise',
    planName: 'Plano Empresarial',
    apiRpmTenant: 1500,
    apiRpmUser: 360,
    aiPerHourTenant: 500,
    emailsPer5MinTenant: 300,
    authPer15MinIp: 120,
    maxAlunos: 25000,
    maxDocentes: 2500,
    maxEscolas: 100,
  },
  'plano-plus': {
    planId: 'plano-plus',
    planName: 'Plano Plus',
    apiRpmTenant: 1500,
    apiRpmUser: 360,
    aiPerHourTenant: 500,
    emailsPer5MinTenant: 300,
    authPer15MinIp: 120,
    maxAlunos: 25000,
    maxDocentes: 2500,
    maxEscolas: 100,
  },
  'super-admin': {
    planId: 'super-admin',
    planName: 'Super Administrador Global',
    apiRpmTenant: 3000,
    apiRpmUser: 600,
    aiPerHourTenant: 1000,
    emailsPer5MinTenant: 600,
    authPer15MinIp: 150,
    maxAlunos: 999999,
    maxDocentes: 999999,
    maxEscolas: 999999,
  },
};

const planPolicyCache = new Map<string, { policy: PlanQuotaPolicy; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 60 * 1000;

export async function getTenantEffectiveQuota(tenantId: string): Promise<PlanQuotaPolicy> {
  const safeTenant = (tenantId || 'global').trim();
  if (safeTenant === 'super-admin') {
    return DEFAULT_PLAN_POLICIES['super-admin'];
  }

  const now = Date.now();
  const cached = planPolicyCache.get(safeTenant);
  if (cached && cached.expiresAt > now) {
    return cached.policy;
  }

  let policy: PlanQuotaPolicy = { ...DEFAULT_PLAN_POLICIES['plano-pro'], planId: 'plano-pro' };

  if (safeTenant && safeTenant !== 'global' && safeTenant !== 'default') {
    try {
      const db = getFirestoreInstance();
      const tenantSnap = await db.collection('tenants').doc(safeTenant).get();
      if (tenantSnap.exists) {
        const tenantData = tenantSnap.data() || {};
        const planoId = String(tenantData.plano_id || 'plano-basico');
        const base = DEFAULT_PLAN_POLICIES[planoId] || DEFAULT_PLAN_POLICIES['plano-basico'];
        policy = { ...base, planId: planoId };

        // Lê limites customizados do documento planos/{planoId}, se configurados
        const planSnap = await db.collection('planos').doc(planoId).get();
        if (planSnap.exists) {
          const planDoc = planSnap.data() || {};
          const limits = planDoc.limits || {};
          policy = {
            ...policy,
            planName: planDoc.nome || policy.planName,
            apiRpmTenant: Number(limits.api_rpm || policy.apiRpmTenant),
            apiRpmUser: Number(limits.api_rpm_user || policy.apiRpmUser),
            aiPerHourTenant: Number(limits.ai_per_hour || policy.aiPerHourTenant),
            emailsPer5MinTenant: Number(limits.emails_per_5min || policy.emailsPer5MinTenant),
            maxAlunos: Number(limits.max_alunos || limits.alunos || policy.maxAlunos),
            maxDocentes: Number(limits.max_docentes || limits.docentes || policy.maxDocentes),
            maxEscolas: Number(limits.max_escolas || limits.escolas || policy.maxEscolas),
          };
        }
      }
    } catch {
      // mantém default não bloqueante em caso de falha de leitura
    }
  }

  if (planPolicyCache.size >= 1000 && !planPolicyCache.has(safeTenant)) {
    const oldest = planPolicyCache.keys().next().value;
    if (oldest) planPolicyCache.delete(oldest);
  }
  planPolicyCache.set(safeTenant, { policy, expiresAt: now + PLAN_CACHE_TTL_MS });
  return policy;
}

export function invalidateTenantQuotaCache(tenantId: string): void {
  if (tenantId) planPolicyCache.delete(tenantId);
}

// ============================================================================
// CONTADOR HÍBRIDO L1 + FIRESTORE PARA RATE LIMITING MULTI-INSTÂNCIA
// ============================================================================

interface LocalBucket {
  count: number;
  unsyncedDelta: number;
  resetAtMs: number;
  lastSyncedAt: number;
}

const l1Buckets = new Map<string, LocalBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, b] of l1Buckets.entries()) {
    if (b.resetAtMs <= now - 30_000) {
      l1Buckets.delete(key);
    }
  }
}, 60_000).unref();

async function syncBucketDeltaToFirestore(bucketId: string, delta: number, resetAtMs: number, limit: number): Promise<number> {
  try {
    const db = getFirestoreInstance();
    const ref = db.collection('rate_limit_buckets').doc(bucketId);
    const total = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      const sameWindow = data && Number(data.resetAtMs || 0) === resetAtMs;
      const nextCount = (sameWindow ? Number(data.count || 0) : 0) + delta;
      tx.set(
        ref,
        {
          count: nextCount,
          limit,
          resetAtMs,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
      return nextCount;
    });
    return total;
  } catch {
    return delta;
  }
}

export async function consumeRateBucket(params: {
  key: string;
  limit: number;
  windowMs: number;
  strictDistributed?: boolean;
}): Promise<{ allowed: boolean; count: number; remaining: number; resetAtMs: number }> {
  const now = Date.now();
  const windowSlot = Math.floor(now / params.windowMs);
  const resetAtMs = (windowSlot + 1) * params.windowMs;
  const bucketHash = crypto.createHash('sha256').update(`${params.key}:${windowSlot}`).digest('hex').slice(0, 32);
  const bucketId = `rl_${bucketHash}`;

  let entry = l1Buckets.get(bucketId);
  if (!entry || entry.resetAtMs !== resetAtMs) {
    entry = { count: 0, unsyncedDelta: 0, resetAtMs, lastSyncedAt: now };
    l1Buckets.set(bucketId, entry);
  }

  entry.count += 1;
  entry.unsyncedDelta += 1;

  const shouldSyncSynchronously =
    params.strictDistributed && entry.count > Math.floor(params.limit * 0.7);

  if (shouldSyncSynchronously) {
    const delta = entry.unsyncedDelta;
    entry.unsyncedDelta = 0;
    entry.lastSyncedAt = now;
    const globalCount = await syncBucketDeltaToFirestore(bucketId, delta, resetAtMs, params.limit);
    entry.count = Math.max(entry.count, globalCount);
  } else if (entry.unsyncedDelta >= (params.strictDistributed ? 5 : 15) || now - entry.lastSyncedAt > (params.strictDistributed ? 3000 : 8000)) {
    const delta = entry.unsyncedDelta;
    entry.unsyncedDelta = 0;
    entry.lastSyncedAt = now;
    void syncBucketDeltaToFirestore(bucketId, delta, resetAtMs, params.limit).then((globalCount) => {
      const current = l1Buckets.get(bucketId);
      if (current && current.resetAtMs === resetAtMs && globalCount > current.count) {
        current.count = globalCount;
      }
    });
  }

  const remaining = Math.max(0, params.limit - entry.count);
  return {
    allowed: entry.count <= params.limit,
    count: entry.count,
    remaining,
    resetAtMs,
  };
}

function resolveIdentityForRateLimit(req: Request): { tenantId: string; userKey: string; clientIp: string } {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown_ip';

  if (req.user) {
    return {
      tenantId: req.user.tenant_id || 'global',
      userKey: req.user.uid || clientIp,
      clientIp,
    };
  }

  const sessionToken = req.cookies?.sysedu_session_id || (req.headers['x-session-id'] as string);
  if (sessionToken) {
    const verified = verifyStatelessSessionToken(sessionToken);
    if (verified) {
      return {
        tenantId: verified.tenantId || 'global',
        userKey: verified.userId || clientIp,
        clientIp,
      };
    }
  }

  const bodyTenant = typeof req.body?.tenant_id === 'string' ? req.body.tenant_id : typeof req.query?.tenant_id === 'string' ? req.query.tenant_id : '';
  return {
    tenantId: bodyTenant || 'global',
    userKey: `ip_${crypto.createHash('md5').update(clientIp).digest('hex').slice(0, 12)}`,
    clientIp,
  };
}

export type RateLimitTier = 'api' | 'ai' | 'email' | 'auth';

export function createTenantRateLimiter(tier: RateLimitTier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    // Saúde e pronto não sofrem rate limit restritivo para não derrubar load balancer probes
    if (req.path === '/health' || req.path === '/ready') {
      return next();
    }

    const { tenantId, userKey, clientIp } = resolveIdentityForRateLimit(req);
    const policy = await getTenantEffectiveQuota(tenantId);

    const windowMs =
      tier === 'auth' ? 15 * 60 * 1000 : tier === 'email' ? 5 * 60 * 1000 : 60 * 1000;

    const tenantLimit =
      tier === 'ai'
        ? policy.aiPerHourTenant
        : tier === 'email'
        ? policy.emailsPer5MinTenant
        : tier === 'auth'
        ? policy.authPer15MinIp * 3
        : policy.apiRpmTenant;

    const userLimit =
      tier === 'ai'
        ? Math.max(15, Math.floor(policy.aiPerHourTenant / 2))
        : tier === 'email'
        ? Math.max(15, Math.floor(policy.emailsPer5MinTenant / 2))
        : tier === 'auth'
        ? policy.authPer15MinIp
        : policy.apiRpmUser;

    const effectiveWindow = tier === 'ai' ? 60 * 60 * 1000 : windowMs;
    const strictDistributed = tier === 'auth' || tier === 'ai' || tier === 'email';

    const [tenantBucket, userBucket] = await Promise.all([
      tenantId !== 'global'
        ? consumeRateBucket({
            key: `t:${tier}:${tenantId}`,
            limit: tenantLimit,
            windowMs: effectiveWindow,
            strictDistributed,
          })
        : Promise.resolve({ allowed: true, count: 0, remaining: tenantLimit, resetAtMs: Date.now() + effectiveWindow }),
      consumeRateBucket({
        key: `u:${tier}:${tenantId}:${tier === 'auth' ? clientIp : userKey}`,
        limit: userLimit,
        windowMs: effectiveWindow,
        strictDistributed,
      }),
    ]);

    const limitingBucket = !tenantBucket.allowed ? tenantBucket : userBucket;
    const effectiveLimit = !tenantBucket.allowed ? tenantLimit : userLimit;

    res.setHeader('X-RateLimit-Limit', String(effectiveLimit));
    res.setHeader('X-RateLimit-Remaining', String(Math.min(tenantBucket.remaining, userBucket.remaining)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(limitingBucket.resetAtMs / 1000)));
    res.setHeader('X-Tenant-Plan', policy.planId);

    if (!tenantBucket.allowed || !userBucket.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((limitingBucket.resetAtMs - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));

      logSecurityEvent('WARN', 'rate_limit_exceeded', {
        tier,
        tenantId,
        userKey,
        planId: policy.planId,
        scope: !tenantBucket.allowed ? 'tenant_quota' : 'user_quota',
        limit: effectiveLimit,
        retryAfterSec,
      });

      const messages: Record<RateLimitTier, string> = {
        api: 'Limite de requisições da instituição ou do utilizador atingido para o plano actual. Aguarde alguns segundos.',
        ai: 'Limite de operações de Inteligência Artificial atingido para o seu plano. Aguarde ou considere actualizar o plano.',
        email: 'Limite de envio de e-mails atingido para esta janela temporal. Aguarde alguns minutos.',
        auth: 'Muitas tentativas de operação de segurança a partir desta origem. Tente novamente dentro de 15 minutos.',
      };

      return res.status(429).json({
        code: 'rate_limit_exceeded',
        tier,
        plan: policy.planId,
        retryAfterSeconds: retryAfterSec,
        error: messages[tier],
      });
    }

    return next();
  };
}
