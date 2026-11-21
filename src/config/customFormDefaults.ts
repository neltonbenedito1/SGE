import { CustomForm } from '../types';

// Campos nativos que já possuem inputs dedicados na seção fixa superior dos formulários originais
// (extraído para permitir lazy loading completo do módulo FormulariosCustomizadosModule)
export const CORE_NATIVE_FORM_FIELD_IDS = new Set<string>([
  // Escola
  'esc_nome', 'esc_tipo_instituicao', 'esc_provincia', 'esc_telefone', 'esc_email',
  'esc_endereco', 'esc_diretor_nome', 'esc_nuit', 'esc_director_pedagogico',
  'esc_regime_manha', 'esc_regime_tarde', 'esc_regime_noite',
  // Docente
  'doc_foto', 'doc_nome', 'doc_email', 'doc_tel_principal', 'doc_genero',
  'doc_data_nascimento', 'doc_documento', 'doc_nuit', 'doc_data_admissao',
  'doc_escola', 'doc_categoria', 'doc_departamento', 'doc_especialidade',
  'doc_vinculo', 'doc_regime',
  // Estudante
  'est_foto', 'est_matricula', 'est_nome', 'est_genero', 'est_data_nascimento',
  'est_data_admissao', 'est_nacionalidade', 'est_documento', 'est_telefone',
  'est_morada', 'est_email', 'est_escola', 'est_turma',
  'est_encarregado_nome', 'est_encarregado_tel',
  // Notas / Pauta
  'pauta_identificacao_estudante', 'pauta_escola', 'pauta_disciplina_cadeira',
  'pauta_periodo_letivo', 'pauta_avaliacao_1', 'pauta_avaliacao_2',
  'pauta_avaliacao_3', 'pauta_exame_normal', 'pauta_exame_recurso'
]);

const DEFAULT_FORM_TIMESTAMP = '2026-01-01T00:00:00.000Z';

