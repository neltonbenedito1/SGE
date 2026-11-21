/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Camada de Cache Multi-Nível (L1 Memória + L2 IndexedDB / localStorage)
 * - Isolamento estrito por tenant (`tenant:{tenantId}:{chave}`)
 * - Invalidação imediata em mutações com sincronização entre separadores (BroadcastChannel)
 * - Suporte a Stale-While-Revalidate (SWR)
 * - Compatível com navegadores desktop, iOS Safari e WebView Android
 */

import { CatalogItem } from '../shared/catalogs';

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
  version: number;
}

export const CACHE_TTLS = {
  PLANOS: 15 * 60 * 1000,            // 15 min (raramente alterado)
  TENANTS_PUBLIC: 3 * 60 * 1000,     // 3 min (lista pública de instituições)
  TENANT_PROFILE: 5 * 60 * 1000,     // 5 min (dados do tenant actual)
  CONFIGURACOES: 5 * 60 * 1000,      // 5 min (configurações do tenant)
  PROVINCIAS: 10 * 60 * 1000,        // 10 min
  ESCOLAS: 5 * 60 * 1000,            // 5 min
  CURSOS: 5 * 60 * 1000,             // 5 min
  CLASSES: 3 * 60 * 1000,            // 3 min (disciplinas e turmas base)
  CLASSES_ESCOLARES: 10 * 60 * 1000, // 10 min
  CADEIRAS: 5 * 60 * 1000,           // 5 min
  SALAS: 10 * 60 * 1000,             // 10 min
  FERIADOS: 15 * 60 * 1000,          // 15 min
  FERIAS: 10 * 60 * 1000,            // 10 min
  CUSTOM_FORMS: 5 * 60 * 1000,       // 5 min
  GLOBAL_SMTP: 10 * 60 * 1000,       // 10 min
} as const;

const CACHE_SCHEMA_VERSION = 1;
const IDB_NAME = 'sge_reference_cache_db';
const IDB_STORE = 'entries';
const L1_MAX_ENTRIES = 250;
const L2_STORAGE_PREFIX = 'sge_rc_';
const INVALIDATION_CHANNEL_NAME = 'sge_cache_sync_v1';

// L1: Cache em memória (acesso O(1) instantâneo)
const l1Cache = new Map<string, CacheEntry<any>>();
// Deduplicação de pedidos concorrentes (thundering herd protection)
const inFlightRequests = new Map<string, Promise<any>>();

let idbPromise: Promise<IDBDatabase | null> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

/**
 * Deteta se a aplicação está a correr dentro de um WebView Android (ou wrapper nativo).
 */
export function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const hasNativeBridge =
    typeof window !== 'undefined' &&
    Boolean((window as any).ReactNativeWebView || (window as any).AndroidBridge || (window as any).Android);
  return hasNativeBridge || /; wv\)/i.test(ua) || (/Android/i.test(ua) && /Version\/[\d.]+/i.test(ua));
}

function getIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function readL2<T>(fullKey: string): Promise<CacheEntry<T> | null> {
  try {
    const idb = await getIdb();
    if (idb) {
      const entry = await new Promise<CacheEntry<T> | null>((resolve) => {
        try {
          const tx = idb.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(fullKey);
          req.onsuccess = () => resolve((req.result as CacheEntry<T>) || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (entry && entry.version === CACHE_SCHEMA_VERSION) {
        return entry;
      }
    }
  } catch {
    // Fallback abaixo para localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(L2_STORAGE_PREFIX + fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (parsed && parsed.version === CACHE_SCHEMA_VERSION) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignorar erros de quota / storage privado
  }
  return null;
}

async function writeL2<T>(fullKey: string, entry: CacheEntry<T>): Promise<void> {
  try {
    const idb = await getIdb();
    if (idb) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          store.put(entry, fullKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
      return;
    }
  } catch {
    // Fallback para localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(entry);
      // Evita saturar os 5MB do localStorage caso IndexedDB não esteja disponível
      if (serialized.length < 350_000) {
        localStorage.setItem(L2_STORAGE_PREFIX + fullKey, serialized);
      }
    }
  } catch {
    // QuotaExceededError silenciosamente absorvido
  }
}

async function deleteL2(fullKey: string): Promise<void> {
  try {
    const idb = await getIdb();
    if (idb) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(fullKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(L2_STORAGE_PREFIX + fullKey);
    }
  } catch {}
}

function setL1<T>(fullKey: string, entry: CacheEntry<T>): void {
  if (l1Cache.size >= L1_MAX_ENTRIES && !l1Cache.has(fullKey)) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey) l1Cache.delete(oldestKey);
  }
  l1Cache.set(fullKey, entry);
}

function ensureBroadcastListener(): void {
  if (typeof window === 'undefined' || broadcastChannel) return;
  try {
    if ('BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel(INVALIDATION_CHANNEL_NAME);
      broadcastChannel.onmessage = (ev) => {
        const msg = ev.data;
        if (msg?.type === 'invalidate_keys' && Array.isArray(msg.keys)) {
          for (const k of msg.keys) {
            l1Cache.delete(k);
          }
        } else if (msg?.type === 'invalidate_prefix' && typeof msg.prefix === 'string') {
          for (const k of Array.from(l1Cache.keys())) {
            if (k.startsWith(msg.prefix)) l1Cache.delete(k);
          }
        }
      };
    }
  } catch {
    // WebViews antigos sem BroadcastChannel
  }
}

ensureBroadcastListener();

export function buildTenantCacheKey(tenantId: string, key: string): string {
  const cleanTenant = (tenantId || '').trim();
  if (!cleanTenant) {
    throw new Error('Isolamento de cache: tenantId é obrigatório para chaves de tenant.');
  }
  return `tenant:${cleanTenant}:${key}`;
}

export function buildGlobalCacheKey(key: string): string {
  return `global:${key}`;
}

export interface GetOrFetchCachedOptions<T> {
  key: string;
  ttlMs: number;
  fetcher: () => Promise<T>;
  forceRefresh?: boolean;
  staleWhileRevalidate?: boolean;
  onBackgroundUpdate?: (freshValue: T) => void;
}

/**
 * Obtém dados da cache (L1 -> L2 -> fetcher) com proteção contra pedidos duplicados
 * e suporte opcional a Stale-While-Revalidate.
 */
export async function getOrFetchCached<T>(options: GetOrFetchCachedOptions<T>): Promise<T> {
  const {
    key,
    ttlMs,
    fetcher,
    forceRefresh = false,
    staleWhileRevalidate = false,
    onBackgroundUpdate,
  } = options;

  const now = Date.now();

  if (!forceRefresh) {
    // 1. Verificar L1 (Memória)
    const memEntry = l1Cache.get(key) as CacheEntry<T> | undefined;
    if (memEntry && memEntry.version === CACHE_SCHEMA_VERSION) {
      if (now < memEntry.expiresAt) {
        return memEntry.value;
      }
      if (staleWhileRevalidate) {
        triggerBackgroundRefresh(key, ttlMs, fetcher, onBackgroundUpdate);
        return memEntry.value;
      }
    }

    // 2. Verificar L2 (IndexedDB / localStorage)
    const diskEntry = await readL2<T>(key);
    if (diskEntry) {
      setL1(key, diskEntry);
      if (now < diskEntry.expiresAt) {
        return diskEntry.value;
      }
      if (staleWhileRevalidate) {
        triggerBackgroundRefresh(key, ttlMs, fetcher, onBackgroundUpdate);
        return diskEntry.value;
      }
    }
  }

  // 3. Deduplicação de pedidos concorrentes para a mesma chave
  const existingFlight = inFlightRequests.get(key);
  if (existingFlight) {
    return existingFlight as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const value = await fetcher();
      const entry: CacheEntry<T> = {
        value,
        storedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        version: CACHE_SCHEMA_VERSION,
      };
      setL1(key, entry);
      writeL2(key, entry).catch(() => {});
      return value;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

function triggerBackgroundRefresh<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onBackgroundUpdate?: (freshValue: T) => void
) {
  if (inFlightRequests.has(key)) return;
  const bgPromise = (async () => {
    try {
      const freshValue = await fetcher();
      const entry: CacheEntry<T> = {
        value: freshValue,
        storedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        version: CACHE_SCHEMA_VERSION,
      };
      setL1(key, entry);
      await writeL2(key, entry);
      if (onBackgroundUpdate) {
        onBackgroundUpdate(freshValue);
      }
    } catch {
      // Falha silenciosa em background preserva dados em cache
    } finally {
      inFlightRequests.delete(key);
    }
  })();
  inFlightRequests.set(key, bgPromise);
}

/**
 * Invalida chaves específicas de um tenant (L1, L2 e outros separadores abertos).
 */
export async function invalidateTenantCache(tenantId: string, keys: string[]): Promise<void> {
  const cleanTenant = (tenantId || '').trim();
  if (!cleanTenant || !keys.length) return;
  const fullKeys = keys.map((k) => buildTenantCacheKey(cleanTenant, k));

  for (const fk of fullKeys) {
    l1Cache.delete(fk);
    inFlightRequests.delete(fk);
    await deleteL2(fk);
  }

  try {
    broadcastChannel?.postMessage({ type: 'invalidate_keys', keys: fullKeys });
  } catch {}
}

/**
 * Limpa toda a cache associada a um tenant (ex: logout ou eliminação de tenant).
 */
export async function clearTenantCaches(tenantId: string): Promise<void> {
  const cleanTenant = (tenantId || '').trim();
  if (!cleanTenant) return;
  const prefix = `tenant:${cleanTenant}:`;

  for (const k of Array.from(l1Cache.keys())) {
    if (k.startsWith(prefix)) l1Cache.delete(k);
  }

  try {
    const idb = await getIdb();
    if (idb) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.openKeyCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
                store.delete(cursor.key);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      const storagePrefix = L2_STORAGE_PREFIX + prefix;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(storagePrefix)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}

  try {
    broadcastChannel?.postMessage({ type: 'invalidate_prefix', prefix });
  } catch {}
}

/**
 * Invalida chaves globais partilhadas (ex: `planos`, `tenants_public`, `global_smtp`).
 */
export async function invalidateGlobalCache(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const fullKeys = keys.map((k) => buildGlobalCacheKey(k));
  for (const fk of fullKeys) {
    l1Cache.delete(fk);
    inFlightRequests.delete(fk);
    await deleteL2(fk);
  }
  try {
    broadcastChannel?.postMessage({ type: 'invalidate_keys', keys: fullKeys });
  } catch {}
}

// Cache em memória para dropdowns e catálogos padronizados (evita reordenar/filtrar em cada render)
const catalogMemoCache = new Map<string, CatalogItem<any>[]>();

export function getCachedDropdownCatalog<T = string>(
  catalogId: string,
  items: CatalogItem<T>[],
  lang: string = 'pt'
): CatalogItem<T>[] {
  const cacheKey = `${catalogId}:${lang}:${items.length}`;
  const existing = catalogMemoCache.get(cacheKey);
  if (existing) {
    return existing as CatalogItem<T>[];
  }
  const normalized = items
    .filter((item) => item.active)
    .slice()
    .sort((a, b) => a.order - b.order);
  catalogMemoCache.set(cacheKey, normalized);
  return normalized;
}
