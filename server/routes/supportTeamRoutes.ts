/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP da Equipa de Atendimento, Departamentos e Permissões (Fase 2)
 * - Superadmin tem acesso total independentemente das permissões da matriz
 * - Funcionários humanos respeitam estado activo, permissões granulares e escopo de departamentos
 */

import { Express, Request, Response, NextFunction } from 'express';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { verifyCsrfToken } from '../security/authManager';
import {
  canAccessHistoryForAgent,
  requireSupportAccess,
  requireSupportPermission,
} from '../middleware/supportAuth';
import {
  SupportAgentAvailabilityPatchSchema,
  SupportAgentCreateSchema,
  SupportAgentStatusPatchSchema,
  SupportAgentUpdateSchema,
  SupportCredentialResetSchema,
  SupportDepartmentCreateSchema,
  SupportDepartmentUpdateSchema,
  SupportPermissionsUpdateSchema,
} from '../../src/shared/schemas';
import {
  createSupportAgent,
  createSupportDepartment,
  deleteSupportAgent,
  deleteSupportDepartment,
  getDefaultPermissionsForRole,
  getSupportAgentById,
  getSupportAgentHistory,
  getSupportAgentPermissions,
  getSupportTeamOverview,
  listSupportAgents,
  listSupportDepartments,
  resetSupportAgentCredentials,
  updateSupportAgent,
  updateSupportAgentAvailability,
  updateSupportAgentPermissions,
  updateSupportAgentStatus,
  updateSupportDepartment,
} from '../services/supportTeamService';
import type {
  SupportAgentRole,
  SupportAgentStatus,
  SupportAvailability,
} from '../../src/types';

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

function resolveTenantScope(req: Request): string | undefined {
  const ctx = req.supportContext;
  if (ctx && !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global') {
    return ctx.agent.tenant_id;
  }
  const q = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
  return q || undefined;
}

