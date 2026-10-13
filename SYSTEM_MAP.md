# MAPA COMPLETO DO SISTEMA: SysEdu

Este documento funciona como um guia arquitetônico e de layout completo e rigoroso para o sistema **SysEdu** (SGE - Sistema de Gestão Educacional). Seu propósito é permitir que engenheiros e arquitetos realizem alterações em massa com precisão, sabendo exatamente onde e como as propriedades visuais, lógicas de dados e tokens de estilo estão configurados.

---

## 1. VISÃO GERAL DO SISTEMA

O **SysEdu** é um sistema SaaS multilocatário (multi-tenant) composto por duas áreas principais isoladas:
1. **Portal Super Admin**: Controle global de faturamento, faturas de assinatura SaaS, aprovação de contas de escolas, auditoria e depuração de falhas de e-mails/sistema.
2. **Portal Tenant**: Ambiente operacional de cada escola ou instituição individual (gestão de turmas, docentes, matrículas, notas, boletins, controle de presença via QR Code e biblioteca integrada de PDFs).

### Stack Tecnológica e Versões
*   **Frontend**: React (v19.0.1) construído sobre o Vite (v6.2.3) com TypeScript (v5.8.2).
*   **Estilização**: Tailwind CSS (v4.1.14) utilizando importação direta `@import "tailwindcss"` e o novo modelo declarativo de temas CSS.
*   **Animações**: Motion para React (`motion/react` v12.23.24) e transições suaves de estilo iOS.
*   **Banco de Dados e Autenticação**: Firebase Firestore (v12.15.0) para persistência em tempo real e Firebase Authentication para controle de credenciais criptográficas.
*   **Servidor Backend**: Node.js rodando servidor Express (v4.21.2) em conjunto com `tsx` (v4.21.0) para execução em TypeScript. Em desenvolvimento, o servidor monta o middleware do Vite para Hot Module Replacement (HMR).
*   **Processamento de E-mail**: Nodemailer (v9.0.3) integrado com suporte a servidores SMTP dedicados por tenant ou fallback de simulação.
*   **Gateway de Pagamento**: Integração híbrida Stripe (v22.4.0 no backend, `@stripe/stripe-js` v9.12.1 no frontend) e suporte local para meios de faturamento regionais (Multicaixa).
*   **Geração de PDFs e QR Codes**: jsPDF (v4.2.1), qrcode (v1.5.4) e jsQR (v1.4.0) para leituras e renderizações offline.
*   **Internacionalização (i18n)**: i18next (v26.4.0) e react-i18next (v17.0.12).
*   **Gerenciador de Pacotes**: `npm` ou `bun` (arquivo `bun.lock` presente).

### Scripts de Execução (`package.json`)
*   `npm run dev`: Executa o backend Express integrado com o Vite em modo desenvolvimento via `tsx server.ts`.
*   `npm run build`: Compila a SPA do Vite (`vite build`) e empacota o servidor Node.js com o `esbuild` em `/dist/server.cjs`.
*   `npm run preview`: Inicia o servidor local para pré-visualização da compilação de produção.
*   `npm run lint`: Valida erros de sintaxe TypeScript (`tsc --noEmit`).

### Variáveis de Ambiente (`.env.example`)
*   `GEMINI_API_KEY`: Chave de API do Google Gemini utilizada no servidor Express para tradução automática de tela e síntese literária.
*   `APP_URL`: URL base do sistema para redirecionamentos e webhooks do gateway financeiro.
*   `VITE_STRIPE_PUBLISHABLE_KEY`: Chave pública do Stripe para o formulário Checkout do lado do cliente.
*   `STRIPE_SECRET_KEY`: Chave privada do Stripe para transações seguras no backend.
*   `STRIPE_WEBHOOK_SECRET`: Segredo de validação criptográfica de payloads Stripe Webhook.

---

## 2. ÁRVORE DE ARQUIVOS E DIRETÓRIOS

Abaixo está a estrutura completa do repositório, com a função operacional de cada arquivo ou diretório:

```
├── .env.example                     # Modelo de variáveis de ambiente obrigatórias.
├── .gitignore                       # Arquivos e diretórios ocultados do controle de versão.
├── COOKIE_POLICY_SUMMARY.md         # Resumo explicativo das políticas de consentimento LGPD.
├── Logo2.png                        # Asset de imagem estática do logo principal.
├── assets/                          # Diretório de mídias e assets estáticos adicionais.
├── bun.lock                         # Lockfile do gerenciador Bun.
├── firebase-applet-config.json      # Configuração de credenciais do Firebase Client.
├── firebase-blueprint.json          # Modelo conceitual estruturado em formato JSON Schema.
├── firestore.rules                  # Regras de segurança robustas do Firestore baseadas em funções.
├── functions/                       # Cloud Functions (se houver infraestrutura serverless).
├── index.html                       # Ponto de entrada HTML indexado como Progressive Web App (PWA).
├── metadata.json                    # Metadados e permissões da aplicação no ambiente Google.
├── package-lock.json                # Lockfile de dependências npm.
├── package.json                     # Declarações de scripts e pacotes instalados.
├── public/                          # Assets estáticos servidos diretamente na raiz.
├── server.ts                        # Servidor Express.js completo contendo APIs críticas do sistema.
├── tsconfig.json                    # Regras de compilação rigorosas do TypeScript.
├── vite.config.ts                   # Configurações do Vite e Tailwind v4.
└── src/                             # Código-fonte principal do frontend.
    ├── main.tsx                     # Inicializador do React, listeners de erro e i18n.
    ├── App.tsx                      # Gerenciador global de telas, autenticação e login único.
    ├── types.ts                     # Centralizador de contratos e interfaces TypeScript.
    ├── index.css                    # Folha de estilo global, temas de cores e utilitários.
    ├── vite-env.d.ts                # Declaração de tipos de ambiente do Vite.
    ├── components/                  # Componentes reutilizáveis e módulos funcionais.
    │   ├── AnalyticsModule.tsx      # Gráficos analíticos de rendimento com Recharts.
    │   ├── AtividadesModule.tsx     # Listagem e controle de tarefas, atividades e prazos.
    │   ├── BibliotecaModule.tsx     # Gerenciamento de livros, edições em PDF e sinopses.
    │   ├── BrandbookView.tsx        # Centralizador visual dos guias de marca SysEdu.
    │   ├── CookieBanner.tsx         # Alerta flutuante de consentimento LGPD.
    │   ├── CookiePolicyModal.tsx    # Modal de termos de uso dos Cookies de sessão.
    │   ├── DocenteFormModal.tsx     # Formulário complexo em abas para dados profissionais/pessoais de professores.
    │   ├── ErrorBoundary.tsx        # Barreira de contenção de erros de renderização.
    │   ├── ErrorLogsModule.tsx      # Terminal de monitoramento de logs de erros em tempo real.
    │   ├── GlobalPermissionsModule.tsx # painel de controle granular de matriz de permissões.
    │   ├── InternalPdfViewer.tsx    # Leitor de PDF embutido que bloqueia download direto indesejado.
    │   ├── LanguageSwitcher.tsx     # Dropdown estilizado para troca manual de idiomas.
    │   ├── MandatoryPasswordResetModal.tsx # Forçador de troca de senha inicial.
    │   ├── NotificationSettingsModule.tsx # Painel de configurações de regras de envio de e-mails.
    │   ├── PerformanceEvaluationModule.tsx # Avaliação quantitativa de desempenho do corpo docente.
    │   ├── ProcessoIndividualModule.tsx # Registro de processos individuais (Matrícula, Justificativas).
    │   ├── SamsungLoadingScreen.tsx # Animação de pré-carregamento interativa e estilizada.
    │   ├── SchoolMap.tsx            # Georreferenciamento de escolas com API de mapas.
    │   ├── SearchableDropdown.tsx   # Filtro dinâmico de chaves em selects complexos.
    │   ├── StripeCheckoutStatus.tsx # Exibição de comprovantes e retornos de pagamentos Stripe.
    │   ├── StripePricingCards.tsx   # Tabela comparativa e interativa de preços de planos SaaS.
    │   ├── StudentQrDisplay.tsx     # Emissor de crachá digital com gerador de QR Code de matrícula.
    │   ├── SuperAdminFinancePanel.tsx # Indicadores financeiros SaaS para o Super Administrador.
    │   ├── SuperAdminPortal.tsx     # Portal corporativo global com abas de auditoria e clientes.
    │   ├── SysEduLogo.tsx           # Arquivo SVG vetorial oficial do logotipo da SysEdu.
    │   ├── TenantPortal.tsx         # Portal operacional multi-escolas do Tenant com todos os submódulos escolares.
    │   ├── UserPermissionsChecklist.tsx # Visualizador em checkboxes de acessos de escrita/leitura.
    │   ├── ValidarPresencaModal.tsx # Scanner de QR Code via câmera para registro automático de assiduidade.
    ├── hooks/                       # Custom Hooks transversais do React.
    │   ├── useAuthSecurityCheck.ts  # Monitor de sessão ativa, inatividade e token de segurança.
    │   ├── useLanguage.ts           # Facilitador para controle reativo de localidade.
    ├── i18n/                        # Infraestrutura de internacionalização de strings.
    │   ├── index.ts                 # Arquivo de bootstrapping do i18next.
    │   └── locales/                 # Arquivos de dicionários estáticos.
    │       ├── en/                  # JSON de tradução para Inglês.
    │       └── pt/                  # JSON de tradução para Português.
    ├── lib/                         # Bibliotecas de integração, utilitários e clientes.
    │   ├── browserNotifications.ts  # Wrapper para a API de Notificação nativa do Browser.
    │   ├── cookies.ts               # Manipulação direta de Cookies (LGPD Compliance).
    │   ├── emailUtils.ts            # Gerador de payloads MIME e templates de email de OTP.
    │   ├── firebase.ts              # Inicializador e conector do SDK do Firestore e Auth.
    │   ├── imageCompression.ts      # Utilitário para compactação de fotos de perfil no upload.
    │   ├── localDb.ts               # Armazenamento e fallback offline IndexedDB.
    │   ├── payments-core.ts         # Orquestrador de requisições de pagamento ao backend.
    │   ├── stripe-client.ts         # Inicialização do assistente Stripe Checkout.
    │   ├── translation.ts           # Mecanismo local de fallback e tradução via dicionário.
    │   ├── useUnsavedChangesGuard.ts# Event listener que previne fechamento acidental de abas com formulários.
    │   └── userState.ts             # Sincronizador de preferências de perfil de usuário.
    ├── services/                    # Serviços lógicos com regras de negócio.
    │   ├── authSecurityService.ts   # Interceptador e verificador de expirações de token e OTP.
    │   ├── errorLoggingService.ts   # Gerenciador e catalogador persistente de erros globais.
    │   └── notificationDispatcher.ts# Despachante inteligente de e-mails de eventos acadêmicos.
    └── utils/                       # Funções utilitárias puras.
        └── qrCodeHelper.ts          # Gerador e parser de payloads binários de QR Code estudantil.
```

