# Propmpt

Realizar alteracoes sem comprometer o banco de dados

Modulo: Provincias e distritos

Remover a funcao de cadastro manual



O sistema deve fazer o cadastro automatic de acordo com o pais de origem da instituicao e paises nos quais a instituicao tem escolas ou sucursais.



Formulario: Cadasto de instituicao no painel superadmin

Adicionar dropdown com pesquisa dinamica para selecionar o pais com botao "+" do lado para adicionar outro pais com botao "-" para remover botao "+" para adicionar outro pais.



Formulario de registo de instituicao a partir da tela de login

Remover formulario actual e colocar um formulario semelhante ao formulario de cadastro de intituicao do painel superadmin com o aditivo de botao para registar. OBS: o botao nao deve executar nenhhuma acao ainda, futuramente sera conectado a uma plataforma de selecao de plano de pagamento e plataforma de pagamento.



Na funcao esqueci a senha, o sistema so pode redefinir senhas de contas ja cadastradas no sistema, caso contrario deve rejeitar operacao. (autencicacao via firebase sempre). Obs: o codogo deve ser enviado ao usuário por email, sem funcionalidade de teste ou expor o código opt.



Modulo: Escolas (Cadastro de escolas, função: controle de assiduidade)

Adicionar checkbox para habilitar ou desabilitar o regime (Manha, tarde e noite)

Adicionar dropdown para selecionar o tipo de instituição:

\- Escola

\- Faculdade

\- Instituto





Modulo: Estudante (Cadastro de estudante)

Adicionar dropdown para selecionar o tipo de estudante, ao selecionar o tipo de estudante, o formulário deve alterar de acordo com o tipo selecionado.

Formulários abaixo:



Actualizar o módulo de CADASTRO / MATRÍCULA DE ESTUDANTES para passar a ter quatro formulários distintos, um por nível de ensino:

1\. Ensino primário (1ª a 6ª classe)

2\. Ensino secundário (8ª a 12ª classe)

3\. Ensino superior (universidade ou instituto superior)

4\. Formação profissional (institutos e centros técnico-profissionais)



\## PASSO 0 – ANALISAR ANTES DE ALTERAR

Antes de escrever código:

\- Lê o formulário de cadastro de estudantes actual, o modelo de dados (Firestore/DB), as regras de segurança e o ficheiro de traduções (i18n).

\- Identifica a stack, os componentes de UI reutilizáveis, a convenção de nomes e o tema visual, e MANTÉM-NOS. Não introduzas bibliotecas novas sem necessidade.

\- Resume em poucas linhas o que existe e o que vais mudar, e só depois implementa.



\## REGRAS GERAIS

\- Preserva TODOS os campos e funcionalidades que já existem e que não estejam neste prompt. Se um campo actual equivale a um campo novo (ex.: "nome", "data de nascimento"), reutiliza-o e não dupliques.

\- Multi-tenant: todos os dados ficam isolados por escola (tenantId / schoolId). Nenhuma consulta ou escrita pode cruzar escolas.

\- O nível de ensino de cada estudante é guardado no campo `nivelEnsino` com um destes valores: `primario`, `secundario`, `superior`, `profissional`.

\- Cada escola/instituição só vê os níveis que ela oferece (configuração por tenant). Se a escola só tem primário, só aparece o formulário primário. Se o tenant não tiver essa configuração, cria-a nas definições da escola (multi-selecção de níveis) com todos os níveis activos por defeito.

\- Todos os textos visíveis passam pelo sistema i18n existente (pt-MZ como idioma base). Cria as chaves em falta e deixa as traduções de outros idiomas já suportados, mesmo que provisórias.

\- Interface mobile-first e compatível com o WebView Android: campos grandes, teclado correcto por tipo (`tel`, `email`, `number`, `date`), sem dependência de APIs não suportadas no WebView.

\- Mostra um separador/selector de nível no topo do cadastro. Ao mudar de nível com dados já preenchidos, pede confirmação antes de limpar os campos que não se aplicam.

\- Validação em tempo real com mensagens claras em português. Campos obrigatórios marcados com \*.

\- Acessibilidade: labels associados aos inputs, foco visível, navegação por teclado.



\## ESTRUTURA DOS FORMULÁRIOS

Legenda: (\*) obrigatório. Os tipos entre parênteses são sugestões, adapta-os à stack.



