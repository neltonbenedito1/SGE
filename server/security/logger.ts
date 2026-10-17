/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Structured Security Logger (JSON, Zero-Secret Exposure)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'SECURITY' | 'ERROR';

const SENSITIVE_KEYS = new Set([
  'password', 'senha', 'pass', 'token', 'idtoken', 'secret', 'authorization',
  'cookie', 'key', 'apikey', 'credential', 'currentpassword', 'newpassword', 'tempPassword'
]);

/**
 * Deep masks sensitive fields in objects before logging
 */
export function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveData);

  const masked: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower)) {
      masked[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      masked[k] = maskSensitiveData(v);
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
  const safeDetails = maskSensitiveData(details);
  const logPayload = {
    timestamp,
    level,
    event,
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