---

## 3. ROTAS E TELAS

O roteamento da aplicação é controlado por estado reativo baseado em cookies de sessão (`currentView` no `src/App.tsx`, linha ~100). Isso impede que usuários burlem barreiras de navegação digitando URLs em um roteador de histórico tradicional:

| Caminho / Estado da View | Componente Principal | Layout Pai | Papéis Exigidos (Roles) | Dados Carregados | Componentes Utilizados |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `'landing'` (Padrão) | `App.tsx` (linhas ~1200-1880) | Nenhum | Visitante | Lista de Planos e Tenants cadastrados do Firestore. | `SysEduLogo`, `StripePricingCards`, `CookieBanner`. |
| `'superadmin'` | `SuperAdminPortal` | `App.tsx` | `super_admin` | Configurações globais, faturamento SaaS, Tenants, Logs de Auditoria e Logs de Erros. | `SysEduLogo`, `SuperAdminFinancePanel`, `ErrorLogsModule`, `CookiePolicyModal`. |
| `'tenant'` | `TenantPortal` | `App.tsx` | `admin`, `director`, `docente`, `pai`, `estudante` | Dados da escola do usuário logado (Professores, Alunos, Pautas, Turmas, Biblioteca). | `DocenteFormModal`, `ProcessoIndividualModule`, `StudentQrDisplay`, `ValidarPresencaModal`, `InternalPdfViewer`. |
| `'brandbook'` | `BrandbookView` | `App.tsx` | Desenvolvedor / Admin | Diretrizes e tokens visuais oficiais do sistema. | `SysEduLogo`. |

---

## 4. COMPONENTES

Detalhamento técnico dos principais componentes da aplicação:

### 1. `SuperAdminPortal.tsx` (src/components/SuperAdminPortal.tsx)
*   **Props**:
    *   `onLogout` (Função, Opcional): Callback para destruir sessão.
    *   `activeTheme` (String, Opcional): Nome do tema ativo (`theme-dark` ou `theme-slate`).
    *   `onChangeTheme` (Função, Opcional): Callback para alteração do tema do sistema.
    *   `systemLang` (String, Opcional): Código do idioma ativo.
    *   `onChangeLanguage` (Função, Opcional): Callback para mudança de localidade.
*   **Estados**: `activeTab` ('dashboard', 'tenants', 'plans', 'payments', 'logs', 'smtp', 'notificacoes_config', 'logs_instituicoes', 'logs_erros'), `tenants`, `plans`, `logsAdmin`, `isAnyModalOpen`, `isSmtpModalOpen`, `smtpForm`.
*   **Contextos Consumidos**: Preferências de cookies (`getThemePreference`, `getSystemLanguage`).
*   **Eventos Emitidos**: `sge-navigate-superadmin` (Navegação via Command Menu Ctrl+K).
*   **Filhos**: `SuperAdminFinancePanel`, `ErrorLogsModule`, `CookiePolicyModal`, `SysEduLogo`, `SamsungLoadingScreen`.
*   **Uso**: Ponto principal de visualização quando logado como Administrador Geral do SaaS.

