/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Super Admin Entities
export interface SuperUser {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'finance';
  created_at: string;
}

export type TipoInstituicao = 'escola' | 'instituto' | 'universidade' | 'global';

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  plano_id: string;
  status: 'ativo' | 'suspenso' | 'cancelado' | 'pendente_pagamento';
  data_vencimento: string;
  data_renovacao: string;
  created_at: string;
  email_admin: string;
  telefone: string;
  endereco: string;
  deleted_at?: string | null;
  slots_adicionais?: Record<string, number>;
  idioma_padrao?: string;
  ai_translation_enabled?: boolean;
  logo_url?: string;
  pais_origem?: string;
  paises_sucursais?: string[];
  paises_atuacao?: string[];
  // Novos campos estruturais por tipo de instituição
  tipoInstituicao?: TipoInstituicao;
  codigo_oficial?: string; // MEC ou Licenciamento técnico ou Registo
  tipo_escola?: 'Primária' | 'Secundária' | 'Ambas' | string;
  regime_funcionamento?: 'Diurno' | 'Noturno' | 'Ambos' | string;
  diretor_responsavel?: string;
  nuit?: string;
  capacidade_total?: number;
  regime_avaliacao?: string;
  // Universidade
  sigla_registo?: string;
  universidade_afiliacao?: string;
  regime_ensino?: 'Semestral' | 'Anual' | 'Créditos ECTS' | 'Modular' | 'Competências' | string;
  modalidade_oferta?: 'Presencial' | 'Semipresencial' | 'EAD' | string;
  decano_faculdade?: string;
  campus_endereco?: string;
  acreditacao_governamental?: 'Acreditada' | 'Em Processo' | string;
  sistema_avaliacao?: string;
  // Instituto
  codigo_licenciamento?: string;
  area_especializacao?: string;
  instalacoes_oficinas?: string[]; // Laboratórios, Oficinas, Simuladores
  parcerias_empresas?: boolean;
  modelo_avaliacao?: string;
  assiduidadeAtiva?: boolean;
}

export interface Curso {
  id: string;
  tenant_id: string;
  institutionId: string;
  escola_id?: string; // Alias for institutionId
  nome: string;
  codigo: string;
  tipo: 'graduacao' | 'tecnico' | 'classe' | string;
  grau?: 'Licenciatura' | 'Mestrado' | 'Doutoramento' | 'Técnico Médio' | 'Técnico Básico' | 'Classe Escolar' | string;
  duracao_anos?: number;
  duracao_periodos?: number;
  regime: 'semestral' | 'trimestral' | 'modular' | 'anual' | 'creditos' | string;
  nivelEnsino: 'escola' | 'instituto' | 'universidade' | 'primario' | 'secundario' | 'superior' | 'profissional' | string;
  area_especializacao?: string;
  faculdade_unidade?: string;
  diretor_curso_id?: string;
  diretor_curso_nome?: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Cadeira {
  id: string;
  tenant_id: string;
  institutionId: string;
  escola_id?: string; // Alias for institutionId
  cursoId?: string;
  curso_id?: string; // Alias for cursoId
  curso_nome?: string;
  nome: string;
  codigo: string;
  ano_curricular: number; // 1º Ano, 2º Ano, etc.
  periodo_lectivo: string; // Ex: '1º Semestre', '2º Trimestre', 'Módulo 1', 'Ano 1'
  semestre?: string; // Alias for periodo_lectivo
  creditos?: number; // Alias for creditos_ects
  regime_periodo: 'semestre' | 'trimestre' | 'modulo' | 'ano' | string;
  creditos_ects?: number;
  horas_teoricas?: number;
  horas_praticas?: number;
  tipo_disciplina: 'obrigatoria' | 'opcional';
  pre_requisitos?: string[]; // IDs de outras cadeiras do mesmo curso
  tipo_trabalho_conclusao?: 'Monografia' | 'Dissertação' | 'Projecto' | 'Nenhum' | string;
  docente_id?: string;
  // Instituto
  nivel_qualificacao_qnc?: 'Nível 3' | 'Nível 4' | 'Nível 5' | string;
  competencia_pratica?: string;
  equipamentos_exigidos?: string;
  estagio_horas?: number;
  created_at: string;
  updated_at?: string;
}

export interface InscricaoCadeira {
  id: string;
  tenant_id: string;
  estudante_id: string;
  institutionId: string;
  cursoId?: string;
  cadeira_id: string;
  cadeira_nome?: string;
  cadeira_codigo?: string;
  ano_lectivo: string;
  periodo_lectivo: string;
  ano_curricular: number;
  estado: 'Por cursar' | 'Em curso' | 'Aprovado' | 'Reprovado' | 'Dispensado';
  nota_final?: number;
  creditos_concluidos?: number;
  data_inscricao: string;
  updated_at?: string;
}

export interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  periodicidade: 'mensal' | 'anual';
  modulos_permitidos: string[]; // e.g. ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "processo"]
  limits: {
    max_escolas: number;
    max_docentes: number;
    max_estudantes: number;
    max_turmas: number;
    max_disciplinas?: number;
    max_classes?: number;
    max_usuarios?: number;
  };
}

export interface Pagamento {
  id: string;
  tenant_id: string;
  tenant_nome: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  metodo: string;
}

export interface LogAdmin {
  id: string;
  admin_id: string;
  admin_nome: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  timestamp: string;
  detalhes: string;
}

// Tenant Entities
export type UserType = 'admin' | 'director' | 'docente' | 'pai' | 'estudante' | 'suporte';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  nome: string;
  tipo: UserType;
  permissoes: string[]; // RWD permissions
  modulo_acessos?: string[];
  escola_id?: string;
  foto_url?: string;
  senha_temporaria?: string;
  ativo: boolean;
  mustChangePassword?: boolean;
  requer_alteracao_senha?: boolean;
  passwordLastChangedAt?: any;
  passwordChangedBy?: string;
  sessionsRevokedAt?: any;
  created_at: string;
}

