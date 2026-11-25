/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP da Central de Atendimento / Tickets e Portal do Utilizador (Fase 3)
 * - /api/superadmin/assistant/tickets* : Inbox de Suporte & Superadmin (RBAC + Escopo)
 * - /api/support/* : Portal do Utilizador autenticado (Isolado por tenant_id e solicitante)
 */

import { Express, NextFunction, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { resolveSupportContextForUser, requireSupportPermission } from '../middleware/supportAuth';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { verifyCsrfToken } from '../security/authManager';
import {
  SupportAttachmentUploadSchema,
  SupportTicketCreateAdminSchema,
  SupportTicketCreatePortalSchema,
  SupportTicketRatingSchema,
  SupportTicketReplySchema,
  SupportTicketStatusUpdateSchema,
  SupportTicketTransferSchema,
} from '../../src/shared/schemas';
import {
  addSupportTicketMessage,
  createSupportTicket,
  getSupportAttachmentForCaller,
  getSupportPortalMeta,
  getSupportTicketDetail,
  listPortalTicketsForUser,
  listSupportTicketsForAdmin,
  submitSupportTicketRating,
  transferSupportTicket,
  updateSupportTicketStatus,
  uploadSupportAttachment,
} from '../services/supportTicketService';
import type { SupportTicketPriority, SupportTicketStatus } from '../../src/types';

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

function handleTicketError(err: any, res: Response, fallbackMsg: string) {
  const msg = String(err?.message || '');
  if (msg === 'FORBIDDEN_TICKET_SCOPE' || msg === 'FORBIDDEN_ATTACHMENT') {
    return res.status(403).json({
      code: 'forbidden_ticket_scope',
      error: 'Acesso negado a esta solicitação.',
    });
  }
  if (msg === 'FORBIDDEN_CLOSE_PERMISSION') {
    return res.status(403).json({
      code: 'missing_close_permission',
      error: 'Falta permissão para encerrar solicitações no seu perfil de atendimento.',
    });
  }
  if (msg === 'FORBIDDEN_STATUS_TRANSITION') {
    return res.status(403).json({
      code: 'forbidden_status_transition',
      error: 'Transição de estado não autorizada para este perfil.',
    });
  }
  return res.status(400).json({ error: msg || fallbackMsg });
}

export function registerSupportTicketRoutes(app: Express): void {
  const ticketWriteLimiter = createTenantRateLimiter('api');

  // ==========================================================================
  // ROTAS ADMIN / EQUIPA DE SUPORTE (/api/superadmin/assistant/tickets*)
  // ==========================================================================

  app.get(
    '/api/superadmin/assistant/tickets',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        const tenantParam = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const staffTenant =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : tenantParam;

        const data = await listSupportTicketsForAdmin(ctx, {
          tenant_id: staffTenant,
          estado: (req.query.estado as SupportTicketStatus | 'todos') || 'todos',
          prioridade: (req.query.prioridade as SupportTicketPriority | 'todas') || 'todas',
          departamento_id: typeof req.query.departamento_id === 'string' ? req.query.departamento_id : 'todos',
          responsavel_id: typeof req.query.responsavel_id === 'string' ? req.query.responsavel_id : 'todos',
          categoria: typeof req.query.categoria === 'string' ? req.query.categoria : 'todas',
          data_inicio: typeof req.query.data_inicio === 'string' ? req.query.data_inicio : undefined,
          data_fim: typeof req.query.data_fim === 'string' ? req.query.data_fim : undefined,
          apenas_alertas: req.query.apenas_alertas === 'true',
          q: typeof req.query.q === 'string' ? req.query.q : '',
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 20),
        });
        return res.json(data);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao carregar caixa de entrada de tickets.');
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/tickets/:id',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const detail = await getSupportTicketDetail({
          ticketId: req.params.id,
          caller: req.supportContext!.caller,
          supportContext: req.supportContext!,
        });
        if (!detail) {
          return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        return res.json(detail);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao carregar conversa do ticket.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/tickets',
    requireSupportPermission('responder'),
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketCreateAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para abertura de ticket.',
          issues: parsed.error.issues,
        });
      }
      try {
        const ctx = req.supportContext!;
        const headerIdem =
          typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
        const tenantTarget =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : parsed.data.tenant_id;

        const created = await createSupportTicket(
          {
            ...parsed.data,
            tenant_id: tenantTarget,
            canal: 'superadmin',
            idempotencyKey: parsed.data.idempotencyKey || headerIdem,
          },
          ctx.caller,
          getClientMeta(req)
        );
        return res.status(created.idempotent ? 200 : 201).json(created);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao criar ticket.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/tickets/:id/messages',
    requireSupportPermission('responder'),
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Conteúdo da mensagem inválido.',
          issues: parsed.error.issues,
        });
      }
      try {
        const ctx = req.supportContext!;
        const headerIdem =
          typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
        const result = await addSupportTicketMessage({
          ticketId: req.params.id,
          conteudo: parsed.data.conteudo,
          tipo: parsed.data.tipo,
          anexos: parsed.data.anexos,
          caller: ctx.caller,
          supportContext: ctx,
          idempotencyKey: parsed.data.idempotencyKey || headerIdem,
          meta: getClientMeta(req),
        });
        if (!result) {
          return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        return res.status(result.idempotent ? 200 : 201).json(result);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao enviar mensagem.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/tickets/:id/transfer',
    requireSupportPermission('transferir'),
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para transferência.',
          issues: parsed.error.issues,
        });
      }
      try {
        const result = await transferSupportTicket({
          ticketId: req.params.id,
          departamento_id: parsed.data.departamento_id,
          responsavel_id: parsed.data.responsavel_id,
          motivo: parsed.data.motivo,
          ctx: req.supportContext!,
          meta: getClientMeta(req),
        });
        if (!result) {
          return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        return res.json(result);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao transferir ticket.');
      }
    }
  );

  app.patch(
    '/api/superadmin/assistant/tickets/:id/status',
    requireSupportPermission('responder'),
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketStatusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Estado inválido.',
          issues: parsed.error.issues,
        });
      }
      try {
        const ctx = req.supportContext!;
        const ticket = await updateSupportTicketStatus({
          ticketId: req.params.id,
          estado: parsed.data.estado,
          motivo: parsed.data.motivo,
          caller: ctx.caller,
          supportContext: ctx,
          meta: getClientMeta(req),
        });
        if (!ticket) {
          return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        return res.json({ ticket });
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao actualizar estado do ticket.');
      }
    }
  );

  // ==========================================================================
  // ROTAS DO PORTAL DO UTILIZADOR (/api/support/*)
  // ==========================================================================

  app.get(
    '/api/support/meta',
    requireAuth,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const data = await getSupportPortalMeta(req.user?.tenant_id);
        return res.json(data);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar departamentos e categorias de suporte.' });
      }
    }
  );

  app.get(
    '/api/support/tickets',
    requireAuth,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const data = await listPortalTicketsForUser(req.user!, {
          estado: (req.query.estado as SupportTicketStatus | 'todos') || 'todos',
          scope: req.query.scope === 'tenant' ? 'tenant' : 'own',
          q: typeof req.query.q === 'string' ? req.query.q : '',
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 15),
        });
        return res.json(data);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao listar solicitações.');
      }
    }
  );

  app.post(
    '/api/support/tickets',
    requireAuth,
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketCreatePortalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para abertura da solicitação.',
          issues: parsed.error.issues,
        });
      }
      try {
        const headerIdem =
          typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
        const created = await createSupportTicket(
          {
            ...parsed.data,
            tenant_id: req.user!.tenant_id,
            canal: 'portal',
            idempotencyKey: parsed.data.idempotencyKey || headerIdem,
          },
          req.user!,
          getClientMeta(req)
        );
        return res.status(created.idempotent ? 200 : 201).json(created);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao abrir solicitação de suporte.');
      }
    }
  );

  app.get(
    '/api/support/tickets/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<any> => {
      try {
        // Note: explicitly pass supportContext = null so portal view NEVER leaks internal notes
        const detail = await getSupportTicketDetail({
          ticketId: req.params.id,
          caller: req.user!,
          supportContext: null,
        });
        if (!detail) {
          return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        return res.json(detail);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao carregar solicitação.');
      }
    }
  );

  app.post(
    '/api/support/tickets/:id/messages',
    requireAuth,
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Mensagem inválida.',
          issues: parsed.error.issues,
        });
      }
      try {
        const headerIdem =
          typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
        const result = await addSupportTicketMessage({
          ticketId: req.params.id,
          conteudo: parsed.data.conteudo,
          tipo: 'mensagem', // Portal users are strictly locked to public messages
          anexos: parsed.data.anexos,
          caller: req.user!,
          supportContext: null,
          idempotencyKey: parsed.data.idempotencyKey || headerIdem,
          meta: getClientMeta(req),
        });
        if (!result) {
          return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        return res.status(result.idempotent ? 200 : 201).json(result);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao enviar resposta.');
      }
    }
  );

  app.patch(
    '/api/support/tickets/:id/reopen',
    requireAuth,
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 500) : '';
        const ticket = await updateSupportTicketStatus({
          ticketId: req.params.id,
          estado: 'reaberto',
          motivo,
          caller: req.user!,
          supportContext: null,
          meta: getClientMeta(req),
        });
        if (!ticket) {
          return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        return res.json({ ticket });
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao reabrir solicitação.');
      }
    }
  );

  app.post(
    '/api/support/tickets/:id/rating',
    requireAuth,
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketRatingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Avaliação inválida (nota 1 a 5).',
          issues: parsed.error.issues,
        });
      }
      try {
        const result = await submitSupportTicketRating({
          ticketId: req.params.id,
          nota: parsed.data.nota,
          comentario: parsed.data.comentario,
          caller: req.user!,
        });
        if (!result) {
          return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        return res.status(201).json(result);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao registar avaliação.');
      }
    }
  );

  // ==========================================================================
  // UPLOAD & DOWNLOAD DE ANEXOS (AUTENTICADO + MAGIC BYTES)
  // ==========================================================================

  app.post(
    '/api/support/attachments',
    requireAuth,
    enforceCsrfForSessionCookie,
    ticketWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAttachmentUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Anexo inválido.',
          issues: parsed.error.issues,
        });
      }
      try {
        const attachment = await uploadSupportAttachment(parsed.data, req.user!);
        return res.status(201).json({ attachment });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao carregar anexo.' });
      }
    }
  );

  app.get(
    '/api/support/attachments/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const supportContext = await resolveSupportContextForUser(req.user!).catch(() => null);
        const file = await getSupportAttachmentForCaller(req.params.id, req.user!, supportContext);
        if (!file) {
          return res.status(404).json({ error: 'Anexo não encontrado.' });
        }
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.nome.replace(/"/g, '')}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.send(file.buffer);
      } catch (err: any) {
        return handleTicketError(err, res, 'Erro ao descarregar anexo.');
      }
    }
  );
}
