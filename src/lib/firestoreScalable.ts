/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Camada de acesso escalável ao Firestore para arquitectura Multi-Tenant.
 * - Obriga filtragem por identificador do tenant (chave natural de particionamento)
 * - Implementa paginação por cursor com limite máximo rígido por pedido
 * - Elimina consultas e escritas N+1 com leitura em lote (chunks de 30) e writeBatch (chunks de 450)
 * - Suporta contagem nativa no servidor via getCountFromServer sem descarregar colecções
 */

import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  OrderByDirection,
  QueryConstraint,
  QueryDocumentSnapshot,
  query,
  startAfter,
  where,
  writeBatch,
  DocumentData,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const FIRESTORE_IN_QUERY_LIMIT = 30;
const FIRESTORE_BATCH_LIMIT = 450;
const CLIENT_SLOW_QUERY_MS = 450;
const lastSlowBeaconByOp = new Map<string, number>();

function reportSlowClientQuery(operation: string, durationMs: number): void {
  if (durationMs < CLIENT_SLOW_QUERY_MS || typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const now = Date.now();
  const lastSent = lastSlowBeaconByOp.get(operation) || 0;
  if (now - lastSent < 15_000) return;
  lastSlowBeaconByOp.set(operation, now);

  void (async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/observability/slow-query', {
        method: 'POST',
        headers,
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({
          operation,
          durationMs: Math.round(durationMs),
        }),
      });
    } catch {
      // Telemetria nunca interrompe consultas principais
    }
  })();
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface TenantPageOptions {
  collectionName: string;
  tenantId: string;
  tenantField?: 'tenant_id' | 'tenantId';
  constraints?: QueryConstraint[];
  orderByField?: string;
  orderDirection?: OrderByDirection;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

/**
 * Garante que todas as consultas possuem um identificador de tenant válido.
 */
export function assertTenantId(tenantId: string | undefined | null): string {
  const clean = (tenantId || '').trim();
  if (!clean) {
    throw new Error('Violação de particionamento multi-tenant: tenant_id é obrigatório para esta consulta.');
  }
  return clean;
}

/**
 * Determina a chave lógica de partição / região do tenant (preparação para sharding por região ou tenant).
 */
export function getTenantPartitionKey(tenantId: string, region = 'mz-global'): string {
  const cleanTenant = assertTenantId(tenantId);
  return `${region}:${cleanTenant}`;
}

/**
 * Executa paginação por cursor estritamente isolada por tenant com limite máximo seguro.
 */
export async function fetchTenantPage<T extends Record<string, any>>(
  options: TenantPageOptions
): Promise<PaginatedResult<T>> {
  const cleanTenant = assertTenantId(options.tenantId);
  const tenantField = options.tenantField || 'tenant_id';
  const safeLimit = Math.min(Math.max(1, options.pageSize || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const queryConstraints: QueryConstraint[] = [
    where(tenantField, '==', cleanTenant),
    ...(options.constraints || []),
  ];

  if (options.orderByField) {
    queryConstraints.push(orderBy(options.orderByField, options.orderDirection || 'asc'));
  }

  if (options.cursor) {
    queryConstraints.push(startAfter(options.cursor));
  }

  // Solicita +1 documento para saber com precisão se existe próxima página sem leitura extra
  queryConstraints.push(limit(safeLimit + 1));

  const tStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const q = query(collection(db, options.collectionName), ...queryConstraints);
  const snap = await getDocs(q);
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tStart;
  reportSlowClientQuery(`firestore:page:${options.collectionName}`, elapsed);

  const hasMore = snap.docs.length > safeLimit;
  const pageDocs = hasMore ? snap.docs.slice(0, safeLimit) : snap.docs;
  const items = pageDocs.map((d) => ({ id: d.id, ...(d.data() as any) } as T));
  const nextCursor = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

  return {
    items,
    nextCursor: hasMore ? nextCursor : null,
    hasMore,
  };
}

/**
 * Conta documentos no servidor sem transferir os payloads para o cliente.
 */
export async function countTenantDocs(
  collectionName: string,
  tenantId: string,
  extraConstraints: QueryConstraint[] = [],
  tenantField: 'tenant_id' | 'tenantId' = 'tenant_id'
): Promise<number> {
  const cleanTenant = assertTenantId(tenantId);
  const q = query(
    collection(db, collectionName),
    where(tenantField, '==', cleanTenant),
    ...extraConstraints
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * Conta documentos globais no servidor (uso exclusivo do Super Admin).
 */
export async function countGlobalDocs(
  collectionName: string,
  extraConstraints: QueryConstraint[] = []
): Promise<number> {
  const q = query(collection(db, collectionName), ...extraConstraints);
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * Elimina consultas N+1 por ID carregando documentos em lotes paralelos de até 30 IDs.
 * Filtra estritamente por tenant_id no resultado para garantir isolamento.
 */
export async function batchFetchByIds<T extends Record<string, any>>(
  collectionName: string,
  ids: string[],
  tenantId?: string,
  tenantField: 'tenant_id' | 'tenantId' = 'tenant_id'
): Promise<T[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  if (uniqueIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    chunks.push(uniqueIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT));
  }

  const tStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, collectionName), where(documentId(), 'in', chunk)))
    )
  );
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tStart;
  reportSlowClientQuery(`firestore:batch:${collectionName}`, elapsed);

  const results: T[] = [];
  snapshots.forEach((snap) => {
    snap.forEach((d) => {
      const data = d.data() as any;
      if (tenantId && data[tenantField] && data[tenantField] !== tenantId) {
        return;
      }
      results.push({ id: d.id, ...data } as T);
    });
  });

  return results;
}

export type BatchMutationOp =
  | { type: 'set'; path: [string, string]; data: Record<string, any>; merge?: boolean }
  | { type: 'update'; path: [string, string]; data: Record<string, any> }
  | { type: 'delete'; path: [string, string] };

/**
 * Executa escritas/actualizações/eliminações em lotes atómicos de até 450 operações.
 */
export async function commitBatchOperations(operations: BatchMutationOp[]): Promise<number> {
  if (!operations || operations.length === 0) return 0;

  let committed = 0;
  for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = operations.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const op of chunk) {
      const ref = doc(db, op.path[0], op.path[1]);
      if (op.type === 'set') {
        batch.set(ref, op.data, op.merge ? { merge: true } : undefined);
      } else if (op.type === 'update') {
        batch.update(ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(ref);
      }
    }

    await batch.commit();
    committed += chunk.length;
  }

  return committed;
}
