# Guia de Padrões de Dados do Sistema de Gestão Educacional (SGE)

Este guia estabelece as convenções obrigatórias para dados, tipos, nomenclatura e integração em todos os módulos do sistema.

## 1. Princípios Gerais
- **Multi-Tenant Estrito**: Todos os documentos acadêmicos e operacionais devem conter o campo `tenant_id` (e `escola_id` quando aplicável). Nenhuma consulta pode cruzar escolas ou tenants sem isolamento explícito.
- **Identificadores Únicos**: Sempre do tipo `string`, alfanuméricos (`^[a-zA-Z0-9_\-]+$`), com comprimento `<= 128`.
- **Nenhum Valor Solto (Anti-Hardcoding)**: Opções de dropdowns e estados devem consumir o catálogo central em `/src/shared/catalogs/index.ts` e o hook `useCatalog`.

## 2. Tipos de Dados e Formatos
- **Datas**: Armazenadas no formato ISO 8601 (`YYYY-MM-DD` para datas civis e timestamps completos UTC para auditoria). Exibição formatada como `DD/MM/AAAA`.
- **Horas**: Formato de 24 horas (`HH:mm`).
- **Valores Monetários**: Armazenados em formato numérico padrão com moeda associada (MZN, AOA, EUR, BRL).
- **Telefone**: Formato internacional com prefixo de país (`+258 84...`, `+244 9...`, etc.).
- **Booleanos**: Sempre tipo nativo `boolean` (`true` ou `false`). É proibido usar `"Sim"/"Não"` ou `1/0` como string.
- **Normalização de Texto**: Aplicar `.trim()` e capitalização correta em nomes próprios.

## 3. Catálogos Centrais do Sistema (`/src/shared/catalogs/index.ts`)
| Domínio | Valores Internos Padronizados |
|---|---|
| Estados de Aula | `planned`, `taught`, `pending`, `cancelled`, `extraordinary` |
| Estados Genéricos | `active`, `inactive`, `suspended`, `archived` |
| Perfis de Utilizador | `super_admin`, `admin`, `director`, `pedagogical_director`, `general_secretary`, `docente`, `estudante`, `pai`, `librarian`, `finance`, `suporte` |
| Níveis de Ensino | `primario`, `secundario`, `superior`, `profissional` |
| Tipos de Instituição | `Escola`, `Faculdade`, `Instituto` |
| Regimes / Turnos | `manha`, `tarde`, `noite` |
| Género | `Masculino`, `Feminino` |
| Documentos | `bi`, `passaporte`, `dire`, `cartao_eleitor`, `certidao_nascimento`, `outro` |

## 4. Estrutura do Documento de Estudante por Nível de Ensino
- Todo documento de estudante possui na raiz os campos essenciais: `id`, `tenant_id`, `escola_id`, `turma_id`, `nome`, `data_nascimento`, `genero`, `numero_matricula`, `nivelEnsino`.
- Os quatro níveis de ensino:
  1. `primario`: Focado nos anos fundamentais (1ª à 6ª classe), inclui certidão de nascimento, encarregado obrigatório, pré-escolar e vacinas.
  2. `secundario`: Dividido em 1º Ciclo (8ª à 10ª) e 2º Ciclo (11ª e 12ª com secção de Ciências ou Letras). Encarregado obrigatório para menores de 18 anos.
  3. `superior`: Para Faculdades e Universidades. Inclui NUIT, histórico do ensino médio, curso, forma de ingresso, regime e situação laboral. Não requer encarregado.
  4. `profissional`: Para Institutos Médicos e Centros Técnico-Profissionais. Inclui nível e área de formação técnica, qualificação anterior, estágio e situação de emprego.
