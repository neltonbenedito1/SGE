/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP de Agentes de IA & Motor Automatizado (Fase 4)
 * - /api/superadmin/assistant/ai-agents* : CRUD, Sandbox e Acionamento em Tickets (RBAC configurar_ia / responder)
 * - /api/webhooks/n8n/support-reply      : Callback assinado via HMAC-SHA256 / segredo do servidor
 */

import { Express, NextFunction, Request, Response } from 'express';
import { requireSupportPermission } from '../middleware/supportAuth';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { verifyCsrfToken } from '../security/authManager';
import {
  N8nInboundSupportReplySchema,
  SupportAiAgentCreateSchema,
  SupportAiAgentUpdateSchema,
  SupportAiSandboxTestSchema,
  SupportAiTicketRespondSchema,
} from '../../src/shared/schemas';
import {
  createSupportAiAgent,
  deleteSupportAiAgent,
  getSupportAiAgentById,
  handleN8nInboundReply,
  listSupportAiAgents,
  runSupportAiForTicket,
  SupportAiError,
  testSupportAiSandbox,
  updateSupportAiAgent,
  verifyN8nWebhookRequest,
} from '../services/supportAiService';
import type { SupportAgentStatus } from '../../src/types';

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

function handleAiRouteError(err: any, res: Response, fallbackMsg: string) {
  if (err instanceof SupportAiError) {
    return res.status(err.httpStatus).json({ code: err.code, error: err.message });
  }
  return res.status(400).json({ error: err?.message || fallbackMsg });
}

export function registerSupportAiRoutes(app: Express): void {
  const aiLimiter = createTenantRateLimiter('ai');
  const writeLimiter = createTenantRateLimiter('api');

  app.get(
    '/api/superadmin/assistant/ai-agents',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        const tenantParam = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const staffTenant =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : tenantParam;

        const data = await listSupportAiAgents({
          tenantId: staffTenant,
          estado: (req.query.estado as SupportAgentStatus | 'todos') || 'todos',
          departamento_id: typeof req.query.departamento_id === 'string' ? req.query.departamento_id : 'todos',
          q: typeof req.query.q === 'string' ? req.query.q : '',
        });
        return res.json(data);
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao listar agentes IA.');
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/ai-agents/:id',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const item = await getSupportAiAgentById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Agente IA não encontrado.' });
        return res.json({ item });
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao carregar agente IA.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/ai-agents',
    requireSupportPermission('configurar_ia'),
    enforceCsrfForSessionCookie,
    writeLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAiAgentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para criação do agente IA.',
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

        const created = await createSupportAiAgent(
          {
            ...parsed.data,
            tenant_id: tenantTarget,
            idempotencyKey: parsed.data.idempotencyKey || headerIdem,
          },
          ctx.caller,
          getClientMeta(req)
        );
        return res.status(created.idempotent ? 200 : 201).json(created);
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao criar agente IA.');
      }
    }
  );

  app.put(
    '/api/superadmin/assistant/ai-agents/:id',
    requireSupportPermission('configurar_ia'),
    enforceCsrfForSessionCookie,
    writeLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAiAgentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para actualizar agente IA.',
          issues: parsed.error.issues,
        });
      }
      try {
        const updated = await updateSupportAiAgent(req.params.id, parsed.data, req.supportContext!.caller, getClientMeta(req));
        if (!updated) return res.status(404).json({ error: 'Agente IA não encontrado.' });
        return res.json({ item: updated });
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao actualizar agente IA.');
      }
    }
  );

  app.delete(
    '/api/superadmin/assistant/ai-agents/:id',
    requireSupportPermission('configurar_ia'),
    enforceCsrfForSessionCookie,
    writeLimiter,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const outcome = await deleteSupportAiAgent(req.params.id, req.supportContext!.caller, getClientMeta(req));
        if (!outcome.deleted) {
          return res.status(outcome.conflict ? 409 : 404).json({ error: outcome.error });
        }
        return res.json({ deleted: true });
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao eliminar agente IA.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/ai-agents/:id/test',
    requireSupportPermission('configurar_ia'),
    enforceCsrfForSessionCookie,
    aiLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAiSandboxTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Parâmetros de teste inválidos.',
          issues: parsed.error.issues,
        });
      }
      try {
        const result = await testSupportAiSandbox(req.params.id, parsed.data);
        if (!result) return res.status(404).json({ error: 'Agente IA não encontrado.' });
        return res.json({ result });
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao executar teste do agente IA.');
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/tickets/:ticketId/ai-respond',
    requireSupportPermission('responder'),
    enforceCsrfForSessionCookie,
    aiLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAiTicketRespondSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos.',
          issues: parsed.error.issues,
        });
      }
      try {
        const headerIdem =
          typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
        const result = await runSupportAiForTicket({
          ticketId: req.params.ticketId,
          agentId: parsed.data.agent_id,
          actor: req.supportContext!.caller,
          idempotencyKey: parsed.data.idempotencyKey || headerIdem,
        });
        if (!result) return res.status(404).json({ error: 'Ticket não encontrado.' });
        return res.json(result);
      } catch (err: any) {
        return handleAiRouteError(err, res, 'Erro ao executar resposta automática IA no ticket.');
      }
    }
  );

  app.post('/api/webhooks/n8n/support-reply', writeLimiter, async (req: Request, res: Response): Promise<any> => {
    const rawBody = (req as any).rawBody instanceof Buffer ? (req as any).rawBody : JSON.stringify(req.body || {});
    const authCheck = verifyN8nWebhookRequest({
      rawBody,
      signatureHeader: typeof req.headers['x-sge-signature'] === 'string' ? req.headers['x-sge-signature'] : undefined,
      bearerHeader: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      secretHeader: typeof req.headers['x-n8n-secret'] === 'string' ? req.headers['x-n8n-secret'] : undefined,
    });
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const parsed = N8nInboundSupportReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Payload do callback n8n inválido.',
        issues: parsed.error.issues,
      });
    }

    try {
      const headerIdem =
        typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
      const result = await handleN8nInboundReply({
        ...parsed.data,
        idempotencyKey: parsed.data.idempotencyKey || headerIdem,
      });
      if (!result) {
        return res.status(404).json({ error: 'Ticket ou Agente IA referenciado não encontrado.' });
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return handleAiRouteError(err, res, 'Erro ao processar callback do n8n.');
    }
  });
}