### 2. `TenantPortal.tsx` (src/components/TenantPortal.tsx)
*   **Props**: Semelhantes ao SuperAdminPortal (controle de logs, sessão e tema).
*   **Estados**: `activeTab` ('dashboard', 'provincias', 'escolas', 'docentes', 'estudantes', 'turmas', 'pautas', 'processos', 'calendario', 'definicoes'), `escolas`, `docentes`, `estudantes`, `turmas`, `faturas`, `notificacoes`.
*   **Contextos Consumidos**: `useLanguage`, `localDb` para persistência offline.
*   **Eventos Emitidos**: `sge-navigate-tenant`, `sge-tenant-deleted`.
*   **Filhos**: `DocenteFormModal`, `ProcessoIndividualModule`, `StudentQrDisplay`, `ValidarPresencaModal`, `SearchableDropdown`.
*   **Uso**: O "coração" do sistema para todos os usuários do tenant (Escolas, Alunos, Professores). Contém o maior volume de regras operacionais de dados.

### 3. `ErrorLogsModule.tsx` (src/components/ErrorLogsModule.tsx)
*   **Props**: `onNotify` (Callback para disparar notificações toast).
*   **Estados**: `logs` (LogErro[]), `loading` (Boolean), `refreshing` (Boolean), `searchQuery` (String), `filterOrigem`, `filterSeveridade`, `filterStatus`, `selectedLog` (LogErro), `resolutionNote`.
*   **Hooks Usados**: `useMemo`, `useEffect`.
*   **Consumo**: `errorLoggingService` (`fetchSystemErrors`, `updateErrorStatus`, `subscribeToErrorLogs`).
*   **Uso**: Injetado dentro do `SuperAdminPortal` quando `activeTab === 'logs_erros'`.

### 4. `DocenteFormModal.tsx` (src/components/DocenteFormModal.tsx)
*   **Props**: `isOpen` (Boolean), `onClose` (Função), `onSave` (Função), `docente` (Docente, Opcional para Edição), `escolas` (Escola[]).
*   **Estados**: `formTab` ('pessoal' \| 'profissional' \| 'academico'), `formData` (Estrutura detalhada do Docente).
*   **Uso**: Renderizado dentro do portal de Tenants no gerenciamento do corpo docente. É um dos formulários mais complexos em abas.

### 5. Componentes Reutilizáveis e Duplicações Identificadas:
*   **Reutilizáveis**:
    *   `SysEduLogo`: Usado em Landing, Login, SuperAdmin e Tenant. Altamente parametrizável.
    *   `SearchableDropdown`: Usado para filtrar seleções longas de professores, escolas e turmas no TenantPortal.
    *   `SamsungLoadingScreen`: Animação limpa e futurista usada em carregamentos de páginas administrativas.
*   **Duplicações de Código**:
    *   Formulários de criação rápidos dentro do `TenantPortal.tsx` (como cadastro rápido de Salas, Províncias e Feriados) possuem blocos JSX e manipuladores `useState` muito similares, que poderiam ser abstraídos em um componente genérico de formulário modal de cadastro.

---

## 5. DESIGN SYSTEM E LAYOUT (Prioridade Máxima para Alterações Visuais)

O SysEdu é configurado usando as regras declarativas do **Tailwind CSS v4**. Toda a paleta de cores e tipografia são amarradas a classes e variáveis nativas do CSS definidas no arquivo `src/index.css`.

### Tokens do Design System (Definidos em `src/index.css`, Linhas ~4-170)

#### 1. Tipografia (Fontes e Escalas)
*   `--font-sans`: `"Inter", ui-sans-serif, system-ui, sans-serif` (Linha 5) - Usado para textos de corpo, tabelas, metadados e formulários.
*   `--font-poppins`: `"Poppins", sans-serif` (Linha 6) - Usado prioritariamente para títulos, cabeçalhos, logos e seções de destaque.
*   `--font-mono`: `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` (Linha 7) - Usado para dados numéricos de faturamento, IDs, carimbos de hora de logs, hashes e tabelas financeiras (`font-mono tabular-nums`).

#### 2. Paleta de Cores de Marca (SysEdu Logo original)
*   **Azul-marinho escuro (Texto da marca)**: `#0D1B3D`
*   **Azul primário da marca (Destaques/Links)**: `#1E66F5`
*   **Verde-água (Sucesso/Confirmação/Destaques secundários)**: `#10B981`

#### 3. Variáveis de Tema (Configuradas por classes dinâmicas)

