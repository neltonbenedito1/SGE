/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP da Base de Conhecimento & FAQ (Fase 1)
 * - Endpoints administrativos (/api/superadmin/faq/*) protegidos com requireAuth + requireRole(['super_admin']) + CSRF + Rate Limiting
 * - Endpoints de consulta pública (/api/faq/public*) com isolamento multi-tenant e filtragem de visibilidade no servidor
 */

import { Express, Request, Response, NextFunction } from 'express';
import { optionalAuth } from '../middleware/auth';
import { requireSupportPermission } from '../middleware/supportAuth';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { verifyCsrfToken } from '../security/authManager';
import {
  FaqArticleCreateSchema,
  FaqArticleStatusSchema,
  FaqArticleUpdateSchema,
  FaqAttachmentUploadSchema,
  FaqCategoryCreateSchema,
  FaqCategoryUpdateSchema,
} from '../../src/shared/schemas';
import {
  createFaqArticle,
  createFaqCategory,
  deleteFaqArticle,
  deleteFaqCategory,
  getFaqArticleById,
  getFaqAttachmentForCaller,
  getFaqOverview,
  incrementPublicFaqView,
  listFaqArticles,
  listFaqCategories,
  listPublicFaqArticles,
  listPublicFaqCategories,
  updateFaqArticle,
  updateFaqCategory,
  uploadFaqAttachment,
} from '../services/faqService';
import type { FaqEstado, FaqTipo, FaqVisibilidade } from '../../src/types';

function enforceCsrfForSessionCookie(req: Request, res: Response, next: NextFunction): any {
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  const hasSessionCookie = Boolean(req.cookies?.sysedu_session_id);
  if (!hasBearer && hasSessionCookie) {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({
        code: 'csrf_invalid',
        error: 'Token CSRF ausente ou inválido para esta operação.',
      });
    }
  }
  return next();
}

function getClientMeta(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  };
}