\### Secções comuns (aparecem em todos os níveis, com as diferenças indicadas)

\*\*A. Dados pessoais\*\*

\- Nome completo (\*)

\- Data de nascimento (\*, data)

\- Sexo (\*, Masculino/Feminino)

\- Naturalidade – província (\*, lista das 11 províncias: Maputo Cidade, Maputo Província, Gaza, Inhambane, Sofala, Manica, Tete, Zambézia, Nampula, Cabo Delgado, Niassa)

\- Distrito de nascimento (\*)

\- Nacionalidade (\*)

\- Primário: Nº da certidão de nascimento (\*) em vez de documento de identificação.

\- Restantes níveis: Tipo de documento (\*: Bilhete de Identidade, Passaporte, DIRE, Cartão de eleitor, Outro), Nº do documento (\*), Validade do documento.



\*\*B. Residência\*\*

\- Província (\*), Distrito (\*), Bairro (\*), Rua/Av./Quarteirão/Nº da casa

\- Secundário, superior e profissional: também Telemóvel (\*) e Email.



\*\*C. Emergência e saúde\*\*

\- Contacto de emergência – nome (\*) e telemóvel (\*)

\- Primário e secundário: Grupo sanguíneo (Não sei, A+, A-, B+, B-, AB+, AB-, O+, O-), Alergias ou doenças crónicas (texto), Necessidades educativas especiais (Não, Visual, Auditiva, Motora, Intelectual, Outra) + detalhes.

\- Superior e profissional: apenas "Alergias ou condições de saúde relevantes" (texto).



\*\*D. Documentos entregues\*\* (checklist, cada item é um booleano; futuramente poderá ter upload)



\### 1. PRIMÁRIO – campos específicos

\- Dados pessoais: + Língua materna, Religião (opcional)

\- Matrícula: Tipo de matrícula (\*: Nova matrícula, Renovação, Transferência), Classe (\*: 1ª a 6ª), Turno (Manhã, Tarde), Escola anterior, Ano lectivo (\*), Usa transporte escolar (Sim/Não), Frequentou pré-escolar (Sim/Não)

\- Encarregado de educação (secção obrigatória): Nome (\*), Parentesco (\*: Pai, Mãe, Avô/Avó, Tio/Tia, Irmão/Irmã, Tutor legal, Outro), Nº do BI (\*), Telemóvel (\*), Telemóvel alternativo, Profissão, Local de trabalho

\- Documentos: Certidão de nascimento, Cartão de vacinas, 2 fotografias tipo passe, Declaração de transferência (se aplicável), Cópia do BI do encarregado



\### 2. SECUNDÁRIO – campos específicos

\- Dados pessoais: + Língua materna, Estado civil (Solteiro(a), Casado(a), União de facto, Outro)

\- Matrícula: Tipo de matrícula (\*), Ciclo (\*: 1º ciclo 8ª-10ª, 2º ciclo 11ª-12ª), Classe (\*: 8ª a 12ª), Área (Ciências/Letras, só 11ª e 12ª), Regime (\*: Diurno/Nocturno), Disciplina de opção, Escola anterior (\*), Média final da classe anterior (número), Ano lectivo (\*), Já repetiu alguma classe (Sim/Não)

\- Encarregado de educação: mesmos campos do primário (obrigatório se o aluno for menor de 18 anos, opcional caso contrário)

\- Documentos: Certificado ou declaração da classe anterior, Cópia do BI ou cédula, 2 fotografias tipo passe, Cartão de vacinas, Cópia do BI do encarregado



\### 3. SUPERIOR – campos específicos

\- Dados pessoais: + NUIT, Estado civil (Solteiro(a), Casado(a), União de facto, Divorciado(a), Viúvo(a)), Nº de filhos

\- Formação anterior: Escola onde concluiu o ensino médio (\*), Ano de conclusão (\*), Média final, Habilitações já obtidas (\*: 12ª classe, Técnico médio, Bacharelato, Licenciatura, Mestrado)

\- Ingresso e curso: Faculdade/departamento (\*), Curso (\*), Forma de ingresso (\*: Exame de admissão, Transferência, Mudança de curso, Graduado, Bolsa de estudo, Outra), Ano de ingresso (\*), Regime (\*: Laboral, Pós-laboral, À distância), Ano de frequência (\*: 1º a 5º), Nº de candidatura ou matrícula, Financiamento (Próprio, Familiar, Bolsa do Estado, Bolsa privada, Empregador), Trabalha actualmente (Sim/Não), Empregador (visível só se trabalha)