export interface Feriado {
  id?: string;
  tenant_id?: string;
  nome: string;
  data: string;
  pais?: string;
  tipo?: string;
  descricao?: string;
  created_at?: string;
}

export interface Provincia {
  id: string;
  tenant_id: string;
  nome: string;
  codigo: string;
}

export interface Escola {
  id: string;
  tenant_id: string;
  provincia_id: string;
  nome: string;
  codigo?: string;
  endereco: string;
  telefone: string;
  email: string;
  diretor_id: string;
  diretor_pedagogico_id?: string;
  data_fundacao?: string;
  ativo: boolean;
  latitude?: string | number;
  longitude?: string | number;
  deleted_at?: string | null;
  logo_url?: string;
  tipo_instituicao?: 'Escola' | 'Faculdade' | 'Instituto';
  controlar_assiduidade?: boolean;
  regime_manha?: boolean;
  regime_tarde?: boolean;
  regime_noite?: boolean;
  tolerancia_manha?: string;
  tolerancia_tarde?: string;
  tolerancia_noite?: string;
  niveis_ensino?: ('primario' | 'secundario' | 'superior' | 'profissional')[];
  nuit?: string;
  diretor_nome?: string;
  contacto?: string;
  dados_customizados?: Record<string, any>;
}

export interface FormacaoAcademica {
  id?: string;
  grau: 'Licenciatura' | 'Mestrado' | 'Doutoramento' | 'Bacharelato' | 'Pós-Graduação' | 'Técnico Médio' | string;
  curso: string;
  instituicao: string;
  ano_conclusao: number | string;
  pais: string;
}

export interface Docente {
  id: string;
  tenant_id: string;
  user_id: string;
  // 1.1 Informações Pessoais (Obrigatórias)
  nome?: string;
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | string;
  nacionalidade?: string;
  estado_civil?: 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)' | 'União de Facto' | string;
  documento_identificacao?: string;
  nuit?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade_provincia?: string;
  foto_url?: string;
  // 1.2 Informações Profissionais (Opcionais no cadastro)
  codigo_docente?: string;
  categoria_profissional?: string;
  cargo?: string;
  departamento?: string;
  cursos_lecionados?: string[];
  especialidade?: string;
  numero_registro?: string;
  data_contratacao?: string;
  data_admissao?: string;
  tipo_vinculo?: 'Efetivo' | 'Contratado' | 'Colaborador' | 'Substituto' | 'Tempo Parcial' | string;
  regime_trabalho?: 'Tempo Integral (Full-time)' | 'Tempo Parcial (Part-time)' | 'Horista' | string;
  escola_id: string;
  turmas_atribuidas?: string[];
  ativo?: boolean;
  // 1.3 Formação Académica (Pelo menos uma obrigatória no cadastro)
  formacoes_academicas?: FormacaoAcademica[];
  dados_em_falta?: string[];
  dados_customizados?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Estudante {
  id: string;
  tenant_id: string;
  user_id: string;
  nome?: string;
  escola_id: string;
  numero_matricula: string;
  data_nascimento: string;
  genero: 'Masculino' | 'Feminino';
  turma_id: string;
  pai_id: string;
  nivelEnsino?: 'primario' | 'secundario' | 'superior' | 'profissional';
  curso_id?: string;
  ano_curricular?: number;
  ano_lectivo?: string;
  dados_nivel?: Record<string, any>;
  naturalidade_provincia?: string;
  naturalidade_distrito?: string;
  nacionalidade?: string;
  tipo_documento?: string;
  numero_documento?: string;
  validade_documento?: string;
  residencia_provincia?: string;
  residencia_distrito?: string;
  residencia_bairro?: string;
  contacto_emergencia_nome?: string;
  contacto_emergencia_telefone?: string;
  telemovel?: string;
  email?: string;
  data_admissao?: string;
  foto_url?: string;
  regime?: string;
  ativo?: boolean;
  motivo_desativacao?: string;
  desativado_em?: string;
  desativado_por?: string;
  documento_identificacao?: string;
  nome_pai?: string;
  nome_mae?: string;
  morada?: string;
  faturado?: boolean;
  periodo_facturacao?: 'Semestral' | 'Mensal' | 'Anual';
  propina_vencimento?: string;
  propina_valor?: number;
  data_matricula?: string;
  dados_em_falta?: string[];
  usuario_sistema?: boolean;
  senha_temporaria?: string;
  bi_nif?: string;
  encarregado_nome?: string;
  encarregado_contacto?: string;
  cracha_gerado?: boolean;
  cracha_gerado_em?: string;
  cracha_inutilizado?: boolean;
  cracha_atualizado_em?: string;
  cracha_eliminado_em?: string;
  qr_code_data?: string;
  dados_customizados?: Record<string, any>;
}

export interface FaturaEstudante {
  id: string;
  tenant_id: string;
  estudante_id: string;
  escola_id: string;
  turma_id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  data_pagamento?: string;
  metodo_pagamento?: string;
  recibo_numero?: string;
}

export interface Pai {
  id: string;
  tenant_id: string;
  user_id: string;
  telefone: string;
  endereco: string;
  estudantes_ids: string[];
}

export interface Turma {
  id: string;
  tenant_id: string;
  escola_id: string;
  nome: string;
  ano_letivo: string;
  nivel: string;
  docente_id: string; // Professor titular
  capacidade_max: number;
  classe_escolar_id?: string;
  curso_id?: string; // Curso associado (ensino superior/profissional)
  ano_curricular?: string; // Ex: '1º Ano', '2º Ano', etc.
  horario?: string;
  turno?: string;
  regime?: string;
}


