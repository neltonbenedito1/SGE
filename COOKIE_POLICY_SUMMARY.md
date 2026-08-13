# Sistema de Gestão de Cookies e Privacidade de Dados
## Plataforma de Gestão Educacional SysEdu (LGPD / GDPR Compliant)

### 1. Visão Geral da Arquitetura de Privacidade
O **SysEdu** implementa um sistema rigoroso de gestão e conformidade de cookies concebido especificamente para instituições de ensino básico, secundário e superior, com especial proteção para dados de estudantes menores de idade e encarregados de educação.

---

### 2. Categorias de Cookies Implementadas

#### A. Essenciais / Sessão (`essential`) — Obrigatórios
- **Finalidade:** Autenticação de utilizadores, manutenção de sessão segura, validação CSRF e expiração automática por inatividade.
- **Cookies do Servidor (HttpOnly):**
  - `sysedu_session_id`: Token criptográfico de sessão armazenado em cookie com flag `HttpOnly`, `Secure`, `SameSite=Strict`.
  - `sysedu_csrf_token`: Token de proteção contra Cross-Site Request Forgery (`HttpOnly`, `Secure`, `SameSite=Strict`).
- **Cookies do Cliente:**
  - `user_cookie_consent`: Guarda a decisão de consentimento do utilizador (`accepted`, `essential_only`, `custom`, `refused`).
  - `user_cookie_categories`: JSON com as categorias explicitamente autorizadas pelo utilizador.
- **Regra de Inatividade:** Invalidação automática após 30 minutos de inatividade do utilizador no servidor para prevenir acessos não autorizados em computadores partilhados na escola.

#### B. Preferências de Utilizador (`preferences`) — Opcionais
- **Finalidade:** Lembrar configurações visuais e linguísticas do utilizador.
- **Cookies:**
  - `user_theme`: Tema visual da interface (ex.: Slate, Emerald, Indigo). Validade: 60 dias.
  - `saas_educ_system_lang`: Idioma preferido da plataforma (Português, Inglês, Espanhol, Francês). Validade: 60 dias.
  - `user_accessibility`: Definições de alto contraste e tamanho de texto. Validade: 60 dias.

#### C. Funcionais Educacionais (`functional`) — Opcionais
- **Finalidade:** Otimização do fluxo de trabalho diário de docentes e administradores.
- **Cookies:**
  - `last_module`: Último módulo acedido (ex.: pautas, calendário, inscrições). Validade: 30 dias.
  - `last_scroll`: Posição de deslocamento vertical da página. Validade: 30 dias.
  - `sysedu_filters`: Filtros de pesquisa de alunos, turmas e ano letivo ativo. Validade: 30 dias.
  - `sysedu_sidebar_state`: Estado expandido/recolhido da barra lateral. Validade: 30 dias.
  - `draft_*`: Rascunhos temporários de formulários não submetidos para evitar perda de dados de pautas ou inscrições. Validade: 7 dias.

#### D. Analítica Interna Anónima (`analytics`) — Opt-in Estrito
- **Finalidade:** Medição interna de tempos de resposta e uso de módulos para relatórios institucionais de desempenho.
- **Cookies:**
  - `sysedu_analytics_id`: Identificador interno anónimo. Validade: 90 dias.
- **Opt-in por defeito desativado (Opt-in estrito).**

#### E. Ausência Estrita de Cookies de Terceiros e Publicidade
- **Proibição Absoluta:** O sistema não utiliza, sob qualquer circunstância, cookies de redes sociais, plataformas de anúncios ou rastreadores comerciais de terceiros.

---

### 3. Matriz de Segurança e Atributos Técnicos

| Nome do Cookie | Categoria | Origem / Tipo | Atributos de Segurança | Duração | Conteúdo Sensível? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sysedu_session_id` | Essencial | Server (`Set-Cookie`) | `HttpOnly; Secure; SameSite=Strict` | 30m inatividade / 24h | Não (Opaque Token) |
| `sysedu_csrf_token` | Essencial | Server (`Set-Cookie`) | `HttpOnly; Secure; SameSite=Strict` | Sessão | Não (Hash) |
| `user_cookie_consent` | Essencial | Client JS | `Secure; SameSite=Lax` | 180 dias | Não |
| `user_cookie_categories` | Essencial | Client JS | `Secure; SameSite=Lax` | 180 dias | Não |
| `user_theme` | Preferências | Client JS | `Secure; SameSite=Lax` | 60 dias | Não |
| `saas_educ_system_lang` | Preferências | Client JS | `Secure; SameSite=Lax` | 60 dias | Não |
| `last_module` | Funcionais | Client JS | `Secure; SameSite=Lax` | 30 dias | Não |
| `last_scroll` | Funcionais | Client JS | `Secure; SameSite=Lax` | 30 dias | Não |
| `draft_*` | Funcionais | Client JS | `Secure; SameSite=Lax` | 7 dias | Não |
| `sysedu_analytics_id` | Analítica | Client JS | `Secure; SameSite=Lax` | 90 dias | Não (Anónimo) |

---

### 4. Endpoints de API de Sessão Servidor
- **`POST /api/auth/session/create`**: Cria/renova o token criptográfico e emite o cookie `HttpOnly`.
- **`GET /api/auth/session/verify`**: Valida o cookie `HttpOnly` e verifica o limite de 30 minutos de inatividade.
- **`POST /api/auth/session/logout`**: Rota e destrói os cookies `HttpOnly` com `Max-Age=0`.

---

### 5. Mecanismo de Revogação de Consentimento
O utilizador pode aceder a qualquer momento ao painel **"Privacidade & Cookies"** disponível:
1. No banner de cookies no primeiro acesso.
2. Na barra superior do aplicativo.
3. No rodapé do menu lateral de professores, alunos e administradores.

Ao clicar em **"Revogar Não-Essenciais"**, a função `revokeAllNonEssentialCookies()` elimina imediatamente todos os cookies de preferências, temas e rascunhos salvos no navegador.
