**Regras gerais:**
- Não quebrar funcionalidades existentes (i18n, Biblioteca, Stripe, notificações, WebView Android, etc.).
- Manter o sistema de internacionalização (pt-MZ como padrão): todos os novos rótulos, opções e mensagens devem usar chaves de tradução, com as proteções anti-auto-translate já existentes.
- Aplicar as regras no **frontend E no backend/regras de segurança** (nunca confiar apenas na UI).
- Manter o isolamento multi-tenant existente (um tenant nunca acessa dados de outro).

---

## 1. TIPO DE INSTITUIÇÃO (NOVO CAMPO ESTRUTURAL)

### 1.1 Modelo de dados
- Adicionar o campo obrigatório `tipoInstituicao` ao documento da instituição, com os valores: `escola` | `instituto` | `universidade`.
- Criar uma constante/enum central (ex.: `INSTITUTION_TYPES`) e um mapa de configuração por tipo (`INSTITUTION_TYPE_CONFIG`) contendo: formulários permitidos, regimes permitidos, módulos/menus visíveis, nível académico, terminologia (ex.: "Aluno" / "Formando" / "Estudante"; "Disciplina" / "Módulo" / "Cadeira").
- **Migração:** instituições já existentes sem o campo recebem `tipoInstituicao = "escola"` por defeito (script de migração idempotente) e o Superadmin pode corrigir depois.
- O campo, uma vez definido, só pode ser alterado pelo Superadmin e com confirmação explícita (aviso de que altera formulários, regimes e módulos disponíveis).

### 1.2 Dropdown "Tipo de instituição"
Adicionar o dropdown **"Tipo de instituição"** (opções: **Escola**, **Instituto**, **Universidade**) em:
1. **Formulário de cadastro de instituições do Superadmin.**
2. **Formulário de cadastro de instituições na tela de login** (auto-registo).

Comportamento:
- Campo obrigatório, posicionado no topo do formulário.
- Ao selecionar o tipo, o restante formulário **renderiza dinamicamente apenas os campos do tipo escolhido** (ver secção 2).
- Ao trocar o tipo antes de submeter, limpar os campos que não pertencem ao novo tipo.

### 1.3 Isolamento por tipo de instituição
Ao definir o tipo, o sistema deve fornecer **somente** serviços ligados a esse tipo:
- **Formulários de cadastro** (instituição, curso/classe/módulo, disciplina/cadeira, estudante) — só os do tipo.
- **Regimes** — só os do tipo (ex.: regime semestral/ECTS só para Universidade; regime modular só para Instituto; regime diurno/noturno só para Escola).
- **Menus, módulos, relatórios, pautas, critérios de avaliação e terminologia** — só os do tipo.
- Criar um helper/hook central (ex.: `useInstitutionFeatures()` / `getInstitutionConfig(tipo)`) e um guard de rotas, de modo que rotas e endpoints de funcionalidades de outro tipo sejam **bloqueados** (redirecionar + mensagem "Funcionalidade não disponível para este tipo de instituição").
- Validar no backend: rejeitar escrita de dados que não correspondam ao tipo da instituição (ex.: criar "cadeira com ECTS" numa escola).

---

## 2. FORMULÁRIOS DE CADASTRO DA INSTITUIÇÃO (POR TIPO)

### 2.1 ESCOLA (Primária e Secundária)
Campos: Nome da Escola; Código Oficial (MEC); **Tipo de Escola** (Primária / Secundária / Ambas); **Regime de Funcionamento** (Diurno / Noturno / Ambos); Diretor/Responsável; NIF/NUIT; Endereço/Localização; Distrito/Província; Contacto Telefónico; Correio Eletrónico; Capacidade Total de Alunos; Regime de Avaliação (padrão: Formativa, Sumativa e Exames Oficiais — campo informativo/fixo).

### 2.2 UNIVERSIDADE (Ensino Superior — Faculdade/Unidade Académica)
Campos: Nome da Faculdade/Instituto; Sigla/Código de Registo; Universidade de Afiliação; **Regime de Ensino** (Semestral / Anual / Créditos ECTS); **Modalidade da Oferta** (Presencial / Semipresencial / EAD); Decano/Director de Faculdade; Endereço do Campus; Contacto Institucional; **Acreditação/Grau Governamental** (Acreditada / Em Processo); Sistema de Avaliação Adotado (padrão: Contínua, Exames Finais e TCC com Júri).

