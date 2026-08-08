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
  endereco: string;
  telefone: string;
  email: string;
  diretor_id: string;
  ativo: boolean;
  latitude?: string | number;
  longitude?: string | number;
  deleted_at?: string | null;
  logo_url?: string;
  controlar_assiduidade?: boolean;
  tolerancia_manha?: string;
  tolerancia_tarde?: string;
  tolerancia_noite?: string;
  nuit?: string;
  diretor_nome?: string;
  contacto?: string;
}

export interface Docente {
  id: string;
  tenant_id: string;
  user_id: string;
  nome?: string;
  escola_id: string;
  especialidade: string;
  numero_registro: string;
  data_contratacao: string;
  turmas_atribuidas?: string[];
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
  foto_url?: string;
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
  horario?: string;
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
  trimestre: '1º Trimestre' | '2º Trimestre' | '3º Trimestre';
  nota_prova?: number;
  nota_trabalho?: number;
  nota_participacao?: number;
  num_avaliacoes?: number;
  avaliacao_1?: number;
  avaliacao_2?: number;
  avaliacao_3?: number;
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
}

export type ProcessoTipo = 'Matrícula' | 'Transferência' | 'Suspensão' | 'Conclusão' | 'Desistência';
export type ProcessoStatus = 'Solicitação' | 'Análise' | 'Aprovado' | 'Rejeitado' | 'Concluído';

export interface ProcessoAluno {
  id: string;
  tenant_id: string;
  estudante_id: string;
  tipo: ProcessoTipo;
  data: string;
  documentos: string[]; // list of file names
  status: ProcessoStatus;
  criador_nome: string;
  observacao?: string;
  detalhes?: string;
  criado_em?: string;
  criado_por?: string;
}

export type SeveridadeActividade = 'Baixo' | 'Médio' | 'Crítico';
export type StatusActividade = 'Pendente' | 'Em Progresso' | 'Finalizada' | 'Suspensa';
export type CategoriaAtribuicaoActividade = 'Todos' | 'Administradores' | 'Directores' | 'Professores' | 'Estudantes' | 'Encarregados';

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
  faturacao_multa_atraso?: number;
  faturacao_taxa_reavaliacao?: number;
  faturacao_taxas_adicionais?: number;
  faturacao_multa_margem?: number;
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
}

export interface Notificacao {
  id: string;
  destinatario_id: string; // 'super_admin', tenantId, or 'todos'
  titulo: string;
  mensagem: string;
  lido: boolean;
  tipo: 'info' | 'alerta' | 'limite' | 'sistema' | 'sucesso';
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