| Token CSS | Valor no Tema Claro (`.theme-slate`) | Valor no Tema Escuro (`.theme-dark`) | Descrição e Propósito Visual |
| :--- | :--- | :--- | :--- |
| `--theme-bg` | `#F4F6F9` | `#0F1115` | Fundo principal da viewport de tela. |
| `--theme-bg-secondary`| `#E5E7EB` | `#161B22` | Fundo secundário para divisores ou containers de entrada. |
| `--theme-card` | `#FFFFFF` | `#1E242C` | Fundo de cartões de informações e containers brancos. |
| `--theme-sidebar` | `#FFFFFF` | `#12161C` | Fundo da barra de navegação lateral (Sidebar). |
| `--theme-navbar` | `#F3F4F6` | `#161B22` | Fundo da barra superior de cabeçalho. |
| `--theme-text` | `#1F2937` | `#FFFFFF` | Texto principal das telas. |
| `--theme-text-muted` | `#4B5563` | `#D1D5DB` | Texto secundário / descrições. |
| `--theme-border` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` | Linhas de borda fina e separadores de tabela. |
| `--btn-primary` | `#2563EB` | `#2563EB` | Cor base de botões de ação principal. |
| `--btn-primary-hover`| `#1D4ED8` | `#1D4ED8` | Hover de botões de ação principal. |
| `--btn-danger` | `#DC2626` | `#DC2626` | Botões de exclusão ou avisos de segurança. |

#### 4. Valores Hardcoded Identificados Fora do index.css
*   **Tons azuis de destaque adicionais**: `bg-indigo-600` e `hover:bg-indigo-500` aparecem em massa em botões em `SuperAdminPortal.tsx` (linhas ~4000-4100) e `TenantPortal.tsx`.
*   **Fundo padrão escuro no HTML**: `theme-color` `#0f172a` em `index.html` (linha 8).
*   **Zoom do Navegador**: Fixado em `zoom: 0.8` (redução óptica de densidade de layout) nas linhas 24-27 de `src/index.css`.

### Estrutura de Layout e Padrões de Interface (Containers Recorrentes)

1.  **Sidebar de Navegação (Menu Lateral)**:
    *   Configurado usando `<aside>` com largura flutuante controlada por estado (`isExpanded` ou largura padrão `w-64` para desktop, recuando para `w-20` recolhido). Possui design de colunas flexíveis (`flex flex-col h-screen`).
2.  **Top Header (Navbar)**:
    *   Seção horizontal flutuante ou fixa de altura fixa `h-[72px]`. Responsável por abrigar o título principal, botão de menu mobile, toggler de tema claro/escuro e o seletor dropdown de idiomas do sistema.
3.  **Tabelas de Dados**:
    *   Configuradas em containers com rolagem horizontal livre (`overflow-x-auto rounded-2xl border`). As cabeças de tabelas (`<thead>`) utilizam fundo cinza suave (`bg-slate-50` ou variável `--table-header-bg` no escuro) com fontes semi-negritas (`font-semibold text-xs text-slate-500 uppercase`).
4.  **Botões e Controles**:
    *   *Botão Primário*: `py-2.5 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all active:scale-95`.
    *   *Botão Secundário*: `py-2.5 px-4 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors`.