### 2.3 INSTITUTO (Formação Profissional/Técnica)
Campos: Nome do Instituto Técnico/Profissional; Código de Licenciamento Técnico; **Área de Especialização Principal** (Indústria / Tecnologia / Serviços / Saúde); **Regime de Ensino** (Modular / Aprendizagem Prática Baseada em Competências — padrão); Director do Centro/Instituto; **Instalações/Oficinas Disponíveis** (multi-seleção: Laboratórios / Oficinas / Simuladores); Endereço da Sede Técnica; Contacto Institucional; **Parcerias com Empresas/Mercado** (Sim/Não); Modelo de Avaliação (padrão: Demonstração Prática por Competência + Estágio Supervisionado).

> Validações comuns: campos obrigatórios marcados, formato de e-mail e telefone (Moçambique), NUIT/NIF com validação de formato, mensagens de erro traduzidas.

---

## 3. MÓDULO "CLASSES" → "CLASSES/CURSOS"

- Renomear o módulo para **"Classes/Cursos"** (menu lateral, títulos de página, breadcrumbs, permissões, chaves i18n, rotas e textos de ajuda). Manter redirecionamento da rota antiga.
- Estrutura em **abas**: **"Classes"** (existente) e **"Cursos"** (nova).
- **Visibilidade das abas conforme o tipo de instituição:**
  - **Escola:** apenas a aba **Classes** (1ª–12ª classe).
  - **Universidade:** apenas a aba **Cursos** (cursos de graduação, com cadeiras).
  - **Instituto:** apenas a aba **Cursos** (cursos técnicos/qualificações, com módulos de competência).
  - Se algum tipo precisar de ambas, definir isso no `INSTITUTION_TYPE_CONFIG` (configurável).

### 3.1 Aba Classes — Formulário de Disciplina/Classe (Escola)
Nome da Disciplina; Código da Disciplina; **Classe/Ano de Escolaridade** (1ª–6ª Primária / 7ª–12ª Secundária); **Ciclo Educacional** (1º Ciclo / 2º Ciclo); Carga Horária Semanal (horas); Carga Horária Anual (horas); **Área Curricular** (Linguagens / Ciências Sociais / etc.); **Tipo de Disciplina** (Obrigatória / Opcional); Critérios de Avaliação (padrão: 3 Testes Sumativos + Avaliação Formativa + Exame Final); Professor Responsável (select de professores da instituição).

### 3.2 Aba Cursos — Formulário de Cadastro de Cursos (conteúdo adaptado ao tipo)

**A) Universidade — Curso de Graduação + Cadeiras**
- Curso: Nome do Curso de Graduação; **Grau Académico** (Licenciatura / Mestrado / Doutoramento); duração (anos/semestres); Faculdade/Unidade (da instituição).
- Cadeira/Disciplina Superior (sub-formulário dentro do curso): Nome da Cadeira; Código da Cadeira; **Semestre Lectivo** (1º / 2º); **Número de Créditos Académicos (ECTS)**; Horas Teóricas; Horas Práticas; Pré-Requisitos Exigidos (multi-seleção de outras cadeiras do mesmo curso, sem ciclos); **Tipo de Trabalho de Conclusão** (Monografia / Dissertação / Projecto); Docente Regente da Cadeira.

**B) Instituto — Qualificação/Curso Técnico + Módulos**
- Curso: Título da Qualificação/Curso Técnico; Área de Especialização; duração total.
- Módulo de Competência (sub-formulário): Nome do Módulo de Competência; Código do Módulo; **Nível de Qualificação (QNC/NQF)** (Nível 3 / 4 / 5); Duração em Horas Práticas (Oficina/Laboratório); Duração em Horas Teóricas (Sala); Competência Prática Esperada; Equipamentos Exigidos; Componente de Estágio Profissional (horas em empresa parceira); Formador/Instrutor Técnico.

**Funcionalidades da aba Cursos:** listagem com pesquisa/filtros, criar/editar/arquivar curso, gerir cadeiras/módulos dentro do curso, contagem de estudantes inscritos, permissões por perfil (admin da instituição, coordenador), validação de códigos únicos por instituição, soft-delete com bloqueio se houver estudantes inscritos.

---

## 4. FORMULÁRIOS DE CADASTRO DE ESTUDANTE (POR TIPO)

### 4.1 Regra principal — Filtro de instituições por nível académico
- No cadastro de estudantes, a lista de instituições **só deve mostrar instituições do mesmo tipo/nível académico** do estudante que está a ser cadastrado.
  - Ensino superior → apenas **Universidades**.
  - Formação profissional → apenas **Institutos**.
  - Ensino primário/secundário → apenas **Escolas**.
