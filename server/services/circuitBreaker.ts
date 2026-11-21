/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Circuit Breakers, Timeouts & Fallbacks para Serviços Externos (SGE — Fase 5)
 * Protege o backend contra degradação em cascata de Stripe, Gemini AI, SMTP e Identity Toolkit.
 */

import { logSecurityEvent } from '../security/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  timeoutMs: number;
  halfOpenMaxSuccesses?: number;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  failureCount: number;
  failureThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
  totalCalls: number;
  totalFailures: number;
  totalFallbacks: number;
  lastError?: string | null;
  lastStateChangeAt: string;
  nextAttemptAt?: string | null;
}

export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly retryAfterSeconds: number;

  constructor(circuitName: string, retryAfterMs: number) {
    const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(`Serviço externo "${circuitName}" temporariamente indisponível (circuito aberto). Tente novamente em ${secs}s.`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfterSeconds = secs;
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private halfOpenSuccesses = 0;
  private openedAt = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalFallbacks = 0;
  private lastError: string | null = null;
  private lastStateChangeAt = new Date().toISOString();

  constructor(private readonly opts: CircuitBreakerOptions) {}

  private transitionTo(nextState: CircuitState, reason?: string): void {
    if (this.state === nextState) return;
    const previousState = this.state;
    this.state = nextState;
    this.lastStateChangeAt = new Date().toISOString();

    if (nextState === 'OPEN') {
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
    } else if (nextState === 'CLOSED') {
      this.failureCount = 0;
      this.halfOpenSuccesses = 0;
      this.openedAt = 0;
    } else if (nextState === 'HALF_OPEN') {
      this.halfOpenSuccesses = 0;
    }

    logSecurityEvent(nextState === 'OPEN' ? 'WARN' : 'INFO', 'circuit_breaker_transition', {
      circuit: this.opts.name,
      previousState,
      nextState,
      failureCount: this.failureCount,
      reason: reason || null,
    });
  }

  private async runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Timeout (${this.opts.timeoutMs}ms) excedido em ${this.opts.name}`));
          }, this.opts.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  public async execute<T>(
    operation: () => Promise<T>,
    fallback?: (error: Error) => T | Promise<T>
  ): Promise<T> {
    this.totalCalls += 1;

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.opts.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN', 'reset_timeout_elapsed');
      } else {
        const openErr = new CircuitOpenError(this.opts.name, this.opts.resetTimeoutMs - elapsed);
        if (fallback) {
          this.totalFallbacks += 1;
          return await fallback(openErr);
        }
        throw openErr;
      }
    }

    try {
      const result = await this.runWithTimeout(operation);
      if (this.state === 'HALF_OPEN') {
        this.halfOpenSuccesses += 1;
        const needed = this.opts.halfOpenMaxSuccesses ?? 2;
        if (this.halfOpenSuccesses >= needed) {
          this.transitionTo('CLOSED', 'half_open_probe_succeeded');
        }
      } else {
        this.failureCount = 0;
      }
      return result;
    } catch (err: any) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.totalFailures += 1;
      this.lastError = errorObj.message.slice(0, 300);

      if (this.state === 'HALF_OPEN') {
        this.transitionTo('OPEN', `half_open_probe_failed: ${this.lastError}`);
      } else {
        this.failureCount += 1;
        if (this.failureCount >= this.opts.failureThreshold) {
          this.transitionTo('OPEN', `threshold_reached: ${this.lastError}`);
        }
      }

      if (fallback) {
        this.totalFallbacks += 1;
        return await fallback(errorObj);
      }
      throw errorObj;
    }
  }

  public getSnapshot(): CircuitBreakerSnapshot {
    const nextAttemptMs = this.state === 'OPEN' ? this.openedAt + this.opts.resetTimeoutMs : null;
    return {
      name: this.opts.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.opts.failureThreshold,
      timeoutMs: this.opts.timeoutMs,
      resetTimeoutMs: this.opts.resetTimeoutMs,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalFallbacks: this.totalFallbacks,
      lastError: this.lastError,
      lastStateChangeAt: this.lastStateChangeAt,
      nextAttemptAt: nextAttemptMs ? new Date(nextAttemptMs).toISOString() : null,
    };
  }
}

export const stripeBreaker = new CircuitBreaker({
  name: 'stripe_api',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  timeoutMs: 12_000,
  halfOpenMaxSuccesses: 2,
});

export const geminiBreaker = new CircuitBreaker({
  name: 'gemini_ai',
  failureThreshold: 4,
  resetTimeoutMs: 45_000,
  timeoutMs: 15_000,
  halfOpenMaxSuccesses: 2,
});

export const smtpBreaker = new CircuitBreaker({
  name: 'smtp_gateway',
  failureThreshold: 4,
  resetTimeoutMs: 60_000,
  timeoutMs: 10_000,
  halfOpenMaxSuccesses: 1,
});

export const firebaseAuthRestBreaker = new CircuitBreaker({
  name: 'firebase_auth_rest',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  timeoutMs: 8_000,
  halfOpenMaxSuccesses: 2,
});

export function getCircuitBreakersSnapshot(): Record<string, CircuitBreakerSnapshot> {
  return {
    stripe: stripeBreaker.getSnapshot(),
    gemini: geminiBreaker.getSnapshot(),
    smtp: smtpBreaker.getSnapshot(),
    firebaseAuthRest: firebaseAuthRestBreaker.getSnapshot(),
  };
}
