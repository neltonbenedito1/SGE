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
    limit(n: number) {
      return makeQuery(col, filters, n);
    },
    doc(id: string) {
      return makeDocRef(col, id);
    },
    async get() {
      const m = getColMap(col);
      let entries = Array.from(m.entries()).filter(([, val]) => {
        return filters.every((f) => {
          const v = val?.[f.field];
          if (f.op === '==') return v === f.val;
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
const mockRecordAuditLog = vi.fn().mockResolvedValue(undefined);

let authMod: typeof import('../server/middleware/auth');
let faqMod: typeof import('../server/services/faqService');

const prevUseAdmin = process.env.USE_ADMIN_FIRESTORE;
const prevSvcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const superActor = {
  uid: 'super_uid_1',
  email: 'super@sge.edu.mz',
  role: 'super_admin' as const,
  tenant_id: 'super-admin',
};

describe('Superadmin Revocation & Fase 1 FAQ Suite', () => {
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
    authMod.invalidateAuthResolutionCache();
    mockVerifyIdToken.mockReset();
    mockRecordAuditLog.mockClear();
  });

  describe('Superadmin Revocation & Firestore Authorization Resolution', () => {
    it('faz fallback para verifyIdToken(token, false) apenas em falha IAM e propaga erros reais de revogação', async () => {
      const iamErr: any = new Error('PERMISSION_DENIED: IAM lookup unavailable on Starter Tier');
      iamErr.code = 'auth/internal-error';

      mockVerifyIdToken
        .mockRejectedValueOnce(iamErr)
        .mockResolvedValueOnce({ uid: 'u1', email: 'super@sge.edu.mz' });

      const decoded = await authMod.verifyFirebaseIdTokenSafe('tok_123', true);
      expect(decoded.uid).toBe('u1');
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(2);
      expect(mockVerifyIdToken).toHaveBeenNthCalledWith(1, 'tok_123', true);
      expect(mockVerifyIdToken).toHaveBeenNthCalledWith(2, 'tok_123', false);

      // Chamada repetida com mesmo token usa cache curto sem nova RPC
      const decodedCached = await authMod.verifyFirebaseIdTokenSafe('tok_123', true);
      expect(decodedCached.uid).toBe('u1');
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(2);

      // Novo token durante janela IAM indisponível vai directo para verificação local (false)
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'u2', email: 'other@sge.edu.mz' });
      const decodedNext = await authMod.verifyFirebaseIdTokenSafe('tok_456', true);
      expect(decodedNext.uid).toBe('u2');
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(3);
      expect(mockVerifyIdToken).toHaveBeenNthCalledWith(3, 'tok_456', false);

      // Após invalidar cache, erro genuíno de revogação propaga imediatamente
      authMod.invalidateAuthResolutionCache();
      mockVerifyIdToken.mockReset();
      const revokedErr: any = new Error('Token revoked');
      revokedErr.code = 'auth/id-token-revoked';
      mockVerifyIdToken.mockRejectedValueOnce(revokedErr);

      await expect(authMod.verifyFirebaseIdTokenSafe('tok_rev', true)).rejects.toMatchObject({
        code: 'auth/id-token-revoked',
      });
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(1);
    });

    it('resolve super_admin via superusers/ownership/bootstrap mesmo sem custom claims', async () => {
      getColMap('system_config').set('ownership', {
        currentOwnerEmail: 'master@sge.edu.mz',
      });
      getColMap('superusers').set('uid_master', {
        email: 'master@sge.edu.mz',
        ativo: true,
      });

      const user = await authMod.resolveUserAuthorizationFromFirestore({
        uid: 'uid_master',
        email: 'master@sge.edu.mz',
      });

      expect(user.role).toBe('super_admin');
      expect(user.tenant_id).toBe('super-admin');
      expect(user.must_reset_password).toBe(false);
    });

    it('rejeita com auth/superadmin-revoked quando a conta foi marcada como revoked_superadmin sem titularidade ativa', async () => {
      getColMap('system_config').set('ownership', {
        currentOwnerEmail: 'novo.dono@sge.edu.mz',
      });
      getColMap('users').set('uid_antigo', {
        email: 'antigo@sge.edu.mz',
        role: 'revoked_superadmin',
        tipo: 'revoked_superadmin',
        ativo: false,
      });

      await expect(
        authMod.resolveUserAuthorizationFromFirestore({
          uid: 'uid_antigo',
          email: 'antigo@sge.edu.mz',
        })
      ).rejects.toMatchObject({
        code: 'auth/superadmin-revoked',
      });
    });

    it('invalida token anterior quando user_revocations.revokedAfter é estritamente posterior ao auth_time', async () => {
      const nowMs = Date.now();
      getColMap('user_revocations').set('uid_x', {
        revokedAfter: nowMs,
      });

      await expect(
        authMod.resolveUserAuthorizationFromFirestore({
          uid: 'uid_x',
          email: 'docente@escola.mz',
          auth_time: Math.floor((nowMs - 5000) / 1000),
        })
      ).rejects.toMatchObject({
        code: 'auth/id-token-revoked',
      });
    });
  });

  describe('Fase 1: Serviço de FAQ & Categorias', () => {
    it('sanitiza HTML perigoso removendo scripts, event handlers e URLs javascript:', () => {
      const dirty =
        '<p>Olá <strong>Mundo</strong></p>' +
        '<script>alert(1)</script>' +
        '<img src="x" onerror="alert(2)" />' +
        '<a href="javascript:alert(3)" onclick="steal()">Mau link</a>' +
        '<a href="https://sge.edu.mz/ajuda">Link seguro</a>';

      const clean = faqMod.sanitizeRichTextHtml(dirty);
      expect(clean).toContain('<strong>Mundo</strong>');
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('<a href="https://sge.edu.mz/ajuda" target="_blank" rel="noopener noreferrer">Link seguro</a>');
    });

    it('gere ciclo CRUD de categorias, propaga renomeação e bloqueia remoção quando há artigos associados', async () => {
      const { category } = await faqMod.createFaqCategory(
        {
          tenant_id: 'global',
          nome: 'Matrículas e Admissões',
          descricao: 'Dúvidas sobre inscrição',
          ordem: 1,
          ativo: true,
          visibilidade_padrao: 'todos',
        },
        superActor
      );

      expect(category.slug).toBe('matriculas-e-admissoes');
      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'faq_category', action: 'create', entity_id: category.id })
      );

      const { article } = await faqMod.createFaqArticle(
        {
          tenant_id: 'global',
          tipo: 'faq',
          titulo: 'Como efectuar matrícula?',
          pergunta: 'Como efectuar matrícula?',
          resposta_html: '<p>Aceda ao módulo de matrículas e submeta os documentos.</p>',
          categoria_id: category.id,
          palavras_chave: ['matrícula', 'inscrição'],
          anexos: [],
          estado: 'publicado',
          prioridade: 80,
          visibilidade: 'todos',
          utilizavel_ia: true,
        },
        superActor
      );

      const updatedCat = await faqMod.updateFaqCategory(
        category.id,
        { nome: 'Matrículas Académicas' },
        superActor
      );
      expect(updatedCat?.nome).toBe('Matrículas Académicas');

      // Propagação do nome da categoria no artigo
      const storedArt = getColMap('faq_articles').get(article.id);
      expect(storedArt.categoria_nome).toBe('Matrículas Académicas');

      // Bloqueio 409 ao tentar remover categoria em uso
      const delRes = await faqMod.deleteFaqCategory(category.id, superActor);
      expect(delRes.deleted).toBe(false);
      expect(delRes.conflict).toBe(true);
    });

    it('valida anexos por magic bytes e rejeita ficheiros falsificados', async () => {
      // PNG válido (89 50 4E 47 0D 0A 1A 0A)
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const { attachment } = await faqMod.uploadFaqAttachment(
        {
          nome: 'guia.png',
          mime_type: 'image/png',
          dataBase64: pngBytes.toString('base64'),
          tenant_id: 'global',
        },
        superActor
      );
      expect(attachment.tipo).toBe('image');
      expect(attachment.url).toBe(`/api/faq/attachments/${attachment.id}`);

      const fetched = await faqMod.getFaqAttachmentForCaller(attachment.id, superActor);
      expect(fetched.found).toBe(true);
      expect(fetched.forbidden).toBeUndefined();
      expect(fetched.mimeType).toBe('image/png');

      // HTML malicioso disfarçado de PDF
      const fakePdf = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
      await expect(
        faqMod.uploadFaqAttachment(
          {
            nome: 'malicioso.pdf',
            mime_type: 'application/pdf',
            dataBase64: fakePdf.toString('base64'),
            tenant_id: 'global',
          },
          superActor
        )
      ).rejects.toThrow();
    });

    it('regista histórico de alterações detalhado e calcula contagens reais na visão geral', async () => {
      const { category } = await faqMod.createFaqCategory(
        { tenant_id: 'global', nome: 'Avaliações e Pautas', ordem: 2 },
        superActor
      );

      const { article } = await faqMod.createFaqArticle(
        {
          tenant_id: 'global',
          tipo: 'faq',
          titulo: 'Como lançar notas?',
          resposta_html: '<p>Abra a turma e selecione a pauta.</p>',
          categoria_id: category.id,
          palavras_chave: ['pauta'],
          anexos: [],
          estado: 'rascunho',
          prioridade: 50,
          visibilidade: 'docentes',
          utilizavel_ia: false,
        },
        superActor
      );

      const edited = await faqMod.updateFaqArticle(
        article.id,
        {
          estado: 'publicado',
          utilizavel_ia: true,
          resposta_html: '<p>Abra a turma, selecione a pauta e clique em publicar.</p>',
        },
        superActor
      );

      expect(edited?.historico_alteracoes.length).toBe(2);
      expect(edited?.historico_alteracoes[0]?.alteracoes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'estado', antes: 'rascunho', depois: 'publicado' }),
          expect.objectContaining({ campo: 'utilizavel_ia', antes: false, depois: true }),
        ])
      );

      const listRes = await faqMod.listFaqArticles({ q: 'publicar', utilizavel_ia: 'true', estado: 'publicado' });
      expect(listRes.total).toBe(1);

      const overview = await faqMod.getFaqOverview();
      expect(overview.totalPerguntas).toBe(1);
      expect(overview.publicadas).toBe(1);
      expect(overview.rascunhos).toBe(0);
      expect(overview.utilizavelIa).toBe(1);
      expect(overview.totalCategorias).toBe(1);
    });

    it('aplica isolamento multi-tenant e regras de visibilidade na consulta pública do portal', async () => {
      const { category } = await faqMod.createFaqCategory(
        { tenant_id: 'global', nome: 'Suporte Técnico', ordem: 1, ativo: true },
        superActor
      );

      // Artigo global visível apenas para docentes
      await faqMod.createFaqArticle(
        {
          tenant_id: 'global',
          tipo: 'faq',
          titulo: 'Registo de presenças docente',
          resposta_html: '<p>Exclusivo para professores.</p>',
          categoria_id: category.id,
          palavras_chave: ['presenças'],
          anexos: [],
          estado: 'publicado',
          prioridade: 70,
          visibilidade: 'docentes',
          utilizavel_ia: true,
        },
        superActor
      );

      // Artigo específico da escola A para todos
      await faqMod.createFaqArticle(
        {
          tenant_id: 'tenant-A',
          tipo: 'faq',
          titulo: 'Horário da biblioteca Escola A',
          resposta_html: '<p>08h às 17h.</p>',
          categoria_id: category.id,
          palavras_chave: ['biblioteca'],
          anexos: [],
          estado: 'publicado',
          prioridade: 60,
          visibilidade: 'todos',
          utilizavel_ia: false,
        },
        superActor
      );

      // Artigo específico da escola B (não deve vazar para escola A)
      await faqMod.createFaqArticle(
        {
          tenant_id: 'tenant-B',
          tipo: 'faq',
          titulo: 'Regulamento interno Escola B',
          resposta_html: '<p>Confidencial da Escola B.</p>',
          categoria_id: category.id,
          palavras_chave: ['regulamento'],
          anexos: [],
          estado: 'publicado',
          prioridade: 90,
          visibilidade: 'todos',
          utilizavel_ia: true,
        },
        superActor
      );

      // Rascunho nunca aparece na consulta pública
      await faqMod.createFaqArticle(
        {
          tenant_id: 'global',
          tipo: 'faq',
          titulo: 'Rascunho interno',
          resposta_html: '<p>Ainda em revisão.</p>',
          categoria_id: category.id,
          palavras_chave: [],
          anexos: [],
          estado: 'rascunho',
          prioridade: 99,
          visibilidade: 'todos',
          utilizavel_ia: false,
        },
        superActor
      );

      // Estudante da Escola A vê apenas "todos" de global ou tenant-A (1 item)
      const resEstudanteA = await faqMod.listPublicFaqArticles({
        caller: { uid: 'est1', email: 'est@a.mz', role: 'estudante', tenant_id: 'tenant-A' },
      });
      expect(resEstudanteA.items.map((i) => i.titulo)).toEqual(['Horário da biblioteca Escola A']);

      // Docente da Escola A vê "docentes" global + "todos" da Escola A (2 itens), mas NÃO vê Escola B nem rascunho
      const resDocenteA = await faqMod.listPublicFaqArticles({
        caller: { uid: 'doc1', email: 'doc@a.mz', role: 'docente', tenant_id: 'tenant-A' },
      });
      expect(resDocenteA.total).toBe(2);
      expect(resDocenteA.items.some((i) => i.tenant_id === 'tenant-B')).toBe(false);
      expect(resDocenteA.items.some((i) => i.estado === 'rascunho')).toBe(false);

      const catsDocenteA = await faqMod.listPublicFaqCategories({
        uid: 'doc1',
        email: 'doc@a.mz',
        role: 'docente',
        tenant_id: 'tenant-A',
      });
      expect(catsDocenteA[0]?.artigos_count).toBe(2);
    });
  });
});