\- Documentos: Certificado do ensino médio (autenticado), Cópia do BI ou passaporte, Comprovativo do NUIT, 2 fotografias tipo passe, Comprovativo de pagamento da inscrição

\- Não tem secção de encarregado de educação.



\### 4. FORMAÇÃO PROFISSIONAL – campos específicos

\- Dados pessoais: + NUIT, Estado civil

\- Escolaridade: Nível concluído (\*: 7ª classe, 9ª classe, 10ª classe, 12ª classe, Técnico básico, Técnico médio, Superior), Última escola frequentada (\*), Ano de conclusão, Experiência profissional na área (texto)

\- Curso: Nível de formação (\*: Básico, Médio, Curta duração), Área de formação (\*: Informática, Electricidade, Mecânica, Construção civil, Contabilidade e gestão, Agropecuária, Hotelaria e turismo, Saúde, Costura e alfaiataria, Outra), Curso (\*), Regime (\*: Diurno, Pós-laboral, Nocturno), Data de início (\*), Quem paga a formação (Próprio, Familiar, Empregador, Bolsa ou projecto), Disponível para estágio (Sim/Não), Empregado actualmente (Sim/Não)

\- Documentos: Certificado de habilitações, Cópia do BI ou passaporte, 2 fotografias tipo passe, Atestado médico, Comprovativo de pagamento

\- Não tem secção de encarregado de educação.



\## ARQUITECTURA SUGERIDA

\- Implementa os formulários de forma data-driven: um ficheiro de configuração (ex.: `studentFormSchemas`) com a definição de secções e campos de cada nível (id, chave i18n do rótulo, tipo, opções, obrigatório, condição de visibilidade), e um único componente que renderiza qualquer nível a partir dele. Assim, acrescentar um campo no futuro é editar a configuração.

\- Campos condicionais (ex.: "Empregador" só se trabalha; "Área" só na 11ª/12ª; encarregado obrigatório conforme a idade) tratados na configuração.

\- Modelo de dados: documento de estudante com campos comuns na raiz e os específicos de cada nível agrupados (ex.: `matricula`, `encarregado`, `saude`, `documentosEntregues`, `formacaoAnterior`). Guarda `nivelEnsino`, `anoLectivo`, `criadoEm`, `actualizadoEm` e `criadoPor`.

\- Actualiza as regras de segurança para validar `nivelEnsino` e impedir acesso fora do tenant.

\- Gera um nº de estudante único por escola, se o sistema já tiver essa lógica. Se não tiver, não inventes: mantém o que existe.



\## MIGRAÇÃO E COMPATIBILIDADE

\- Estudantes já registados continuam a funcionar. Se não tiverem `nivelEnsino`, assume-o a partir da escola/classe existente quando possível. Caso contrário, deixa-o vazio e pede para o completar quando o registo for editado.

\- Não apagues nem renomeies campos existentes sem criar a migração. Se for preciso migrar, entrega o script de migração separado e seguro (com modo de simulação).

\- A edição de um estudante abre o formulário do nível correspondente com os dados preenchidos.

\- Listagens, pesquisa e outros módulos que usam dados do estudante (Plano de Aulas, Calendário, Biblioteca, notificações a pais e encarregados) não podem quebrar.



\## CRITÉRIOS DE ACEITAÇÃO

1\. Os quatro formulários existem, com os campos e as obrigatoriedades descritos.

2\. Escolas só vêem os níveis activados para o seu tenant.

3\. Dados guardados com `nivelEnsino` correcto e isolados por tenant.

4\. Validação funciona (obrigatórios, tipos, condicionais) e as mensagens vêm do i18n.

5\. Funciona bem no telemóvel e no WebView Android.

6\. Estudantes antigos continuam a abrir, a listar e a editar sem erros.

7\. Sem regressões nos restantes módulos.



\## ENTREGA

\- Primeiro, apresenta o resumo do que encontraste no código actual e o plano de alterações.

\- Depois, entrega o código completo e funcional dos ficheiros alterados ou criados, indicando o caminho de cada um.

\- Termina com: chaves i18n novas, regras de segurança actualizadas, script de migração (se aplicável) e uma lista curta de testes manuais para verificar.



