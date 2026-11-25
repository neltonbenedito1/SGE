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
      const docId = id || `auto_${col}_${getColMap(col).size + 1}`;
      return makeDocRef(col, docId);
    },
    async add(data: any) {
      const docId = `auto_${col}_${getColMap(col).size + 1}`;
      const ref = makeDocRef(col, docId);
      await ref.set(data);
      return ref;
    },
    async get() {
      const m = getColMap(col);
      let entries = Array.from(m.entries()).filter(([, val]) => {
        return filters.every((f) => {
          const v = val?.[f.field];
          if (f.op === '==') return v === f.val;
          if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.val);
          if (f.op === 'in' && Array.isArray(f.val)) return f.val.includes(v);
          return true;
        });
      });
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

const mockVerifyIdToken = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();
const mockRevokeRefreshTokens = vi.fn();
const mockRecordAuditLog = vi.fn().mockResolvedValue(undefined);

let authMod: typeof import('../server/middleware/auth');
let teamMod: typeof import('../server/services/supportTeamService');
let supportAuthMod: typeof import('../server/middleware/supportAuth');
let ticketMod: typeof import('../server/services/supportTicketService');

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  nome: 'Superadmin SGE',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

const tenantAUser = {
  uid: 'user_a1',
  email: 'aluno@escola-a.mz',
  nome: 'Joao Silva',
  role: 'estudante' as const,
  tenant_id: 'tenant_a',
};

const tenantAOwnerTwo = {
  uid: 'user_a2',
  email: 'outro@escola-a.mz',
  nome: 'Maria Costa',
  role: 'estudante' as const,
  tenant_id: 'tenant_a',
};

const tenantAAdmin = {
  uid: 'admin_a1',
  email: 'dir@escola-a.mz',
  nome: 'Director Escola A',
  role: 'admin' as const,
  tenant_id: 'tenant_a',
};

const tenantBUser = {
  uid: 'user_b1',
  email: 'aluno@escola-b.mz',
  nome: 'Carlos Bento',
  role: 'estudante' as const,
  tenant_id: 'tenant_b',
};

