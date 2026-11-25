/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP da Distribuição Automática e Balanceamento (Fase 5)
 * - /api/superadmin/assistant/distribution/overview
 * - /api/superadmin/assistant/distribution/rules*
 * - /api/superadmin/assistant/distribution/simulate
 * - /api/superadmin/assistant/distribution/rebalance
 * - /api/superadmin/assistant/tickets/:ticketId/auto-distribute
 */

import { Express, NextFunction, Request, Response } from 'express';
import { requireSupportPermission } from '../middleware/supportAuth';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { verifyCsrfToken } from '../security/authManager';
import {
  SupportDistributionRebalanceSchema,
  SupportDistributionRuleCreateSchema,
  SupportDistributionRuleUpdateSchema,
  SupportDistributionSimulateSchema,
  SupportTicketAutoDistributeSchema,
} from '../../src/shared/schemas';
import {
  createDistributionRule,
  deleteDistributionRule,
  distributeTicketAutomatically,
  getDistributionOverview,
  getDistributionRuleById,
  listDistributionRules,
  rebalanceSupportQueues,
  simulateSupportDistribution,
  updateDistributionRule,
} from '../services/supportDistributionService';

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

export function registerSupportDistributionRoutes(app: Express): void {
  const distLimiter = createTenantRateLimiter('api');

  app.get(
    '/api/superadmin/assistant/distribution/overview',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        const tenantParam = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const staffTenant =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : tenantParam;

        const overview = await getDistributionOverview(staffTenant);
        return res.json(overview);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar visão geral de distribuição.' });
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/distribution/rules',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        const tenantParam = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
        const staffTenant =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : tenantParam;

        const rules = await listDistributionRules({
          tenant_id: staffTenant,
          ativo:
            req.query.ativo === 'true'
              ? true
              : req.query.ativo === 'false'
              ? false
              : undefined,
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
        });
        return res.json({ rules });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao listar regras de distribuição.' });
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/distribution/rules/:id',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const rule = await getDistributionRuleById(req.params.id);
        if (!rule) {
          return res.status(404).json({ error: 'Regra de distribuição não encontrada.' });
        }
        return res.json({ rule });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar regra.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/distribution/rules',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    distLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDistributionRuleCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para regra de distribuição.',
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

        const created = await createDistributionRule(
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
        return res.status(400).json({ error: err.message || 'Erro ao criar regra de distribuição.' });
      }
    }
  );

  app.put(
    '/api/superadmin/assistant/distribution/rules/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    distLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDistributionRuleUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos ao actualizar regra.',
          issues: parsed.error.issues,
        });
      }
      try {
        const updated = await updateDistributionRule(
          req.params.id,
          parsed.data,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!updated) {
          return res.status(404).json({ error: 'Regra de distribuição não encontrada.' });
        }
        return res.json({ rule: updated });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro ao actualizar regra.' });
      }
    }
  );

  app.delete(
    '/api/superadmin/assistant/distribution/rules/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    distLimiter,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await deleteDistributionRule(
          req.params.id,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!result.deleted) {
          return res.status(404).json({ error: result.error || 'Regra não encontrada.' });
        }
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro ao eliminar regra.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/distribution/simulate',
    requireSupportPermission('visualizar'),
    enforceCsrfForSessionCookie,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDistributionSimulateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para simulação.',
          issues: parsed.error.issues,
        });
      }
      try {
        const ctx = req.supportContext!;
        const tenantTarget =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : parsed.data.tenant_id;

        const simulation = await simulateSupportDistribution({
          ...parsed.data,
          tenant_id: tenantTarget,
        });
        return res.json(simulation);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro ao simular roteamento.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/distribution/rebalance',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    distLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDistributionRebalanceSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Parâmetros de balanceamento inválidos.',
          issues: parsed.error.issues,
        });
      }
      try {
        const ctx = req.supportContext!;
        const tenantTarget =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : parsed.data.tenant_id;

        const result = await rebalanceSupportQueues({
          tenant_id: tenantTarget,
          departamento_id: parsed.data.departamento_id,
          incluir_alertas_sla: parsed.data.incluir_alertas_sla,
          reatribuir_offline: parsed.data.reatribuir_offline,
          dry_run: parsed.data.dry_run,
          limite: parsed.data.limite,
          actor: ctx.caller,
          meta: getClientMeta(req),
        });
        return res.json(result);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro ao balancear filas de atendimento.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/tickets/:ticketId/auto-distribute',
    requireSupportPermission('transferir'),
    enforceCsrfForSessionCookie,
    distLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportTicketAutoDistributeSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Parâmetros inválidos para distribuição.',
          issues: parsed.error.issues,
        });
      }
      try {
        const result = await distributeTicketAutomatically({
          ticketId: req.params.ticketId,
          ruleId: parsed.data.rule_id,
          fallbackStrategy: parsed.data.metodo_alternativo || 'menor_carga',
          requireMatchedRule: false,
          actor: req.supportContext!.caller,
          meta: getClientMeta(req),
        });
        if (!result) {
          return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        return res.json(result);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro ao distribuir ticket automaticamente.' });
      }
    }
  );
}
