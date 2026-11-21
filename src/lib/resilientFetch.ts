/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cliente HTTP Resiliente para Redes Móveis Lentas / Instáveis (SGE — Fase 6)
 * - Timeout configurável com AbortController (adaptativo em ligações 2G/3G)
 * - Retry automático com backoff exponencial em erros transitórios (429, 502, 503, 504, falha de rede)
 * - Mensagens de erro contextualizadas em Português (sem bloquear em WebView Android)
 */

export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
}

export type ConnectionQuality = 'offline' | 'slow' | 'moderate' | 'fast';

export interface NetworkCapabilities {
  isOnline: boolean;
  effectiveType?: string;
  saveData: boolean;
  downlink?: number;
  rtt?: number;
  quality: ConnectionQuality;
}

export function getNetworkCapabilities(): NetworkCapabilities {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  if (!isOnline) {
    return { isOnline: false, saveData: false, quality: 'offline' };
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

  const effectiveType: string | undefined = typeof conn?.effectiveType === 'string' ? conn.effectiveType : undefined;
  const saveData: boolean = Boolean(conn?.saveData);
  const downlink: number | undefined = typeof conn?.downlink === 'number' ? conn.downlink : undefined;
  const rtt: number | undefined = typeof conn?.rtt === 'number' ? conn.rtt : undefined;

  let quality: ConnectionQuality = 'fast';
  if (
    saveData ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    (typeof downlink === 'number' && downlink > 0 && downlink < 0.7) ||
    (typeof rtt === 'number' && rtt >= 800)
  ) {
    quality = 'slow';
  } else if (
    effectiveType === '3g' ||
    (typeof downlink === 'number' && downlink > 0 && downlink < 2.5) ||
    (typeof rtt === 'number' && rtt >= 350)
  ) {
    quality = 'moderate';
  }

  return { isOnline, effectiveType, saveData, downlink, rtt, quality };
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function isAbortOrNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /Failed to fetch|NetworkError|network|timeout|ECONNRESET|ETIMEDOUT|aborted/i.test(msg);
}

export function classifyNetworkErrorPt(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sem ligação à Internet. A sua operação será sincronizada quando a rede voltar.';
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'A ligação demorou mais tempo do que o esperado. Verifique o sinal da rede e tente novamente.';
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/i.test(msg)) {
    return 'Ligação instável ao servidor. Verifique os dados móveis ou Wi-Fi.';
  }
  if (/429|Too Many Requests/i.test(msg)) {
    return 'Demasiados pedidos em simultâneo. Aguarde alguns segundos antes de tentar novamente.';
  }
  return msg || 'Ocorreu uma falha temporária de comunicação com o servidor.';
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const net = getNetworkCapabilities();
  const adaptiveTimeout =
    options.timeoutMs ?? (net.quality === 'slow' ? 25_000 : net.quality === 'moderate' ? 16_000 : 12_000);
  const maxRetries = options.maxRetries ?? 2;
  const baseDelay = options.baseRetryDelayMs ?? 600;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const externalSignal = options.signal;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timer = setTimeout(() => controller.abort(), adaptiveTimeout);

    try {
      const { timeoutMs: _t, maxRetries: _r, baseRetryDelayMs: _b, signal: _s, ...fetchInit } = options;
      const res = await fetch(input, {
        ...fetchInit,
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (!shouldRetryStatus(res.status) || attempt === maxRetries) {
        return res;
      }

      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const backoffMs = Math.max(
        isNaN(retryAfterMs) ? 0 : retryAfterMs,
        baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
      );
      await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 6000)));
    } catch (err) {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      lastError = err;

      if (externalSignal?.aborted || !isAbortOrNetworkError(err) || attempt === maxRetries) {
        throw err;
      }

      const backoffMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 5000)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha de rede após tentativas.');
}