export interface Classe {
  id: string;
  tenant_id: string;
  turma_id: string;
  nome: string; // Subject name (e.g. Matemática, Língua Portuguesa)
  docente_id: string;
  horario: string; // e.g. "Segunda 08:00 - 10:00"
  sala: string;
  data?: string; // e.g. "2026-07-10"
  dia_semana?: string; // e.g. "Sexta-feira"
  escola_id?: string;
  classe_escolar_id?: string;
  professores_responsaveis?: string[];
  classes_associadas_ids?: string[];
  codigo?: string;
  status_aprovacao?: string;
  justificativa?: string;
  disciplina_id?: string;
  plano_aula_id?: string;
  materia_topico?: string;
  extraordinario?: boolean;
}

export type PeriodoTipo = 'semestre' | 'trimestre';
export type StatusPlanoAula = 'pendente' | 'lecionado';

export interface PlanoAula {
  id: string;
  tenantId: string;
  docenteId: string;
  disciplinaId: string;
  turmaId?: string;
  topico: string;
  periodoTipo: PeriodoTipo;
  periodoNumero: number;
  anoLectivo: string;
  dataPrevista?: string;
  status: StatusPlanoAula;
  dataLecionada?: string;
  extraordinario: boolean;
  aulaCalendarioId?: string;
  ordem: number;
  notificadoEm?: string;
  notificadoPor?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}


export interface Sala {
  id: string;
  tenant_id: string;
  escola_id?: string;
  nome: string;
  capacidade: number;
  tipo: string;
  descricao?: string;
}

export interface ClasseEscolar {
  id: string;
  tenant_id: string;
  nome: string; // e.g. "7ª Classe", "10ª Classe"
  nivel: 'Primário' | 'Secundário' | 'Médio' | 'Pré-escolar';
  descricao?: string;
  escola_id?: string;
}

export interface Pauta {
  id: string;
  tenant_id: string;
  escola_id?: string;
  turma_id?: string;
  estudante_id: string;
  classe_id: string;
  trimestre?: '1º Trimestre' | '2º Trimestre' | '3º Trimestre' | string;
  semestre?: '1º Semestre' | '2º Semestre' | 'Anual' | string;
  modulo_periodo?: string;
  curso_id?: string;
  cadeira_id?: string;
  nota_prova?: number;
  nota_trabalho?: number;
  nota_participacao?: number;
  num_avaliacoes?: number;
  avaliacao_1?: number;
  avaliacao_2?: number;
  avaliacao_3?: number;
  // Campos Universitários (Cadeiras / Semestres)
  frequencia_1?: number;
  frequencia_2?: number;
  trabalho_pratico?: number;
  media_frequencia?: number;
  exame_normal?: number;
  exame_recurso?: number;
  creditos_ects?: number;
  // Campos de Institutos Técnicos (Módulos / Competências)
  avaliacao_teorica?: number;
  avaliacao_pratica?: number;
  projecto_integrador?: number;
  horas_estagio_cumpridas?: number;
  competencia_status?: 'Apto' | 'Ainda Não Apto' | 'Apto com Distinção' | string;
  tipo_instituicao_origem?: 'escola' | 'universidade' | 'instituto' | string;
  nota_tr1?: number;
  media_final?: number;
  nota_exame?: number;
  nota_reavaliacao?: number;
  nota_media?: number;
  situacao?: 'Aprovado' | 'Reprovado' | 'Recuperação' | string;
  status_estudante?: string;
  observacao?: string;
  data_lancamento?: string;
  status?: string;
  estado?: string;
  publicado?: boolean;
  nota?: number;
  criado_em?: string;
  dados_customizados?: Record<string, any>;
}

export type ProcessoTipo = 'Matrícula' | 'Transferência' | 'Suspensão' | 'Conclusão' | 'Desistência' | 'Justificativa de Ausência' | string;
export type ProcessoStatus = 'Solicitação' | 'Análise' | 'Aprovado' | 'Rejeitado' | 'Concluído';

export interface ProcessoAluno {
  id: string;
  tenant_id: string;
  estudante_id: string;
  tipo: ProcessoTipo;
  data: string;
  documentos: string[]; // list of file names or URLs
  status: ProcessoStatus;
  criador_nome: string;
  observacao?: string;
  detalhes?: string;
  criado_em?: string;
  criado_por?: string;
}

export type ProcessoDocenteTipo = 'Admissão' | 'Progressão na Carreira' | 'Avaliação de Desempenho' | 'Licença / Dispensa' | 'Transferência de Escola' | 'Dossiê Individual' | 'Rescisão Contratual' | string;

export interface ProcessoDocente {
  id: string;
  tenant_id: string;
  docente_id: string;
  tipo: ProcessoDocenteTipo;
  data: string;
  documentos: string[];
  status: ProcessoStatus;
  criador_nome: string;
  observacao?: string;
  detalhes?: string;
  criado_em?: string;
  criado_por?: string;
}

export type SeveridadeActividade = 'Baixo' | 'Médio' | 'Crítico';
export type StatusActividade = 'Pendente' | 'Em Progresso' | 'Finalizada' | 'Concluída' | 'Suspensa';
export type CategoriaAtribuicaoActividade = 'Todos' | 'Administradores' | 'Directores' | 'Professores' | 'Estudantes' | 'Encarregados' | string;

export interface ActividadeAuditoria {
  data: string;
  acao: string;
  autor_id: string;
  autor_nome: string;
  origem: string;
  detalhes?: string;
}