- Implementar: seletor de **"Nível/Tipo de ensino"** (ou derivado do contexto) **antes** do dropdown de instituição; o dropdown de instituição é carregado com filtro `tipoInstituicao == nível selecionado`. Ao trocar o nível, limpar a instituição, o curso/classe e os campos dependentes.
- Se o utilizador já estiver dentro de uma instituição (tenant), o estudante é automaticamente associado a ela e os formulários seguem o tipo dessa instituição.
- **Validação no backend:** rejeitar matrículas em que `tipoInstituicao` não corresponda ao nível do estudante.
- Estado vazio: mensagem "Não existem instituições deste nível cadastradas".

### 4.2 Escola — Cadastro de Estudante
Nome Completo do Aluno; Número de Matrícula; Data de Nascimento (DD/MM/AAAA); Género (M/F); **Classe em que se Matricula** (select das classes da instituição); Turma e Turno Assignado; Nome do Encarregado de Educação; Grau de Parentesco; Contacto do Encarregado; Documento de Identificação (BI/Cédula); Acompanhamento Pedagógico/Necessidades Especiais (Sim/Não); Histórico Escolar Verificado (Sim/Pendente).

### 4.3 Universidade — Cadastro de Estudante Universitário
Nome Completo do Estudante; Número de Estudante (Matrícula); **Curso de Ingresso** (select dos cursos da instituição); **Ano Curricular Inicial** (1º–4º, ajustável à duração do curso); **Regime de Frequência** (Tempo Integral / Parcial); **Modalidade** (Presencial / EAD); Bilhete de Identidade/Passaporte; Email Académico; Telefone de Contacto; **Situação da Prova de Ingresso/Exame** (Aprovado / Dispensado); **Estatuto Especial** (Trabalhador-Estudante / Bolseiro / Nenhum); Orientador de TCC (se aplicável).

### 4.4 Instituto — Cadastro de Formando/Trainee Profissional
Nome Completo do Formando; Número de Registo/Formando; **Módulo/Curso Técnico Inscrito** (select dos cursos/módulos da instituição); **Turno de Formação** (Manhã / Tarde / Pós-Laboral); **Nível de Escolaridade Prévia** (Básico / Médio / Superior); Documento de Identificação; Email do Formando; Contacto Telefónico; Empresa/Patrocinador (se houver); **Estatuto do Estágio Prático** (Pendente / Em Curso / Concluído); Avaliação de Desempenho Prático (Apto/Competente / Ainda Não Apto); Tutor de Estágio Atribuído.

---

## 5. REQUISITOS TÉCNICOS TRANSVERSAIS
1. **Renderização dinâmica de formulários:** definir os formulários como schemas declarativos por tipo (campos, tipo, obrigatoriedade, opções, validações), renderizados por um componente único reutilizável — evitar duplicar código.
2. **Segurança:** atualizar regras do Firestore/backend para validar `tipoInstituicao` em todas as escritas relevantes e impedir acesso cruzado entre tenants e entre tipos.
3. **Modelo de dados:** novas coleções/campos para `cursos`, `cadeiras` (universidade) e `modulosCompetencia` (instituto), sempre ligados à instituição (`institutionId`) e com índices necessários.
4. **Dados existentes:** script de migração + compatibilidade retroativa (escolas continuam a funcionar sem alterações visíveis).
5. **i18n:** adicionar todas as chaves novas (pt-MZ, e demais idiomas existentes), incluindo "Classes/Cursos", "Cursos", "Tipo de instituição", "Escola", "Instituto", "Universidade".
6. **UX:** formulários responsivos (também no WebView Android), feedback de validação por campo, confirmações em ações destrutivas, estados de carregamento e vazio.
7. **Permissões:** respeitar os perfis existentes (Superadmin, administrador da instituição, secretaria, docente, etc.).

## 6. CRITÉRIOS DE ACEITAÇÃO
- [ ] O dropdown "Tipo de instituição" aparece no formulário do Superadmin e na tela de login.
- [ ] Cada tipo mostra apenas os seus formulários, regimes, menus e terminologia.
- [ ] Rotas/endpoints de funcionalidades de outro tipo estão bloqueados (frontend e backend).
- [ ] O módulo aparece como "Classes/Cursos" com as abas corretas por tipo.
- [ ] O formulário de cadastro de cursos funciona para Universidade (curso + cadeiras) e Instituto (curso + módulos).
- [ ] No cadastro de estudantes, o dropdown de instituições mostra só instituições do mesmo nível.
- [ ] Instituições existentes foram migradas sem perda de dados.
- [ ] Todas as strings estão traduzidas e nenhuma funcionalidade existente foi quebrada.

