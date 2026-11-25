/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de Base de Conhecimento & FAQ (Fase 1)
 * - CRUD de Categorias e Artigos/Perguntas Frequentes
 * - Sanitização estrita de Rich Text HTML no servidor (anti-XSS)
 * - Validação de anexos por magic-bytes e armazenamento seguro
 * - Histórico de alterações por item + Trilha de auditoria imutável
 * - Consulta pública com isolamento multi-tenant e controlo por visibilidade/perfil
 */

import crypto from 'crypto';
import { getFirestoreInstance, AuthenticatedUser } from '../middleware/auth';
import { recordAuditLog } from '../security/audit';
import { validateFileMagicBytes } from '../security/fileValidator';
import type {
  FaqArticle,
  FaqAttachment,
  FaqCategory,
  FaqChangeHistoryDiff,
  FaqChangeHistoryEntry,
  FaqEstado,
  FaqOverviewStats,
  FaqTipo,
  FaqVisibilidade,
} from '../../src/types';

const FAQ_CATEGORIES_COL = 'faq_categories';
const FAQ_ARTICLES_COL = 'faq_articles';
const FAQ_ATTACHMENTS_COL = 'faq_attachments';
const IDEMPOTENCY_COL = 'idempotency_keys';

const ALLOWED_HTML_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
  'code', 'pre', 'a', 'hr', 'div', 'span',
]);

const STRIP_WITH_CONTENT_REGEX =
  /<\s*(script|style|iframe|object|embed|form|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const VOID_TAGS = new Set(['br', 'hr']);

/**
 * Sanitizes rich-text HTML strictly on the server without external DOM dependencies.
 * Strips dangerous tags/contents, inline event handlers, javascript:/data: URIs,
 * and unknown attributes.
 */
export function sanitizeRichTextHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(STRIP_WITH_CONTENT_REGEX, '');

  // Neutralize standalone dangerous void/unclosed tags
  cleaned = cleaned.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|link|meta|base|svg|math)\b[^>]*>/gi,
    ''
  );

  // Process remaining tags via allowlist
  cleaned = cleaned.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)(\s+[^>]*)?\s*(\/?)>/g, (_match, slash, tagNameRaw, attrsRaw = '') => {
    const tag = String(tagNameRaw).toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      return '';
    }
    if (slash === '/') {
      return VOID_TAGS.has(tag) ? '' : `</${tag}>`;
    }
    if (tag === 'a') {
      const hrefMatch = String(attrsRaw).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const rawHref = (hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || '').trim();
      const isSafeUrl = /^(https?:\/\/|\/)/i.test(rawHref) && !/[\u0000-\u001F\s]*javascript:/i.test(rawHref);
      if (!isSafeUrl) {
        return '<a>';
      }
      const escapedHref = rawHref
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer">`;
    }
    return VOID_TAGS.has(tag) ? `<${tag} />` : `<${tag}>`;
  });

  return cleaned.trim();
}