export interface ActividadePendente {
  id: string;
  tenant_id: string;
  titulo: string;
  detalhes: string;
  responsavel_id: string;
  responsavel_nome: string;
  responsavel_cargo: string;
  responsavel_email?: string;
  severidade: SeveridadeActividade;
  status: StatusActividade;
  criado_por_id: string;
  criado_por_nome: string;
  escola_id?: string;
  turma_id?: string;
  data_criacao: string;
  data_prazo?: string;
  data_finalizacao?: string;
  nota_finalizacao?: string;
  finalizado_por_id?: string;
  finalizado_por_nome?: string;
  concluido_por_id?: string;
  concluido_por_nome?: string;
  concluido_em?: string;
  categoria_atribuicao?: CategoriaAtribuicaoActividade;
  modulo_origem?: string;
  dedup_key?: string;
  resolvido_automaticamente?: boolean;
  origem_resolucao?: string;
  historico_auditoria?: ActividadeAuditoria[];
}

export interface IntervaloHorario {
  id: string;
  nome: string;
  turno: 'manha' | 'tarde' | 'noite' | 'todos';
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  nome_instituicao: string;
  logo_url?: string;
  endereco: string;
  contacto: string;
  ano_letivo_atual: string;
  escala_avaliacao: '0-20' | '0-10' | 'A-F';
  notificacoes_email: boolean;
  fuso_horario?: string;
  pais?: string;
  num_avaliacoes?: number;
  metodo_calculo?: string;
  taxa_propina_base?: number;
  taxa_multa_atraso?: number;
  moeda_padrao?: string;
  taxa_iva?: number;
  smtp_provider?: 'system' | 'custom';
  smtp_type?: 'manual' | 'gmail';
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
  smtp_sender_email?: string;
  smtp_sender_name?: string;
  smtp_status?: 'ativo' | 'inativo';
  notification_modules?: any[];
  pautas_num_avaliacoes?: number;
  pautas_tipo_periodo?: 'Trimestral' | 'Semestral';
  pautas_metodo_calculo?: 'Aritmética' | 'Ponderada';
  pautas_peso_provas?: number;
  pautas_peso_trabalhos?: number;
  pautas_nota_aprovacao?: number;
  pautas_nota_admissao?: number;
  pautas_arredondamento?: 'padrao' | 'cima' | 'baixo';
  faturacao_multa_atraso?: number;
  faturacao_taxa_reavaliacao?: number;
  faturacao_taxas_adicionais?: number;
  faturacao_multa_margem?: number;
  dia_vencimento_padrao?: number;
  // Configurações modulares adicionais
  horarios_duracao_minutos?: number;
  horarios_dias_letivos?: number;
  horarios_hora_inicio_manha?: string;
  horarios_hora_inicio_tarde?: string;
  horarios_hora_inicio_noite?: string;
  horarios_intervalos?: IntervaloHorario[];
  assiduidade_minima_aprovacao?: number; // Ex: 75 (%)
  prazo_justificativa_dias?: number;     // Ex: 5 dias
  limite_faltas_alerta?: number;         // Ex: 3 faltas
  biblioteca_prazo_dias?: number;        // Ex: 15 dias
  biblioteca_limite_livros?: number;     // Ex: 3 livros
  biblioteca_multa_diaria?: number;      // Ex: 20 MZN
  biblioteca_permitir_renovacao?: boolean;
  biblioteca_permitir_download?: boolean;
  capacidade_padrao_turma?: number;      // Ex: 30 alunos
  capacidade_minima_por_curso?: number;  // Ex: 25 alunos (padrão)
  prefixo_matricula?: string;            // Ex: "MAT"
  idade_minima_matricula?: number;       // Ex: 5 anos
  carga_horaria_maxima_docente?: number; // Ex: 32 horas semanais
  limite_turmas_docente?: number;        // Ex: 6 turmas
  disciplinas_carga_horaria_padrao?: number; // Ex: 4 horas semanais
  disciplinas_permitir_semestrais?: boolean;
  financeiro_formas_pagamento?: string[]; // Ex: ["M-Pesa", "E-Mola", "Transferência", "Dinheiro"]
  financeiro_taxa_juros_diario?: number;  // Ex: 0.1%
  relatorios_cabecalho_oficial?: string;
  relatorios_rodape_oficial?: string;
  relatorios_formato_exportacao?: 'pdf' | 'excel' | 'ambos';
  relatorios_orientacao_padrao?: 'retrato' | 'paisagem';
  notificacoes_canais?: { email: boolean; push: boolean; sistema: boolean };
  notificacoes_modelo_falta?: string;
  notificacoes_modelo_cobranca?: string;
  tamanho_minimo_senha?: number;         // Ex: 8 caracteres
  exigir_alteracao_primeiro_login?: boolean;
  tempo_inatividade_sessao_minutos?: number; // Ex: 60 minutos
  tentativas_maximas_login?: number;     // Ex: 5 tentativas
}

export interface SmtpConfig {
  id: string; // doc ID can be tenant_id
  tenant_id: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  sender_email: string;
  sender_name: string;
  status: 'ativo' | 'inativo';
  updated_at?: string;
  smtp_type?: 'manual' | 'gmail';
  gmail_token?: string;
  auth_type?: 'oauth' | 'password';
}

export interface Notificacao {
  id: string;
  destinatario_id: string; // 'super_admin', tenantId, userId, teacherId, studentId, or 'todos'
  destinatario_role?: 'admin' | 'director' | 'docente' | 'estudante' | 'pai' | 'todos' | string;
  destinatario_email?: string;
  usuario_id?: string;
  usuario_email?: string;
  tenant_id?: string;
  estudante_id?: string;
  aluno_id?: string;
  docente_id?: string;
  turma_id?: string;
  turma_nome?: string;
  escola_id?: string;
  disciplina_id?: string;
  disciplina_nome?: string;
  atividade_id?: string;
  exame_id?: string;
  processo_id?: string;
  titulo: string;
  mensagem: string;
  lido: boolean;
  lido_em?: string;
  tipo: 'info' | 'alerta' | 'limite' | 'sistema' | 'sucesso' | 'cadastro';
  link?: string;
  modulo?: string;
  created_at: string;
}