## 7. ENTREGA
Antes de codificar, apresente um **plano resumido** (ficheiros a alterar, novos componentes, alterações de esquema/regras). Depois implemente por etapas: (1) modelo de dados + migração, (2) configuração por tipo + guards, (3) formulários de instituição, (4) módulo Classes/Cursos, (5) formulários de estudante + filtro, (6) i18n + testes. Liste no final todos os ficheiros alterados.

---

# 8. ADIÇÕES E ALTERAÇÕES (prevalecem sobre as secções anteriores em caso de conflito)

## 8.1 Opção "Global" no tipo de instituição / criação de cliente

- Adicionar o valor **`global`** ao enum `tipoInstituicao` (passa a: `escola` | `instituto` | `universidade` | `global`) e a opção **"Global"** no dropdown **"Tipo de instituição"** em:
  1. Formulário de **criação de cliente** (Superadmin).
  2. Formulário de **cadastro de instituição** (Superadmin e tela de login).
- Comportamento de uma instituição **Global**:
  - Pode criar e gerir **qualquer tipo de unidade/oferta formativa**: escolas (primário/secundário), institutos (formação profissional), universidades/faculdades (ensino superior) e outros tipos que venham a ser adicionados ao `INSTITUTION_TYPE_CONFIG`.
  - O isolamento da secção 1.3 continua a aplicar-se **ao nível de cada unidade/oferta**: cada curso, classe ou módulo criado numa instituição Global tem um campo obrigatório **`nivelEnsino`** (`escola` | `instituto` | `universidade` | outros) e usa apenas os formulários, regimes e terminologia desse nível.
  - Menus, módulos e formulários disponíveis = **união** das configurações de todos os tipos, mas cada registo individual valida contra o seu `nivelEnsino`.
  - Na regra de filtro do cadastro de estudante (secção 4.1), uma instituição Global **aparece em qualquer nível**; o dropdown de curso/classe é então filtrado pelo `nivelEnsino` correspondente.
  - Cada unidade pode ter o seu próprio **regime de ensino** (semestral, trimestral, mensal/modular, anual, créditos).
- Apenas o **Superadmin** pode atribuir o tipo Global (confirmação explícita; considerar impacto em planos/faturação Stripe, se aplicável).
- Instituições dos tipos não-Global continuam estritamente isoladas conforme a secção 1.3.

## 8.2 Cadeiras/Disciplinas associadas à instituição

- No **formulário de cadastro de cadeiras/disciplinas (e módulos de competência)**, adicionar o campo obrigatório **"Instituição"** (associar ao cadastrar → `institutionId` obrigatório; para cadeiras/módulos também `cursoId`).
  - **Superadmin:** dropdown com todas as instituições (compatíveis com o tipo do formulário).
  - **Utilizador de instituição:** campo preenchido automaticamente e bloqueado com a sua instituição.
- O dropdown de **Curso** passa a listar apenas cursos da instituição selecionada; ao trocar de instituição, limpar curso e campos dependentes.
- Validações: código único **por instituição**; a cadeira só pode ser associada a cursos da mesma instituição; backend rejeita registos sem `institutionId` ou com tipo incompatível; consultas e listagens sempre filtradas pela instituição.
- **Migração:** disciplinas/cadeiras existentes são associadas à instituição do seu tenant.
- O campo **Período Lectivo** da cadeira/disciplina/módulo deve ser **dinâmico conforme o regime de ensino** do curso/instituição: Semestre (1º, 2º…), Trimestre (1º, 2º, 3º), Mês/Módulo, ou Ano. Guardar também o **Ano Curricular** (1º, 2º, 3º…) para ordenar o plano curricular.

## 8.3 Formulário de cadastro de estudante — Curso e plano curricular

- Adicionar o dropdown **"Curso"** (para Escola: "Classe"; para Instituto: "Curso/Módulo técnico"), que mostra **apenas os cursos/classes da instituição selecionada** (e do nível correto, ver 8.1). Sem instituição selecionada, o dropdown fica desativado.
- **Ao selecionar o curso**, apresentar logo abaixo o **plano curricular**: as cadeiras/disciplinas/módulos que serão lecionados, **agrupados por período lectivo conforme o regime de ensino da instituição**:
  - Regime semestral/créditos → agrupado por **Ano > Semestre**
  - Regime trimestral → agrupado por **Ano/Classe > Trimestre**
  - Regime mensal/modular → agrupado por **Mês/Módulo**
  - Regime anual → agrupado por **Ano**