Modulo: Analises e analitics

O modulo não aparece no sistema mesmo para utilizadores que possuem permissão de acesso, corrija o erro



\# TAREFA: PADRONIZAÇÃO GLOBAL DE DADOS DO SISTEMA (SGE)



Você é um engenheiro de software sénior. Realize uma auditoria e uma refatoração completa para padronizar TODOS os dados do sistema, eliminando duplicação, inconsistência e valores "soltos" (hardcoded) espalhados pelos módulos. Não remova nem altere nenhuma funcionalidade existente. O objectivo é apenas centralizar, uniformizar e tornar os dados reutilizáveis.



\## FASE 1 — AUDITORIA (faça antes de alterar qualquer código)



Percorra todos os módulos (Calendário e horários, Plano de Aulas, Actividades, Notificações, Biblioteca, Estudantes, Docentes, Financeiro/Stripe, Configurações, entre outros) e produza um relatório com:



1\. Todos os dropdowns, selects, radios, checkboxes e listas fixas, indicando o ficheiro, o módulo e as opções usadas.

2\. Valores repetidos com grafias diferentes (ex.: "Lecionado" / "Lecionada" / "lecionado", "Ativo" / "Activo", "Masculino" / "M" / "male").

3\. Campos que representam o mesmo conceito mas têm tipos de dados diferentes entre módulos (ex.: data como string num módulo e Timestamp noutro; ano lectivo como número e como texto; id numérico vs. string).

4\. Entidades duplicadas ou copiadas entre módulos (ex.: matérias, turmas, níveis de ensino, perfis, semestres/trimestres).

5\. Textos escritos directamente no código em vez de passarem pelo sistema i18n.

6\. Inconsistências de formato: datas, horas, moeda, telefone, nomes próprios, códigos.



Apresente o relatório em tabela e só avance para a Fase 2 depois de concluí-lo.



\## FASE 2 — CATÁLOGO CENTRAL DE DADOS (fonte única de verdade)



Crie uma estrutura central (ex.: `/src/constants/` ou `/src/shared/catalogs/`) com um ficheiro por domínio. Cada lista deve ter:

\- `value` (chave interna estável, em minúsculas, sem acentos, em inglês ou snake\_case; NUNCA muda)

\- `labelKey` (chave i18n para o texto exibido; os textos finais vivem nos ficheiros de tradução pt/en)

\- `order` (ordem de exibição)

\- `active` (permite desactivar sem apagar)

\- opcionalmente `color`, `icon`, `meta`



Catálogos mínimos a criar (ajuste conforme a auditoria):

\- Estados de aula/plano: `planned`, `taught`, `pending`, `cancelled`, `extraordinary`

\- Estados genéricos: `active`, `inactive`, `suspended`, `archived`

\- Perfis de utilizador: `school\_director`, `pedagogical\_director`, `general\_secretary`, `teacher`, `student`, `guardian`, `librarian`, `finance`, `super\_admin`

\- Níveis de ensino: `primary`, `secondary`, `university`, `vocational`

\- Períodos lectivos: `semester`, `trimester`, com sub-valores (1.º, 2.º, 3.º)

\- Dias da semana, turnos (manhã/tarde/noite), tipos de aula (normal/extraordinária/reposição)

\- Género, estado civil, grau de parentesco, tipo de documento de identificação

\- Tipos de notificação e de actividade, prioridades (`low`, `medium`, `high`, `urgent`)

\- Estados de pagamento, métodos de pagamento, moedas

\- Estados de empréstimo e categorias da Biblioteca

\- Países, províncias e distritos (Moçambique como padrão), prefixos telefónicos



Regras:

\- Listas dependentes de cada escola (matérias, turmas, cursos, classes, salas) NÃO ficam no código: ficam no banco de dados, sempre isoladas por `tenantId` (`schoolId`), e são acedidas por um único serviço/hook por entidade.

\- Listas globais fixas ficam no catálogo central.

\- Proibido escrever opções de dropdown directamente em componentes.



\## FASE 3 — TIPOS DE DADOS E MODELOS



1\. Defina interfaces/tipos TypeScript (ou JSDoc) únicos para cada entidade partilhada: `Student`, `Teacher`, `Subject`, `Class`, `Lesson`, `LessonPlan`, `Notification`, `Activity`, `Payment`, `Book`, etc.

