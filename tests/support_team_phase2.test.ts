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

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

describe('Fase 2: Equipa de Atendimento, Departamentos e Permissões', () => {
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
    authMod.invalidateAuthResolutionCache();
    mockVerifyIdToken.mockReset();
    mockGetUserByEmail.mockReset();
    mockCreateUser.mockReset();
    mockUpdateUser.mockReset();
    mockSetCustomUserClaims.mockReset();
    mockRevokeRefreshTokens.mockReset();
    mockRecordAuditLog.mockClear();

    mockGetUserByEmail.mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' }));
    mockCreateUser.mockImplementation(async ({ email }: { email: string }) => ({
      uid: `fb_${email.replace(/[^a-z0-9]/gi, '_')}`,
      email,
    }));
    mockUpdateUser.mockResolvedValue({});
    mockSetCustomUserClaims.mockResolvedValue({});
    mockRevokeRefreshTokens.mockResolvedValue({});
  });

  describe('Departamentos / Filas CRUD e Integridade Referencial', () => {
    it('cria departamento, actualiza nome com propagação e bloqueia eliminação com 409 se tiver funcionários', async () => {
      const { department, idempotent } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Suporte Académico',
          descricao: 'Pautas, notas e matrículas',
          email_fila: 'academico@sge.edu.mz',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 1,
          ativo: true,
          padrao: true,
          idempotencyKey: 'dept-key-1',
        },
        superActor
      );

      expect(idempotent).toBe(false);
      expect(department.nome).toBe('Suporte Académico');

      const idemRepeat = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Suporte Académico',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 1,
          ativo: true,
          padrao: true,
          idempotencyKey: 'dept-key-1',
        },
        superActor
      );
      expect(idemRepeat.idempotent).toBe(true);
      expect(idemRepeat.department.id).toBe(department.id);

      const { agent } = await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'Carla Mendes',
          email: 'carla@sge.edu.mz',
          departamento_id: department.id,
          departamentos_autorizados: [],
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 8,
          mustResetPassword: true,
        },
        superActor
      );

      expect(agent.departamentos_autorizados).toContain(department.id);

      const conflict = await teamMod.deleteSupportDepartment(department.id, superActor);
      expect(conflict.conflict).toBe(true);
      expect(conflict.deleted).toBe(false);

      const updatedDept = await teamMod.updateSupportDepartment(
        department.id,
        { nome: 'Suporte Académico e Registo' },
        superActor
      );
      expect(updatedDept?.nome).toBe('Suporte Académico e Registo');

      const reloadedAgent = await teamMod.getSupportAgentById(agent.id);
      expect(reloadedAgent?.departamento_nome).toBe('Suporte Académico e Registo');
    });
  });

  describe('Funcionários, Matriz de Permissões e Redefinição de Credenciais', () => {
    it('gere ciclo de vida completo de funcionário, matriz Assistente vs Supervisor e reset de senha seguro', async () => {
      const { department: deptA } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Financeiro',
          sla_resposta_minutos: 45,
          sla_resolucao_horas: 24,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );
      const { department: deptB } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Infraestrutura',
          sla_resposta_minutos: 20,
          sla_resolucao_horas: 8,
          ordem: 1,
          ativo: true,
          padrao: false,
        },
        superActor
      );

      //Assistente defaults vs Supervisor defaults
      const assistenteDef = teamMod.getDefaultPermissionsForRole('assistente');
      const supervisorDef = teamMod.getDefaultPermissionsForRole('supervisor');
      expect(assistenteDef.historico_escopo).toBe('proprio');
      expect(assistenteDef.consultar_analytics).toBe(false);
      expect(assistenteDef.gerir_faq).toBe(false);
      expect(supervisorDef.historico_escopo).toBe('todos');
      expect(supervisorDef.consultar_analytics).toBe(true);
      expect(supervisorDef.gerir_faq).toBe(true);

      const { agent } = await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'João Mabunda',
          email: 'joao.suporte@sge.edu.mz',
          departamento_id: deptA.id,
          departamentos_autorizados: [deptA.id],
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'offline',
          limite_simultaneo: 12,
          mustResetPassword: true,
        },
        superActor
      );

      // Quick availability update
      const availUpdated = await teamMod.updateSupportAgentAvailability(agent.id, 'online', superActor);
      expect(availUpdated?.disponibilidade).toBe('online');

      // Custom permission upgrade for employee
      const updatedPermRecord = await teamMod.updateSupportAgentPermissions(
        agent.id,
        {
          funcao: 'supervisor',
          permissoes: {
            ...supervisorDef,
            gerir_funcionarios: false,
            configurar_ia: false,
          },
        },
        superActor
      );
      expect(updatedPermRecord?.funcao).toBe('supervisor');
      expect(updatedPermRecord?.permissoes.consultar_analytics).toBe(true);

      // Credential reset: rejects weak password
      await expect(
        teamMod.resetSupportAgentCredentials(
          agent.id,
          {
            newPassword: 'weak',
            mustResetPassword: true,
            revokeActiveSessions: true,
          },
          superActor
        )
      ).rejects.toThrow();

      // Credential reset: succeeds with compliant password and updates PBKDF2 hash without leaking secret in audit log
      const secretPwd = 'SgeSuporte#2026Strong!';
      const resetRes = await teamMod.resetSupportAgentCredentials(
        agent.id,
        {
          newPassword: secretPwd,
          mustResetPassword: true,
          revokeActiveSessions: true,
        },
        superActor
      );
      expect(resetRes?.success).toBe(true);
      expect(mockRevokeRefreshTokens).toHaveBeenCalledTimes(1);

      const auditPayloads = JSON.stringify(mockRecordAuditLog.mock.calls);
      expect(auditPayloads).not.toContain(secretPwd);

      // Suspend agent blocks user in auth & users collection
      const suspended = await teamMod.updateSupportAgentStatus(agent.id, 'suspenso', superActor);
      expect(suspended?.estado).toBe('suspenso');

      const overview = await teamMod.getSupportTeamOverview('global');
      expect(overview.totalFuncionarios).toBe(1);
      expect(overview.suspensos).toBe(1);
      expect(overview.totalDepartamentos).toBe(2);
      expect(deptB.id).toBeTruthy();
    });
  });

  describe('Middleware de Autorização, Escopo de Departamentos e Bypass de Superadmin', () => {
    it('restringe funcionário a pedidos próprios/departamentos autorizados e dá acesso irrestrito ao Superadmin', async () => {
      const { department: deptFin } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Financeiro',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );
      const { department: deptPed } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Pedagógico',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 1,
          ativo: true,
          padrao: false,
        },
        superActor
      );

      const { agent: agentOne } = await teamMod.createSupportAgent(
        {
          tenant_id: 'tenant-1',
          nome: 'Agente Um',
          email: 'agente1@sge.edu.mz',
          departamento_id: deptFin.id,
          departamentos_autorizados: [deptFin.id],
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 5,
          mustResetPassword: false,
        },
        superActor
      );

      const ctxStaff = await supportAuthMod.resolveSupportContextForUser({
        uid: agentOne.uid || 'u_ag1',
        email: agentOne.email,
        role: 'suporte',
        tenant_id: 'tenant-1',
      });

      expect(ctxStaff).not.toBeNull();
      expect(ctxStaff?.isSuperAdmin).toBe(false);

      // Can access ticket in authorized department & matching tenant
      expect(
        supportAuthMod.canAccessTicketScope(ctxStaff!, {
          tenant_id: 'tenant-1',
          departamento_id: deptFin.id,
          responsavel_id: 'other_agent',
        })
      ).toBe(true);

      // Can access ticket directly assigned to self in same tenant
      expect(
        supportAuthMod.canAccessTicketScope(ctxStaff!, {
          tenant_id: 'tenant-1',
          departamento_id: deptPed.id,
          responsavel_id: agentOne.id,
        })
      ).toBe(true);

      // Denied for unauthorized department not assigned to self
      expect(
        supportAuthMod.canAccessTicketScope(ctxStaff!, {
          tenant_id: 'tenant-1',
          departamento_id: deptPed.id,
          responsavel_id: 'other_agent',
        })
      ).toBe(false);

      // Denied across tenants (multi-tenant isolation)
      expect(
        supportAuthMod.canAccessTicketScope(ctxStaff!, {
          tenant_id: 'tenant-2',
          departamento_id: deptFin.id,
          responsavel_id: agentOne.id,
        })
      ).toBe(false);

      // History scope: assistente can only inspect own history, not another agent's history
      expect(supportAuthMod.canAccessHistoryForAgent(ctxStaff!, agentOne.id)).toBe(true);
      expect(supportAuthMod.canAccessHistoryForAgent(ctxStaff!, 'other_agent_id')).toBe(false);

      // Superadmin retains unconditional full access regardless of permissions matrix
      const ctxSuper = await supportAuthMod.resolveSupportContextForUser(superActor);
      expect(ctxSuper?.isSuperAdmin).toBe(true);
      expect(
        supportAuthMod.canAccessTicketScope(ctxSuper!, {
          tenant_id: 'tenant-2',
          departamento_id: deptPed.id,
          responsavel_id: 'other_agent',
        })
      ).toBe(true);
      expect(supportAuthMod.canAccessHistoryForAgent(ctxSuper!, 'other_agent_id')).toBe(true);

      // Inactive / suspended employee cannot resolve active support context
      await teamMod.updateSupportAgentStatus(agentOne.id, 'inactivo', superActor);
      const ctxInactive = await supportAuthMod.resolveSupportContextForUser({
        uid: agentOne.uid || 'u_ag1',
        email: agentOne.email,
        role: 'suporte',
        tenant_id: 'tenant-1',
      });
      expect(ctxInactive).toBeNull();
    });

    it('bloqueia utilizadores sem vínculo e aplica requireSupportPermission para gerir_faq', async () => {
      const { department } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Geral',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );
      const { agent } = await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'Assistente Sem FAQ',
          email: 'assist.nofaq@sge.edu.mz',
          departamento_id: department.id,
          departamentos_autorizados: [],
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 5,
          mustResetPassword: false,
        },
        superActor
      );

      mockVerifyIdToken.mockResolvedValue({
        uid: agent.uid,
        email: agent.email,
        role: 'suporte',
      });

      const req: any = {
        headers: { authorization: 'Bearer tok_assist' },
        cookies: {},
        query: {},
        requestId: 'req-1',
      };
      let statusCode = 200;
      let bodyJson: any = null;
      const res: any = {
        headersSent: false,
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          bodyJson = payload;
          this.headersSent = true;
          return this;
        },
      };
      const next = vi.fn();

      const middleware = supportAuthMod.requireSupportPermission('gerir_faq');
      await new Promise<void>((resolve) => {
        const origJson = res.json.bind(res);
        res.json = (p: any) => {
          const out = origJson(p);
          resolve();
          return out;
        };
        middleware(req, res, () => {
          next();
          resolve();
        });
      });

      expect(statusCode).toBe(403);
      expect(bodyJson?.code).toBe('missing_support_permission');
      expect(next).not.toHaveBeenCalled();

      // Upgrade permission to gerir_faq: true -> allowed
      const curPerms = await teamMod.getSupportAgentPermissions(agent.id);
      await teamMod.updateSupportAgentPermissions(
        agent.id,
        {
          permissoes: { ...curPerms!.permissoes, gerir_faq: true },
        },
        superActor
      );

      statusCode = 200;
      bodyJson = null;
      res.headersSent = false;
      const nextAllowed = vi.fn();

      await new Promise<void>((resolve) => {
        middleware(req, res, () => {
          nextAllowed();
          resolve();
        });
      });

      expect(nextAllowed).toHaveBeenCalledTimes(1);
    });
  });

  describe('Regressão: Listagens, Contadores, Protecção de Contas e Paginação por Escopo', () => {
    it('actualiza listas, contadores por departamento e visão geral mesmo quando existe agente IA com o mesmo e-mail', async () => {
      const { department: deptA } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'TI',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );
      const { department: deptB } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Administração',
          sla_resposta_minutos: 45,
          sla_resolucao_horas: 24,
          ordem: 1,
          ativo: true,
          padrao: false,
        },
        superActor
      );

      // Existing active AI agent sharing the same email must not block human staff creation
      const db = (await import('firebase-admin/firestore')).getFirestore();
      await db.collection('support_agents').doc('supia_existing_1').set({
        id: 'supia_existing_1',
        tenant_id: 'global',
        tipo: 'ia',
        nome: 'SysEdu IA',
        email: 'equipa.partilhada@sge.edu.mz',
        departamento_id: deptA.id,
        departamentos_autorizados: [deptA.id],
        estado: 'activo',
      });

      const { agent } = await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'Nelton Suporte',
          email: 'equipa.partilhada@sge.edu.mz',
          departamento_id: deptA.id,
          departamentos_autorizados: [deptA.id, deptB.id],
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 10,
          mustResetPassword: false,
        },
        superActor
      );

      const listRes = await teamMod.listSupportAgents({ tenantId: 'global', page: 1, pageSize: 15 });
      expect(listRes.total).toBe(1);
      expect(listRes.items.map((i) => i.id)).toContain(agent.id);

      const depts = await teamMod.listSupportDepartments({ tenantId: 'global', includeInactive: true });
      const deptsById = new Map(depts.map((d) => [d.id, d]));
      expect(deptsById.get(deptA.id)?.membros_count).toBe(1);
      expect(deptsById.get(deptB.id)?.membros_count).toBe(1);

      const overview = await teamMod.getSupportTeamOverview('global');
      expect(overview.totalFuncionarios).toBe(1);
      expect(overview.activos).toBe(1);
      expect(overview.online).toBe(1);
      expect(overview.totalAgentesIa).toBe(1);
      expect(overview.porDepartamento.find((d) => d.departamento_id === deptA.id)?.total_membros).toBe(1);
      expect(overview.porDepartamento.find((d) => d.departamento_id === deptB.id)?.total_membros).toBe(1);
    });

    it('protege conta super_admin contra rebaixamento e rejeita colisão com utilizador escolar activo', async () => {
      const { department } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Geral',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );

      const db = (await import('firebase-admin/firestore')).getFirestore();
      await db.collection('users').doc('uid_super_existing').set({
        id: 'uid_super_existing',
        uid: 'uid_super_existing',
        email: 'super.real@sge.edu.mz',
        nome: 'Super Admin Principal',
        tipo: 'super_admin',
        role: 'super_admin',
        tenant_id: 'super-admin',
        ativo: true,
      });

      await db.collection('users').doc('uid_docente_existing').set({
        id: 'uid_docente_existing',
        uid: 'uid_docente_existing',
        email: 'docente.escola@sge.edu.mz',
        nome: 'Docente Escola',
        tipo: 'docente',
        role: 'docente',
        tenant_id: 'tenant-1',
        ativo: true,
      });

      // Superadmin with initialPassword must be rejected cleanly
      await expect(
        teamMod.createSupportAgent(
          {
            tenant_id: 'global',
            nome: 'Super Suporte',
            email: 'super.real@sge.edu.mz',
            departamento_id: department.id,
            funcao: 'supervisor',
            estado: 'activo',
            disponibilidade: 'online',
            limite_simultaneo: 10,
            initialPassword: 'SgeSuporte#2026Strong!',
            mustResetPassword: false,
          },
          superActor
        )
      ).rejects.toThrow(/Superadministrador/i);

      // Superadmin without initialPassword links existing UID and preserves super_admin role
      const { agent: linkedSuper } = await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'Super Suporte',
          email: 'super.real@sge.edu.mz',
          departamento_id: department.id,
          funcao: 'supervisor',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 10,
          mustResetPassword: false,
        },
        superActor
      );
      expect(linkedSuper.uid).toBe('uid_super_existing');
      const superUserAfter = (await db.collection('users').doc('uid_super_existing').get()).data();
      expect(superUserAfter?.tipo).toBe('super_admin');
      expect(superUserAfter?.role).toBe('super_admin');

      // Active institutional school user email must be rejected
      await expect(
        teamMod.createSupportAgent(
          {
            tenant_id: 'global',
            nome: 'Docente Conflito',
            email: 'docente.escola@sge.edu.mz',
            departamento_id: department.id,
            funcao: 'assistente',
            estado: 'activo',
            disponibilidade: 'online',
            limite_simultaneo: 5,
            mustResetPassword: false,
          },
          superActor
        )
      ).rejects.toThrow(/institucional/i);
    });

    it('aplica filtro de escopo de departamentos antes da paginação para total exacto', async () => {
      const { department: deptA } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Alpha',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 0,
          ativo: true,
          padrao: true,
        },
        superActor
      );
      const { department: deptB } = await teamMod.createSupportDepartment(
        {
          tenant_id: 'global',
          nome: 'Beta',
          sla_resposta_minutos: 30,
          sla_resolucao_horas: 12,
          ordem: 1,
          ativo: true,
          padrao: false,
        },
        superActor
      );

      await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'A1 Alpha',
          email: 'a1@sge.edu.mz',
          departamento_id: deptA.id,
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 5,
        },
        superActor
      );
      await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'B1 Beta',
          email: 'b1@sge.edu.mz',
          departamento_id: deptB.id,
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 5,
        },
        superActor
      );
      await teamMod.createSupportAgent(
        {
          tenant_id: 'global',
          nome: 'C1 Beta',
          email: 'c1@sge.edu.mz',
          departamento_id: deptB.id,
          funcao: 'assistente',
          estado: 'activo',
          disponibilidade: 'online',
          limite_simultaneo: 5,
        },
        superActor
      );

      // Caller authorized only for deptB with pageSize=1 must see total=2, totalPages=2, page 1 = B1 Beta
      const scopedPage1 = await teamMod.listSupportAgents({
        tenantId: 'global',
        authorizedDepartmentIds: [deptB.id],
        page: 1,
        pageSize: 1,
      });
      expect(scopedPage1.total).toBe(2);
      expect(scopedPage1.totalPages).toBe(2);
      expect(scopedPage1.items.length).toBe(1);
      expect(scopedPage1.items[0].nome).toBe('B1 Beta');

      const scopedPage2 = await teamMod.listSupportAgents({
        tenantId: 'global',
        authorizedDepartmentIds: [deptB.id],
        page: 2,
        pageSize: 1,
      });
      expect(scopedPage2.items.length).toBe(1);
      expect(scopedPage2.items[0].nome).toBe('C1 Beta');
    });
  });
});
