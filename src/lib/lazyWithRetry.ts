import React, { lazy, ComponentType } from 'react';

const RETRY_DELAYS_MS = [350, 900];
const RELOAD_COOLDOWN_MS = 10_000;

export function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|ChunkLoadError/i.test(
    message
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps React.lazy with automatic transient retries and a guarded single-shot
 * reload if the Vite dev server restarted or deployed new chunk hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  moduleKey: string
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const mod = await importer();
        try {
          sessionStorage.removeItem(`lazy_reload_${moduleKey}`);
        } catch {
          // ignore sessionStorage restrictions
        }
        return mod;
      } catch (err) {
        lastError = err;
        if (!isDynamicImportError(err) || attempt === RETRY_DELAYS_MS.length) {
          break;
        }
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }

    if (isDynamicImportError(lastError) && typeof window !== 'undefined') {
      const storageKey = `lazy_reload_${moduleKey}`;
      let shouldReload = true;
      try {
        const lastReloadRaw = sessionStorage.getItem(storageKey);
        const lastReloadTs = lastReloadRaw ? Number(lastReloadRaw) : 0;
        if (lastReloadTs && Date.now() - lastReloadTs < RELOAD_COOLDOWN_MS) {
          shouldReload = false;
        } else {
          sessionStorage.setItem(storageKey, String(Date.now()));
        }
      } catch {
        // if sessionStorage is unavailable, avoid reload loop
        shouldReload = false;
      }

      if (shouldReload) {
        window.location.reload();
        // Hold Suspense cleanly while the browser reloads
        return new Promise<{ default: T }>(() => {});
      }
    }

    throw lastError;
  });
}