export function registerFaqRoutes(app: Express): void {
  const faqWriteLimiter = createTenantRateLimiter('api');

  // ==========================================================================
  // SUPERADMIN — VISÃO GERAL & CONTAGENS REAIS
  // ==========================================================================
  app.get(
    '/api/superadmin/faq/overview',
    requireSupportPermission('gerir_faq'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const tenantId = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const overview = await getFaqOverview(tenantId);
        return res.json(overview);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar visão geral das FAQ.' });
      }
    }
  );

  // ==========================================================================
  // SUPERADMIN — CATEGORIAS CRUD
  // ==========================================================================
  app.get(
    '/api/superadmin/faq/categories',
    requireSupportPermission('gerir_faq'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const tenantId = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const includeInactive = req.query.includeInactive !== 'false';
        const categories = await listFaqCategories({ tenantId, includeInactive });
        return res.json({ categories });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao listar categorias FAQ.' });
      }
    }
  );

  app.post(
    '/api/superadmin/faq/categories',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqCategoryCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos para categoria.' });
        }
        const idempotencyKey = (req.headers['x-idempotency-key'] as string) || parsed.data.idempotencyKey;
        const { category, idempotent } = await createFaqCategory(
          { ...parsed.data, idempotencyKey },
          req.user!,
          getClientMeta(req)
        );
        return res.status(idempotent ? 200 : 201).json({ category, idempotent });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao criar categoria FAQ.' });
      }
    }
  );

  app.put(
    '/api/superadmin/faq/categories/:id',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqCategoryUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos para actualizar categoria.' });
        }
        const updated = await updateFaqCategory(req.params.id, parsed.data, req.user!, getClientMeta(req));
        if (!updated) {
          return res.status(404).json({ error: 'Categoria não encontrada.' });
        }
        return res.json({ category: updated });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao actualizar categoria FAQ.' });
      }
    }
  );

  app.delete(
    '/api/superadmin/faq/categories/:id',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await deleteFaqCategory(req.params.id, req.user!, getClientMeta(req));
        if (result.conflict) {
          return res.status(409).json({ error: result.error });
        }
        if (!result.deleted) {
          return res.status(404).json({ error: result.error || 'Categoria não encontrada.' });
        }
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao eliminar categoria FAQ.' });
      }
    }
  );

  // ==========================================================================
  // SUPERADMIN — ARTIGOS E PERGUNTAS FREQUENTES CRUD
  // ==========================================================================
  app.get(
    '/api/superadmin/faq/articles',
    requireSupportPermission('gerir_faq'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await listFaqArticles({
          tenantId: typeof req.query.tenant_id === 'string' ? req.query.tenant_id : undefined,
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          categoria_id: typeof req.query.categoria_id === 'string' ? req.query.categoria_id : undefined,
          estado: (typeof req.query.estado === 'string' ? req.query.estado : 'todos') as FaqEstado | 'todos',
          tipo: (typeof req.query.tipo === 'string' ? req.query.tipo : 'todos') as FaqTipo | 'todos',
          visibilidade: (typeof req.query.visibilidade === 'string' ? req.query.visibilidade : 'todas') as FaqVisibilidade | 'todas',
          utilizavel_ia: (typeof req.query.utilizavel_ia === 'string' ? req.query.utilizavel_ia : 'todos') as 'true' | 'false' | 'todos',
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 12),
        });
        return res.json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao listar artigos FAQ.' });
      }
    }
  );

  app.get(
    '/api/superadmin/faq/articles/:id',
    requireSupportPermission('gerir_faq'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const article = await getFaqArticleById(req.params.id);
        if (!article) {
          return res.status(404).json({ error: 'Artigo ou pergunta não encontrada.' });
        }
        return res.json({ article });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao consultar artigo FAQ.' });
      }
    }
  );

  app.post(
    '/api/superadmin/faq/articles',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqArticleCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos para artigo FAQ.' });
        }
        const idempotencyKey = (req.headers['x-idempotency-key'] as string) || parsed.data.idempotencyKey;
        const { article, idempotent } = await createFaqArticle(
          { ...parsed.data, idempotencyKey },
          req.user!,
          getClientMeta(req)
        );
        return res.status(idempotent ? 200 : 201).json({ article, idempotent });
      } catch (err: any) {
        const status = err.message?.includes('Categoria') || err.message?.includes('sanitização') ? 400 : 500;
        return res.status(status).json({ error: err.message || 'Erro ao criar artigo FAQ.' });
      }
    }
  );

  app.put(
    '/api/superadmin/faq/articles/:id',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqArticleUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos para actualizar artigo.' });
        }
        const updated = await updateFaqArticle(req.params.id, parsed.data, req.user!, getClientMeta(req));
        if (!updated) {
          return res.status(404).json({ error: 'Artigo ou pergunta não encontrada.' });
        }
        return res.json({ article: updated });
      } catch (err: any) {
        const status = err.message?.includes('Categoria') || err.message?.includes('sanitização') ? 400 : 500;
        return res.status(status).json({ error: err.message || 'Erro ao actualizar artigo FAQ.' });
      }
    }
  );

  app.patch(
    '/api/superadmin/faq/articles/:id/status',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqArticleStatusSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Estado inválido.' });
        }
        const updated = await updateFaqArticle(
          req.params.id,
          { estado: parsed.data.estado, nota_alteracao: parsed.data.nota_alteracao },
          req.user!,
          getClientMeta(req)
        );
        if (!updated) {
          return res.status(404).json({ error: 'Artigo ou pergunta não encontrada.' });
        }
        return res.json({ article: updated });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao alterar estado do artigo.' });
      }
    }
  );

  app.delete(
    '/api/superadmin/faq/articles/:id',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const deleted = await deleteFaqArticle(req.params.id, req.user!, getClientMeta(req));
        if (!deleted) {
          return res.status(404).json({ error: 'Artigo ou pergunta não encontrada.' });
        }
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao eliminar artigo FAQ.' });
      }
    }
  );

  // ==========================================================================
  // ANEXOS FAQ (UPLOAD ADMIN & DOWNLOAD PROTEGIDO)
  // ==========================================================================
  app.post(
    '/api/superadmin/faq/attachments',
    faqWriteLimiter,
    requireSupportPermission('gerir_faq'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const parsed = FaqAttachmentUploadSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Ficheiro anexo inválido.' });
        }
        const idempotencyKey = (req.headers['x-idempotency-key'] as string) || parsed.data.idempotencyKey;
        const tenantId = typeof req.body?.tenant_id === 'string' ? req.body.tenant_id : 'global';
        const { attachment, idempotent } = await uploadFaqAttachment(
          { ...parsed.data, tenant_id: tenantId, idempotencyKey },
          req.user!,
          getClientMeta(req)
        );
        return res.status(idempotent ? 200 : 201).json({ attachment, idempotent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao validar e gravar anexo.' });
      }
    }
  );

  app.get('/api/faq/attachments/:id', optionalAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const result = await getFaqAttachmentForCaller(req.params.id, req.user);
      if (!result.found) {
        return res.status(404).json({ error: 'Anexo não encontrado.' });
      }
      if (result.forbidden) {
        return res.status(403).json({ error: 'Sem permissão para visualizar este anexo.' });
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(result.nome || 'anexo')}"`
      );
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(result.buffer);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao servir anexo.' });
    }
  });

  // ==========================================================================
  // CONSULTA PÚBLICA DE FAQ NO PORTAL DO UTILIZADOR
  // ==========================================================================
  app.get('/api/faq/public/categories', optionalAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const categories = await listPublicFaqCategories(req.user);
      return res.json({ categories });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao consultar categorias FAQ.' });
    }
  });

  app.get('/api/faq/public', optionalAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const result = await listPublicFaqArticles({
        caller: req.user,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        categoria_id: typeof req.query.categoria_id === 'string' ? req.query.categoria_id : undefined,
        tipo: (typeof req.query.tipo === 'string' ? req.query.tipo : 'todos') as FaqTipo | 'todos',
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 12),
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao consultar FAQ públicas.' });
    }
  });

  app.post('/api/faq/public/:id/view', optionalAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const result = await incrementPublicFaqView(req.params.id, req.user);
      if (!result.counted) {
        return res.status(404).json({ error: 'Artigo não disponível para contabilização.' });
      }
      return res.json({ success: true, visualizacoes: result.visualizacoes });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao registar leitura.' });
    }
  });
}
