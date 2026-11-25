import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const store = new Map<string, Map<string, any>>();

function getColMap(col: string): Map<string, any> {
  let m = store.get(col);
  if (!m) {
    m = new Map<string, any>();
    store.set(col, m);
  }
  return m;
}

function makeDocRef(col: string, id: string): any {
  return {
    id,
    path: `${col}/${id}`,
    async get() {
      const data = getColMap(col).get(id);
      return {
        id,
        exists: data !== undefined,
        data: () => (data !== undefined ? structuredClone(data) : undefined),
      };
    },
    async set(data: any, options?: { merge?: boolean }) {
      const m = getColMap(col);
      if (options?.merge && m.has(id)) {
        m.set(id, { ...m.get(id), ...structuredClone(data) });
      } else {
        m.set(id, structuredClone(data));
      }
    },
    async update(data: any) {
      const m = getColMap(col);
      const prev = m.get(id) || {};
      m.set(id, { ...prev, ...structuredClone(data) });
    },
    async delete() {
      getColMap(col).delete(id);
    },
  };
}

let autoIdCounter = 0;

function makeQuery(
  col: string,
  filters: Array<{ field: string; op: string; val: any }> = [],
  maxLimit?: number
): any {
  return {
    where(field: string, op: string, val: any) {
      return makeQuery(col, [...filters, { field, op, val }], maxLimit);
    },
    orderBy() {
      return this;
    },
    limit(n: number) {
      return makeQuery(col, filters, n);
    },
    doc(id?: string) {
      autoIdCounter += 1;
      const docId = id || `auto_${col}_${autoIdCounter}`;
      return makeDocRef(col, docId);
    },
    async add(data: any) {
      autoIdCounter += 1;
      const docId = `auto_${col}_${autoIdCounter}`;
      const ref = makeDocRef(col, docId);
      await ref.set(data);
      return ref;
    },
    async get() {
      const m = getColMap(col);
      let entries = Array.from(m.entries()).filter(([, val]) =>
        filters.every((f) => {
          const v = val?.[f.field];
          if (f.op === '==') return v === f.val;
          if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.val);
          if (f.op === 'in' && Array.isArray(f.val)) return f.val.includes(v);
          return true;
        })
      );
      if (typeof maxLimit === 'number') {
        entries = entries.slice(0, maxLimit);
      }
      return {
        empty: entries.length === 0,
        size: entries.length,
        docs: entries.map(([docId, val]) => ({
          id: docId,
          exists: true,
          data: () => structuredClone(val),
          ref: makeDocRef(col, docId),
        })),
      };
    },
  };
}

const mockRecordAuditLog = vi.fn().mockResolvedValue(undefined);

let analyticsMod: typeof import('../server/services/supportAnalyticsService');
let teamMod: typeof import('../server/services/supportTeamService');
let faqMod: typeof import('../server/services/faqService');

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  nome: 'Superadmin SGE',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