export function extractPlainText(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-4]|blockquote|pre)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTextForSearch(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(value: string): string {
  return normalizeTextForSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'categoria';
}

export function isSuperAdminRole(role?: string): boolean {
  const normalized = String(role || '').toLowerCase().trim();
  return normalized === 'super_admin' || normalized === 'superadmin';
}

export function canRoleViewArticle(visibilidade: FaqVisibilidade, userRole?: string): boolean {
  const role = String(userRole || '').toLowerCase().trim();
  if (isSuperAdminRole(role)) return true;
  if (visibilidade === 'todos') return true;
  if (!role) return false;

  switch (visibilidade) {
    case 'tenant_admin':
      return ['admin', 'tenant_admin', 'director', 'administrador', 'directores', 'suporte'].includes(role);
    case 'docentes':
      return ['docente', 'professor', 'admin', 'tenant_admin', 'director', 'administrador'].includes(role);
    case 'estudantes':
      return ['estudante', 'aluno'].includes(role);
    case 'encarregados':
      return ['pai', 'encarregado', 'encarregado_educacao'].includes(role);
    case 'super_admin':
      return isSuperAdminRole(role);
    default:
      return false;
  }
}

async function getIdempotentResult<T>(scope: string, key?: string): Promise<{ hit: boolean; data?: T }> {
  if (!key || !key.trim()) return { hit: false };
  try {
    const db = getFirestoreInstance();
    const docId = `idem_${scope}_${crypto.createHash('sha256').update(key.trim()).digest('hex').slice(0, 32)}`;
    const snap = await db.collection(IDEMPOTENCY_COL).doc(docId).get();
    if (snap.exists) {
      const payload = snap.data();
      if (payload?.expiresAt && Number(payload.expiresAt) > Date.now() && payload?.result) {
        return { hit: true, data: payload.result as T };
      }
    }
  } catch {}
  return { hit: false };
}

async function saveIdempotentResult(scope: string, key: string | undefined, result: any): Promise<void> {
  if (!key || !key.trim()) return;
  try {
    const db = getFirestoreInstance();
    const docId = `idem_${scope}_${crypto.createHash('sha256').update(key.trim()).digest('hex').slice(0, 32)}`;
    await db.collection(IDEMPOTENCY_COL).doc(docId).set({
      scope,
      key: key.trim(),
      result,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch {}
}

// ============================================================================
// CATEGORIAS FAQ
// ============================================================================

export async function listFaqCategories(params?: {
  tenantId?: string;
  includeInactive?: boolean;
}): Promise<FaqCategory[]> {
  const db = getFirestoreInstance();
  const [catSnap, artSnap] = await Promise.all([
    db.collection(FAQ_CATEGORIES_COL).get(),
    db.collection(FAQ_ARTICLES_COL).get(),
  ]);

  const countByCat = new Map<string, number>();
  for (const d of artSnap.docs) {
    const a = d.data() || {};
    const cid = String(a.categoria_id || '');
    if (cid) {
      countByCat.set(cid, (countByCat.get(cid) || 0) + 1);
    }
  }

  const targetTenant = params?.tenantId?.trim();
  const list: FaqCategory[] = [];
  for (const d of catSnap.docs) {
    const data = d.data() || {};
    const row: FaqCategory = {
      id: d.id,
      tenant_id: String(data.tenant_id || 'global'),
      nome: String(data.nome || ''),
      slug: String(data.slug || slugify(data.nome || d.id)),
      descricao: String(data.descricao || ''),
      ordem: Number(data.ordem ?? 0),
      ativo: data.ativo !== false,
      visibilidade_padrao: (data.visibilidade_padrao || 'todos') as FaqVisibilidade,
      artigos_count: countByCat.get(d.id) || 0,
      created_at: String(data.created_at || ''),
      updated_at: String(data.updated_at || ''),
      created_by: String(data.created_by || ''),
      updated_by: String(data.updated_by || ''),
    };
    if (targetTenant && row.tenant_id !== targetTenant && row.tenant_id !== 'global') {
      continue;
    }
    if (params?.includeInactive === false && !row.ativo) {
      continue;
    }
    list.push(row);
  }

  list.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
  return list;
}

export async function createFaqCategory(
  input: {
    tenant_id: string;
    nome: string;
    descricao?: string;
    ordem?: number;
    ativo?: boolean;
    visibilidade_padrao?: FaqVisibilidade;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ category: FaqCategory; idempotent: boolean }> {
  const idem = await getIdempotentResult<FaqCategory>('faq_cat_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { category: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const id = `faqcat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const cleanNome = input.nome.trim();

  const category: FaqCategory = {
    id,
    tenant_id: input.tenant_id || 'global',
    nome: cleanNome,
    slug: slugify(cleanNome),
    descricao: (input.descricao || '').trim(),
    ordem: Number(input.ordem ?? 0),
    ativo: input.ativo !== false,
    visibilidade_padrao: input.visibilidade_padrao || 'todos',
    artigos_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: actor.email || actor.uid,
    updated_by: actor.email || actor.uid,
  };

  await db.collection(FAQ_CATEGORIES_COL).doc(id).set(category);
  await saveIdempotentResult('faq_cat_create', input.idempotencyKey, category);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'faq_category',
    entity_id: id,
    tenant_id: category.tenant_id,
    after_state: category,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { category, idempotent: false };
}

export async function updateFaqCategory(
  id: string,
  input: {
    nome?: string;
    descricao?: string;
    ordem?: number;
    ativo?: boolean;
    visibilidade_padrao?: FaqVisibilidade;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<FaqCategory | null> {
  const db = getFirestoreInstance();
  const ref = db.collection(FAQ_CATEGORIES_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const before = snap.data() as FaqCategory;
  const nowIso = new Date().toISOString();
  const nextNome = input.nome !== undefined ? input.nome.trim() : before.nome;

  const updated: FaqCategory = {
    ...before,
    id,
    nome: nextNome,
    slug: input.nome !== undefined ? slugify(nextNome) : before.slug || slugify(nextNome),
    descricao: input.descricao !== undefined ? input.descricao.trim() : before.descricao || '',
    ordem: input.ordem !== undefined ? Number(input.ordem) : Number(before.ordem ?? 0),
    ativo: input.ativo !== undefined ? Boolean(input.ativo) : before.ativo !== false,
    visibilidade_padrao: input.visibilidade_padrao || before.visibilidade_padrao || 'todos',
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await ref.set(updated, { merge: true });

  // Propagate category name change to existing articles referencing this category
  if (input.nome !== undefined && nextNome !== before.nome) {
    try {
      const artSnap = await db.collection(FAQ_ARTICLES_COL).where('categoria_id', '==', id).get();
      if (!artSnap.empty) {
        const batch = db.batch();
        for (const aDoc of artSnap.docs) {
          batch.update(aDoc.ref, { categoria_nome: nextNome });
        }
        await batch.commit();
      }
    } catch {}
  }

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'update',
    entity: 'faq_category',
    entity_id: id,
    tenant_id: updated.tenant_id,
    before_state: before,
    after_state: updated,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return updated;
}

export async function deleteFaqCategory(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ deleted: boolean; conflict?: boolean; error?: string }> {
  const db = getFirestoreInstance();
  const ref = db.collection(FAQ_CATEGORIES_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { deleted: false, error: 'Categoria não encontrada.' };
  }

  const artSnap = await db.collection(FAQ_ARTICLES_COL).where('categoria_id', '==', id).limit(1).get();
  if (!artSnap.empty) {
    return {
      deleted: false,
      conflict: true,
      error: 'Não é possível eliminar uma categoria com perguntas ou artigos associados. Reassocie ou remova os artigos primeiro.',
    };
  }

  const before = snap.data() as FaqCategory;
  await ref.delete();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'faq_category',
    entity_id: id,
    tenant_id: before.tenant_id || 'global',
    before_state: before,
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { deleted: true };
}

// ============================================================================
// ANEXOS FAQ (IMAGENS E PDF COM MAGIC BYTES)
// ============================================================================

export async function uploadFaqAttachment(
  input: {
    nome: string;
    mime_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
    dataBase64: string;
    tenant_id?: string;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ attachment: FaqAttachment; idempotent: boolean }> {
  const idem = await getIdempotentResult<FaqAttachment>('faq_att_upload', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { attachment: idem.data, idempotent: true };
  }

  const cleanBase64 = input.dataBase64.replace(/^data:[^;]+;base64,/i, '').trim();
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (!buffer || buffer.length === 0) {
    throw new Error('Conteúdo do ficheiro vazio ou base64 inválido.');
  }
  if (buffer.length > 750 * 1024) {
    throw new Error('O anexo excede o limite máximo de 700 KB.');
  }

  const validation = validateFileMagicBytes(buffer, input.nome, input.mime_type);
  if (!validation.valid) {
    throw new Error(validation.error || 'Assinatura de ficheiro inválida.');
  }
  if (validation.mimeType === 'image/gif') {
    throw new Error('Apenas imagens PNG, JPEG, WEBP e documentos PDF são permitidos.');
  }

  const db = getFirestoreInstance();
  const id = `faqatt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const attachmentType: 'image' | 'pdf' = validation.mimeType === 'application/pdf' ? 'pdf' : 'image';

  await db.collection(FAQ_ATTACHMENTS_COL).doc(id).set({
    id,
    tenant_id: input.tenant_id || 'global',
    nome: input.nome.trim().slice(0, 180),
    tipo: attachmentType,
    mime_type: validation.mimeType,
    tamanho_bytes: buffer.length,
    data_base64: buffer.toString('base64'),
    uploaded_by: actor.email || actor.uid,
    created_at: nowIso,
  });

  const attachment: FaqAttachment = {
    id,
    nome: input.nome.trim().slice(0, 180),
    tipo: attachmentType,
    mime_type: validation.mimeType as FaqAttachment['mime_type'],
    tamanho_bytes: buffer.length,
    url: `/api/faq/attachments/${id}`,
    criado_em: nowIso,
  };

  await saveIdempotentResult('faq_att_upload', input.idempotencyKey, attachment);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'faq_attachment',
    entity_id: id,
    tenant_id: input.tenant_id || 'global',
    after_state: { id: attachment.id, nome: attachment.nome, mime_type: attachment.mime_type, tamanho_bytes: attachment.tamanho_bytes },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { attachment, idempotent: false };
}

export async function getFaqAttachmentForCaller(
  attachmentId: string,
  caller?: AuthenticatedUser
): Promise<{
  found: boolean;
  forbidden?: boolean;
  nome?: string;
  mimeType?: string;
  buffer?: Buffer;
}> {
  const db = getFirestoreInstance();
  const snap = await db.collection(FAQ_ATTACHMENTS_COL).doc(attachmentId).get();
  if (!snap.exists) return { found: false };

  const data = snap.data() || {};
  const isSuper = isSuperAdminRole(caller?.role);

  if (!isSuper) {
    const attTenant = String(data.tenant_id || 'global');
    if (attTenant !== 'global' && (!caller || attTenant !== caller.tenant_id)) {
      return { found: true, forbidden: true };
    }

    // Verify if at least one published article referencing this attachment is visible to caller
    const targetUrl = `/api/faq/attachments/${attachmentId}`;
    const artSnap = await db.collection(FAQ_ARTICLES_COL).get();
    const referencing = artSnap.docs
      .map((d: any) => d.data())
      .filter((a: any) => Array.isArray(a?.anexos) && a.anexos.some((ax: any) => ax?.id === attachmentId || ax?.url === targetUrl));

    if (referencing.length > 0) {
      const canSeeAny = referencing.some((a: any) => {
        if (a.estado !== 'publicado') return false;
        const aTenant = String(a.tenant_id || 'global');
        if (aTenant !== 'global' && (!caller || aTenant !== caller.tenant_id)) return false;
        return canRoleViewArticle((a.visibilidade || 'todos') as FaqVisibilidade, caller?.role);
      });
      if (!canSeeAny) {
        return { found: true, forbidden: true };
      }
    } else if (!caller) {
      return { found: true, forbidden: true };
    }
  }

  return {
    found: true,
    nome: String(data.nome || 'anexo'),
    mimeType: String(data.mime_type || 'application/octet-stream'),
    buffer: Buffer.from(String(data.data_base64 || ''), 'base64'),
  };
}

// ============================================================================
// ARTIGOS E PERGUNTAS FREQUENTES (FAQ)
// ============================================================================

function mapDocToArticle(id: string, data: any, catNameMap?: Map<string, string>): FaqArticle {
  const catId = String(data.categoria_id || '');
  return {
    id,
    tenant_id: String(data.tenant_id || 'global'),
    tipo: (data.tipo === 'artigo_tutorial' ? 'artigo_tutorial' : 'faq') as FaqTipo,
    titulo: String(data.titulo || ''),
    pergunta: String(data.pergunta || data.titulo || ''),
    resposta_html: String(data.resposta_html || ''),
    resposta_texto: String(data.resposta_texto || extractPlainText(String(data.resposta_html || ''))),
    categoria_id: catId,
    categoria_nome: catNameMap?.get(catId) || String(data.categoria_nome || ''),
    palavras_chave: Array.isArray(data.palavras_chave) ? data.palavras_chave.map(String) : [],
    anexos: Array.isArray(data.anexos) ? data.anexos : [],
    estado: (data.estado || 'rascunho') as FaqEstado,
    prioridade: Number(data.prioridade ?? 50),
    visibilidade: (data.visibilidade || 'todos') as FaqVisibilidade,
    utilizavel_ia: Boolean(data.utilizavel_ia),
    visualizacoes: Number(data.visualizacoes ?? 0),
    autor_id: String(data.autor_id || ''),
    autor_nome: String(data.autor_nome || ''),
    autor_email: String(data.autor_email || ''),
    publicado_em: data.publicado_em || null,
    historico_alteracoes: Array.isArray(data.historico_alteracoes) ? data.historico_alteracoes : [],
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    updated_by: String(data.updated_by || ''),
  };
}

function matchesSearchQuery(article: FaqArticle, rawQuery: string): boolean {
  const q = normalizeTextForSearch(rawQuery);
  if (!q) return true;
  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = normalizeTextForSearch(
    [
      article.titulo,
      article.pergunta || '',
      article.resposta_texto,
      article.categoria_nome || '',
      ...(article.palavras_chave || []),
    ].join(' ')
  );
  return terms.every((term) => haystack.includes(term));
}

export async function listFaqArticles(params?: {
  tenantId?: string;
  q?: string;
  categoria_id?: string;
  estado?: FaqEstado | 'todos';
  tipo?: FaqTipo | 'todos';
  visibilidade?: FaqVisibilidade | 'todas';
  utilizavel_ia?: 'true' | 'false' | 'todos';
  page?: number;
  pageSize?: number;
}): Promise<{
  items: FaqArticle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const db = getFirestoreInstance();
  const [artSnap, catSnap] = await Promise.all([
    db.collection(FAQ_ARTICLES_COL).get(),
    db.collection(FAQ_CATEGORIES_COL).get(),
  ]);

  const catNameMap = new Map<string, string>();
  for (const c of catSnap.docs) {
    catNameMap.set(c.id, String(c.data()?.nome || ''));
  }

  let items = artSnap.docs.map((d: any) => mapDocToArticle(d.id, d.data() || {}, catNameMap));

  if (params?.tenantId && params.tenantId.trim()) {
    const t = params.tenantId.trim();
    items = items.filter((item) => item.tenant_id === t || item.tenant_id === 'global');
  }
  if (params?.categoria_id && params.categoria_id !== 'todas') {
    items = items.filter((item) => item.categoria_id === params.categoria_id);
  }
  if (params?.estado && params.estado !== 'todos') {
    items = items.filter((item) => item.estado === params.estado);
  }
  if (params?.tipo && params.tipo !== 'todos') {
    items = items.filter((item) => item.tipo === params.tipo);
  }
  if (params?.visibilidade && params.visibilidade !== 'todas') {
    items = items.filter((item) => item.visibilidade === params.visibilidade);
  }
  if (params?.utilizavel_ia === 'true') {
    items = items.filter((item) => item.utilizavel_ia === true);
  } else if (params?.utilizavel_ia === 'false') {
    items = items.filter((item) => item.utilizavel_ia === false);
  }
  if (params?.q && params.q.trim()) {
    items = items.filter((item) => matchesSearchQuery(item, params.q!));
  }

  items.sort((a, b) => {
    if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });

  const total = items.length;
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 12)));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(params?.page || 1)));
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getFaqArticleById(id: string): Promise<FaqArticle | null> {
  const db = getFirestoreInstance();
  const snap = await db.collection(FAQ_ARTICLES_COL).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  let catNome = String(data.categoria_nome || '');
  if (data.categoria_id) {
    const catSnap = await db.collection(FAQ_CATEGORIES_COL).doc(String(data.categoria_id)).get();
    if (catSnap.exists) {
      catNome = String(catSnap.data()?.nome || catNome);
    }
  }
  const map = new Map<string, string>();
  if (data.categoria_id && catNome) map.set(String(data.categoria_id), catNome);
  return mapDocToArticle(snap.id, data, map);
}

export async function createFaqArticle(
  input: {
    tenant_id: string;
    tipo: FaqTipo;
    titulo: string;
    pergunta?: string;
    resposta_html: string;
    categoria_id: string;
    palavras_chave: string[];
    anexos: FaqAttachment[];
    estado: FaqEstado;
    prioridade: number;
    visibilidade: FaqVisibilidade;
    utilizavel_ia: boolean;
    idempotencyKey?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ article: FaqArticle; idempotent: boolean }> {
  const idem = await getIdempotentResult<FaqArticle>('faq_art_create', input.idempotencyKey);
  if (idem.hit && idem.data) {
    return { article: idem.data, idempotent: true };
  }

  const db = getFirestoreInstance();
  const catSnap = await db.collection(FAQ_CATEGORIES_COL).doc(input.categoria_id).get();
  if (!catSnap.exists) {
    throw new Error('Categoria selecionada não existe.');
  }
  const catData = catSnap.data() || {};

  const sanitizedHtml = sanitizeRichTextHtml(input.resposta_html);
  const plainText = extractPlainText(sanitizedHtml);
  if (!plainText) {
    throw new Error('A resposta não contém texto válido após sanitização.');
  }

  const id = `faqart_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const cleanKeywords = Array.from(
    new Set((input.palavras_chave || []).map((k) => k.trim()).filter(Boolean))
  ).slice(0, 20);

  const actorDisplay = actor.email ? actor.email.split('@')[0] : actor.uid;
  const initialHistory: FaqChangeHistoryEntry = {
    id: `hist_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
    autor_id: actor.uid,
    autor_nome: actorDisplay,
    autor_email: actor.email || '',
    data: nowIso,
    acao: 'criacao',
    resumo: `Item criado no estado "${input.estado}"`,
    alteracoes: [
      { campo: 'estado', antes: null, depois: input.estado },
      { campo: 'visibilidade', antes: null, depois: input.visibilidade },
      { campo: 'utilizavel_ia', antes: null, depois: Boolean(input.utilizavel_ia) },
    ],
  };

  const article: FaqArticle = {
    id,
    tenant_id: input.tenant_id || 'global',
    tipo: input.tipo || 'faq',
    titulo: input.titulo.trim(),
    pergunta: (input.pergunta || input.titulo).trim(),
    resposta_html: sanitizedHtml,
    resposta_texto: plainText,
    categoria_id: input.categoria_id,
    categoria_nome: String(catData.nome || ''),
    palavras_chave: cleanKeywords,
    anexos: input.anexos || [],
    estado: input.estado || 'rascunho',
    prioridade: Number(input.prioridade ?? 50),
    visibilidade: input.visibilidade || 'todos',
    utilizavel_ia: Boolean(input.utilizavel_ia),
    visualizacoes: 0,
    autor_id: actor.uid,
    autor_nome: actorDisplay,
    autor_email: actor.email || '',
    publicado_em: input.estado === 'publicado' ? nowIso : null,
    historico_alteracoes: [initialHistory],
    created_at: nowIso,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await db.collection(FAQ_ARTICLES_COL).doc(id).set(article);
  await saveIdempotentResult('faq_art_create', input.idempotencyKey, article);

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'create',
    entity: 'faq_article',
    entity_id: id,
    tenant_id: article.tenant_id,
    after_state: {
      id: article.id,
      titulo: article.titulo,
      tipo: article.tipo,
      categoria_id: article.categoria_id,
      estado: article.estado,
      visibilidade: article.visibilidade,
      utilizavel_ia: article.utilizavel_ia,
    },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return { article, idempotent: false };
}

export async function updateFaqArticle(
  id: string,
  input: {
    tipo?: FaqTipo;
    titulo?: string;
    pergunta?: string;
    resposta_html?: string;
    categoria_id?: string;
    palavras_chave?: string[];
    anexos?: FaqAttachment[];
    estado?: FaqEstado;
    prioridade?: number;
    visibilidade?: FaqVisibilidade;
    utilizavel_ia?: boolean;
    nota_alteracao?: string;
  },
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<FaqArticle | null> {
  const db = getFirestoreInstance();
  const ref = db.collection(FAQ_ARTICLES_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const before = mapDocToArticle(snap.id, snap.data() || {});
  let nextCategoryName = before.categoria_nome || '';

  if (input.categoria_id && input.categoria_id !== before.categoria_id) {
    const catSnap = await db.collection(FAQ_CATEGORIES_COL).doc(input.categoria_id).get();
    if (!catSnap.exists) {
      throw new Error('Categoria selecionada não existe.');
    }
    nextCategoryName = String(catSnap.data()?.nome || '');
  }

  let nextHtml = before.resposta_html;
  let nextText = before.resposta_texto;
  if (input.resposta_html !== undefined) {
    nextHtml = sanitizeRichTextHtml(input.resposta_html);
    nextText = extractPlainText(nextHtml);
    if (!nextText) {
      throw new Error('A resposta não contém texto válido após sanitização.');
    }
  }

  const nextKeywords =
    input.palavras_chave !== undefined
      ? Array.from(new Set(input.palavras_chave.map((k) => k.trim()).filter(Boolean))).slice(0, 20)
      : before.palavras_chave;

  const diffs: FaqChangeHistoryDiff[] = [];
  if (input.tipo !== undefined && input.tipo !== before.tipo) {
    diffs.push({ campo: 'tipo', antes: before.tipo, depois: input.tipo });
  }
  if (input.titulo !== undefined && input.titulo.trim() !== before.titulo) {
    diffs.push({ campo: 'titulo', antes: before.titulo, depois: input.titulo.trim() });
  }
  if (input.categoria_id !== undefined && input.categoria_id !== before.categoria_id) {
    diffs.push({ campo: 'categoria', antes: before.categoria_nome || before.categoria_id, depois: nextCategoryName || input.categoria_id });
  }
  if (input.resposta_html !== undefined && nextHtml !== before.resposta_html) {
    diffs.push({ campo: 'resposta', antes: before.resposta_texto.slice(0, 120), depois: nextText.slice(0, 120) });
  }
  if (input.palavras_chave !== undefined && JSON.stringify(nextKeywords) !== JSON.stringify(before.palavras_chave)) {
    diffs.push({ campo: 'palavras_chave', antes: before.palavras_chave, depois: nextKeywords });
  }
  if (input.anexos !== undefined && JSON.stringify(input.anexos) !== JSON.stringify(before.anexos)) {
    diffs.push({ campo: 'anexos', antes: `${before.anexos.length} anexo(s)`, depois: `${input.anexos.length} anexo(s)` });
  }
  if (input.estado !== undefined && input.estado !== before.estado) {
    diffs.push({ campo: 'estado', antes: before.estado, depois: input.estado });
  }
  if (input.prioridade !== undefined && Number(input.prioridade) !== before.prioridade) {
    diffs.push({ campo: 'prioridade', antes: before.prioridade, depois: Number(input.prioridade) });
  }
  if (input.visibilidade !== undefined && input.visibilidade !== before.visibilidade) {
    diffs.push({ campo: 'visibilidade', antes: before.visibilidade, depois: input.visibilidade });
  }
  if (input.utilizavel_ia !== undefined && Boolean(input.utilizavel_ia) !== before.utilizavel_ia) {
    diffs.push({ campo: 'utilizavel_ia', antes: before.utilizavel_ia, depois: Boolean(input.utilizavel_ia) });
  }

  const nowIso = new Date().toISOString();
  const actorDisplay = actor.email ? actor.email.split('@')[0] : actor.uid;
  const nextEstado = input.estado || before.estado;
  const onlyStatusChanged = diffs.length === 1 && diffs[0].campo === 'estado';

  const historyEntry: FaqChangeHistoryEntry = {
    id: `hist_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
    autor_id: actor.uid,
    autor_nome: actorDisplay,
    autor_email: actor.email || '',
    data: nowIso,
    acao: onlyStatusChanged ? 'estado' : 'edicao',
    resumo:
      input.nota_alteracao?.trim() ||
      (diffs.length > 0
        ? `Alterados os campos: ${diffs.map((d) => d.campo).join(', ')}`
        : 'Actualização de metadados'),
    alteracoes: diffs,
  };

  const nextHistory = [historyEntry, ...(before.historico_alteracoes || [])].slice(0, 50);

  const updated: FaqArticle = {
    ...before,
    id,
    tipo: input.tipo || before.tipo,
    titulo: input.titulo !== undefined ? input.titulo.trim() : before.titulo,
    pergunta:
      input.pergunta !== undefined
        ? input.pergunta.trim()
        : input.titulo !== undefined
        ? input.titulo.trim()
        : before.pergunta,
    resposta_html: nextHtml,
    resposta_texto: nextText,
    categoria_id: input.categoria_id || before.categoria_id,
    categoria_nome: nextCategoryName,
    palavras_chave: nextKeywords,
    anexos: input.anexos !== undefined ? input.anexos : before.anexos,
    estado: nextEstado,
    prioridade: input.prioridade !== undefined ? Number(input.prioridade) : before.prioridade,
    visibilidade: input.visibilidade || before.visibilidade,
    utilizavel_ia: input.utilizavel_ia !== undefined ? Boolean(input.utilizavel_ia) : before.utilizavel_ia,
    publicado_em:
      nextEstado === 'publicado' && !before.publicado_em
        ? nowIso
        : nextEstado === 'publicado'
        ? before.publicado_em
        : before.publicado_em,
    historico_alteracoes: nextHistory,
    updated_at: nowIso,
    updated_by: actor.email || actor.uid,
  };

  await ref.set(updated, { merge: true });

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: onlyStatusChanged ? 'status_change' : 'update',
    entity: 'faq_article',
    entity_id: id,
    tenant_id: updated.tenant_id,
    before_state: { estado: before.estado, titulo: before.titulo, visibilidade: before.visibilidade, utilizavel_ia: before.utilizavel_ia },
    after_state: { estado: updated.estado, titulo: updated.titulo, visibilidade: updated.visibilidade, utilizavel_ia: updated.utilizavel_ia, diffs },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return updated;
}

export async function deleteFaqArticle(
  id: string,
  actor: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<boolean> {
  const db = getFirestoreInstance();
  const ref = db.collection(FAQ_ARTICLES_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const before = mapDocToArticle(snap.id, snap.data() || {});
  await ref.delete();

  await recordAuditLog({
    actor_id: actor.uid,
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'delete',
    entity: 'faq_article',
    entity_id: id,
    tenant_id: before.tenant_id || 'global',
    before_state: { id: before.id, titulo: before.titulo, categoria_id: before.categoria_id, estado: before.estado },
    ip: meta?.ip,
    user_agent: meta?.userAgent,
  });

  return true;
}

// ============================================================================
// VISÃO GERAL & CONTAGENS REAIS
// ============================================================================

export async function getFaqOverview(tenantId?: string): Promise<FaqOverviewStats> {
  const db = getFirestoreInstance();
  const [catSnap, artSnap] = await Promise.all([
    db.collection(FAQ_CATEGORIES_COL).get(),
    db.collection(FAQ_ARTICLES_COL).get(),
  ]);

  const categories = catSnap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((c: any) => !tenantId || c.tenant_id === tenantId || c.tenant_id === 'global');

  const catNameMap = new Map<string, string>();
  for (const c of categories) {
    catNameMap.set(c.id, String(c.nome || ''));
  }

  const articles = artSnap.docs
    .map((d: any) => mapDocToArticle(d.id, d.data() || {}, catNameMap))
    .filter((a: FaqArticle) => !tenantId || a.tenant_id === tenantId || a.tenant_id === 'global');

  const byCatStats = new Map<string, { categoria_id: string; nome: string; total: number; publicadas: number; visualizacoes: number }>();
  for (const c of categories) {
    byCatStats.set(c.id, {
      categoria_id: c.id,
      nome: String(c.nome || ''),
      total: 0,
      publicadas: 0,
      visualizacoes: 0,
    });
  }

  let publicadas = 0;
  let rascunhos = 0;
  let despublicadas = 0;
  let arquivadas = 0;
  let utilizavelIa = 0;
  let totalVisualizacoes = 0;
  let totalFaqs = 0;
  let totalArtigosTutoriais = 0;

  for (const a of articles) {
    if (a.tipo === 'artigo_tutorial') totalArtigosTutoriais += 1;
    else totalFaqs += 1;

    if (a.estado === 'publicado') publicadas += 1;
    else if (a.estado === 'rascunho') rascunhos += 1;
    else if (a.estado === 'despublicado') despublicadas += 1;
    else if (a.estado === 'arquivado') arquivadas += 1;

    if (a.utilizavel_ia) utilizavelIa += 1;
    totalVisualizacoes += Number(a.visualizacoes || 0);

    const catBucket = byCatStats.get(a.categoria_id) || {
      categoria_id: a.categoria_id || 'sem_categoria',
      nome: a.categoria_nome || 'Sem categoria',
      total: 0,
      publicadas: 0,
      visualizacoes: 0,
    };
    catBucket.total += 1;
    if (a.estado === 'publicado') catBucket.publicadas += 1;
    catBucket.visualizacoes += Number(a.visualizacoes || 0);
    byCatStats.set(catBucket.categoria_id, catBucket);
  }

  const topArtigos = [...articles]
    .sort((a, b) => b.visualizacoes - a.visualizacoes || b.prioridade - a.prioridade)
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      titulo: a.titulo,
      categoria_nome: a.categoria_nome || 'Sem categoria',
      visualizacoes: a.visualizacoes,
      tipo: a.tipo,
      utilizavel_ia: a.utilizavel_ia,
    }));

  const porCategoria = Array.from(byCatStats.values()).sort((a, b) => b.total - a.total);

  return {
    totalPerguntas: articles.length,
    totalFaqs,
    totalArtigosTutoriais,
    totalCategorias: categories.length,
    categoriasAtivas: categories.filter((c: any) => c.ativo !== false).length,
    publicadas,
    rascunhos,
    despublicadas,
    arquivadas,
    utilizavelIa,
    totalVisualizacoes,
    topArtigos,
    porCategoria,
  };
}

// ============================================================================
// CONSULTA PÚBLICA (PORTAL DO UTILIZADOR COM ISOLAMENTO E VISIBILIDADE)
// ============================================================================

export async function listPublicFaqCategories(caller?: AuthenticatedUser): Promise<FaqCategory[]> {
  const db = getFirestoreInstance();
  const [catSnap, artSnap] = await Promise.all([
    db.collection(FAQ_CATEGORIES_COL).get(),
    db.collection(FAQ_ARTICLES_COL).get(),
  ]);

  const tenantFilter = caller?.tenant_id;
  const role = caller?.role;

  // Count only published articles visible to this caller per category
  const visibleCountByCat = new Map<string, number>();
  for (const d of artSnap.docs) {
    const a = d.data() || {};
    if (a.estado !== 'publicado') continue;
    const aTenant = String(a.tenant_id || 'global');
    if (aTenant !== 'global' && (!tenantFilter || aTenant !== tenantFilter) && !isSuperAdminRole(role)) continue;
    if (!canRoleViewArticle((a.visibilidade || 'todos') as FaqVisibilidade, role)) continue;
    const cid = String(a.categoria_id || '');
    visibleCountByCat.set(cid, (visibleCountByCat.get(cid) || 0) + 1);
  }

  const result: FaqCategory[] = [];
  for (const d of catSnap.docs) {
    const c = d.data() || {};
    if (c.ativo === false) continue;
    const cTenant = String(c.tenant_id || 'global');
    if (cTenant !== 'global' && (!tenantFilter || cTenant !== tenantFilter) && !isSuperAdminRole(role)) continue;
    const vis = (c.visibilidade_padrao || 'todos') as FaqVisibilidade;
    if (!canRoleViewArticle(vis, role) && (visibleCountByCat.get(d.id) || 0) === 0) continue;

    const count = visibleCountByCat.get(d.id) || 0;
    if (count === 0) continue;

    result.push({
      id: d.id,
      tenant_id: cTenant,
      nome: String(c.nome || ''),
      slug: String(c.slug || slugify(c.nome || d.id)),
      descricao: String(c.descricao || ''),
      ordem: Number(c.ordem ?? 0),
      ativo: true,
      visibilidade_padrao: vis,
      artigos_count: count,
      created_at: String(c.created_at || ''),
      updated_at: String(c.updated_at || ''),
      created_by: String(c.created_by || ''),
      updated_by: String(c.updated_by || ''),
    });
  }

  result.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
  return result;
}

export async function listPublicFaqArticles(params: {
  caller?: AuthenticatedUser;
  q?: string;
  categoria_id?: string;
  tipo?: FaqTipo | 'todos';
  page?: number;
  pageSize?: number;
}): Promise<{
  items: Omit<FaqArticle, 'historico_alteracoes' | 'autor_id' | 'autor_email' | 'updated_by'>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const db = getFirestoreInstance();
  const [artSnap, catSnap] = await Promise.all([
    db.collection(FAQ_ARTICLES_COL).get(),
    db.collection(FAQ_CATEGORIES_COL).get(),
  ]);

  const activeCategoryMap = new Map<string, string>();
  for (const d of catSnap.docs) {
    const c = d.data() || {};
    if (c.ativo !== false) {
      activeCategoryMap.set(d.id, String(c.nome || ''));
    }
  }

  const callerTenant = params.caller?.tenant_id;
  const callerRole = params.caller?.role;

  let eligible = artSnap.docs
    .map((d: any) => mapDocToArticle(d.id, d.data() || {}, activeCategoryMap))
    .filter((a: FaqArticle) => {
      if (a.estado !== 'publicado') return false;
      if (a.categoria_id && !activeCategoryMap.has(a.categoria_id)) return false;
      if (a.tenant_id !== 'global' && (!callerTenant || a.tenant_id !== callerTenant) && !isSuperAdminRole(callerRole)) {
        return false;
      }
      return canRoleViewArticle(a.visibilidade, callerRole);
    });

  if (params.categoria_id && params.categoria_id !== 'todas') {
    eligible = eligible.filter((a) => a.categoria_id === params.categoria_id);
  }
  if (params.tipo && params.tipo !== 'todos') {
    eligible = eligible.filter((a) => a.tipo === params.tipo);
  }
  if (params.q && params.q.trim()) {
    eligible = eligible.filter((a) => matchesSearchQuery(a, params.q!));
  }

  eligible.sort((a, b) => {
    if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
    return b.visualizacoes - a.visualizacoes;
  });

  const total = eligible.length;
  const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 12)));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(params.page || 1)));
  const offset = (page - 1) * pageSize;

  const sanitizedItems = eligible.slice(offset, offset + pageSize).map((item) => ({
    id: item.id,
    tenant_id: item.tenant_id,
    tipo: item.tipo,
    titulo: item.titulo,
    pergunta: item.pergunta,
    resposta_html: item.resposta_html,
    resposta_texto: item.resposta_texto,
    categoria_id: item.categoria_id,
    categoria_nome: item.categoria_nome,
    palavras_chave: item.palavras_chave,
    anexos: item.anexos,
    estado: item.estado,
    prioridade: item.prioridade,
    visibilidade: item.visibilidade,
    utilizavel_ia: item.utilizavel_ia,
    visualizacoes: item.visualizacoes,
    autor_nome: item.autor_nome,
    publicado_em: item.publicado_em,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  return {
    items: sanitizedItems,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function incrementPublicFaqView(
  articleId: string,
  caller?: AuthenticatedUser
): Promise<{ counted: boolean; visualizacoes?: number }> {
  const db = getFirestoreInstance();
  const ref = db.collection(FAQ_ARTICLES_COL).doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { counted: false };

  const a = mapDocToArticle(snap.id, snap.data() || {});
  if (a.estado !== 'publicado') return { counted: false };
  if (a.tenant_id !== 'global' && (!caller?.tenant_id || a.tenant_id !== caller.tenant_id) && !isSuperAdminRole(caller?.role)) {
    return { counted: false };
  }
  if (!canRoleViewArticle(a.visibilidade, caller?.role)) {
    return { counted: false };
  }

  const nextViews = Number(a.visualizacoes || 0) + 1;
  await ref.update({ visualizacoes: nextViews });
  return { counted: true, visualizacoes: nextViews };
}
