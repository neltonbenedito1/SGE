/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Camada de CDN e Cache Local para Ficheiros Estáticos e Media (PDFs, Livros, Imagens).
 * - Reescreve URLs estáticos/media para o domínio CDN configurado em VITE_MEDIA_CDN_URL
 * - Armazena localmente PDFs e capas de livros em CacheStorage (`sge-media-cdn-v1`)
 *   para leitura instantânea repetida, com fallback seguro para Android WebView
 */

const MEDIA_CACHE_NAME = 'sge-media-cdn-v1';
const MAX_LOCAL_BLOB_CACHE = 40;

const objectUrlMemoryCache = new Map<string, string>();

function getConfiguredCdnBase(): string {
  try {
    const raw = (import.meta as any)?.env?.VITE_MEDIA_CDN_URL || '';
    return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

/**
 * Converte um URL de media/asset estático para o ponto de presença CDN quando configurado.
 * Preserva intactos data URLs, blob URLs e URLs já externos assinados que não pertencem à origem.
 */
export function resolveCdnMediaUrl(
  url: string | undefined | null,
  options?: { width?: number; quality?: number }
): string {
  if (!url) return '';
  const clean = url.trim();
  if (!clean) return '';

  if (
    clean.startsWith('data:') ||
    clean.startsWith('blob:') ||
    clean.startsWith('chrome-extension:')
  ) {
    return clean;
  }

  const cdnBase = getConfiguredCdnBase();
  if (!cdnBase) {
    return clean;
  }

  try {
    // Caminhos relativos da aplicação (/Logo2.png, /assets/..., /media/...)
    if (clean.startsWith('/')) {
      const target = new URL(clean, cdnBase);
      if (options?.width) target.searchParams.set('w', String(options.width));
      if (options?.quality) target.searchParams.set('q', String(options.quality));
      return target.toString();
    }

    // URLs absolutos da própria origem ou Firebase Storage podem ser servidos via CDN proxy quando configurado
    if (typeof window !== 'undefined') {
      const parsed = new URL(clean, window.location.origin);
      if (parsed.origin === window.location.origin) {
        const target = new URL(parsed.pathname + parsed.search, cdnBase);
        if (options?.width) target.searchParams.set('w', String(options.width));
        if (options?.quality) target.searchParams.set('q', String(options.quality));
        return target.toString();
      }
    }
  } catch {
    // Em caso de URL malformado, devolve o original
  }

  return clean;
}

/**
 * Obtém um ficheiro media (PDF ou imagem) através da cache local (CacheStorage + ObjectURL),
 * evitando downloads repetidos do mesmo livro ou capa.
 */
export async function fetchCachedMediaObjectUrl(
  rawUrl: string,
  tenantId?: string
): Promise<string> {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  const resolvedUrl = resolveCdnMediaUrl(rawUrl);
  const cacheKeyUrl = tenantId
    ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(tenantId)}`
    : resolvedUrl;

  const existingMem = objectUrlMemoryCache.get(cacheKeyUrl);
  if (existingMem) {
    return existingMem;
  }

  // Fallback seguro para ambientes sem Cache API (ex: WebViews antigos ou HTTP não seguro)
  if (typeof caches === 'undefined') {
    return resolvedUrl;
  }

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cachedRes = await cache.match(cacheKeyUrl);
    if (cachedRes && cachedRes.ok) {
      const blob = await cachedRes.blob();
      const objUrl = URL.createObjectURL(blob);
      rememberObjectUrl(cacheKeyUrl, objUrl);
      return objUrl;
    }

    const networkRes = await fetch(resolvedUrl, { mode: 'cors', credentials: 'omit' });
    if (!networkRes.ok) {
      return resolvedUrl;
    }

    const cloned = networkRes.clone();
    cache.put(cacheKeyUrl, cloned).catch(() => {});

    const blob = await networkRes.blob();
    const objUrl = URL.createObjectURL(blob);
    rememberObjectUrl(cacheKeyUrl, objUrl);
    return objUrl;
  } catch {
    return resolvedUrl;
  }
}

function rememberObjectUrl(key: string, objUrl: string): void {
  if (objectUrlMemoryCache.size >= MAX_LOCAL_BLOB_CACHE && !objectUrlMemoryCache.has(key)) {
    const oldest = objectUrlMemoryCache.keys().next().value;
    if (oldest) {
      const oldUrl = objectUrlMemoryCache.get(oldest);
      objectUrlMemoryCache.delete(oldest);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {}
      }
    }
  }
  objectUrlMemoryCache.set(key, objUrl);
}

/**
 * Remove um recurso específico da cache local de media (ex: quando uma edição de livro é substituída).
 */
export async function evictCachedMediaUrl(rawUrl: string, tenantId?: string): Promise<void> {
  if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return;
  const resolvedUrl = resolveCdnMediaUrl(rawUrl);
  const cacheKeyUrl = tenantId
    ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(tenantId)}`
    : resolvedUrl;

  const memUrl = objectUrlMemoryCache.get(cacheKeyUrl);
  if (memUrl) {
    objectUrlMemoryCache.delete(cacheKeyUrl);
    if (memUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(memUrl);
      } catch {}
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(MEDIA_CACHE_NAME);
      await cache.delete(cacheKeyUrl);
      await cache.delete(resolvedUrl);
    } catch {}
  }
}

/**
 * Pré-carrega em tempo ocioso recursos estáticos e capas frequentemente acedidas.
 */
export function prefetchMediaAssets(urls: string[]): void {
  if (typeof window === 'undefined' || !urls.length) return;
  const unique = Array.from(
    new Set(urls.filter((u) => u && !u.startsWith('data:') && !u.startsWith('blob:')))
  ).slice(0, 12);
  if (!unique.length) return;

  const run = () => {
    for (const u of unique) {
      const target = resolveCdnMediaUrl(u);
      fetch(target, { mode: 'cors', credentials: 'omit' }).catch(() => {});
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 800);
  }
}
