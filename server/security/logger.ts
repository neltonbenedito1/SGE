/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Structured Security & Observability Logger (JSON, Zero-Secret Exposure)
 * - AsyncLocalStorage para propagação automática de requestId, tenantId e userId
 */

import { AsyncLocalStorage } from 'async_hooks';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'SECURITY' | 'ERROR';

export interface RequestLogContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  method?: string;
  path?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(ctx: RequestLogContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore();
}

export function enrichRequestContext(patch: Partial<RequestLogContext>): void {
  const store = requestContextStorage.getStore();
  if (!store) return;
  if (patch.tenantId !== undefined) store.tenantId = patch.tenantId;
  if (patch.userId !== undefined) store.userId = patch.userId;
  if (patch.role !== undefined) store.role = patch.role;
  if (patch.method !== undefined) store.method = patch.method;
  if (patch.path !== undefined) store.path = patch.path;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'pass',
  'token',
  'idtoken',
  'secret',
  'authorization',
  'cookie',
  'key',
  'apikey',
  'credential',
  'currentpassword',
  'newpassword',
  'temppassword',
  'sessionid',
  'sysedu_session_id',
]);

/**
 * Deep masks sensitive fields in objects before logging
 */
export function maskSensitiveData(obj: any, depth = 0): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (depth > 8) return '[TRUNCATED_DEPTH]';
  if (Array.isArray(obj)) return obj.map((item) => maskSensitiveData(item, depth + 1));

  const masked: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower)) {
      masked[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      masked[k] = maskSensitiveData(v, depth + 1);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

export function logSecurityEvent(
  level: LogLevel,
  event: string,
  details: Record<string, any> = {}
) {
  const timestamp = new Date().toISOString();
  const ctx = requestContextStorage.getStore();
  const safeDetails = maskSensitiveData(details);

  const logPayload: Record<string, any> = {
    timestamp,
    level,
    event,
    pid: process.pid,
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    ...(ctx?.userId ? { userId: ctx.userId } : {}),
    ...(ctx?.role ? { role: ctx.role } : {}),
    ...safeDetails,
  };

  const formatted = JSON.stringify(logPayload);
  if (level === 'ERROR') {
    console.error(formatted);
  } else if (level === 'WARN' || level === 'SECURITY') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}
