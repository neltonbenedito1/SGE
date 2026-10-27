# Prompt de correcção de erros — SGE (Sistema de Gestão Educacional)

Copie o texto abaixo e cole no seu assistente de código (Cursor, Claude Code, Copilot, etc.) com o repositório `neltonbenedito1/SGE` aberto.

---

És um engenheiro sénior de React 19 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) e Cloudflare Workers. Vais corrigir os defeitos encontrados num teste de QA ao SGE em produção (https://sge.neltonbenedito1.workers.dev), feito a 25/26-10-2026. Trabalha por ordem de prioridade, faz commits pequenos (um por item) e não alteres comportamento que não esteja listado. No fim de cada bloco, executa `npm run build` e os testes existentes (`tests/`) e mostra um resumo das alterações.

## P0 — Segurança e autenticação (obrigatório primeiro)

1. **Remover credenciais hardcoded do frontend.**
   - `src/App.tsx:136`, `src/App.tsx:536`, `src/lib/firebase.ts:99`, `src/components/SuperAdminPortal.tsx:958`, `src/components/SuperAdminFinancePanel.tsx:205` contêm a senha do super admin `'Errado23x'` e a senha padrão `'12345678'`. Estas strings aparecem no bundle público (`/assets/index-*.js`).
   - Elimina todas as chamadas `ensureFirebaseAuthSession('neltonbenedito1@gmail.com', 'Errado23x')`. A sessão deve vir só de `onAuthStateChanged`.
   - Em `firebase.ts`, não uses nenhuma senha por omissão. A criação de utilizadores deve passar por um endpoint de backend (Firebase Admin SDK) que gere uma senha aleatória e envie um link de redefinição (`generatePasswordResetLink`).
   - O papel `super_admin` tem de ser definido por **custom claims** (Admin SDK) e validado em `firestore.rules`, nunca pelo e-mail no cliente.
   - Depois de corrigir, avisa que a senha `Errado23x` tem de ser **trocada** no Firebase Console, porque já foi exposta.
2. **Corrigir o fluxo de login do super admin** (`src/App.tsx` ~linhas 528–590):
   - Remove o bootstrap automático (`registerUserInFirebaseAuth`) e o ramo `catch { isSuperAdminAuth = true; }`, que concede acesso sem autenticação válida.
   - O login deve ser apenas `signInWithEmailAndPassword`. Depois lê `getIdTokenResult()` e verifica `claims.role === 'super_admin'`.
   - Não escrevas em `superusers`/`users` a partir do cliente durante o login.
   - Mostra erros específicos (`auth/invalid-credential`, `auth/too-many-requests`, `auth/user-disabled`).
   - Contexto: a conta `neltonbenedito1@gmail.com` com a senha fornecida pelo dono falhou com "Credenciais inválidas", ou seja, a senha no Firebase Auth não coincide. Acrescenta um script de administração (`scripts/set-superadmin.ts`) que define a claim e redefine a senha via Admin SDK.
3. **Backend não implementado no Worker.** `server.ts` (Express) não corre em Cloudflare Workers.
   - Em produção, todos os `POST /api/*` devolvem **405**. `GET /health`, `/ready` e `/api/auth/session/verify` devolvem o HTML da SPA.
   - Rotas afectadas: `/api/auth/login`, `/api/auth/session/create`, `/api/auth/user/create`, `/api/send-email`, `/api/translate`, `/api/presenca/generate-qr`, `/api/presenca/validate-qr`, `/api/stripe/*`, `/api/upload/validate-file`, `/api/biblioteca/generate-synopsis`.
   - Escolhe uma de duas soluções:
     - (a) portar as rotas para um Worker com Hono (`src/worker.ts`) e configurar `wrangler.toml` com `main` + `assets` (SPA fallback apenas para GET não-`/api`);
     - (b) hospedar o Express noutro serviço (Cloud Run/Render) e configurar `VITE_API_BASE_URL`.
   - Segredos (SMTP, Stripe, chave de IA) devem ir para `wrangler secret`.
   - `/api/*` desconhecido tem de devolver JSON 404, nunca `index.html`.
   - No frontend, quando a API falhar, mostra um aviso claro em vez de falhar em silêncio (por exemplo, e-mails "em fila — Sem SMTP").

## P1 — Integridade de dados e lógica

4. **Actividades auto-geradas duplicadas.**
   - A auto-varredura cria repetidamente "Pendente Cadastral do Docente: X", "Nomeação de Director Escolar" e "Atribuição de Professor Titular" (o total passou de 9 para 17 durante o teste).
   - Usa uma chave idempotente (`auto_key = tipo + entidade_id`). Antes de criar, procura com `where('auto_key','==',k)` e `where('status','!=','concluida')`, ou usa um id de documento determinístico com `setDoc(..., {merge:true})`.
   - Faz o mesmo para as notificações "Actividade Atribuída" (que também saem duplicadas).
5. **Exclusão em cascata / integridade referencial** (`src/components/TenantPortal.tsx`):
   - Ao eliminar um estudante ou uma disciplina, as pautas ficam órfãs (aparece "Aluno") e a média do Dashboard não é recalculada (ficou em 13.7). Bloqueia a exclusão quando há dependências, ou faz exclusão em cascata/arquivamento com `writeBatch`.
   - Ao eliminar um docente ou estudante, a conta em `users` fica activa ou suspensa. Elimina ou desactiva também essa conta.
   - Adiciona o botão **Eliminar** para pautas em rascunho.
6. **Conta de utilizador criada sem pedido.** Ao matricular um estudante com "Usuário do Sistema" **desmarcado**, mesmo assim é criada uma conta activa. Respeita a checkbox.
7. **Pautas** (`TenantPortal.tsx` ~linhas 3111 e 7125–7140):
   - O estado por omissão é `'Admitido'` mesmo sem notas. Deve ser `'Pendente'` até existirem avaliações.
   - A pré-visualização da média aceita valores > 20. Limita com `clamp(0,20)` no `onChange` e valida no submit.
   - Uniformiza a terminologia "Admitido/Aprovado" entre o formulário, a Pauta Geral e o Dashboard.
   - Só envia a notificação "Nova Nota de Pauta Publicada" quando `status === 'publicado'` (hoje é enviada também em rascunho).
8. **Tradução.** O seletor PT/EN só troca a bandeira. Usa i18n estático (`src/i18n`, `react-i18next`) em vez de depender de `/api/translate`.
9. **Backup JSON incompleto.** O backup exporta só tenant, config, províncias, escolas, docentes, estudantes, turmas, classes, pautas e processos. Inclui também disciplinas, salas, livros, actividades, users (sem dados sensíveis), presenças, calendário e plano de aulas. Acrescenta `schema_version`.

## P2 — Validação de formulários

10. **Sala:** a capacidade aceita -5. O input tem `min=0 max=0` mal configurado. Usa `min=1` e valida no submit.
11. **Docente:** o NUIT tem de ter exactamente 9 dígitos (`/^\d{9}$/`). Valida o telefone no formato moçambicano (`/^(\+258)?8[2-7]\d{7}$/`) e o e-mail.
12. **Estudante:** a data de nascimento não pode ser futura e a idade tem de ser plausível (4 a 60 anos).
13. **Transferência:** bloqueia transferir para a mesma escola e turma. Envia o assunto do e-mail de transferência em português.
14. **Actividade:** o prazo não pode ficar no passado.
15. **Calendário:** explica que agendar uma aula exige um tópico no Plano de Aulas, ou permite agendar sem tópico.
16. **Assiduidade:**
    - Não mostres "AGENDA CONFIRMADA" quando não há aulas no dia.
    - Usa o fuso da instituição (`Africa/Maputo`) em vez de "Horário de Brasília".
17. **Biblioteca** (`src/components/BibliotecaModule.tsx`):
    - Linhas 439 e 467: remove `Math.random()` como contagem de páginas de reserva. Usa `pdfjs-dist` (`getDocument().numPages`) ou deixa o campo vazio e obrigatório.
    - Mostra o tamanho real do ficheiro (`file.size` formatado em KB/MB). Hoje mostra 1.5 MB para 1.4 KB, e 0 MB na pré-visualização.
    - "Média avaliações" deve mostrar "—" quando não há avaliações (não 4.5).
    - O leitor de PDF abre em branco e por baixo da dobra. Abre-o num modal em ecrã inteiro com `pdfjs` e verifica CORS/`Content-Type` no Storage.

## P3 — UI, i18n e acessibilidade

18. **Cabeçalhos com chaves técnicas:** ANALISE_ADMINISTRATIVA, PROVINCIAS, PLANO_AULAS, PAUTA_GERAL, PAUTAS, CLASSES_ESCOLARES, CALENDARIO, CONFIGURACAO, USUARIOS, NOTIFICACOES, PERMISSOES_GLOBAIS, SALAS, ATIVIDADES. Cria um mapa `viewKey -> título PT` (por exemplo, "Análise Administrativa", "Plano de Aulas").
19. **Títulos e toasts técnicos ou mistos:**
    - "Novo Lançamento (SALA/STUDENT/USER/PAUTA)" e "Editar Registro (STUDENT)" devem passar a "Nova Sala", "Editar Estudante", etc.
    - Ao guardar uma disciplina aparece "Registro de classe salvo"; deve ser "Disciplina guardada".
    - "Registro de student salvo" deve passar a "Estudante guardado".
20. **Contraste no modo escuro (WCAG AA ≥ 4.5:1):**
    - badge da escola branco sobre branco (Disciplinas)
    - coluna Acções branca
    - "Limite do Plano Plus"
    - cartões cinzentos de Turma, Sala e Calendário
    - painel Matéria
    - valores de média na pauta
    - título "Divergência de Páginas" (laranja sobre laranja)
    - título do livro no cartão
21. **Tabela de pautas:** a coluna sticky "Acções" sobrepõe Exame e Média Final. Adiciona fundo opaco, `z-index` e `padding-right` à tabela.
22. **Modais e toasts:**
    - Fecha os modais com Esc e evita empilhá-los.
    - Fecha a confirmação ao mudar de módulo.
    - Substitui `window.confirm` nativo por um modal próprio.
    - Empilha os toasts com espaçamento (sem sobreposição).
23. **Crachá:** mostra a classe (por exemplo, "12ª Classe") em vez do nível ("Secundário").

## Critérios de aceitação

- `grep -rn "Errado23x\|12345678" src dist` não devolve resultados.
- O login do super admin funciona com credenciais válidas e falha com credenciais inválidas, sem nenhum caminho que conceda acesso sem auth.
- `curl -X POST https://<dominio>/api/send-email` devolve 401 ou 400 em JSON (não 405). `GET /health` devolve JSON.
- Correr a auto-varredura 5 vezes não cria duplicados.
- Eliminar um estudante não deixa pautas órfãs e o Dashboard é recalculado.
- Todos os formulários rejeitam os valores inválidos listados.
- O modo escuro passa numa verificação de contraste (axe/Lighthouse ≥ 90 em acessibilidade).
- Acrescenta testes (Vitest/Playwright) para os itens 2, 4, 5, 7, 10–14.