export interface Livro {
  id: string;
  tenant_id: string;
  titulo: string;
  autor: string;
  editora: string;
  numero_paginas: number;
  capa_url: string; // Base64 or URL
  categoria?: string; // e.g. "Ficção", "Científico", etc.
  sinopse?: string;
  idioma?: string;
  isbn?: string;
  criado_por: string; // user ID
  escola_origem: string; // Escola ID (auditing)
  criado_em: string;
  atualizado_em: string;
  tags?: string[];
  destaque?: boolean;
  disciplina_associada?: string;
}

export interface Edicao {
  id: string;
  livro_id: string;
  numero_edicao: number;
  pdf_url: string; // Base64 or URL
  tamanho_ficheiro: number; // in MB
  notas_da_edicao?: string;
  adicionado_por: string; // user ID
  adicionado_em: string;
  ativa: boolean;
}

export interface PermissaoBiblioteca {
  id: string;
  utilizador_id: string;
  pode_ler: boolean;
  pode_baixar: boolean;
  pode_ver_todas_edicoes: boolean;
  escolas_permitidas?: string[];
  pode_avaliar?: boolean;
  pode_favoritar?: boolean;
  pode_excluir?: boolean;
  pode_adicionar?: boolean;
  pode_editar?: boolean;
}

export interface HistoricoLeitura {
  id: string;
  utilizador_id: string;
  livro_id: string;
  edicao_id: string;
  ultima_pagina_lida: number;
  percentual_concluido: number;
  ultima_leitura_em: string;
}

export interface ModuleActions {
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
  exportar: boolean;
  aprovar: boolean;
}

export interface ModulePermissionConfig {
  habilitado: boolean;
  acoes: ModuleActions;
}

export interface UserCategoryPermission {
  id: string;
  tenant_id?: string;
  nome: string;
  codigo: string;
  descricao: string;
  cor_badge: string;
  is_system?: boolean;
  modulos: Record<string, ModulePermissionConfig>;
  criado_em?: string;
}

export interface Avaliacao {
  id: string;
  utilizador_id: string;
  livro_id: string;
  nota: number; // 1-5
  comentario?: string;
  criado_em: string;
}

export type TipoAgendamentoExame = 
  | 'Exame Normal' 
  | 'Exame Recurso' 
  | 'Exame Extraordinário' 
  | 'Avaliação Contínua' 
  | 'Teste Escrito' 
  | 'Trabalho Prático'
  | 'Reavaliação';

export interface AgendamentoExame {
  id: string;
  tenant_id: string;
  turma_id: string;
  turma_nome?: string;
  disciplina_id?: string;
  disciplina_nome: string;
  docente_id?: string;
  docente_nome?: string;
  tipo: TipoAgendamentoExame;
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  sala: string;
  peso_nota?: number;
  observacoes?: string;
  escola_id?: string;
  created_at?: string;
}

export type ErrorSeverity = 'critico' | 'erro' | 'aviso' | 'info';
export type ErrorStatus = 'aberto' | 'investigando' | 'resolvido' | 'ignorado';
export type ErrorOrigem = 'super_admin' | 'tenant' | 'api' | 'auth' | 'email' | 'financeiro' | 'sistema' | 'rede';

export interface LogErro {
  id: string;
  origem: ErrorOrigem;
  mensagem: string;
  severidade: ErrorSeverity;
  status: ErrorStatus;
  modulo: string;
  acao: string;
  tenant_id?: string;
  tenant_nome?: string;
  usuario_id?: string;
  usuario_email?: string;
  usuario_nome?: string;
  usuario_tipo?: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  detalhes?: Record<string, any>;
  resolvido_por?: string;
  resolvido_em?: string | null;
  notas_resolucao?: string | null;
  created_at: string;
}

// Custom Forms / Formulários Customizados
export type CustomFieldTipo = 
  | 'texto_curto'
  | 'alfabetico'
  | 'alfanumerico'
  | 'dropdown'
  | 'data'
  | 'checkbox'
  | 'texto_longo'
  | 'numero'
  | 'telefone_ddd'
  | 'titulo'
  | 'upload_arquivo'
  | 'upload_foto';

export interface CustomFormField {
  id: string;
  tipo: CustomFieldTipo;
  label: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[]; // for dropdown
  ddd_padrao?: string; // for telefone_ddd (default '+258')
  formatos_permitidos?: ('pdf' | 'xlsx')[]; // for upload_arquivo
  tamanho_maximo_mb?: number;
  texto_ajuda?: string;
  ordem: number;
  largura?: '1/2' | 'full';
  valor_padrao?: any;
}

export type CustomFormStatus = 'ativo' | 'suspenso' | 'rascunho';