// Mapeamento dos formulários base padrão do sistema analisados (100% customizáveis)
export const DEFAULT_SYSTEM_FORMS: CustomForm[] = [
  {
    id: 'form_cadastro_escola',
    tenant_id: '',
    codigo: 'cadastro_escola',
    nome: 'Cadastro de Escolas e Unidades',
    descricao: 'Formulário oficial de registro de escolas, faculdades, institutos e polos.',
    entidade: 'escola',
    status: 'ativo',
    campos_padrao_inicializados: true,
    campos_padrao_v2_inicializados: true,
    campos: [
      {
        id: 'esc_nome',
        tipo: 'alfanumerico',
        label: 'Nome da Instituição / Escola',
        placeholder: 'Ex: Escola Secundária Josina Machel',
        obrigatorio: true,
        ordem: 1,
        largura: 'full'
      },
      {
        id: 'esc_tipo_instituicao',
        tipo: 'dropdown',
        label: 'Tipo de Instituição',
        obrigatorio: true,
        opcoes: ['Escola', 'Faculdade', 'Instituto'],
        ordem: 2,
        largura: '1/2'
      },
      {
        id: 'esc_provincia',
        tipo: 'alfabetico',
        label: 'Província de Localização',
        placeholder: 'Ex: Maputo Cidade',
        obrigatorio: true,
        ordem: 3,
        largura: '1/2'
      },
      {
        id: 'esc_telefone',
        tipo: 'telefone_ddd',
        label: 'Contacto Telefónico Oficial',
        placeholder: '84 123 4567',
        obrigatorio: false,
        ddd_padrao: '+258',
        ordem: 4,
        largura: '1/2'
      },
      {
        id: 'esc_email',
        tipo: 'texto_curto',
        label: 'E-mail Institucional',
        placeholder: 'contato@escola.edu.mz',
        obrigatorio: false,
        ordem: 5,
        largura: '1/2'
      },
      {
        id: 'esc_endereco',
        tipo: 'texto_curto',
        label: 'Endereço Físico Completo',
        placeholder: 'Av. Eduardo Mondlane, Nº 1234',
        obrigatorio: false,
        ordem: 6,
        largura: 'full'
      },
      {
        id: 'esc_data_fundacao',
        tipo: 'data',
        label: 'Data de Fundação Oficial',
        obrigatorio: false,
        ordem: 7,
        largura: '1/2'
      },
      {
        id: 'esc_diretor_nome',
        tipo: 'alfabetico',
        label: 'Diretor(a) Responsável',
        placeholder: 'Nome completo do diretor',
        obrigatorio: false,
        ordem: 8,
        largura: '1/2'
      },
      {
        id: 'esc_nuit',
        tipo: 'numero',
        label: 'NUIT da Unidade',
        placeholder: 'Ex: 400123456',
        obrigatorio: false,
        ordem: 9,
        largura: '1/2'
      },
      {
        id: 'esc_director_pedagogico',
        tipo: 'alfabetico',
        label: 'Director(a) Pedagógico(a)',
        placeholder: 'Nome completo do director pedagógico',
        obrigatorio: false,
        ordem: 10,
        largura: '1/2'
      },
      {
        id: 'esc_regime_manha',
        tipo: 'checkbox',
        label: 'Regime de Manhã Activo',
        obrigatorio: false,
        ordem: 11,
        largura: '1/2'
      },
      {
        id: 'esc_regime_tarde',
        tipo: 'checkbox',
        label: 'Regime da Tarde Activo',
        obrigatorio: false,
        ordem: 12,
        largura: '1/2'
      },
      {
        id: 'esc_regime_noite',
        tipo: 'checkbox',
        label: 'Regime Nocturno Activo',
        obrigatorio: false,
        ordem: 13,
        largura: '1/2'
      },
      {
        id: 'esc_salas_clima',
        tipo: 'numero',
        label: 'Quantidade de Salas Climatizadas',
        placeholder: 'Ex: 12',
        obrigatorio: false,
        ordem: 14,
        largura: '1/2',
        texto_ajuda: 'Salas equipadas com ar condicionado ativo.'
      },
      {
        id: 'esc_lab_info',
        tipo: 'checkbox',
        label: 'Possui Laboratório de Informática Equipado',
        obrigatorio: false,
        ordem: 15,
        largura: '1/2',
        texto_ajuda: 'Marque caso a unidade possua computadores para os alunos.'
      },
      {
        id: 'esc_regulamento',
        tipo: 'upload_arquivo',
        label: 'Regulamento Interno da Unidade',
        obrigatorio: false,
        formatos_permitidos: ['pdf'],
        tamanho_maximo_mb: 15,
        ordem: 16,
        largura: 'full',
        texto_ajuda: 'Ficheiro em PDF com as diretrizes da escola.'
      }
    ],
    created_at: DEFAULT_FORM_TIMESTAMP,
    updated_at: DEFAULT_FORM_TIMESTAMP
  },
  {
    id: 'form_cadastro_docente',
    tenant_id: '',
    codigo: 'cadastro_docente',
    nome: 'Cadastro de Docentes e Professores',
    descricao: 'Formulário oficial de cadastro de professores, docentes e auxiliares.',
    entidade: 'docente',
    status: 'ativo',
    campos_padrao_inicializados: true,
    campos_padrao_v2_inicializados: true,
    campos: [
      {
        id: 'doc_foto',
        tipo: 'upload_foto',
        label: 'Fotografia do Docente',
        obrigatorio: false,
        ordem: 1,
        largura: 'full'
      },
      {
        id: 'doc_nome',
        tipo: 'alfabetico',
        label: 'Nome Completo do Docente',
        placeholder: 'Ex: Prof. Dr. Armando Guebuza',
        obrigatorio: true,
        ordem: 2,
        largura: 'full'
      },
      {
        id: 'doc_email',
        tipo: 'texto_curto',
        label: 'E-mail Oficial / Institucional',
        placeholder: 'docente@escola.edu.mz',
        obrigatorio: true,
        ordem: 3,
        largura: '1/2'
      },
      {
        id: 'doc_tel_principal',
        tipo: 'telefone_ddd',
        label: 'Contacto Telefónico Principal',
        placeholder: '84 123 4567',
        obrigatorio: false,
        ddd_padrao: '+258',
        ordem: 4,
        largura: '1/2'
      },
      {
        id: 'doc_genero',
        tipo: 'dropdown',
        label: 'Gênero',
        obrigatorio: false,
        opcoes: ['Masculino', 'Feminino'],
        ordem: 5,
        largura: '1/2'
      },
      {
        id: 'doc_documento',
        tipo: 'alfanumerico',
        label: 'Documento de Identificação (BI / DIRE)',
        placeholder: 'Ex: 110100234567M',
        obrigatorio: false,
        ordem: 6,
        largura: '1/2'
      },
      {
        id: 'doc_nuit',
        tipo: 'numero',
        label: 'NUIT do Docente',
        placeholder: 'Ex: 123456789',
        obrigatorio: false,
        ordem: 7,
        largura: '1/2'
      },
      {
        id: 'doc_data_nascimento',
        tipo: 'data',
        label: 'Data de Nascimento',
        obrigatorio: false,
        ordem: 8,
        largura: '1/2'
      },
      {
        id: 'doc_data_admissao',
        tipo: 'data',
        label: 'Data de Admissão / Contratação',
        obrigatorio: false,
        ordem: 9,
        largura: '1/2'
      },
      {
        id: 'doc_escola',
        tipo: 'texto_curto',
        label: 'Escola / Faculdade de Alocação',
        placeholder: 'Unidade principal',
        obrigatorio: false,
        ordem: 10,
        largura: '1/2'
      },
      {
        id: 'doc_categoria',
        tipo: 'dropdown',
        label: 'Categoria Profissional',
        obrigatorio: false,
        opcoes: ['Professor Auxiliar', 'Professor Assistente', 'Professor Associado', 'Professor Catedrático', 'Docente N1', 'Docente N2', 'Docente N3'],
        ordem: 11,
        largura: '1/2'
      },
      {
        id: 'doc_departamento',
        tipo: 'texto_curto',
        label: 'Departamento / Área Científica',
        placeholder: 'Ex: Ciências Exactas',
        obrigatorio: false,
        ordem: 12,
        largura: '1/2'
      },
      {
        id: 'doc_especialidade',
        tipo: 'texto_curto',
        label: 'Especialidade / Disciplinas Lecionadas',
        placeholder: 'Ex: Matemática e Física',
        obrigatorio: false,
        ordem: 13,
        largura: '1/2'
      },
      {
        id: 'doc_vinculo',
        tipo: 'dropdown',
        label: 'Tipo de Vínculo Laboral',
        obrigatorio: false,
        opcoes: ['Efetivo', 'Contratado', 'Convidado', 'Estagiário'],
        ordem: 14,
        largura: '1/2'
      },
      {
        id: 'doc_regime',
        tipo: 'dropdown',
        label: 'Regime de Trabalho',
        obrigatorio: false,
        opcoes: ['Tempo Integral', 'Tempo Parcial', 'Por Horas'],
        ordem: 15,
        largura: '1/2'
      },
      {
        id: 'doc_grau_pedagogico',
        tipo: 'dropdown',
        label: 'Certificação de Habilitação Pedagógica',
        placeholder: 'Selecione o nível de formação...',
        obrigatorio: false,
        opcoes: [
          'Licenciatura em Educação / Ensino',
          'Mestrado em Ciências da Educação',
          'Doutoramento / PhD',
          'Certificado de Formação de Formadores (CENFOC)',
          'Em Formação Pedagógica',
          'Não Possui Certificação Pedagógica'
        ],
        ordem: 16,
        largura: 'full',
        texto_ajuda: 'Qualificação pedagógica oficial do docente.'
      },
      {
        id: 'doc_curriculum_vitae',
        tipo: 'upload_arquivo',
        label: 'Curriculum Vitae Atualizado',
        obrigatorio: false,
        formatos_permitidos: ['pdf', 'xlsx'],
        tamanho_maximo_mb: 20,
        ordem: 17,
        largura: 'full',
        texto_ajuda: 'Ficheiro PDF ou XLSX do CV.'
      },
      {
        id: 'doc_observacoes',
        tipo: 'texto_longo',
        label: 'Observações ou Competências Especiais',
        placeholder: 'Áreas de pesquisa, artigos publicados, projetos...',
        obrigatorio: false,
        ordem: 18,
        largura: 'full'
      }
    ],
    created_at: DEFAULT_FORM_TIMESTAMP,
    updated_at: DEFAULT_FORM_TIMESTAMP
  },
  {
    id: 'form_cadastro_estudante',
    tenant_id: '',
    codigo: 'cadastro_estudante',
    nome: 'Cadastro de Estudantes e Alunos',
    descricao: 'Formulário oficial de admissão, matrícula e ficha do estudante.',
    entidade: 'estudante',
    status: 'ativo',
    campos_padrao_inicializados: true,
    campos_padrao_v2_inicializados: true,
    campos: [
      {
        id: 'est_foto',
        tipo: 'upload_foto',
        label: 'Fotografia Digital do Aluno',
        obrigatorio: false,
        ordem: 1,
        largura: 'full'
      },
      {
        id: 'est_matricula',
        tipo: 'alfanumerico',
        label: 'Número de Matrícula',
        placeholder: 'Ex: MAT-2026-001',
        obrigatorio: true,
        ordem: 2,
        largura: '1/2'
      },
      {
        id: 'est_nome',
        tipo: 'alfabetico',
        label: 'Nome Completo do Estudante',
        placeholder: 'Ex: Nelton Benedito',
        obrigatorio: true,
        ordem: 3,
        largura: '1/2'
      },
      {
        id: 'est_genero',
        tipo: 'dropdown',
        label: 'Gênero',
        obrigatorio: true,
        opcoes: ['Masculino', 'Feminino'],
        ordem: 4,
        largura: '1/2'
      },
      {
        id: 'est_data_nascimento',
        tipo: 'data',
        label: 'Data de Nascimento',
        obrigatorio: false,
        ordem: 5,
        largura: '1/2'
      },
      {
        id: 'est_data_admissao',
        tipo: 'data',
        label: 'Data de Matrícula / Admissão',
        obrigatorio: false,
        ordem: 6,
        largura: '1/2'
      },
      {
        id: 'est_nacionalidade',
        tipo: 'alfabetico',
        label: 'Nacionalidade',
        placeholder: 'Ex: Moçambicana',
        obrigatorio: false,
        ordem: 7,
        largura: '1/2'
      },
      {
        id: 'est_documento',
        tipo: 'alfanumerico',
        label: 'Documento de Identificação (BI / Cédula)',
        placeholder: 'Ex: 110100456789B',
        obrigatorio: false,
        ordem: 8,
        largura: '1/2'
      },
      {
        id: 'est_telefone',
        tipo: 'telefone_ddd',
        label: 'Contacto Telefónico do Aluno',
        placeholder: '84 123 4567',
        obrigatorio: false,
        ddd_padrao: '+258',
        ordem: 9,
        largura: '1/2'
      },
      {
        id: 'est_morada',
        tipo: 'texto_curto',
        label: 'Endereço de Residência',
        placeholder: 'Bairro Central, Rua das Flores Nº 45',
        obrigatorio: false,
        ordem: 10,
        largura: 'full'
      },
      {
        id: 'est_email',
        tipo: 'texto_curto',
        label: 'E-mail do Estudante',
        placeholder: 'estudante@escola.edu.mz',
        obrigatorio: false,
        ordem: 11,
        largura: '1/2'
      },
      {
        id: 'est_escola',
        tipo: 'texto_curto',
        label: 'Escola / Faculdade de Alocação',
        placeholder: 'Unidade de ensino',
        obrigatorio: true,
        ordem: 12,
        largura: '1/2'
      },
      {
        id: 'est_turma',
        tipo: 'texto_curto',
        label: 'Turma / Curso Alocado',
        placeholder: 'Ex: 10ª Classe A',
        obrigatorio: false,
        ordem: 13,
        largura: '1/2'
      },
      {
        id: 'est_encarregado_nome',
        tipo: 'alfabetico',
        label: 'Nome do Encarregado / Contacto de Emergência',
        placeholder: 'Nome completo do responsável',
        obrigatorio: false,
        ordem: 14,
        largura: '1/2'
      },
      {
        id: 'est_encarregado_tel',
        tipo: 'telefone_ddd',
        label: 'Contacto do Encarregado / Emergência',
        placeholder: '84 123 4567',
        obrigatorio: false,
        ddd_padrao: '+258',
        ordem: 15,
        largura: '1/2'
      },
      {
        id: 'est_grupo_sanguineo',
        tipo: 'dropdown',
        label: 'Grupo Sanguíneo',
        placeholder: 'Selecione...',
        obrigatorio: false,
        opcoes: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não Sabe'],
        ordem: 16,
        largura: '1/2',
        texto_ajuda: 'Para primeiros socorros e ficha de saúde escolar.'
      },
      {
        id: 'est_nee',
        tipo: 'checkbox',
        label: 'Necessidades Educativas Especiais (NEE)',
        obrigatorio: false,
        ordem: 17,
        largura: '1/2',
        texto_ajuda: 'Assinale caso o estudante necessite de apoio pedagógico especializado.'
      },
      {
        id: 'est_alergias_medicas',
        tipo: 'texto_longo',
        label: 'Alergias ou Restrições de Saúde',
        placeholder: 'Especifique alergias a medicamentos, alimentos, condições crônicas...',
        obrigatorio: false,
        ordem: 18,
        largura: 'full'
      },
      {
        id: 'est_cert_habilitacoes',
        tipo: 'upload_arquivo',
        label: 'Certificado de Habilitações Anteriores',
        obrigatorio: false,
        formatos_permitidos: ['pdf'],
        tamanho_maximo_mb: 15,
        ordem: 19,
        largura: 'full',
        texto_ajuda: 'Cópia autenticada do certificado de conclusão em formato PDF.'
      }
    ],
    created_at: DEFAULT_FORM_TIMESTAMP,
    updated_at: DEFAULT_FORM_TIMESTAMP
  },
  {
    id: 'form_lancamento_notas',
    tenant_id: '',
    codigo: 'lancamento_notas',
    nome: 'Lançamento de Notas e Avaliações',
    descricao: 'Formulário oficial de pautas, notas contínuas, frequências, exames e avaliações modulares.',
    entidade: 'notas',
    status: 'ativo',
    campos_padrao_inicializados: true,
    campos_padrao_v2_inicializados: true,
    campos: [
      {
        id: 'pauta_escola',
        tipo: 'texto_curto',
        label: 'Escola / Faculdade / Instituto',
        placeholder: 'Unidade da avaliação',
        obrigatorio: true,
        ordem: 1,
        largura: '1/2'
      },
      {
        id: 'pauta_identificacao_estudante',
        tipo: 'alfanumerico',
        label: 'Identificação do Estudante (Matrícula/Código)',
        placeholder: 'Ex: MAT-2026-001',
        obrigatorio: true,
        ordem: 2,
        largura: '1/2',
        texto_ajuda: 'Código único ou número de matrícula do estudante avaliado.'
      },
      {
        id: 'pauta_disciplina_cadeira',
        tipo: 'texto_curto',
        label: 'Disciplina / Cadeira / Módulo',
        placeholder: 'Nome da disciplina ou módulo',
        obrigatorio: true,
        ordem: 3,
        largura: '1/2'
      },
      {
        id: 'pauta_periodo_letivo',
        tipo: 'dropdown',
        label: 'Período / Trimestre / Semestre',
        obrigatorio: true,
        opcoes: ['1º Trimestre', '2º Trimestre', '3º Trimestre', '1º Semestre', '2º Semestre', 'Anual'],
        ordem: 4,
        largura: '1/2'
      },
      {
        id: 'pauta_data_avaliacao',
        tipo: 'data',
        label: 'Data Oficial de Fecho da Avaliação',
        obrigatorio: false,
        ordem: 3,
        largura: '1/2',
        texto_ajuda: 'Data de realização do exame ou fecho da pauta.'
      },
      {
        id: 'pauta_avaliacao_1',
        tipo: 'numero',
        label: 'Avaliação 1 / Teste 1 / Frequência 1',
        placeholder: '0.0 a 20.0',
        obrigatorio: false,
        ordem: 4,
        largura: '1/2',
        texto_ajuda: 'Primeira nota de avaliação contínua (0 a 20).'
      },
      {
        id: 'pauta_avaliacao_2',
        tipo: 'numero',
        label: 'Avaliação 2 / Teste 2 / Frequência 2',
        placeholder: '0.0 a 20.0',
        obrigatorio: false,
        ordem: 5,
        largura: '1/2',
        texto_ajuda: 'Segunda nota de avaliação contínua (0 a 20).'
      },
      {
        id: 'pauta_avaliacao_3',
        tipo: 'numero',
        label: 'Avaliação 3 / Trabalho Prático',
        placeholder: '0.0 a 20.0',
        obrigatorio: false,
        ordem: 6,
        largura: '1/2',
        texto_ajuda: 'Trabalho prático ou terceira avaliação (0 a 20).'
      },
      {
        id: 'pauta_exame_normal',
        tipo: 'numero',
        label: 'Nota de Exame Normal',
        placeholder: '0.0 a 20.0',
        obrigatorio: false,
        ordem: 7,
        largura: '1/2',
        texto_ajuda: 'Nota obtida na época normal de exames.'
      },
      {
        id: 'pauta_exame_recurso',
        tipo: 'numero',
        label: 'Nota de Exame de Recurso / Reavaliação',
        placeholder: '0.0 a 20.0',
        obrigatorio: false,
        ordem: 8,
        largura: '1/2',
        texto_ajuda: 'Nota da época de recurso ou segunda chamada.'
      },
      {
        id: 'pauta_criterio_mencao',
        tipo: 'dropdown',
        label: 'Menção Qualitativa de Desempenho',
        placeholder: 'Selecione...',
        obrigatorio: false,
        opcoes: ['Excelente (18-20)', 'Muito Bom (16-17)', 'Bom (14-15)', 'Suficiente (10-13)', 'Insuficiente (0-9)'],
        ordem: 9,
        largura: '1/2'
      },
      {
        id: 'pauta_justificativa_recuperacao',
        tipo: 'texto_curto',
        label: 'Justificativa de Ausência / Prova de Recuperação',
        placeholder: 'Ex: Atestado médico hospitalar Nº 452',
        obrigatorio: false,
        ordem: 10,
        largura: 'full',
        texto_ajuda: 'Motivo regulamentar para admissão a época especial ou segunda chamada.'
      },
      {
        id: 'pauta_observacoes_docente',
        tipo: 'texto_longo',
        label: 'Observações e Parecer Pedagógico do Docente',
        placeholder: 'Descreva a evolução pedagógica, participação e recomendações...',
        obrigatorio: false,
        ordem: 11,
        largura: 'full'
      },
      {
        id: 'pauta_comprovativo_prova',
        tipo: 'upload_arquivo',
        label: 'Pauta Física Assinada ou Prova Escaneada (PDF ou XLSX)',
        obrigatorio: false,
        formatos_permitidos: ['pdf', 'xlsx'],
        tamanho_maximo_mb: 20,
        ordem: 12,
        largura: 'full',
        texto_ajuda: 'Anexo oficial para arquivo pedagógico da instituição.'
      }
    ],
    created_at: DEFAULT_FORM_TIMESTAMP,
    updated_at: DEFAULT_FORM_TIMESTAMP
  }
];
