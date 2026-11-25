/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas HTTP do Analytics do Centro de Atendimento (Fase 6)
 * - GET /api/superadmin/assistant/analytics
 * - GET /api/superadmin/assistant/analytics/export
 */

import { Express, Request, Response } from 'express';
import { requireSupportPermission } from '../middleware/supportAuth';
import { createTenantRateLimiter } from '../middleware/tenantRateLimiter';
import { SupportAnalyticsQuerySchema } from '../../src/shared/schemas';
import {
  exportSupportAnalyticsCsv,
  getSupportAnalyticsReport,
} from '../services/supportAnalyticsService';

function getClientMeta(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  };
}

export function registerSupportAnalyticsRoutes(app: Express): void {
  const exportLimiter = createTenantRateLimiter('api');

  app.get(
    '/api/superadmin/assistant/analytics',
    requireSupportPermission('consultar_analytics'),
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAnalyticsQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Parâmetros de filtro inválidos para Analytics.',
          issues: parsed.error.issues,
        });
      }

      try {
        const report = await getSupportAnalyticsReport(parsed.data, req.supportContext!);
        return res.json(report);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao gerar relatório analítico de suporte.' });
      }
    }
  );

  app.get(
    '/api/superadmin/assistant/analytics/export',
    requireSupportPermission('consultar_analytics'),
    exportLimiter,
    async (req: Request, res: Response): Promise<any> => {
      const parsed = SupportAnalyticsQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Parâmetros inválidos para exportação.',
          issues: parsed.error.issues,
        });
      }

      try {
        const ctx = req.supportContext!;
        const { filename, csv } = await exportSupportAnalyticsCsv(
          parsed.data,
          ctx,
          ctx.caller,
          getClientMeta(req)
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(csv);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Erro ao exportar relatório CSV.' });
      }
    }
  );
}