describe('Fase 3: Helpdesk Tickets, Conversas, Notas Internas, Transferências e Avaliações', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.USE_ADMIN_FIRESTORE = 'true';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';

    vi.doMock('firebase-admin/app', () => ({
      getApps: () => [{ name: 'mock-admin-app' }],
      initializeApp: () => ({ name: 'mock-admin-app' }),
    }));

    vi.doMock('firebase-admin/auth', () => ({
      getAuth: () => ({
        verifyIdToken: mockVerifyIdToken,
        getUserByEmail: mockGetUserByEmail,
        createUser: mockCreateUser,
        updateUser: mockUpdateUser,
        setCustomUserClaims: mockSetCustomUserClaims,
        revokeRefreshTokens: mockRevokeRefreshTokens,
      }),
    }));

    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: () => ({
        collection: (col: string) => makeQuery(col),
        batch: () => {
          const ops: Array<() => Promise<void>> = [];
          return {
            set(docRef: any, data: any, options?: any) {
              ops.push(() => docRef.set(data, options));
              return this;
            },
            update(docRef: any, data: any) {
              ops.push(() => docRef.update(data));
              return this;
            },
            delete(docRef: any) {
              ops.push(() => docRef.delete());
              return this;
            },
            async commit() {
              for (const op of ops) await op();
            },
          };
        },
      }),
    }));

    vi.doMock('../server/security/audit', () => ({
      recordAuditLog: mockRecordAuditLog,
    }));

    authMod = await import('../server/middleware/auth');
    teamMod = await import('../server/services/supportTeamService');
    supportAuthMod = await import('../server/middleware/supportAuth');
    ticketMod = await import('../server/services/supportTicketService');
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

  beforeEach(async () => {
    store.clear();
    vi.clearAllMocks();
    mockGetUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    mockCreateUser.mockImplementation(async ({ email }: any) => ({ uid: `uid_${email}` }));
    mockUpdateUser.mockResolvedValue({});
    mockSetCustomUserClaims.mockResolvedValue({});
    mockRevokeRefreshTokens.mockResolvedValue({});
    authMod.invalidateAuthResolutionCache();

    // Seed tenant names
    await makeDocRef('tenants', 'tenant_a').set({ id: 'tenant_a', nome: 'Escola Secundaria A' });
    await makeDocRef('tenants', 'tenant_b').set({ id: 'tenant_b', nome: 'Instituto Tecnico B' });
  });

  it('creates portal ticket with SLA computation, notification, and idempotency', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      {
        tenant_id: 'global',
        nome: 'Secretaria Academica',
        sla_resposta_minutos: 30,
        sla_resolucao_horas: 12,
        padrao: true,
      },
      superActor
    );

    const first = await ticketMod.createSupportTicket(
      {
        assunto: 'Erro no historico de notas',
        categoria: 'Pautas e Avaliacoes',
        departamento_id: dept.id,
        prioridade: 'alta',
        mensagem: 'Ao abrir o boletim do trimestre, uma disciplina nao aparece.',
        idempotencyKey: 'tk_idem_1',
      },
      tenantAUser
    );

    expect(first.idempotent).toBe(false);
    expect(first.ticket.codigo).toMatch(/^TK-\d{8}-[A-F0-9]{6}$/);
    expect(first.ticket.tenant_id).toBe('tenant_a');
    expect(first.ticket.tenant_nome).toBe('Escola Secundaria A');
    expect(first.ticket.departamento_id).toBe(dept.id);
    expect(first.ticket.estado).toBe('aberto');

    // SLA timestamps match 30 min & 12h
    const openMs = new Date(first.ticket.data_abertura).getTime();
    const respMs = new Date(first.ticket.sla_resposta_em).getTime();
    const resMs = new Date(first.ticket.sla_resolucao_em).getTime();
    expect(Math.round((respMs - openMs) / 60_000)).toBe(30);
    expect(Math.round((resMs - openMs) / 3600_000)).toBe(12);

    // Notification emitted to super_admin
    const notifs = Array.from(getColMap('notificacoes').values());
    expect(notifs.some((n) => n.destinatario_id === 'super_admin' && n.ticket_id === first.ticket.id)).toBe(true);

    // Duplicate idempotencyKey returns existing result without creating second ticket
    const second = await ticketMod.createSupportTicket(
      {
        assunto: 'Erro no historico de notas',
        categoria: 'Pautas e Avaliacoes',
        departamento_id: dept.id,
        prioridade: 'alta',
        mensagem: 'Ao abrir o boletim do trimestre, uma disciplina nao aparece.',
        idempotencyKey: 'tk_idem_1',
      },
      tenantAUser
    );
    expect(second.idempotent).toBe(true);
    expect(getColMap('support_tickets').size).toBe(1);
  });

  it('enforces strict multi-tenant & requester ownership isolation on portal endpoints', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Suporte Tecnico', padrao: true },
      superActor
    );

    const { ticket } = await ticketMod.createSupportTicket(
      {
        assunto: 'Problema privado de matricula',
        departamento_id: dept.id,
        mensagem: 'Detalhes confidenciais do estudante A1.',
      },
      tenantAUser
    );

    // Cross-tenant access blocked even for Tenant B admin/student
    await expect(
      ticketMod.getSupportTicketDetail({ ticketId: ticket.id, caller: tenantBUser, supportContext: null })
    ).rejects.toThrow('FORBIDDEN_TICKET_SCOPE');

    // Another student in Tenant A cannot see student A1's ticket
    await expect(
      ticketMod.getSupportTicketDetail({ ticketId: ticket.id, caller: tenantAOwnerTwo, supportContext: null })
    ).rejects.toThrow('FORBIDDEN_TICKET_SCOPE');

    // Tenant A Admin CAN view Tenant A tickets in institution scope
    const tenantAdminView = await ticketMod.getSupportTicketDetail({
      ticketId: ticket.id,
      caller: tenantAAdmin,
      supportContext: null,
    });
    expect(tenantAdminView?.ticket.id).toBe(ticket.id);

    const listB = await ticketMod.listPortalTicketsForUser(tenantBUser);
    expect(listB.items).toHaveLength(0);

    const listTenantAAdmin = await ticketMod.listPortalTicketsForUser(tenantAAdmin, { scope: 'tenant' });
    expect(listTenantAAdmin.canViewTenantScope).toBe(true);
    expect(listTenantAAdmin.items).toHaveLength(1);
  });

  it('strictly hides internal notes from portal users and prevents portal internal note injection', async () => {
    const { department: dept } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Financeiro', padrao: true },
      superActor
    );

    const { ticket } = await ticketMod.createSupportTicket(
      {
        assunto: 'Fatura duplicada',
        departamento_id: dept.id,
        mensagem: 'Por favor verifiquem a cobranca de Outubro.',
      },
      tenantAUser
    );

    const superCtx = await supportAuthMod.resolveSupportContextForUser(superActor);
    expect(superCtx?.isSuperAdmin).toBe(true);

    // Staff writes an internal note
    const internalRes = await ticketMod.addSupportTicketMessage({
      ticketId: ticket.id,
      conteudo: 'Nota interna: verificar gateway Stripe antes de responder.',
      tipo: 'nota_interna',
      caller: superActor,
      supportContext: superCtx,
    });
    expect(internalRes?.message.tipo).toBe('nota_interna');
    // Internal notes should NOT trigger user notifications or alter ticket status to em_atendimento
    expect(internalRes?.ticket.estado).toBe('aberto');
    const userNotifsAfterInternal = Array.from(getColMap('notificacoes').values()).filter(
      (n) => n.destinatario_id === tenantAUser.uid
    );
    expect(userNotifsAfterInternal).toHaveLength(0);

    // Staff sends public reply
    const publicRes = await ticketMod.addSupportTicketMessage({
      ticketId: ticket.id,
      conteudo: 'Estamos a analisar a fatura e retornamos em breve.',
      tipo: 'mensagem',
      caller: superActor,
      supportContext: superCtx,
    });
    expect(publicRes?.ticket.estado).toBe('em_atendimento');
    expect(publicRes?.ticket.primeira_resposta_em).toBeTruthy();

    // Admin view sees all 3 messages (initial + nota_interna + public reply)
    const adminDetail = await ticketMod.getSupportTicketDetail({
      ticketId: ticket.id,
      caller: superActor,
      supportContext: superCtx,
    });
    expect(adminDetail?.messages.length).toBe(3);
    expect(adminDetail?.messages.some((m) => m.tipo === 'nota_interna')).toBe(true);

    // Portal view strips all internal notes completely
    const portalDetail = await ticketMod.getSupportTicketDetail({
      ticketId: ticket.id,
      caller: tenantAUser,
      supportContext: null,
    });
    expect(portalDetail?.messages.length).toBe(2);
    expect(portalDetail?.messages.some((m) => m.tipo === 'nota_interna')).toBe(false);
    expect(portalDetail?.events.some((e) => e.tipo === 'nota_interna')).toBe(false);

    // Attempted portal escalation passing tipo: 'nota_interna' is forced to 'mensagem'
    const forcedMsg = await ticketMod.addSupportTicketMessage({
      ticketId: ticket.id,
      conteudo: 'Tentativa de nota interna pelo portal',
      tipo: 'nota_interna',
      caller: tenantAUser,
      supportContext: null,
    });
    expect(forcedMsg?.message.tipo).toBe('mensagem');
    expect(forcedMsg?.message.remetente_tipo).toBe('utilizador');
  });

  it('enforces department scoping, transfer workload recalculation, close permission, reopen, and 1-5 ratings', async () => {
    const { department: dept1 } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Fila Pedagogica', padrao: true },
      superActor
    );
    const { department: dept2 } = await teamMod.createSupportDepartment(
      { tenant_id: 'global', nome: 'Fila Infraestrutura' },
      superActor
    );

    const { agent: agent1 } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Assistente Ana',
        email: 'ana@sge.edu.mz',
        departamento_id: dept1.id,
        departamentos_autorizados: [dept1.id],
        funcao: 'assistente',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 10,
        permissoes: {
          ...teamMod.getDefaultPermissionsForRole('assistente'),
          encerrar: false, // Explicitly revoke close permission
        },
      },
      superActor
    );

    const { agent: agent2 } = await teamMod.createSupportAgent(
      {
        tenant_id: 'global',
        nome: 'Supervisor Bruno',
        email: 'bruno@sge.edu.mz',
        departamento_id: dept2.id,
        departamentos_autorizados: [dept2.id],
        funcao: 'supervisor',
        estado: 'activo',
        disponibilidade: 'online',
        limite_simultaneo: 15,
      },
      superActor
    );

    const anaCaller = { uid: agent1.uid!, email: agent1.email, nome: agent1.nome, role: 'suporte' as const, tenant_id: 'global' };
    const anaCtx = await supportAuthMod.resolveSupportContextForUser(anaCaller);
    expect(anaCtx).not.toBeNull();

    const { ticket: tk1 } = await ticketMod.createSupportTicket(
      {
        assunto: 'Duvida sobre lancamento de pautas',
        departamento_id: dept1.id,
        mensagem: 'Preciso lancar notas recuperadas.',
      },
      tenantAUser
    );
    const { ticket: tk2 } = await ticketMod.createSupportTicket(
      {
        assunto: 'Erro servidor SMTP',
        departamento_id: dept2.id,
        mensagem: 'E-mails nao estao a sair.',
      },
      tenantAUser
    );

    // Ana only sees Dept 1 ticket, NOT Dept 2
    const anaInbox = await ticketMod.listSupportTicketsForAdmin(anaCtx!);
    expect(anaInbox.items.map((i) => i.id)).toEqual([tk1.id]);

    // Transfer tk1 from Dept 1 (unassigned) to Dept 2 + Bruno
    const superCtx = await supportAuthMod.resolveSupportContextForUser(superActor);
    const transferred = await ticketMod.transferSupportTicket({
      ticketId: tk1.id,
      departamento_id: dept2.id,
      responsavel_id: agent2.id,
      motivo: 'Requer apoio de infraestrutura',
      ctx: superCtx!,
    });
    expect(transferred?.ticket.departamento_id).toBe(dept2.id);
    expect(transferred?.ticket.responsavel_id).toBe(agent2.id);
    expect(transferred?.ticket.estado).toBe('em_atendimento');

    // Bruno's workload incremented to 1
    const brunoAfterTransfer = await teamMod.getSupportAgentById(agent2.id);
    expect(brunoAfterTransfer?.carga_actual).toBe(1);

    // Rating before resolution is rejected
    await expect(
      ticketMod.submitSupportTicketRating({
        ticketId: tk1.id,
        nota: 5,
        comentario: 'Ainda aberto',
        caller: tenantAUser,
      })
    ).rejects.toThrow('resolvidas');

    // Ana without 'encerrar' permission cannot close tk1 even if she had access; test directly on tk3 in dept1
    const { ticket: tk3 } = await ticketMod.createSupportTicket(
      {
        assunto: 'Outro pedido pedagogico',
        departamento_id: dept1.id,
        mensagem: 'Verificar horario de aulas.',
      },
      tenantAUser
    );
    await expect(
      ticketMod.updateSupportTicketStatus({
        ticketId: tk3.id,
        estado: 'resolvido',
        caller: anaCaller,
        supportContext: anaCtx,
      })
    ).rejects.toThrow('FORBIDDEN_CLOSE_PERMISSION');

    // Superadmin closes tk1 -> Bruno load returns to 0
    const closedTk1 = await ticketMod.updateSupportTicketStatus({
      ticketId: tk1.id,
      estado: 'resolvido',
      motivo: 'Corrigido com sucesso',
      caller: superActor,
      supportContext: superCtx,
    });
    expect(closedTk1?.estado).toBe('resolvido');
    const brunoAfterClose = await teamMod.getSupportAgentById(agent2.id);
    expect(brunoAfterClose?.carga_actual).toBe(0);

    // User rates tk1 (5/5 + comment)
    const rated = await ticketMod.submitSupportTicketRating({
      ticketId: tk1.id,
      nota: 5,
      comentario: 'Excelente rapidez!',
      caller: tenantAUser,
    });
    expect(rated?.rating.nota).toBe(5);
    expect(rated?.ticket.avaliacao_nota).toBe(5);

    // User reopens tk1 -> estado='reaberto', Bruno load goes back to 1
    const reopened = await ticketMod.updateSupportTicketStatus({
      ticketId: tk1.id,
      estado: 'reaberto',
      motivo: 'Voltou a ocorrer',
      caller: tenantAUser,
      supportContext: null,
    });
    expect(reopened?.estado).toBe('reaberto');
    const brunoAfterReopen = await teamMod.getSupportAgentById(agent2.id);
    expect(brunoAfterReopen?.carga_actual).toBe(1);
    expect(tk2.id).toBeTruthy();
  });

  it('validates attachments with magic-bytes and flags SLA violations / unanswered tickets', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).toString(
      'base64'
    );
    const att = await ticketMod.uploadSupportAttachment(
      {
        fileName: 'captura.png',
        mimeType: 'image/png',
        base64Data: `data:image/png;base64,${validPng}`,
      },
      tenantAUser
    );
    expect(att.tipo).toBe('image');
    expect(att.url).toBe(`/api/support/attachments/${att.id}`);

    // Cross-tenant download denied
    await expect(ticketMod.getSupportAttachmentForCaller(att.id, tenantBUser, null)).rejects.toThrow(
      'FORBIDDEN_ATTACHMENT'
    );

    // Owner tenant download succeeds
    const downloaded = await ticketMod.getSupportAttachmentForCaller(att.id, tenantAUser, null);
    expect(downloaded?.mime_type).toBe('image/png');

    // Spoofed executable pretending to be PNG rejected
    const fakePng = Buffer.from('MZfakeExecutableHeader1234').toString('base64');
    await expect(
      ticketMod.uploadSupportAttachment(
        {
          fileName: 'malware.png',
          mimeType: 'image/png',
          base64Data: fakePng,
        },
        tenantAUser
      )
    ).rejects.toThrow();

    // Seed an overdue unanswered ticket and check live SLA enrichment
    const oldTime = new Date(Date.now() - 120 * 60_000).toISOString();
    await makeDocRef('support_tickets', 'tk_overdue').set({
      id: 'tk_overdue',
      codigo: 'TK-20261122-OVERDU',
      tenant_id: 'tenant_a',
      solicitante_id: tenantAUser.uid,
      solicitante_nome: tenantAUser.nome,
      solicitante_email: tenantAUser.email,
      solicitante_role: 'estudante',
      assunto: 'Ticket com SLA vencido',
      categoria: 'Geral',
      departamento_id: 'geral',
      prioridade: 'urgente',
      estado: 'aberto',
      canal: 'portal',
      total_mensagens: 1,
      ultima_mensagem_por: 'utilizador',
      data_abertura: oldTime,
      ultima_interacao: oldTime,
      primeira_resposta_em: null,
      sla_resposta_em: new Date(Date.now() - 60 * 60_000).toISOString(),
      sla_resolucao_em: new Date(Date.now() + 3600_000).toISOString(),
      created_at: oldTime,
      updated_at: oldTime,
    });

    const superCtx = await supportAuthMod.resolveSupportContextForUser(superActor);
    const inbox = await ticketMod.listSupportTicketsForAdmin(superCtx!, { apenas_alertas: true });
    expect(inbox.items.length).toBe(1);
    expect(inbox.items[0].sla_status).toBe('violado');
    expect(inbox.items[0].sem_resposta_alerta).toBe(true);
    expect(inbox.items[0].sem_resposta_ha_minutos).toBeGreaterThanOrEqual(119);
    expect(inbox.summary.alertasSla).toBe(1);
  });
});
