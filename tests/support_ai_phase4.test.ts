import crypto from 'crypto';
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

let authMod: typeof import('../server/middleware/auth');
let faqMod: typeof import('../server/services/faqService');
let teamMod: typeof import('../server/services/supportTeamService');
let ticketMod: typeof import('../server/services/supportTicketService');
let aiMod: typeof import('../server/services/supportAiService');
let supportAuthMod: typeof import('../server/middleware/supportAuth');

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const prevGeminiKey = process.env.GEMINI_API_KEY;
const prevN8nSecret = process.env.N8N_WEBHOOK_SECRET;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  nome: 'Superadmin SGE',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

const tenantAStudent = {
  uid: 'stu_a1',
  email: 'estudante@escola-a.mz',
  nome: 'Pedro Langa',
  role: 'estudante' as const,
  tenant_id: 'tenant_a',
};

describe('Fase 4: Agentes de IA, Grounding FAQ, Anti-SSRF, Auto-Escalonamento e Webhooks n8n', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.USE_ADMIN_FIRESTORE = 'true';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.N8N_WEBHOOK_SECRET = 'test-n8n-webhook-secret-32chars-minimum';

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

    authMod = await import('../server/middleware/auth');
    faqMod = await import('../server/services/faqService');
    teamMod = await import('../server/services/supportTeamService');
    ticketMod = await import('../server/services/supportTicketService');
    aiMod = await import('../server/services/supportAiService');
    supportAuthMod = await import('../server/middleware/supportAuth');
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
    if (prevN8nSecret === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = prevN8nSecret;
  });

  beforeEach(() => {
    store.clear();
    autoIdCounter = 0;
    mockGenerateContent.mockReset();
    mockRecordAuditLog.mockClear();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.N8N_WEBHOOK_SECRET = 'test-n8n-webhook-secret-32chars-minimum';
  });

  it('valida política anti-SSRF rigorosa em URLs de webhook n8n', () => {
    expect(() => aiMod.assertSafeWebhookUrl('http://n8n.example.com/hook')).toThrow(/HTTPS/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://localhost:5678/webhook')).toThrow(/SSRF/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://127.0.0.1/hook')).toThrow(/SSRF/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://169.254.169.254/latest/meta-data')).toThrow(/SSRF/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://10.0.1.5/hook')).toThrow(/SSRF/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://192.168.1.20/hook')).toThrow(/SSRF/i);
    expect(() => aiMod.assertSafeWebhookUrl('https://user:pass@n8n.example.com/hook')).toThrow();

    const safe = aiMod.assertSafeWebhookUrl('https://n8n.escola.co.mz/webhook/sge-reply');
    expect(safe).toBe('https://n8n.escola.co.mz/webhook/sge-reply');
  });

  it('sincroniza CRUD de agentes IA sem poluir a equipa humana e exige permissão configurar_ia', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Suporte Geral', padrao: true },
      superActor
    );
    const { department: humanDept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Equipa Financeira N2' },
      superActor
    );

    const { item, idempotent } = await aiMod.createSupportAiAgent(
      {
        tenant_id: 'global',
        nome: 'Assistente Virtual Propinas',
        departamento_id: dept.id,
        fallback_departamento_id: humanDept.id,
        estado: 'activo',
        limite_simultaneo: 100,
        modelo: 'gemini-4-hydrogen',
        modo_execucao: 'gemini_direct',
        prompt_sistema: 'Responda questões sobre pagamentos com rigor.',
        personalidade: 'Cortês e objectivo',
        idioma_padrao: 'pt',
        limiar_confianca: 0.75,
        usar_apenas_faq_autorizada: true,
        max_turnos_ia: 3,
        auto_responder_tickets: true,
        palavras_chave_escalonamento: ['urgente', 'reclamação'],
        idempotencyKey: 'create_ia_1',
      },
      superActor
    );

    expect(idempotent).toBe(false);
    expect(item.agent.tipo).toBe('ia');
    expect(item.config.modelo).toBe('gemini-4-hydrogen');
    expect(item.config.fallback_departamento_id).toBe(humanDept.id);

    // Human team list must exclude IA agents
    const humanList = await teamMod.listSupportAgents({});
    expect(humanList.total).toBe(0);

    // Human staff member without configurar_ia cannot access IA configuration routes
    const { agent: assistantStaff } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Operador Assistente',
        email: 'assistente@sge.mz',
        departamento_id: dept.id,
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 10,
      },
      superActor
    );
    const staffCtx = await supportAuthMod.resolveSupportContextForUser({
      uid: assistantStaff.uid!,
      email: assistantStaff.email,
      role: 'suporte',
      tenant_id: 'global',
    });
    expect(staffCtx?.permissions.configurar_ia).toBe(false);
  });

  it('filtra Base de Conhecimento estritamente por FAQ publicadas, utilizavel_ia=true e isolamento de tenant/perfil', async () => {
    const { category } = await faqMod.createFaqCategory(
      { tenant_id: 'global', nome: 'Pagamentos & Propinas', visibilidade_padrao: 'todos' },
      superActor
    );

    // 1. Elegível: publicada + utilizavel_ia=true + global + todos
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Como emitir recibo de propina mensal',
        resposta_html: '<p>Aceda ao menu Financeiro e clique em Emitir Recibo PDF.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo', 'propina', 'financeiro'],
        anexos: [],
        estado: 'publicado',
        prioridade: 90,
        visibilidade: 'todos',
        utilizavel_ia: true,
      },
      superActor
    );

    // 2. Excluída: publicada mas utilizavel_ia=false
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Recibo interno confidencial de auditoria',
        resposta_html: '<p>Procedimento restrito interno.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo', 'propina'],
        anexos: [],
        estado: 'publicado',
        prioridade: 95,
        visibilidade: 'todos',
        utilizavel_ia: false,
      },
      superActor
    );

    // 3. Excluída: rascunho mesmo com utilizavel_ia=true
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Rascunho recibo futuro',
        resposta_html: '<p>Ainda em revisão.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo', 'propina'],
        anexos: [],
        estado: 'rascunho',
        prioridade: 80,
        visibilidade: 'todos',
        utilizavel_ia: true,
      },
      superActor
    );

    // 4. Excluída: outro tenant (tenant_b)
    await faqMod.createFaqArticle(
      {
        tenant_id: 'tenant_b',
        tipo: 'faq',
        titulo: 'Regra de recibo exclusiva Escola B',
        resposta_html: '<p>Válido apenas para Escola B.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo', 'propina'],
        anexos: [],
        estado: 'publicado',
        prioridade: 99,
        visibilidade: 'todos',
        utilizavel_ia: true,
      },
      superActor
    );

    // 5. Excluída por visibilidade: restrita a super_admin quando solicitante é estudante
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Configuração Superadmin de recibo',
        resposta_html: '<p>Painel global apenas.</p>',
        categoria_id: category.id,
        palavras_chave: ['recibo'],
        anexos: [],
        estado: 'publicado',
        prioridade: 99,
        visibilidade: 'super_admin',
        utilizavel_ia: true,
      },
      superActor
    );

    const kb = await aiMod.retrieveRelevantFaqForAi({
      queryText: 'Como emitir recibo de propina?',
      tenantId: 'tenant_a',
      requesterRole: 'estudante',
    });

    expect(kb.references).toHaveLength(1);
    expect(kb.references[0].titulo).toBe('Como emitir recibo de propina mensal');
  });

  it('executa resposta IA com Gemini grounded na FAQ e escalona automaticamente por baixa confiança, palavra-chave ou limite de turnos', async () => {
    const { department: triagem } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Triagem Geral', padrao: true },
      superActor
    );
    const { department: humano } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Atendimento Especializado N2' },
      superActor
    );
    const { category } = await faqMod.createFaqCategory(
      { tenant_id: 'global', nome: 'Propinas', visibilidade_padrao: 'todos' },
      superActor
    );
    await faqMod.createFaqArticle(
      {
        tenant_id: 'global',
        tipo: 'faq',
        titulo: 'Emissão de Declaração de Matrícula',
        resposta_html: '<p>O estudante pode gerar a declaração no portal em Documentos.</p>',
        categoria_id: category.id,
        palavras_chave: ['declaracao', 'matricula', 'documentos'],
        anexos: [],
        estado: 'publicado',
        prioridade: 90,
        visibilidade: 'todos',
        utilizavel_ia: true,
      },
      superActor
    );

    const { item: ia } = await aiMod.createSupportAiAgent(
      {
        tenant_id: 'global',
        nome: 'Agente SGE Triagem',
        departamento_id: triagem.id,
        fallback_departamento_id: humano.id,
        estado: 'activo',
        limite_simultaneo: 100,
        modelo: 'gemini-4-hydrogen',
        modo_execucao: 'gemini_direct',
        prompt_sistema: 'Ajude o utilizador usando a FAQ oficial.',
        personalidade: 'Profissional',
        idioma_padrao: 'pt',
        limiar_confianca: 0.75,
        usar_apenas_faq_autorizada: true,
        max_turnos_ia: 2,
        auto_responder_tickets: true,
        palavras_chave_escalonamento: ['fraude', 'advogado'],
      },
      superActor
    );

    // A) Resposta confiante (0.92 >= 0.75)
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        resposta: 'Pode gerar a sua declaração de matrícula na secção Documentos do portal.',
        confianca: 0.92,
        escalonar_humano: false,
        artigos_referenciados: ['Emissão de Declaração de Matrícula'],
      }),
    });

    const { ticket: t1 } = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Preciso da declaração de matrícula',
        categoria: 'Geral',
        departamento_id: triagem.id,
        mensagem: 'Onde posso emitir a minha declaração de matrícula?',
        canal: 'portal',
      },
      tenantAStudent
    );

    const execOk = await aiMod.runSupportAiForTicket({
      ticketId: t1.id,
      agentId: ia.agent.id,
      actor: superActor,
    });

    expect(execOk?.escalonado).toBe(false);
    expect(execOk?.message.remetente_tipo).toBe('ia');
    expect(execOk?.ticket.responsavel_id).toBe(ia.agent.id);
    expect(execOk?.artigos_faq_usados.length).toBe(1);

    // B) Baixa confiança (0.40 < 0.75) -> Escalona para fila humana e cria nota interna invisível ao utilizador
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        resposta: 'Não tenho certeza sobre este reembolso extraordinário.',
        confianca: 0.4,
        escalonar_humano: false,
      }),
    });

    const { ticket: t2 } = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Pedido complexo de transferência internacional',
        categoria: 'Geral',
        departamento_id: triagem.id,
        responsavel_id: ia.agent.id,
        mensagem: 'Preciso transferir créditos académicos para universidade estrangeira.',
        canal: 'portal',
      },
      tenantAStudent
    );

    const execLow = await aiMod.runSupportAiForTicket({
      ticketId: t2.id,
      agentId: ia.agent.id,
      actor: superActor,
    });

    expect(execLow?.escalonado).toBe(true);
    expect(execLow?.ticket.departamento_id).toBe(humano.id);
    expect(execLow?.ticket.responsavel_id).toBeNull();
    expect(execLow?.ticket.estado).toBe('aberto');

    // Portal detail MUST strip nota_interna created by IA escalation
    const portalView = await ticketMod.getSupportTicketDetail({
      ticketId: t2.id,
      caller: tenantAStudent,
      supportContext: null,
    });
    expect(portalView?.messages.some((m) => m.tipo === 'nota_interna')).toBe(false);

    // Superadmin view MUST contain nota_interna
    const adminCtx = await supportAuthMod.resolveSupportContextForUser(superActor);
    const adminView = await ticketMod.getSupportTicketDetail({
      ticketId: t2.id,
      caller: superActor,
      supportContext: adminCtx,
    });
    expect(adminView?.messages.some((m) => m.tipo === 'nota_interna' && m.remetente_tipo === 'ia')).toBe(true);

    // C) Palavra-chave crítica -> Escalona sem gastar chamada Gemini
    const callsBeforeKw = mockGenerateContent.mock.calls.length;
    const { ticket: t3 } = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Suspeita de fraude na propina',
        categoria: 'Geral',
        departamento_id: triagem.id,
        mensagem: 'Quero reportar fraude na factura emitida.',
        canal: 'portal',
      },
      tenantAStudent
    );
    const execKw = await aiMod.runSupportAiForTicket({
      ticketId: t3.id,
      agentId: ia.agent.id,
      actor: superActor,
    });
    expect(execKw?.escalonado).toBe(true);
    expect(execKw?.motivo_escalonamento).toMatch(/fraude/i);
    expect(mockGenerateContent.mock.calls.length).toBe(callsBeforeKw);

    // D) Missing GEMINI_API_KEY propagates clear error (422) without faking response or 503 outage
    delete process.env.GEMINI_API_KEY;
    await expect(
      aiMod.testSupportAiSandbox(ia.agent.id, {
        mensagem: 'Como pagar propinas?',
        tenant_id: 'tenant_a',
        role: 'estudante',
      })
    ).rejects.toMatchObject({
      code: 'ai_provider_unconfigured',
      httpStatus: 422,
    });

    // E) Upstream SDK 403 error maps cleanly to ai_permission_denied
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    mockGenerateContent.mockRejectedValueOnce(Object.assign(new Error('PERMISSION_DENIED'), { status: 403 }));
    await expect(
      aiMod.testSupportAiSandbox(ia.agent.id, {
        mensagem: 'Como pagar propinas?',
        tenant_id: 'tenant_a',
        role: 'estudante',
      })
    ).rejects.toMatchObject({
      code: 'ai_permission_denied',
      httpStatus: 403,
    });
  });

  it('valida assinatura HMAC-SHA256 e idempotência no webhook inbound do n8n', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Fila Geral', padrao: true },
      superActor
    );
    const { item: ia } = await aiMod.createSupportAiAgent(
      {
        tenant_id: 'global',
        nome: 'Agente n8n',
        departamento_id: dept.id,
        estado: 'activo',
        limite_simultaneo: 100,
        modelo: 'gemini-4-hydrogen',
        modo_execucao: 'n8n_webhook',
        n8n_webhook_url: 'https://n8n.instituicao.example/webhook/sge',
        prompt_sistema: 'Integração n8n externa.',
        personalidade: 'Directo',
        idioma_padrao: 'pt',
        limiar_confianca: 0.7,
        usar_apenas_faq_autorizada: true,
        max_turnos_ia: 4,
        auto_responder_tickets: false,
        palavras_chave_escalonamento: [],
      },
      superActor
    );

    const { ticket } = await ticketMod.createSupportTicket(
      {
        tenant_id: 'tenant_a',
        assunto: 'Integração via n8n',
        categoria: 'Geral',
        departamento_id: dept.id,
        mensagem: 'Aguardar resposta externa n8n.',
        canal: 'portal',
      },
      tenantAStudent
    );

    const payloadObj = {
      ticket_id: ticket.id,
      agent_id: ia.agent.id,
      resposta: 'Resposta processada com sucesso pelo fluxo n8n.',
      confianca: 0.91,
      escalonar_humano: false,
      idempotencyKey: 'n8n_evt_001',
    };
    const rawBody = JSON.stringify(payloadObj);
    const validSig =
      'sha256=' + crypto.createHmac('sha256', process.env.N8N_WEBHOOK_SECRET!).update(rawBody).digest('hex');

    // Invalid signature rejected
    const badCheck = aiMod.verifyN8nWebhookRequest({
      rawBody,
      signatureHeader: 'sha256=invalidhex0000000000000000000000000000000000000000000000000000',
    });
    expect(badCheck.ok).toBe(false);
    expect(badCheck.status).toBe(401);

    // Valid signature accepted
    const okCheck = aiMod.verifyN8nWebhookRequest({
      rawBody,
      signatureHeader: validSig,
    });
    expect(okCheck.ok).toBe(true);

    const first = await aiMod.handleN8nInboundReply(payloadObj);
    const second = await aiMod.handleN8nInboundReply(payloadObj);
    expect(first?.escalonado).toBe(false);
    expect(first?.message.id).toBe(second?.message.id); // Idempotency prevents duplicate message
  });
});
