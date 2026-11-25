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

const mockGenerateContent = vi.fn();
const mockRecordAuditLog = vi.fn().mockResolvedValue(undefined);

let teamMod: typeof import('../server/services/supportTeamService');
let ticketMod: typeof import('../server/services/supportTicketService');
let aiMod: typeof import('../server/services/supportAiService');
let distMod: typeof import('../server/services/supportDistributionService');
let faqMod: typeof import('../server/services/faqService');

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const prevGeminiKey = process.env.GEMINI_API_KEY;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  nome: 'Superadmin SGE',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

const tenantAStudent = {
  uid: 'stu_a1',
  email: 'aluno@escola-a.mz',
  nome: 'Joana Mucavel',
  role: 'estudante' as const,
  tenant_id: 'tenant_a',
};

const tenantBStudent = {
  uid: 'stu_b1',
  email: 'aluno@escola-b.mz',
  nome: 'Carlos Chissano',
  role: 'estudante' as const,
  tenant_id: 'tenant_b',
};

describe('Fase 5: Distribuição Automática, Horários, Estratégias, IA-Primeiro, Simulador e Rebalanceamento SLA', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.USE_ADMIN_FIRESTORE = 'true';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

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
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: class MockGoogleGenAI {
        models = {
          generateContent: mockGenerateContent,
        };
      },
      Type: {
        OBJECT: 'OBJECT',
        STRING: 'STRING',
        NUMBER: 'NUMBER',
        BOOLEAN: 'BOOLEAN',
        ARRAY: 'ARRAY',
      },
      ThinkingLevel: {
        LOW: 'LOW',
      },
    }));

    teamMod = await import('../server/services/supportTeamService');
    ticketMod = await import('../server/services/supportTicketService');
    aiMod = await import('../server/services/supportAiService');
    distMod = await import('../server/services/supportDistributionService');
    faqMod = await import('../server/services/faqService');
  });

  afterAll(() => {
    vi.doUnmock('firebase-admin/app');
    vi.doUnmock('firebase-admin/auth');
    vi.doUnmock('firebase-admin/firestore');
    vi.doUnmock('../server/security/audit');
    vi.doUnmock('@google/genai');
    vi.resetModules();

    if (prevUseAdmin === undefined) delete process.env.USE_ADMIN_FIRESTORE;
    else process.env.USE_ADMIN_FIRESTORE = prevUseAdmin;
    if (prevSvcJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSvcJson;
    if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGeminiKey;
  });

  beforeEach(() => {
    store.clear();
    autoIdCounter = 0;
    mockGenerateContent.mockReset();
    mockRecordAuditLog.mockClear();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  it('avalia corretamente horários de atendimento por fuso horário e turno nocturno', () => {
    const horario = {
      ativo: true,
      timezone: 'Africa/Maputo',
      dias: [
        { dia: 'seg' as const, ativo: true, inicio: '08:00', fim: '17:00' },
        { dia: 'sab' as const, ativo: false, inicio: '08:00', fim: '12:00' },
        { dia: 'dom' as const, ativo: true, inicio: '22:00', fim: '04:00' },
      ],
    };

    // Monday 10:30 Africa/Maputo (UTC+2 -> 08:30Z)
    expect(distMod.isWithinWorkingHours(horario, new Date('2026-11-23T08:30:00Z'))).toBe(true);
    // Monday 18:30 Africa/Maputo (UTC+2 -> 16:30Z)
    expect(distMod.isWithinWorkingHours(horario, new Date('2026-11-23T16:30:00Z'))).toBe(false);
    // Saturday 10:00 Africa/Maputo (UTC+2 -> 08:00Z)
    expect(distMod.isWithinWorkingHours(horario, new Date('2026-11-28T08:00:00Z'))).toBe(false);
    // Sunday overnight 23:30 Africa/Maputo (UTC+2 -> 21:30Z)
    expect(distMod.isWithinWorkingHours(horario, new Date('2026-11-22T21:30:00Z'))).toBe(true);
  });

  it('gere CRUD idempotente de regras e respeita isolamento multi-tenant na correspondência', async () => {
    const { department: deptFin } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Financeiro', padrao: true },
      superActor
    );

    const { rule, idempotent } = await distMod.createDistributionRule(
      {
        tenant_id: 'tenant_a',
        nome: 'Triagem Financeira Escola A',
        ordem: 5,
        metodo: 'menor_carga',
        destino_departamento_id: deptFin.id,
        condicoes: {
          categorias: ['Financeiro'],
          prioridades: ['alta', 'urgente'],
          canais: ['portal'],
          departamentos_origem: [],
          palavras_chave: ['propina', 'recibo'],
        },
        idempotencyKey: 'idem_rule_a',
      },
      superActor
    );
    expect(idempotent).toBe(false);
    expect(rule.destino_departamento_nome).toBe('Financeiro');

    const dup = await distMod.createDistributionRule(
      {
        tenant_id: 'tenant_a',
        nome: 'Duplicada',
        ordem: 5,
        metodo: 'menor_carga',
        destino_departamento_id: deptFin.id,
        idempotencyKey: 'idem_rule_a',
      },
      superActor
    );
    expect(dup.idempotent).toBe(true);
    expect(dup.rule.id).toBe(rule.id);

    // Matches tenant_a with matching conditions
    expect(
      distMod.doesRuleMatchTicket(
        rule,
        {
          tenant_id: 'tenant_a',
          categoria: 'Financeiro',
          prioridade: 'alta',
          canal: 'portal',
          departamento_id: deptFin.id,
          assunto: 'Erro ao emitir recibo',
        },
        'Propina do mês'
      )
    ).toBe(true);

    // Must NOT match tenant_b (multi-tenant rule isolation)
    expect(
      distMod.doesRuleMatchTicket(rule, {
        tenant_id: 'tenant_b',
        categoria: 'Financeiro',
        prioridade: 'alta',
        canal: 'portal',
        departamento_id: deptFin.id,
        assunto: 'Erro ao emitir recibo',
      })
    ).toBe(false);

    const updated = await distMod.updateDistributionRule(rule.id, { ativo: false }, superActor);
    expect(updated?.ativo).toBe(false);
    expect(
      distMod.doesRuleMatchTicket(updated!, {
        tenant_id: 'tenant_a',
        categoria: 'Financeiro',
        prioridade: 'alta',
        canal: 'portal',
        departamento_id: deptFin.id,
        assunto: 'Recibo',
      })
    ).toBe(false);

    const del = await distMod.deleteDistributionRule(rule.id, superActor);
    expect(del.deleted).toBe(true);
    expect(mockRecordAuditLog).toHaveBeenCalled();
  });

  it('executa round-robin persistido com rotação justa entre técnicos online e elegíveis', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Suporte Técnico', padrao: true },
      superActor
    );

    const { agent: techA } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Ana Técnica',
        email: 'ana@sge.edu.mz',
        departamento_id: dept.id,
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 5,
        regras_atribuicao: {
          auto_atribuir: true,
          apenas_horario: false,
          prioridade_atribuicao: 50,
          categorias_especialidade: [],
        },
      },
      superActor
    );

    const { agent: techB } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Bruno Técnico',
        email: 'bruno@sge.edu.mz',
        departamento_id: dept.id,
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 5,
        regras_atribuicao: {
          auto_atribuir: true,
          apenas_horario: false,
          prioridade_atribuicao: 50,
          categorias_especialidade: [],
        },
      },
      superActor
    );

    const { agent: techOffline } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Carlos Offline',
        email: 'carlos@sge.edu.mz',
        departamento_id: dept.id,
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'offline',
        limite_simultaneo: 5,
        regras_atribuicao: {
          auto_atribuir: true,
          apenas_horario: false,
          prioridade_atribuicao: 90,
          categorias_especialidade: [],
        },
      },
      superActor
    );

    await distMod.createDistributionRule(
      {
        tenant_id: 'global',
        nome: 'Rotação Round-Robin Geral',
        ordem: 1,
        metodo: 'round_robin',
        destino_departamento_id: dept.id,
        respeitar_horario_atendimento: false,
        exigir_disponibilidade_online: true,
      },
      superActor
    );

    // Dry-run simulator first: does not mutate DB or assign cursor
    const sim = await distMod.simulateSupportDistribution({
      tenant_id: 'tenant_a',
      categoria: 'Acesso',
      prioridade: 'normal',
      canal: 'portal',
      assunto: 'Não consigo entrar',
    });
    expect(sim.matched_rule?.metodo).toBe('round_robin');
    expect(sim.responsavel_selecionado?.id).toBe(techA.id);
    const offDiag = sim.candidatos_avaliados.find((c) => c.agent_id === techOffline.id);
    expect(offDiag?.elegivel).toBe(false);
    expect(offDiag?.motivo_exclusao).toContain('offline');

    // Create 2 tickets back-to-back -> autoDistributeNewTicketSafe runs automatically
    const t1 = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Primeiro pedido RR',
        categoria: 'Acesso',
        prioridade: 'normal',
        mensagem: 'Preciso de ajuda no portal.',
      },
      tenantAStudent
    );
    expect(t1.ticket.responsavel_id).toBe(techA.id);
    expect(t1.ticket.estado).toBe('em_atendimento');

    const t2 = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_b',
        assunto: 'Segundo pedido RR',
        categoria: 'Acesso',
        prioridade: 'normal',
        mensagem: 'Erro ao aceder pauta.',
      },
      tenantBStudent
    );
    expect(t2.ticket.responsavel_id).toBe(techB.id);

    const t3 = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Terceiro pedido RR',
        categoria: 'Acesso',
        prioridade: 'normal',
        mensagem: 'Nova dúvida.',
      },
      tenantAStudent
    );
    expect(t3.ticket.responsavel_id).toBe(techA.id);
  });

  it('roteia por ia_primeiro, responde automaticamente via IA e faz fallback humano em caso de escalonamento', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Atendimento Inteligente', padrao: true },
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
        titulo: 'Como emitir recibo de propina',
        pergunta: 'Como emitir o recibo de propina?',
        resposta_html: '<p>Aceda a Finanças > Recibos e clique em Gerar PDF.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo', 'propina'],
        estado: 'publicado',
        prioridade: 90,
        visibilidade: 'todos',
        utilizavel_ia: true,
        anexos: [],
      },
      superActor
    );

    await aiMod.createSupportAiAgent(
      {
        tenant_id: 'global',
        nome: 'Bot Propinas SGE',
        departamento_id: dept.id,
        fallback_departamento_id: dept.id,
        estado: 'activo',
        limite_simultaneo: 50,
        modelo: 'gemini-4-hydrogen',
        modo_execucao: 'gemini_direct',
        prompt_sistema: 'Responda com base nas FAQ.',
        personalidade: 'Profissional',
        idioma_padrao: 'pt',
        max_turnos_ia: 4,
        palavras_chave_escalonamento: ['humano', 'atendente', 'urgente'],
        usar_apenas_faq_autorizada: true,
        limiar_confianca: 0.7,
        auto_responder_tickets: true,
      },
      superActor
    );

    const { agent: humanAgent } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Helena Suporte',
        email: 'helena@sge.edu.mz',
        departamento_id: dept.id,
        funcao: 'supervisor',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 10,
        regras_atribuicao: {
          auto_atribuir: true,
          apenas_horario: false,
          prioridade_atribuicao: 80,
          categorias_especialidade: ['Propinas'],
        },
      },
      superActor
    );

    await distMod.createDistributionRule(
      {
        tenant_id: 'global',
        nome: 'IA Primeiro Propinas',
        ordem: 1,
        metodo: 'ia_primeiro',
        destino_departamento_id: dept.id,
        auto_executar_ia: true,
        escalonar_para_humano_se_ia_falhar: true,
        respeitar_horario_atendimento: false,
        exigir_disponibilidade_online: true,
        condicoes: {
          categorias: ['Propinas'],
          prioridades: [],
          canais: [],
          departamentos_origem: [],
          palavras_chave: [],
        },
      },
      superActor
    );

    // Case 1: AI answers confidently
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        resposta: 'Para emitir o seu recibo de propina, vá a Finanças > Recibos e clique em Gerar PDF.',
        confianca: 0.94,
        escalonar_humano: false,
        motivo_escalonamento: '',
      }),
    });

    const tkOk = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Como emitir recibo de propina',
        categoria: 'Propinas',
        prioridade: 'normal',
        mensagem: 'Onde descarrego o recibo?',
      },
      tenantAStudent
    );
    expect(tkOk.ticket.responsavel_tipo).toBe('ia');

    // Case 2: User message triggers keyword escalation -> AI escalates and rule assigns human fallback
    const tkEsc = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Reclamação urgente propina',
        categoria: 'Propinas',
        prioridade: 'urgente',
        mensagem: 'Quero falar com atendente humano imediatamente.',
      },
      tenantAStudent
    );
    expect(tkEsc.ticket.responsavel_id).toBe(humanAgent.id);
    expect(tkEsc.ticket.responsavel_tipo).toBe('humano');
  });

  it('balanceia filas em lote e reencaminha tickets com SLA violado ou atribuídos a offline', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Secretaria Central', padrao: true },
      superActor
    );

    // Ticket created BEFORE any agents or rules exist
    const rawTicket = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Certificado atrasado',
        categoria: 'Secretaria',
        prioridade: 'alta',
        mensagem: 'Solicitei há 3 dias.',
      },
      tenantAStudent
    );
    expect(rawTicket.ticket.responsavel_id).toBeNull();

    // Force SLA breach timestamp in store
    const pastIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await getColMap('support_tickets').set(rawTicket.ticket.id, {
      ...getColMap('support_tickets').get(rawTicket.ticket.id),
      sla_resposta_em: pastIso,
      sla_resolucao_em: pastIso,
    });

    const { agent: onlineAgent } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Diana Secretaria',
        email: 'diana@sge.edu.mz',
        departamento_id: dept.id,
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 10,
        regras_atribuicao: {
          auto_atribuir: true,
          apenas_horario: false,
          prioridade_atribuicao: 60,
          categorias_especialidade: ['Secretaria'],
        },
      },
      superActor
    );

    const dry = await distMod.rebalanceSupportQueues({
      incluir_alertas_sla: true,
      reatribuir_offline: true,
      dry_run: true,
      limite: 20,
      actor: superActor,
    });
    expect(dry.dry_run).toBe(true);
    expect(dry.atribuidos).toBe(1);
    expect(dry.escalonados_sla).toBe(1);
    // Dry run must NOT persist ticket assignment
    expect(getColMap('support_tickets').get(rawTicket.ticket.id)?.responsavel_id).toBeNull();

    const real = await distMod.rebalanceSupportQueues({
      incluir_alertas_sla: true,
      reatribuir_offline: true,
      dry_run: false,
      limite: 20,
      actor: superActor,
    });
    expect(real.dry_run).toBe(false);
    expect(real.atribuidos).toBe(1);
    expect(real.escalonados_sla).toBe(1);
    expect(getColMap('support_tickets').get(rawTicket.ticket.id)?.responsavel_id).toBe(onlineAgent.id);

    const overview = await distMod.getDistributionOverview();
    expect(overview.equipaOnlineDisponivel).toBe(1);
    expect(overview.ticketsSemResponsavel).toBe(0);
  });
});