2\. Regras de tipo obrigatórias em todo o sistema:

&#x20;  - IDs: sempre `string`.

&#x20;  - Datas: guardar em formato único (Timestamp/ISO 8601 em UTC) e converter apenas na camada de exibição. Exibir como `DD/MM/AAAA`; horas em 24h (`HH:mm`).

&#x20;  - Valores monetários: guardar como inteiro na menor unidade (centavos) com campo `currency`; formatar apenas na exibição.

&#x20;  - Telefone: guardar em formato internacional (+258...), exibir formatado.

&#x20;  - Texto: aplicar `trim`, normalizar espaços e padronizar capitalização de nomes próprios.

&#x20;  - Booleanos: nunca usar "sim"/"não" ou 0/1 como texto.

&#x20;  - Campos que referenciam catálogos guardam apenas o `value` interno, nunca o texto traduzido.

3\. Todo documento deve ter: `id`, `tenantId`, `createdAt`, `updatedAt`, `createdBy`, `status`.

4\. Crie um esquema de validação central (ex.: Zod/Yup) para cada entidade e use-o em todos os formulários e na camada de API/regras de segurança.



\## FASE 4 — COMPONENTES REUTILIZÁVEIS



Crie componentes únicos e use-os em todos os módulos, substituindo as implementações duplicadas:

\- `<CatalogSelect catalog="lessonStatus" />` (dropdown alimentado pelo catálogo, com i18n, pesquisa e ordenação)

\- `<EntitySelect entity="subject" />` (dropdown alimentado pelo banco, filtrado por `tenantId` e dependências, ex.: matérias do docente)

\- `<StatusBadge status="..." />` (cores e rótulos padronizados)

\- `<DateField />`, `<TimeField />`, `<MoneyField />`, `<PhoneField />` (com máscara e validação)

\- Hooks centrais: `useCatalog(name)`, `useEntityList(entity, filters)`



\## FASE 5 — CONSISTÊNCIA ENTRE MÓDULOS



\- Cada conceito existe em UM só lugar e os outros módulos apenas o referenciam por ID (sem copiar dados). Onde for necessário guardar uma cópia histórica (ex.: nome do docente numa notificação), guarde também o ID de origem.

\- Garanta que as relações existentes continuam a funcionar: matéria extraordinária criada no Calendário entra no Plano de Aulas com o indicador "Extraordinário"; "Notificar Aula pendente" continua a gerar a notificação e a actividade no módulo Actividades.

\- Padronize nomes de colecções/tabelas e de campos (camelCase em inglês, sem abreviações ambíguas).



\## FASE 6 — MIGRAÇÃO DOS DADOS EXISTENTES



\- Gere um script de migração idempotente que converta os valores antigos para os novos `value` do catálogo (mapa de equivalências: "Lecionado", "lecionada" → `taught`), corrija tipos (strings de data → Timestamp) e preencha campos em falta.

\- O script deve: funcionar por `tenantId`, ter modo simulação (dry-run) com relatório do que seria alterado, registar logs e permitir reverter.

\- Mantenha leitura compatível com valores antigos durante a transição, para não quebrar dados já gravados.



\## FASE 7 — i18n E ACESSIBILIDADE



\- Todos os rótulos dos catálogos devem existir em pt e en (e nos idiomas já suportados). Nenhum texto fixo em componentes.

\- Dropdowns com etiqueta, navegação por teclado e mensagens de erro padronizadas.



\## ENTREGA ESPERADA



1\. Relatório da auditoria (Fase 1).

2\. Lista de ficheiros criados e alterados, agrupados por módulo.

3\. Catálogos, tipos, validações e componentes implementados.

4\. Script de migração com instruções de execução.

5\. Checklist de verificação manual por módulo para eu confirmar que nada quebrou.

6\. Documento curto "Guia de Padrões de Dados" com as regras para novos módulos.



\## RESTRIÇÕES



\- Não quebrar funcionalidades existentes nem alterar o design visual, salvo onde for necessário para unificar componentes.

\- Manter o isolamento multi-tenant em todas as consultas.

\- Fazer alterações por etapas e explicar cada uma antes de aplicar.

\- Se encontrar ambiguidade (dois valores que parecem iguais mas podem ter significados diferentes), pergunte antes de fundir.