export function registerSupportTeamRoutes(app: Express): void {
  const supportWriteLimiter = createTenantRateLimiter('api');
  const credentialLimiter = createTenantRateLimiter('auth');

  // ==========================================================================
  // CONTEXTO DO UTILIZADOR AUTENTICADO (SUPERADMIN OU FUNCIONÁRIO DE SUPORTE)
  // ==========================================================================
  app.get(
    '/api/superadmin/assistant/me',
    requireSupportAccess,
    async (req: Request, res: Response): Promise<any> => {
      const ctx = req.supportContext!;
      return res.json({
        isSuperAdmin: ctx.isSuperAdmin,
        user: ctx.caller,
        agent: ctx.agent,
        permissions: ctx.permissions,
        authorizedDepartmentIds: ctx.authorizedDepartmentIds,
        roleDefaults: {
          assistente: getDefaultPermissionsForRole('assistente'),
          supervisor: getDefaultPermissionsForRole('supervisor'),
          administrador: getDefaultPermissionsForRole('administrador'),
        },
      });
    }
  );

  // ==========================================================================
  // VISÃO GERAL DA EQUIPA DE SUPORTE
  // ==========================================================================
  app.get(
    '/api/superadmin/assistant/overview',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const tenantId = resolveTenantScope(req);
        const overview = await getSupportTeamOverview(tenantId);
        return res.json(overview);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar visão geral da equipa.' });
      }
    }
  );

  // ==========================================================================
  // DEPARTAMENTOS / FILAS DE ATENDIMENTO
  // ==========================================================================
  app.get(
    '/api/superadmin/assistant/departments',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const tenantId = resolveTenantScope(req);
        const includeInactive = req.query.includeInactive !== 'false';
        let departments = await listSupportDepartments({ tenantId, includeInactive });

        const ctx = req.supportContext!;
        if (!ctx.isSuperAdmin && !ctx.permissions.gerir_funcionarios && ctx.agent) {
          departments = departments.filter((d) => ctx.authorizedDepartmentIds.includes(d.id));
        }

        return res.json({ departments });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao listar departamentos.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/departments',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDepartmentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados do departamento inválidos.' });
      }
      try {
        const ctx = req.supportContext!;
        const tenantId =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : parsed.data.tenant_id;

        const idemKey =
          parsed.data.idempotencyKey ||
          (typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined);

        const { department, idempotent } = await createSupportDepartment(
          { ...parsed.data, tenant_id: tenantId, idempotencyKey: idemKey },
          ctx.caller,
          getClientMeta(req)
        );
        return res.status(idempotent ? 200 : 201).json({ department, idempotent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao criar departamento.' });
      }
    }
  );

  app.put(
    '/api/superadmin/assistant/departments/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportDepartmentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
      }
      try {
        const department = await updateSupportDepartment(
          req.params.id,
          parsed.data,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!department) return res.status(404).json({ error: 'Departamento não encontrado.' });
        return res.json({ department });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao actualizar departamento.' });
      }
    }
  );

  app.delete(
    '/api/superadmin/assistant/departments/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await deleteSupportDepartment(req.params.id, req.supportContext!.caller, getClientMeta(req));
        if (result.conflict) return res.status(409).json({ error: result.error });
        if (!result.deleted) return res.status(404).json({ error: result.error || 'Departamento não encontrado.' });
        return res.json({ deleted: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao eliminar departamento.' });
      }
    }
  );

  // ==========================================================================
  // FUNCIONÁRIOS DE SUPORTE
  // ==========================================================================
  app.get(
    '/api/superadmin/assistant/staff',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        const tenantId = resolveTenantScope(req);
        const restrictScope = !ctx.isSuperAdmin && !ctx.permissions.gerir_funcionarios && Boolean(ctx.agent);
        const result = await listSupportAgents({
          tenantId,
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          departamento_id: typeof req.query.departamento_id === 'string' ? req.query.departamento_id : undefined,
          funcao: typeof req.query.funcao === 'string' ? (req.query.funcao as SupportAgentRole | 'todas') : undefined,
          estado: typeof req.query.estado === 'string' ? (req.query.estado as SupportAgentStatus | 'todos') : undefined,
          disponibilidade:
            typeof req.query.disponibilidade === 'string'
              ? (req.query.disponibilidade as SupportAvailability | 'todas')
              : undefined,
          authorizedDepartmentIds: restrictScope ? ctx.authorizedDepartmentIds : undefined,
          selfAgentId: restrictScope ? ctx.agent?.id : undefined,
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 15),
        });

        return res.json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao listar funcionários.' });
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/staff/:id',
    requireSupportPermission('visualizar'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const agent = await getSupportAgentById(req.params.id);
        if (!agent) return res.status(404).json({ error: 'Funcionário não encontrado.' });

        const ctx = req.supportContext!;
        if (
          !ctx.isSuperAdmin &&
          !ctx.permissions.gerir_funcionarios &&
          ctx.agent?.id !== agent.id
        ) {
          return res.status(403).json({ error: 'Sem permissão para consultar este perfil de funcionário.' });
        }

        return res.json({ agent });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar funcionário.' });
      }
    }
  );

  app.post(
    '/api/superadmin/assistant/staff',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAgentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados do funcionário inválidos.' });
      }
      try {
        const ctx = req.supportContext!;
        const tenantId =
          !ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global'
            ? ctx.agent.tenant_id
            : parsed.data.tenant_id;

        const idemKey =
          parsed.data.idempotencyKey ||
          (typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined);

        const { agent, idempotent } = await createSupportAgent(
          { ...parsed.data, tenant_id: tenantId, idempotencyKey: idemKey },
          ctx.caller,
          getClientMeta(req)
        );
        return res.status(idempotent ? 200 : 201).json({ agent, idempotent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao cadastrar funcionário.' });
      }
    }
  );

  app.put(
    '/api/superadmin/assistant/staff/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAgentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
      }
      try {
        const existing = await getSupportAgentById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Funcionário não encontrado.' });

        const ctx = req.supportContext!;
        if (!ctx.isSuperAdmin && ctx.agent?.tenant_id && ctx.agent.tenant_id !== 'global' && existing.tenant_id !== ctx.agent.tenant_id) {
          return res.status(403).json({ error: 'Violação de isolamento multi-tenant.' });
        }

        const agent = await updateSupportAgent(req.params.id, parsed.data, ctx.caller, getClientMeta(req));
        return res.json({ agent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao actualizar funcionário.' });
      }
    }
  );

  app.patch(
    '/api/superadmin/assistant/staff/:id/status',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAgentStatusPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Estado inválido.' });
      }
      try {
        const agent = await updateSupportAgentStatus(
          req.params.id,
          parsed.data.estado,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!agent) return res.status(404).json({ error: 'Funcionário não encontrado.' });
        return res.json({ agent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao alterar estado do funcionário.' });
      }
    }
  );

  app.patch(
    '/api/superadmin/assistant/staff/:id/availability',
    requireSupportAccess,
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const ctx = req.supportContext!;
      const isSelf = ctx.agent?.id === req.params.id;
      if (!ctx.isSuperAdmin && !ctx.permissions.gerir_funcionarios && !isSelf) {
        return res.status(403).json({ error: 'Sem permissão para alterar disponibilidade de outro funcionário.' });
      }
      const parsed = SupportAgentAvailabilityPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Disponibilidade inválida.' });
      }
      try {
        const agent = await updateSupportAgentAvailability(
          req.params.id,
          parsed.data.disponibilidade,
          ctx.caller,
          getClientMeta(req)
        );
        if (!agent) return res.status(404).json({ error: 'Funcionário não encontrado.' });
        return res.json({ agent });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao actualizar disponibilidade.' });
      }
    }
  );

  app.delete(
    '/api/superadmin/assistant/staff/:id',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await deleteSupportAgent(req.params.id, req.supportContext!.caller, getClientMeta(req));
        if (result.conflict) return res.status(409).json({ error: result.error });
        if (!result.deleted) return res.status(404).json({ error: result.error || 'Funcionário não encontrado.' });
        return res.json({ deleted: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao eliminar funcionário.' });
      }
    }
  );

  // ==========================================================================
  // MATRIZ DE PERMISSÕES POR FUNCIONÁRIO
  // ==========================================================================
  app.get(
    '/api/superadmin/assistant/staff/:id/permissions',
    requireSupportPermission('gerir_funcionarios'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const record = await getSupportAgentPermissions(req.params.id);
        if (!record) return res.status(404).json({ error: 'Funcionário não encontrado.' });
        return res.json({ record });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao consultar permissões.' });
      }
    }
  );

  app.put(
    '/api/superadmin/assistant/staff/:id/permissions',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    supportWriteLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportPermissionsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Matriz de permissões inválida.' });
      }
      try {
        const record = await updateSupportAgentPermissions(
          req.params.id,
          parsed.data,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!record) return res.status(404).json({ error: 'Funcionário não encontrado.' });
        return res.json({ record });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao guardar permissões.' });
      }
    }
  );

  // ==========================================================================
  // REDEFINIÇÃO DE CREDENCIAIS & HISTÓRICO DE ATENDIMENTO
  // ==========================================================================
  app.post(
    '/api/superadmin/assistant/staff/:id/reset-credentials',
    requireSupportPermission('gerir_funcionarios'),
    enforceCsrfForSessionCookie,
    credentialLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportCredentialResetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados de redefinição inválidos.' });
      }
      try {
        const result = await resetSupportAgentCredentials(
          req.params.id,
          parsed.data,
          req.supportContext!.caller,
          getClientMeta(req)
        );
        if (!result) return res.status(404).json({ error: 'Funcionário não encontrado.' });
        return res.json(result);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Falha ao redefinir credenciais.' });
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/staff/:id/history',
    requireSupportAccess,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const ctx = req.supportContext!;
        if (!canAccessHistoryForAgent(ctx, req.params.id)) {
          return res.status(403).json({
            code: 'history_scope_forbidden',
            error: 'Sem permissão para consultar o histórico de outros funcionários.',
          });
        }
        const entries = await getSupportAgentHistory(req.params.id);
        return res.json({ entries });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao carregar histórico do funcionário.' });
      }
    }
  );
}