- Cada grupo é um bloco recolhível (accordion), com: nome e código da cadeira, créditos/carga horária, tipo (obrigatória/opcional) e docente (se atribuído); mostrar o total de créditos/horas por período.
- Visualização apenas de leitura no cadastro (pré-visualização do plano); ao confirmar a matrícula, o sistema **inscreve o estudante nas cadeiras do primeiro período lectivo** (ou do período/ano de ingresso escolhido). Cadeiras opcionais podem ser selecionadas pelo utilizador.
- Estados: carregamento, "Este curso ainda não tem cadeiras cadastradas", e erro; tudo traduzido (i18n).

## 8.4 Módulo "Processo do Aluno" (ficha académica completa)

O módulo deve exibir **toda a informação relacionada ao estudante**, num ecrã com cabeçalho (foto, nome, nº de matrícula, instituição, curso/classe/módulo, estado da matrícula) e **abas** (adaptadas ao tipo de instituição e ao regime):

1. **Dados pessoais e contactos** (incluindo encarregado, quando aplicável).
2. **Matrícula e enquadramento:** instituição, tipo/nível, curso/classe/módulo, ano curricular, turma/turno, regime de frequência/modalidade, estatuto especial.
3. **Período lectivo:** período atual e histórico, com rótulo conforme o regime (**Semestre / Trimestre / Módulo lectivo / Mês / Ano**).
4. **Plano curricular e inscrições:** todas as **cadeiras, disciplinas ou módulos** do curso/classe/módulo, agrupados por período, com estado (Por cursar / Em curso / Aprovado / Reprovado / Dispensado).
5. **Aproveitamento académico:** notas e avaliações por cadeira/disciplina/módulo, médias por período, média geral, créditos acumulados (ensino superior), competências Apto/Não Apto (instituto), resultado final.
6. **Assiduidade** (**apenas se aplicável**, configurável por instituição/tipo através de uma flag, ex.: `assiduidadeAtiva`): presenças, faltas justificadas/injustificadas e percentagem por cadeira/disciplina.
7. **Específicos do tipo:** Escola — acompanhamento pedagógico/necessidades especiais, histórico escolar; Universidade — TCC/orientador, prova de ingresso, estatuto especial; Instituto — estágio prático, tutor, empresa/patrocinador, avaliação de desempenho.
8. **Financeiro e documentos** (se os módulos existirem): propinas/pagamentos, documentos anexados.
9. **Histórico / linha do tempo** de eventos (matrícula, transferências, alterações de estado).

Regras:
- **Fonte única de dados:** a ficha lê dados dos módulos existentes (matrículas, notas, assiduidade, plano curricular, calendário), sem duplicar informação.
- **Permissões:** aluno vê apenas o seu processo; encarregado vê o do seu educando; docente vê apenas alunos das suas turmas/cadeiras; direção/secretaria/admin veem os da sua instituição; Superadmin vê todos. Cada aba respeita o perfil (ex.: dados financeiros só para perfis autorizados). Registar acessos sensíveis em log de auditoria.
- Terminologia dinâmica por tipo de instituição (Aluno/Estudante/Formando; Disciplina/Cadeira/Módulo; Classe/Curso).
- Carregamento por aba (lazy-loading), pesquisa de estudante, e opção de **exportar/imprimir o processo individual em PDF**.
- Responsivo (WebView Android) e com todas as strings em i18n.

## 8.5 Critérios de aceitação adicionais
- [ ] A opção "Global" existe no formulário de criação de cliente e no de cadastro de instituição, e só o Superadmin a atribui.
- [ ] Uma instituição Global consegue criar cursos/classes/módulos de qualquer nível, cada um com o seu `nivelEnsino` e formulários correspondentes.
- [ ] Toda cadeira/disciplina/módulo fica associada a uma instituição (`institutionId`) ao ser cadastrada.
- [ ] No cadastro de estudante, o dropdown de curso mostra só cursos da instituição selecionada.
- [ ] Ao selecionar o curso, o plano curricular aparece agrupado por semestre/trimestre/mês/ano conforme o regime.
- [ ] O "Processo do Aluno" mostra período lectivo, plano curricular, aproveitamento e (quando aplicável) assiduidade, com permissões por perfil.
- [ ] Dados existentes migrados sem perda; nenhuma funcionalidade anterior quebrada.