describe('Fase 6: Analytics de Suporte, Métricas Reais, Isolamento Multi-Tenant e Exportação CSV Segura', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.USE_ADMIN_FIRESTORE = 'true';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';

    vi.doMock('firebase-admin/app', () => ({
      getApps: () => [{ name: '[DEFAULT]' }],
      initializeApp: () => ({ name: '[DEFAULT]' }),
    }));
    vi.doMock('firebase-admin/auth', () => ({
      getAuth: () => ({
        verifyIdToken: vi.fn(),
        getUserByEmail: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        setCustomUserClaims: vi.fn(),
        revokeRefreshTokens: vi.fn(),
      }),
    }));
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: () => ({
        collection: (col: string) => makeQuery(col),
        batch: () => {
          const ops: Array<() => Promise<void>> = [];
          return {
            set: (ref: any, data: any, opts?: any) => ops.push(() => ref.set(data, opts)),
            update: (ref: any, data: any) => ops.push(() => ref.update(data)),
            delete: (ref: any) => ops.push(() => ref.delete()),
            commit: async () => {
              for (const fn of ops) await fn();
            },
          };
        },
      }),
    }));
    vi.doMock('../server/security/audit', () => ({
      recordAuditLog: mockRecordAuditLog,
    }));

    analyticsMod = await import('../server/services/supportAnalyticsService');
    teamMod = await import('../server/services/supportTeamService');
    faqMod = await import('../server/services/faqService');
  });

  afterAll(() => {
    vi.doUnmock('firebase-admin/app');
    vi.doUnmock('firebase-admin/auth');
    vi.doUnmock('firebase-admin/firestore');
    vi.doUnmock('../server/security/audit');
    vi.resetModules();

    if (prevUseAdmin === undefined) delete process.env.USE_ADMIN_FIRESTORE;
    else process.env.USE_ADMIN_FIRESTORE = prevUseAdmin;
    if (prevSvcJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSvcJson;
  });

  beforeEach(() => {
    store.clear();
    autoIdCounter = 0;
    mockRecordAuditLog.mockClear();
  });

  it('retorna relatório limpo e sem erros quando ainda não existem solicitações', async () => {
    const ctx = {
      isSuperAdmin: true,
      caller: superActor,
      agent: null,
      permissions: teamMod.getDefaultPermissionsForRole('administrador'),
      authorizedDepartmentIds: ['*'],
    };

    const report = await analyticsMod.getSupportAnalyticsReport({ days: 7 }, ctx);
    expect(report.resumo.totalSolicitacoes).toBe(0);
    expect(report.resumo.taxaResolucaoPct).toBe(0);
    expect(report.resumo.taxaCumprimentoSlaPct).toBe(100);
    expect(report.serieDiaria.length).toBeGreaterThanOrEqual(7);
    expect(report.porCategoria).toEqual([]);
  });

  it('calcula métricas reais por período, SLA, IA, satisfação e isola tenants para supervisores locais', async () => {
    const { department: deptFin } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Financeiro', padrao: true },
      superActor
    );
    const { agent: agentAna } = await teamMod.createSupportAgent(
      {
        tenant_id: 'tenant_a',
        nome: 'Ana Financeira',
        email: 'ana@escola-a.mz',
        departamento_id: deptFin.id,
        funcao: 'supervisor',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 10,
      },
      superActor
    );

    const { category } = await faqMod.createFaqCategory(
      { tenant_id: 'global', nome: 'Propinas', ativo: true, visibilidade_padrao: 'todos' },
      superActor
    );
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Guia de Recibos',
        pergunta: 'Como emitir recibos?',
        resposta_html: '<p>Via portal.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo'],
        estado: 'publicado',
        prioridade: 80,
        visibilidade: 'todos',
        utilizavel_ia: true,
        anexos: [],
      },
      superActor
    );

    const nowMs = Date.now();
    const tOpen1 = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    const tResp1 = new Date(nowMs - 110 * 60 * 1000).toISOString(); // 10 min first response
    const tRes1 = new Date(nowMs - 60 * 60 * 1000).toISOString(); // 1 hour resolution
    const futureSla = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    const pastSla = new Date(nowMs - 30 * 60 * 1000).toISOString();

    // Ticket 1 (tenant_a, resolved by human, rated 5)
    await getColMap('support_tickets').set('tk_1', {
      id: 'tk_1',
      codigo: 'SUP-0001',
      tenant_id: 'tenant_a',
      assunto: 'Recibo duplicado',
      categoria: 'Financeiro',
      departamento_id: deptFin.id,
      departamento_nome: 'Financeiro',
      responsavel_id: agentAna.id,
      responsavel_nome: agentAna.nome,
      responsavel_tipo: 'humano',
      prioridade: 'alta',
      estado: 'resolvido',
      canal: 'portal',
      data_abertura: tOpen1,
      primeira_resposta_em: tResp1,
      resolvido_em: tRes1,
      sla_resposta_em: futureSla,
      sla_resolucao_em: futureSla,
      sla_status: 'ok',
      created_at: tOpen1,
      updated_at: tRes1,
    });

    // Ticket 2 (tenant_a, resolved directly by AI)
    await getColMap('support_tickets').set('tk_2', {
      id: 'tk_2',
      codigo: 'SUP-0002',
      tenant_id: 'tenant_a',
      assunto: 'Horário tesouraria',
      categoria: 'Financeiro',
      departamento_id: deptFin.id,
      departamento_nome: 'Financeiro',
      responsavel_id: 'ai_bot_1',
      responsavel_nome: 'Bot Propinas',
      responsavel_tipo: 'ia',
      prioridade: 'normal',
      estado: 'resolvido',
      canal: 'portal',
      data_abertura: tOpen1,
      primeira_resposta_em: tResp1,
      resolvido_em: tRes1,
      sla_resposta_em: futureSla,
      sla_resolucao_em: futureSla,
      sla_status: 'ok',
      created_at: tOpen1,
      updated_at: tRes1,
    });

    // Ticket 3 (tenant_b, open with SLA breached — must be isolated from tenant_a supervisor)
    await getColMap('support_tickets').set('tk_3', {
      id: 'tk_3',
      codigo: 'SUP-0003',
      tenant_id: 'tenant_b',
      assunto: '=CMD("calc") Erro de login',
      categoria: 'Acesso',
      departamento_id: deptFin.id,
      departamento_nome: 'Financeiro',
      responsavel_id: null,
      responsavel_nome: null,
      responsavel_tipo: null,
      prioridade: 'urgente',
      estado: 'aberto',
      canal: 'portal',
      data_abertura: tOpen1,
      sla_resposta_em: pastSla,
      sla_resolucao_em: pastSla,
      sla_status: 'violado',
      created_at: tOpen1,
      updated_at: tOpen1,
    });

    await getColMap('support_ratings').set('rat_1', {
      id: 'rat_1',
      ticket_id: 'tk_1',
      tenant_id: 'tenant_a',
      solicitante_id: 'stu_1',
      responsavel_id: agentAna.id,
      nota: 5,
      comentario: '=SUM(1,1) Excelente rapidez!',
      created_at: tRes1,
      updated_at: tRes1,
    });

    await getColMap('support_events').set('ev_ia_1', {
      id: 'ev_ia_1',
      ticket_id: 'tk_2',
      tenant_id: 'tenant_a',
      tipo: 'ia_resposta',
      descricao: 'Resposta automática IA',
      actor_id: 'ai_bot_1',
      actor_nome: 'Bot Propinas',
      created_at: tResp1,
    });

    const superCtx = {
      isSuperAdmin: true,
      caller: superActor,
      agent: null,
      permissions: teamMod.getDefaultPermissionsForRole('administrador'),
      authorizedDepartmentIds: ['*'],
    };

    const fullReport = await analyticsMod.getSupportAnalyticsReport({ days: 30, tenant_id: 'todos' }, superCtx);
    expect(fullReport.resumo.totalSolicitacoes).toBe(3);
    expect(fullReport.resumo.solicitacoesResolvidas).toBe(2);
    expect(fullReport.resumo.solicitacoesAbertasAgora).toBe(1);
    expect(fullReport.resumo.alertasSlaEmAberto).toBe(1);
    expect(fullReport.resumo.tempoMedioPrimeiraRespostaMin).toBe(10);
    expect(fullReport.resumo.avaliacaoMedia).toBe(5);
    expect(fullReport.resumo.totalInteracoesIa).toBe(1);
    expect(fullReport.resumo.taxaResolucaoIaPct).toBe(100);
    expect(fullReport.faqInsights.totalPublicados).toBe(1);

    // Tenant-scoped supervisor trying to request tenant_id='todos' or 'tenant_b' gets ONLY tenant_a!
    const tenantACtx = {
      isSuperAdmin: false,
      caller: {
        uid: 'ana_uid',
        email: 'ana@escola-a.mz',
        nome: 'Ana Financeira',
        role: 'suporte' as const,
        tenant_id: 'tenant_a',
      },
      agent: agentAna,
      permissions: teamMod.getDefaultPermissionsForRole('supervisor'),
      authorizedDepartmentIds: [deptFin.id],
    };

    const scopedReport = await analyticsMod.getSupportAnalyticsReport(
      { days: 30, tenant_id: 'tenant_b' },
      tenantACtx
    );
    expect(scopedReport.periodo.tenant_id).toBe('tenant_a');
    expect(scopedReport.resumo.totalSolicitacoes).toBe(2);
    expect(scopedReport.resumo.solicitacoesAbertasAgora).toBe(0);
    expect(scopedReport.resumo.taxaCumprimentoSlaPct).toBe(100);

    // CSV export must neutralize Excel formula injection (=, +, -, @) and record audit log
    expect(analyticsMod.sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(analyticsMod.sanitizeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(analyticsMod.sanitizeCsvCell('-2')).toBe('"\'-2"');
    expect(analyticsMod.sanitizeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');

    const exported = await analyticsMod.exportSupportAnalyticsCsv({ days: 30 }, superCtx, superActor);
    expect(exported.filename).toMatch(/^sge-suporte-analytics-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exported.csv).toContain('Total de Solicitações (Período),3');
    expect(exported.csv).toContain('Ana Financeira');
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entity: 'support_analytics_export',
      })
    );
  });
});
