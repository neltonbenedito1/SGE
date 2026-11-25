/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Middleware de Autorização e Isolamento para Central de Atendimento (Assistente & FAQ)
 * - Superadmin tem acesso total independentemente das permissões da matriz
 * - Funcionários humanos só operam se estado === 'activo' e se possuírem a permissão específica
 * - Um funcionário só vê/gere pedidos atribuídos a si ou pertencentes aos seus departamentos autorizados
 */

import { NextFunction, Request, Response } from 'express';
import { AuthenticatedUser, requireAuth } from './auth';
import {
  getDefaultPermissionsForRole,
  resolveSupportAgentByCaller,
} from '../services/supportTeamService';
import type {
  SupportAgent,
  SupportPermissionBooleanKey,
  SupportPermissionSet,
} from '../../src/types';

export interface SupportAuthContext {
  isSuperAdmin: boolean;
  caller: AuthenticatedUser;
  agent: SupportAgent | null;
  permissions: SupportPermissionSet;
  authorizedDepartmentIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      supportContext?: SupportAuthContext;
    }
  }
}

function isSuperAdminUser(user?: AuthenticatedUser): boolean {
  const r = String(user?.role || '').toLowerCase().trim();
  return r === 'super_admin' || r === 'superadmin';
}

export async function resolveSupportContextForUser(user: AuthenticatedUser): Promise<SupportAuthContext | null> {
  if (isSuperAdminUser(user)) {
    return {
      isSuperAdmin: true,
      caller: user,
      agent: null,
      permissions: getDefaultPermissionsForRole('administrador'),
      authorizedDepartmentIds: ['*'],
    };
  }

  const agent = await resolveSupportAgentByCaller(user.uid, user.email);
  if (!agent || agent.tipo !== 'humano') {
    return null;
  }

  if (agent.estado !== 'activo') {
    return null;
  }

  const permissions = agent.permissoes || getDefaultPermissionsForRole(agent.funcao);
  const authorizedDepartmentIds = Array.from(
    new Set([agent.departamento_id, ...(agent.departamentos_autorizados || [])].filter(Boolean))
  );

  return {
    isSuperAdmin: false,
    caller: user,
    agent,
    permissions,
    authorizedDepartmentIds,
  };
}

/**
 * Ensures the caller is either an active Superadmin OR an active human Support Staff member.
 */
export function requireSupportAccess(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, async () => {
    if (res.headersSent) return;
    if (!req.user) {
      res.status(401).json({
        code: 'unauthorized',
        message: 'Utilizador não autenticado.',
        requestId: req.requestId,
      });
      return;
    }

    try {
      const ctx = await resolveSupportContextForUser(req.user);
      if (!ctx) {
        res.status(403).json({
          code: 'support_access_denied',
          message: 'Acesso negado. Conta sem vínculo activo na equipa de atendimento.',
          requestId: req.requestId,
        });
        return;
      }
      req.supportContext = ctx;
      next();
    } catch (err: any) {
      res.status(500).json({
        code: 'support_auth_error',
        message: err.message || 'Erro ao validar permissões da equipa de suporte.',
        requestId: req.requestId,
      });
    }
  });
}

/**
 * Enforces a specific granular permission from SupportPermissionSet.
 * Superadmin bypasses permission matrix restrictions automatically.
 */
export function requireSupportPermission(permissionKey: SupportPermissionBooleanKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireSupportAccess(req, res, () => {
      if (res.headersSent) return;
      const ctx = req.supportContext;
      if (!ctx) {
        res.status(403).json({
          code: 'forbidden',
          message: 'Contexto de autorização de suporte ausente.',
          requestId: req.requestId,
        });
        return;
      }

      if (ctx.isSuperAdmin || ctx.permissions[permissionKey] === true) {
        next();
        return;
      }

      res.status(403).json({
        code: 'missing_support_permission',
        message: `Acesso negado. Falta a permissão "${permissionKey}" no seu perfil de atendimento.`,
        requestId: req.requestId,
      });
    });
  };
}

/**
 * Scope rule: Superadmin sees everything.
 * Support staff only sees tickets assigned to themselves OR within their authorized departments
 * (always honoring tenant isolation unless staff is global).
 */
export function canAccessTicketScope(
  ctx: SupportAuthContext,
  ticket: { tenant_id?: string; departamento_id?: string; responsavel_id?: string }
): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.agent || ctx.agent.estado !== 'activo') return false;

  const staffTenant = ctx.agent.tenant_id || 'global';
  const ticketTenant = ticket.tenant_id || 'global';
  if (staffTenant !== 'global' && ticketTenant !== staffTenant) {
    return false;
  }

  if (ticket.responsavel_id && ticket.responsavel_id === ctx.agent.id) {
    return true;
  }

  if (ticket.departamento_id && ctx.authorizedDepartmentIds.includes(ticket.departamento_id)) {
    return true;
  }

  return false;
}

/**
 * Scope rule for viewing employee service history ("proprio" vs "todos").
 */
export function canAccessHistoryForAgent(ctx: SupportAuthContext, targetAgentId: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.agent || ctx.agent.estado !== 'activo') return false;
  if (ctx.permissions.gerir_funcionarios) return true;
  if (!ctx.permissions.consultar_historico) return false;
  if (ctx.permissions.historico_escopo === 'todos') return true;
  return ctx.agent.id === targetAgentId;
}