export interface CustomForm {
  id: string;
  tenant_id: string;
  codigo: 'cadastro_escola' | 'cadastro_docente' | 'cadastro_estudante' | 'lancamento_notas' | string;
  nome: string;
  descricao?: string;
  entidade: 'escola' | 'docente' | 'estudante' | 'notas' | 'outro';
  status: CustomFormStatus;
  campos: CustomFormField[];
  campos_padrao_inicializados?: boolean;
  campos_padrao_v2_inicializados?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MÓDULO FAQ & BASE DE CONHECIMENTO (FASE 1)
// ============================================================================

export type FaqEstado = 'rascunho' | 'publicado' | 'despublicado' | 'arquivado';
export type FaqTipo = 'faq' | 'artigo_tutorial';
export type FaqVisibilidade = 'todos' | 'tenant_admin' | 'docentes' | 'estudantes' | 'encarregados' | 'super_admin';

export interface FaqAttachment {
  id: string;
  nome: string;
  tipo: 'image' | 'pdf';
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  tamanho_bytes: number;
  url: string;
  criado_em?: string;
}

export interface FaqChangeHistoryDiff {
  campo: string;
  antes?: string | boolean | number | string[] | null;
  depois?: string | boolean | number | string[] | null;
}

export interface FaqChangeHistoryEntry {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_email: string;
  data: string;
  acao: 'criacao' | 'edicao' | 'estado' | 'anexo';
  resumo: string;
  alteracoes?: FaqChangeHistoryDiff[];
}

export interface FaqCategory {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  descricao?: string;
  ordem: number;
  ativo: boolean;
  visibilidade_padrao: FaqVisibilidade;
  artigos_count?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface FaqArticle {
  id: string;
  tenant_id: string;
  tipo: FaqTipo;
  titulo: string;
  pergunta?: string;
  resposta_html: string;
  resposta_texto: string;
  categoria_id: string;
  categoria_nome?: string;
  palavras_chave: string[];
  anexos: FaqAttachment[];
  estado: FaqEstado;
  prioridade: number;
  visibilidade: FaqVisibilidade;
  utilizavel_ia: boolean;
  visualizacoes: number;
  autor_id: string;
  autor_nome: string;
  autor_email: string;
  publicado_em?: string | null;
  historico_alteracoes: FaqChangeHistoryEntry[];
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface FaqOverviewStats {
  totalPerguntas: number;
  totalFaqs: number;
  totalArtigosTutoriais: number;
  totalCategorias: number;
  categoriasAtivas: number;
  publicadas: number;
  rascunhos: number;
  despublicadas: number;
  arquivadas: number;
  utilizavelIa: number;
  totalVisualizacoes: number;
  topArtigos: Array<{
    id: string;
    titulo: string;
    categoria_nome: string;
    visualizacoes: number;
    tipo: FaqTipo;
    utilizavel_ia: boolean;
  }>;
  porCategoria: Array<{
    categoria_id: string;
    nome: string;
    total: number;
    publicadas: number;
    visualizacoes: number;
  }>;
}

// ============================================================================
// MÓDULO ASSISTENTE — FASE 2: EQUIPA, DEPARTAMENTOS E PERMISSÕES
// ============================================================================

export type SupportAgentRole = 'administrador' | 'supervisor' | 'assistente';
export type SupportAgentStatus = 'activo' | 'inactivo' | 'suspenso' | 'arquivado';
export type SupportAvailability = 'online' | 'offline' | 'ocupado';
export type SupportWeekday = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
export type SupportHistoryScope = 'proprio' | 'todos';

export interface SupportScheduleDay {
  dia: SupportWeekday;
  ativo: boolean;
  inicio: string; // HH:MM
  fim: string;    // HH:MM
}

export interface SupportWorkingHours {
  ativo: boolean;
  timezone: string;
  dias: SupportScheduleDay[];
}

export interface SupportAssignmentRules {
  auto_atribuir: boolean;
  apenas_horario: boolean;
  prioridade_atribuicao: number; // 1-100
  categorias_especialidade: string[];
}

export interface SupportDepartment {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  descricao?: string;
  email_fila?: string;
  sla_resposta_minutos: number;
  sla_resolucao_horas: number;
  ordem: number;
  ativo: boolean;
  padrao: boolean;
  membros_count?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface SupportPermissionSet {
  visualizar: boolean;
  responder: boolean;
  transferir: boolean;
  encerrar: boolean;
  consultar_historico: boolean;
  historico_escopo: SupportHistoryScope;
  consultar_analytics: boolean;
  gerir_funcionarios: boolean;
  configurar_ia: boolean;
  gerir_faq: boolean;
}

export type SupportPermissionBooleanKey = Exclude<keyof SupportPermissionSet, 'historico_escopo'>;

export interface SupportPermissionsRecord {
  id: string;
  agent_id: string;
  tenant_id: string;
  funcao: SupportAgentRole;
  permissoes: SupportPermissionSet;
  updated_at: string;
  updated_by: string;
}

export interface SupportAgent {
  id: string;
  uid?: string;
  tenant_id: string;
  tipo: 'humano' | 'ia';
  nome: string;
  email: string;
  departamento_id: string;
  departamento_nome?: string;
  departamentos_autorizados: string[];
  funcao: SupportAgentRole;
  estado: SupportAgentStatus;
  disponibilidade: SupportAvailability;
  limite_simultaneo: number;
  carga_actual: number;
  horario_atendimento: SupportWorkingHours;
  regras_atribuicao: SupportAssignmentRules;
  permissoes?: SupportPermissionSet;
  must_reset_password?: boolean;
  credenciais_redefinidas_em?: string | null;
  ultimo_acesso?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface SupportAgentHistoryEntry {
  id: string;
  origem: 'ticket' | 'atribuicao' | 'auditoria';
  titulo: string;
  detalhe: string;
  estado?: string;
  tenant_id: string;
  data: string;
  actor_email?: string;
}

export interface SupportTeamOverviewStats {
  totalFuncionarios: number;
  totalAgentesIa?: number;
  activos: number;
  inactivos: number;
  suspensos: number;
  arquivados: number;
  online: number;
  ocupado: number;
  offline: number;
  totalDepartamentos: number;
  departamentosActivos: number;
  capacidadeTotalSimultanea: number;
  cargaActualTotal: number;
  porFuncao: {
    administrador: number;
    supervisor: number;
    assistente: number;
  };
  porDepartamento: Array<{
    departamento_id: string;
    nome: string;
    total_membros: number;
    online: number;
    capacidade: number;
  }>;
}

// ============================================================================
// MÓDULO HELP DESK / TICKETS & CONVERSAS (FASE 3)
// ============================================================================

export type SupportTicketPriority = 'baixa' | 'normal' | 'alta' | 'urgente';
export type SupportTicketStatus = 'aberto' | 'em_atendimento' | 'pendente' | 'resolvido' | 'reaberto';
export type SupportMessageType = 'mensagem' | 'nota_interna' | 'sistema';
export type SupportSenderType = 'utilizador' | 'funcionario' | 'ia' | 'sistema';
export type SupportSlaStatus = 'ok' | 'em_risco' | 'violado';

export interface SupportAttachment {
  id: string;
  nome: string;
  tipo: 'image' | 'pdf';
  mime_type: string;
  tamanho_bytes: number;
  url: string;
}

export interface SupportTicket {
  id: string;
  codigo: string;
  tenant_id: string;
  tenant_nome?: string;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_role: string;
  assunto: string;
  categoria: string;
  departamento_id: string;
  departamento_nome?: string;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  responsavel_tipo?: 'humano' | 'ia' | null;
  prioridade: SupportTicketPriority;
  estado: SupportTicketStatus;
  canal: 'portal' | 'superadmin' | 'ia';
  total_mensagens: number;
  ultima_mensagem_por?: SupportSenderType;
  ultima_mensagem_preview?: string;
  data_abertura: string;
  ultima_interacao: string;
  primeira_resposta_em?: string | null;
  resolvido_em?: string | null;
  reaberto_em?: string | null;
  sla_resposta_em: string;
  sla_resolucao_em: string;
  sla_status: SupportSlaStatus;
  sem_resposta_alerta: boolean;
  sem_resposta_ha_minutos: number;
  avaliacao_nota?: number | null;
  avaliacao_comentario?: string | null;
  avaliado_em?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  tenant_id: string;
  remetente_id: string;
  remetente_nome: string;
  remetente_email?: string;
  remetente_tipo: SupportSenderType;
  tipo: SupportMessageType;
  conteudo: string;
  anexos: SupportAttachment[];
  created_at: string;
}

export interface SupportAssignmentRecord {
  id: string;
  ticket_id: string;
  tenant_id: string;
  de_responsavel_id?: string | null;
  de_responsavel_nome?: string | null;
  para_responsavel_id?: string | null;
  para_responsavel_nome?: string | null;
  de_departamento_id?: string | null;
  de_departamento_nome?: string | null;
  para_departamento_id?: string | null;
  para_departamento_nome?: string | null;
  motivo?: string;
  actor_id: string;
  actor_email: string;
  created_at: string;
}

export interface SupportRating {
  id: string;
  ticket_id: string;
  tenant_id: string;
  solicitante_id: string;
  responsavel_id?: string | null;
  nota: number;
  comentario?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportEvent {
  id: string;
  ticket_id: string;
  tenant_id: string;
  tipo:
    | 'ticket_criado'
    | 'mensagem_enviada'
    | 'nota_interna'
    | 'transferido'
    | 'estado_alterado'
    | 'avaliado'
    | 'ia_resposta'
    | 'escalado_humano'
    | 'distribuido_automaticamente'
    | 'reencaminhado_sla';
  descricao: string;
  actor_id: string;
  actor_nome: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface SupportTicketInboxSummary {
  total: number;
  abertos: number;
  emAtendimento: number;
  pendentes: number;
  resolvidos: number;
  reabertos: number;
  alertasSla: number;
  semResposta: number;
}

// ============================================================================
// MÓDULO ASSISTENTE — FASE 4: AGENTES DE IA & MOTOR AUTOMATIZADO
// ============================================================================

export type SupportAiExecutionMode = 'gemini_direct' | 'n8n_webhook' | 'hibrido';
export type SupportAiModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export interface SupportAiAgentConfig {
  id: string;
  agent_id: string;
  tenant_id: string;
  modelo: SupportAiModel;
  modo_execucao: SupportAiExecutionMode;
  prompt_sistema: string;
  personalidade: string;
  idioma_padrao: string;
  limiar_confianca: number; // 0.10 - 0.99
  usar_apenas_faq_autorizada: boolean;
  max_turnos_ia: number; // 1 - 20
  auto_responder_tickets: boolean;
  palavras_chave_escalonamento: string[];
  n8n_webhook_url?: string;
  fallback_departamento_id?: string;
  fallback_departamento_nome?: string;
  total_interacoes: number;
  total_escalonamentos: number;
  ultima_execucao_em?: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface SupportAiAgentWithConfig {
  agent: SupportAgent;
  config: SupportAiAgentConfig;
}

export interface SupportAiProviderStatus {
  geminiConfigured: boolean;
  n8nSecretConfigured: boolean;
  defaultModel: SupportAiModel;
}

export interface SupportAiFaqReference {
  id: string;
  titulo: string;
  categoria_nome?: string;
  score: number;
}

export interface SupportAiSandboxResult {
  agent_id: string;
  agent_nome: string;
  modo_usado: SupportAiExecutionMode;
  modelo: string;
  resposta: string;
  confianca: number;
  escalonar_humano: boolean;
  motivo_escalonamento?: string;
  artigos_faq_usados: SupportAiFaqReference[];
  latencia_ms: number;
}

export interface SupportAiTicketExecutionResult {
  ticket: SupportTicket;
  message: SupportMessage;
  escalonado: boolean;
  motivo_escalonamento?: string;
  confianca?: number;
  artigos_faq_usados: SupportAiFaqReference[];
  modo_usado: SupportAiExecutionMode;
}

// ============================================================================
// MÓDULO ASSISTENTE — FASE 5: DISTRIBUIÇÃO AUTOMÁTICA E REENCAMINHAMENTO
// ============================================================================

export type SupportDistributionStrategy =
  | 'ia_primeiro'
  | 'round_robin'
  | 'menor_carga'
  | 'especialidade'
  | 'fila_departamento';

export interface SupportDistributionConditions {
  categorias: string[];
  prioridades: SupportTicketPriority[];
  canais: Array<'portal' | 'superadmin' | 'ia'>;
  departamentos_origem: string[];
  palavras_chave: string[];
}

export interface SupportDistributionRule {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  ordem: number;
  condicoes: SupportDistributionConditions;
  metodo: SupportDistributionStrategy;
  destino_departamento_id: string;
  destino_departamento_nome?: string;
  destino_agent_id?: string | null;
  destino_agent_nome?: string | null;
  auto_executar_ia: boolean;
  escalonar_para_humano_se_ia_falhar: boolean;
  respeitar_horario_atendimento: boolean;
  exigir_disponibilidade_online: boolean;
  permitir_ocupado_se_sem_online: boolean;
  ultimo_agent_id?: string | null;
  total_atribuicoes: number;
  ultima_execucao_em?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface SupportDistributionCandidateCheck {
  agent_id: string;
  nome: string;
  tipo: 'humano' | 'ia';
  elegivel: boolean;
  motivo_exclusao?: string;
  carga_actual: number;
  limite_simultaneo: number;
  disponibilidade: SupportAvailability;
}

export interface SupportDistributionExecutionResult {
  ticket: SupportTicket;
  atribuido: boolean;
  motivo: string;
  regra_id?: string | null;
  regra_nome?: string | null;
  metodo_usado?: SupportDistributionStrategy | null;
  departamento_id: string;
  departamento_nome: string;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  responsavel_tipo?: 'humano' | 'ia' | null;
  ia_executada?: boolean;
}

export interface SupportDistributionSimulationResult {
  matched_rule: {
    id: string;
    nome: string;
    ordem: number;
    metodo: SupportDistributionStrategy;
  } | null;
  destino_departamento_id: string;
  destino_departamento_nome: string;
  responsavel_selecionado: {
    id: string;
    nome: string;
    tipo: 'humano' | 'ia';
  } | null;
  motivo: string;
  candidatos_avaliados: SupportDistributionCandidateCheck[];
}

export interface SupportDistributionRebalanceResult {
  processados: number;
  atribuidos: number;
  escalonados_sla: number;
  sem_elegivel: number;
  dry_run: boolean;
  detalhes: Array<{
    ticket_id: string;
    codigo: string;
    acao: 'atribuido' | 'reencaminhado_sla' | 'fila_atualizada' | 'sem_elegivel';
    responsavel_nome?: string | null;
    departamento_nome: string;
    motivo: string;
  }>;
}

export interface SupportDistributionOverview {
  totalRegras: number;
  regrasActivas: number;
  ticketsSemResponsavel: number;
  ticketsAlertasSla: number;
  equipaOnlineDisponivel: number;
  capacidadeLivreHumanos: number;
  agentesIaActivos: number;
}

// ============================================================================
// MÓDULO ASSISTENTE — FASE 6: ANALYTICS E MÉTRICAS DO SUPORTE
// ============================================================================

export interface SupportAnalyticsSummary {
  totalSolicitacoes: number;
  solicitacoesAbertasAgora: number;
  solicitacoesResolvidas: number;
  taxaResolucaoPct: number;
  tempoMedioPrimeiraRespostaMin: number;
  tempoMedioResolucaoHoras: number;
  taxaCumprimentoSlaPct: number;
  alertasSlaEmAberto: number;
  avaliacaoMedia: number;
  totalAvaliacoes: number;
  totalInteracoesIa: number;
  totalEscalonamentosIa: number;
  taxaResolucaoIaPct: number;
}

export interface SupportAnalyticsDailyPoint {
  data: string;
  label: string;
  abertos: number;
  resolvidos: number;
  iaRespostas: number;
  escalonamentos: number;
}

export interface SupportAnalyticsCategoryStat {
  categoria: string;
  total: number;
  abertos: number;
  resolvidos: number;
  taxaResolucaoPct: number;
}

export interface SupportAnalyticsDepartmentStat {
  departamento_id: string;
  nome: string;
  total: number;
  abertos: number;
  resolvidos: number;
  tempoMedioRespostaMin: number;
  slaCumpridoPct: number;
}

export interface SupportAnalyticsAgentStat {
  agent_id: string;
  nome: string;
  tipo: 'humano' | 'ia';
  departamento_nome: string;
  totalAtribuidos: number;
  resolvidos: number;
  cargaActual: number;
  limiteSimultaneo: number;
  avaliacaoMedia: number;
  totalAvaliacoes: number;
  tempoMedioRespostaMin: number;
}

export interface SupportAnalyticsRatingDist {
  nota: number;
  count: number;
  pct: number;
}

export interface SupportAnalyticsFeedbackItem {
  id: string;
  ticket_id: string;
  codigo: string;
  assunto: string;
  tenant_id: string;
  nota: number;
  comentario: string;
  responsavel_nome?: string | null;
  created_at: string;
}

export interface SupportAnalyticsFaqInsight {
  totalPublicados: number;
  totalUtilizavelIa: number;
  totalVisualizacoes: number;
  topArtigos: Array<{
    id: string;
    titulo: string;
    categoria_nome: string;
    visualizacoes: number;
    utilizavel_ia: boolean;
  }>;
}

export interface SupportAnalyticsReport {
  periodo: {
    days: number;
    start_date: string;
    end_date: string;
    tenant_id: string;
    departamento_id: string;
    canal: 'todos' | 'portal' | 'superadmin' | 'ia';
  };
  resumo: SupportAnalyticsSummary;
  serieDiaria: SupportAnalyticsDailyPoint[];
  porCategoria: SupportAnalyticsCategoryStat[];
  porDepartamento: SupportAnalyticsDepartmentStat[];
  porAgente: SupportAnalyticsAgentStat[];
  distribuicaoAvaliacoes: SupportAnalyticsRatingDist[];
  recentesComentarios: SupportAnalyticsFeedbackItem[];
  faqInsights: SupportAnalyticsFaqInsight;
}