### Suporte a Temas e Responsividade
*   **Tema Claro e Escuro**: O sistema aplica os overrides de classe por herança direto em cascata através de `.theme-slate` e `.theme-dark` aplicados na tag `html` ou `body`. O arquivo `src/index.css` possui blocos de redefinição forçada (`HIGH-POLISH GLOBAL DARK THEME OVERRIDES`, linhas ~174-396) que interceptam classes padrões do Tailwind (como `.bg-white` para `--theme-card` e `.border-slate-200` para `--theme-border`) para garantir conformidade perfeita do modo escuro.
*   **Responsividade**: Controlada usando breakpoints nativos do Tailwind:
    *   Menu Sidebar esconde em telas móveis (`hidden md:flex`) e é controlado por gaveta deslizante (drawer) no mobile utilizando gestos ou clique no ícone `<Menu />`.
    *   Grids flexíveis (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`) são usados em cards de alunos, relatórios e contadores analíticos.
*   **Biblioteca de Ícones**: Lucide React (`lucide-react`).

---

## 6. DADOS E BACKEND

O armazenamento persistente do SysEdu usa **Firebase Firestore** gerenciado em tempo real. A segurança de transação é imposta no backend por meio do `firestore.rules`.

### Coleções do Banco de Dados (Estruturadas no Firestore)

#### 1. `tenants`
*   **Propósito**: Cadastro de instituições escolares clientes do SaaS.
*   **Esquema de Campos**:
    *   `id` (String, Obrigatório): ID exclusivo ou ID de auto-onboarding.
    *   `nome` (String, Obrigatório): Nome da instituição.
    *   `slug` (String, Obrigatório): Link URL amigável (Slug).
    *   `plano_id` (String, Obrigatório): Relação com plano ('plano-basico', 'plano-pro', 'plano-plus').
    *   `status` (String): Estado de assinatura (`'ativo' \| 'suspenso' \| 'cancelado' \| 'pendente_pagamento'`).
    *   `email_admin` (String): E-mail do Administrador Responsável.
    *   `data_vencimento` (String): Data limite da licença (YYYY-MM-DD).

#### 2. `users`
*   **Propósito**: Cadastro unificado de usuários com privilégios.
*   **Esquema de Campos**:
    *   `id` (String, ID do Auth): Vinculado diretamente ao Firebase Auth UID.
    *   `tenant_id` (String, Obrigatório): ID de isolamento multitenant.
    *   `email` (String, Obrigatório): E-mail de credencial.
    *   `nome` (String, Obrigatório): Nome completo do usuário.
    *   `tipo` (String): Perfil de acesso (`'admin' \| 'director' \| 'docente' \| 'pai' \| 'estudante'`).
    *   `ativo` (Boolean): Flag de acesso bloqueado/liberado.
    *   `mustChangePassword` (Boolean): Forçador de troca de senha inicial.

#### 3. `escolas`
*   **Propósito**: Escolas vinculadas a um tenant.
*   **Esquema de Campos**: `id`, `tenant_id`, `provincia_id`, `nome`, `endereco`, `telefone`, `email`, `diretor_id`, `ativo`.

#### 4. `docentes`
*   **Propósito**: Ficha técnica e acadêmica do professor.
*   **Esquema de Campos**: `id`, `tenant_id`, `user_id`, `nome`, `data_nascimento`, `documento_identificacao`, `telefone`, `email`, `escola_id`, `tipo_vinculo`, `formacoes_academicas` (Array de Objetos).

#### 5. `estudantes`
*   **Propósito**: Ficha completa e faturamento mensal do aluno.
*   **Esquema de Campos**: `id`, `tenant_id`, `user_id`, `nome`, `numero_matricula`, `data_nascimento`, `genero`, `escola_id`, `turma_id`, `pai_id`, `propina_valor`, `propina_vencimento`, `qr_code_data`.

#### 6. `pautas`
*   **Propósito**: Boletim de notas trimestrais.
*   **Esquema de Campos**: `id`, `tenant_id`, `escola_id`, `turma_id`, `estudante_id`, `classe_id` (Disciplina), `trimestre`, `nota_prova`, `nota_trabalho`, `nota_participacao`, `media_final`, `situacao` (`'Aprovado' \| 'Reprovado'`).

#### 7. `logs_erros`
*   **Propósito**: Catálogo detalhado de erros do sistema (gerado pela equipe de engenharia para depuração automática).
*   **Esquema de Campos**: `id`, `origem`, `tenant_id`, `tenant_nome`, `usuario_email`, `mensagem`, `stack_trace`, `severidade` (`'critico' \| 'erro' \| 'aviso'`), `status` (`'aberto' \| 'investigando' \| 'resolvido'`), `url`, `user_agent`, `created_at`.

### Regras de Segurança do Firestore (`firestore.rules`)
O arquivo aplica isolamento estrito de inquilino (multitenancy isolation) baseando-se no campo `request.auth.uid`. Usuários comuns de um tenant só podem ler dados cuja propriedade `tenant_id` coincida com a propriedade `tenant_id` gravada em seu próprio documento de usuário `/users/$(request.auth.uid)`. O Super Administrador global possui passe livre de auditoria.

### Fluxo de Autenticação e Autorização (Auth Flow)
1.  **Entrada**: Tela de Login único em `App.tsx` (método `handleLogin`, linha ~499).
2.  **Validação**: Credenciais enviadas ao Firebase Auth via `signInWithEmailAndPassword`.
3.  **Roteamento por Tenant**: O sistema lê o documento do usuário em `/users`, extrai o `tenant_id` e redireciona de acordo com o `tipo` de usuário. Se o tenant estiver em atraso de faturamento (`status === 'suspenso'`), o login é interrompido com mensagem informativa.
4.  **Cookie HttpOnly**: O frontend chama o endpoint backend `/api/auth/session/create` para gravar uma sessão HttpOnly segura no Express, ativando as barreiras de tempo de inatividade (timeout de 30 minutos).

---

## 7. ESTADO E LÓGICA DO SISTEMA

### Gerenciamento de Estado do Cliente
Não há stores globais de Redux ou Zustand instaladas para evitar complexidades de HMR. O controle de estado de dados é feito de duas maneiras:
1.  **Estados Reativos Locais**: Concentrados em `TenantPortal.tsx` e `SuperAdminPortal.tsx` usando `useState` e propagados para abas e modais através de passagem de props limpa.
2.  **Cache offline resiliente**: Desenvolvido no utilitário `src/lib/localDb.ts` que manipula o LocalStorage do navegador para armazenar dados estáticos de planos, províncias e permissões em situações de queda de sinal de internet.

### Serviços e Utilitários de Lógica (Camada `/src/services` e `/src/lib`)

*   `authSecurityService.ts`: Controla a validação de fluxos de login em 2 etapas (2FA OTP) para descriptografia de logs corporativos sigilosos.
*   `errorLoggingService.ts`: Intercepta falhas de JavaScript em tempo de execução no cliente (`window.onerror` e `window.onunhandledrejection`), gerando automaticamente registros catalogados no banco de dados com dados do navegador do usuário afetado.
*   `notificationDispatcher.ts`: Envia e-mails transacionais (como boletim de notas publicado, convocação de reuniões de pais ou alertas de faltas de assiduidade) formatando-os em inglês e forçando o cabeçalho UTF-8 para exibição correta de acentuação em qualquer software de e-mail (Gmail, Outlook).
*   `cookies.ts`: Lê, grava e expira cookies de consentimento e sessão em estrito compliance com a Lei Geral de Proteção de Dados (LGPD).

---

## 8. TEXTOS E TRADUÇÃO (Internacionalização)

O sistema suporta internacionalização avançada (i18n).

*   **Idiomas Suportados**: Português (`pt`), Inglês (`en`), Espanhol (`es`), Francês (`fr`), Alemão (`de`), Italiano (`it`), Chinês (`zh`), Japonês (`ja`), Russo (`ru`) e Árabe (`ar`).
*   **Métodos Utilizados**:
    1.  **i18next Estático**: Baseia-se em arquivos JSON estruturados localizados em `/src/i18n/locales`. O carregamento das traduções é ativado por namespace (NS) (ex: `common`, `dashboard`, `library`, `admin`, `users`).
    2.  **Tradução Dinâmica IA (Gemini)**: Integrada na biblioteca de tradução (`src/lib/translation.ts`, método `fetchAiTranslation`). Dispara uma chamada assíncrona ao backend `/api/translate` que utiliza o modelo **Gemini 3.5 Flash** para traduzir strings de bancos de dados ou relatórios dinâmicos que não existem no dicionário estático local.

---

## 9. MAPA DE DEPENDÊNCIAS DO PROJETO

```
index.html -> src/main.tsx
              ├── src/i18n/index.ts -> Carrega locales JSON (pt, en)
              ├── src/index.css -> Carrega Tailwind v4 e variáveis de temas
              └── src/App.tsx
                    ├── src/lib/firebase.ts -> Inicializador do banco de dados Firestore
                    ├── src/lib/cookies.ts -> Manipulação de sessões criptografadas e preferências
                    ├── src/components/SuperAdminPortal.tsx
                    │     ├── src/components/SuperAdminFinancePanel.tsx -> Indicadores SaaS
                    │     └── src/components/ErrorLogsModule.tsx
                    │           └── src/services/errorLoggingService.ts -> Registro de falhas
                    └── src/components/TenantPortal.tsx
                          ├── src/components/DocenteFormModal.tsx -> Formulários em Abas
                          ├── src/components/ProcessoIndividualModule.tsx
                          ├── src/components/StudentQrDisplay.tsx -> QR Code estático
                          └── src/components/ValidarPresencaModal.tsx -> Scanner de Presença
```

### Componentes Críticos (Pontos com Alto Acoplamento de Código)
1.  `src/App.tsx`: Centraliza login, rotas internas baseadas em estado e validações de faturamento Stripe. Alterações neste arquivo podem quebrar o login geral.
2.  `src/components/TenantPortal.tsx`: Contém mais de 20 mil linhas e concentra quase todos os formulários e rotinas escolares do sistema.
3.  `server.ts`: Central de transações de pagamento (Stripe Webhook), disparo real de SMTP e rotas de tradução por Inteligência Artificial.

---

## 10. GUIA DE ALTERAÇÃO VISUAL EM MASSA (Receitas Práticas de Layout)

Esta seção fornece expressões regulares (regex) prontas para busca e substituição em editores de código (VS Code, Cursor) para alterar propriedades visuais em massa no projeto de forma segura:

### Receita A: Trocar a Cor Primária do Sistema (Claro e Escuro)
O SysEdu utiliza classes CSS e variáveis no Tailwind v4. Para mudar a cor azul-marinho ou azul primário:
*   **O que editar**: `src/index.css` (linhas ~41-151) e o SVG em `src/components/SysEduLogo.tsx` (linhas ~18-35).
*   **Ação**: Substitua os valores hexadecimais correspondentes:
    *   Azul Primário Claro (`#2563EB` para botões/links) -> Mudar as propriedades `--btn-primary` e `--theme-link`.
    *   Azul Primário da Marca (`#1E66F5`) -> Mudar no `src/components/SysEduLogo.tsx` e `src/index.css`.
*   **Regex de Busca (para arquivos React)**: `text-indigo-600|bg-indigo-600|hover:bg-indigo-500`
*   **Aviso de Risco**: Alto. Certifique-se de manter o contraste mínimo de acessibilidade de 4.5:1 exigido pela WCAG AA ao escolher a nova cor primária.

### Receita B: Alterar Escala de Cantos Arredondados (Border Radius)
*   **O que editar**: As classes utilitárias aplicadas nos modais e cartões.
*   **Regex de Busca**: `rounded-2xl|rounded-3xl|rounded-xl`
*   **Padrão de Substituição**: Substituir por `rounded-lg` para cantos mais duros ou `rounded-none` para design brutalista reto.
*   **Aviso de Risco**: Baixo. É uma alteração estritamente estética sem impacto lógico de dados.

### Receita C: Mudar Fonte Global do Sistema
*   **O que editar**: `src/index.css` (linhas ~4-7).
*   **Ação**: Altere as propriedades do `@theme` declaradas:
    ```css
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-poppins: "Poppins", sans-serif;
    ```
    Basta alterar o nome das fontes importadas no início do arquivo `@import url('...')` (linha 1) e redefinir o nome das variáveis correspondentes.

### Receita D: Renomear Coleção ou Campo de Dados (Ex: `propina_valor` para `mensalidade_valor`)
*   **O que editar**:
    1.  `src/types.ts` (linha ~212, interface `Estudante`).
    2.  `src/components/TenantPortal.tsx` (busca no arquivo inteiro).
    3.  `firestore.rules` (se houver regras de validação baseadas no campo).
*   **Regex de Busca**: `\bpropina_valor\b`
*   **Aviso de Risco**: CRÍTICO. Renomear um campo que já está gravado no Firestore resultará em perda de visualização de registros legados. É recomendável executar um script de migração de banco de dados para reescrever as propriedades de documentos antigos no Firestore antes de publicar a alteração no código do applet.

---

## 11. DÍVIDA TÉCNICA E RISCOS ARQUITETÔNICOS

Ao analisar o código completo, foram identificados os seguintes pontos de dívida técnica com seus respectivos graus de impacto:

1.  **Monolito de Arquivo no TenantPortal (IMPACTO: CRÍTICO)**:
    *   *Descrição*: O `TenantPortal.tsx` acumulou mais de 20.800 linhas. Ele realiza requisições ao banco, monta modais de cadastro de seis entidades distintas, exporta planilhas em Excel e valida QR Codes em um único arquivo de componente.
    *   *Risco*: Lentidão em compilação de desenvolvimento, alto acoplamento de lógica visível e alta probabilidade de conflitos em mesclagens de código (Git Merge Conflicts).
    *   *Mitigação*: Abstrair os formulários e abas (como o módulo de gerenciamento de faturas estudantis e de agendamento de provas) em componentes separados no diretório `/src/components`.

2.  **Fallback de E-mails Silencioso (IMPACTO: MÉDIO)**:
    *   *Descrição*: Quando a infraestrutura SMTP de um inquilino falha ou está vazia, o sistema realiza uma simulação silenciosa de e-mail que apenas exibe o log no terminal Express, sem retornar um status de alerta visível no painel do usuário do Tenant.
    *   *Risco*: Docentes ou alunos podem acreditar que e-mails importantes foram entregues de verdade quando o sistema está operando em simulação.
    *   *Mitigação*: Exibir um banner sutil de status de simulação ("Ambiente em modo de simulação de e-mails") para esclarecer o contexto do disparo aos usuários.

3.  **Acoplamento de Dependências do Recharts (IMPACTO: BAIXO)**:
    *   *Descrição*: O componente `AnalyticsModule.tsx` importa gráficos diretamente de uma biblioteca externa pesada (Recharts), o que pode aumentar significativamente o tamanho do bundle final compilado.
    *   *Mitigação*: Adicionar o Recharts nas configurações de desmembramento de chunks do Vite (`rollupOptions`) para dividi-lo em um arquivo separado.

---

## 12. CHECKLIST DE VALIDAÇÃO DE MAPEAMENTO

- [x] Todas as rotas de views mapeadas (`landing`, `superadmin`, `tenant`, `brandbook`).
- [x] Principais componentes React catalogados e localizados por linha.
- [x] Paleta de cores, tipografia e temas de variáveis do Tailwind v4 descritos.
- [x] Coleções de banco de dados e fluxos de segurança do Firestore descritos.
- [x] Serviços críticos catalogados (Notificações, Auditoria, Diagnósticos).
- [x] Guia de busca Regex para alterações visuais em massa detalhado.

---
*Este mapa de sistema foi validado contra a base ativa do código do SysEdu. Para alterações complexas, utilize este guia em conjunto com os logs do módulo de erros administrativo.*
