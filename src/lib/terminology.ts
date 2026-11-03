/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Camada Central de Terminologia e Configuração Analítica por Tipo de Instituição
 */

import { TipoInstituicao } from '../types';

export interface InstitutionTerminologyMap {
  nivelEnsino: string;
  instituicao: string;
  instituicaoPlural: string;
  unidadeCurricular: string;
  unidadeCurricularPlural: string;
  agrupamento: string;
  agrupamentoPlural: string;
  programa: string;
  programaPlural: string;
  periodoLectivo: string;
  periodoLectivoPlural: string;
  estudante: string;
  estudantePlural: string;
  docente: string;
  docentePlural: string;
  departamentoFaculdade: string;
}

export const TERMINOLOGY_BY_INSTITUTION_TYPE: Record<TipoInstituicao, InstitutionTerminologyMap> = {
  escola: {
    nivelEnsino: 'Classe',
    instituicao: 'Escola',
    instituicaoPlural: 'Escolas',
    unidadeCurricular: 'Disciplina',
    unidadeCurricularPlural: 'Disciplinas',
    agrupamento: 'Turma',
    agrupamentoPlural: 'Turmas',
    programa: 'Classe',
    programaPlural: 'Classes',
    periodoLectivo: 'Trimestre',
    periodoLectivoPlural: 'Trimestres',
    estudante: 'Aluno',
    estudantePlural: 'Alunos',
    docente: 'Professor',
    docentePlural: 'Professores',
    departamentoFaculdade: 'Divisão / Ciclo'
  },
  instituto: {
    nivelEnsino: 'Curso / Nível',
    instituicao: 'Instituto',
    instituicaoPlural: 'Institutos',
    unidadeCurricular: 'Módulo',
    unidadeCurricularPlural: 'Módulos',
    agrupamento: 'Turma',
    agrupamentoPlural: 'Turmas',
    programa: 'Curso',
    programaPlural: 'Cursos',
    periodoLectivo: 'Módulo / Mês',
    periodoLectivoPlural: 'Módulos',
    estudante: 'Formando',
    estudantePlural: 'Formandos',
    docente: 'Formador',
    docentePlural: 'Formadores',
    departamentoFaculdade: 'Área Técnica / Polo'
  },
  universidade: {
    nivelEnsino: 'Ano / Semestre',
    instituicao: 'Universidade / Faculdade',
    instituicaoPlural: 'Faculdades / Universidades',
    unidadeCurricular: 'Cadeira',
    unidadeCurricularPlural: 'Cadeiras',
    agrupamento: 'Turma',
    agrupamentoPlural: 'Turmas',
    programa: 'Curso',
    programaPlural: 'Cursos',
    periodoLectivo: 'Semestre',
    periodoLectivoPlural: 'Semestres',
    estudante: 'Estudante',
    estudantePlural: 'Estudantes',
    docente: 'Docente',
    docentePlural: 'Docentes',
    departamentoFaculdade: 'Faculdade / Departamento'
  },
  global: {
    nivelEnsino: 'Nível de Ensino',
    instituicao: 'Instituição',
    instituicaoPlural: 'Instituições',
    unidadeCurricular: 'Cadeira / Disciplina',
    unidadeCurricularPlural: 'Cadeiras / Disciplinas',
    agrupamento: 'Turma',
    agrupamentoPlural: 'Turmas',
    programa: 'Curso / Classe',
    programaPlural: 'Cursos / Classes',
    periodoLectivo: 'Período Lectivo',
    periodoLectivoPlural: 'Períodos Lectivos',
    estudante: 'Estudante',
    estudantePlural: 'Estudantes',
    docente: 'Docente / Professor',
    docentePlural: 'Docentes',
    departamentoFaculdade: 'Unidade Orgânica'
  }
};

/**
 * Retorna os termos corretos para o tipo de instituição
 */
export function getTerminology(tipo?: TipoInstituicao | string | null): InstitutionTerminologyMap {
  const norm = (tipo || 'escola').toLowerCase() as TipoInstituicao;
  return TERMINOLOGY_BY_INSTITUTION_TYPE[norm] || TERMINOLOGY_BY_INSTITUTION_TYPE.escola;
}

/**
 * Helper para obter um termo específico de forma segura
 */
export function getTerm(
  concept: keyof InstitutionTerminologyMap, 
  tipo?: TipoInstituicao | string | null
): string {
  return getTerminology(tipo)[concept];
}

/**
 * Tipos de Cards Analíticos
 */
export type AnalyticsCardType = 
  | 'estudantes_ativos'
  | 'rendimento_medio'
  | 'taxa_aprovacao'
  | 'eficiencia_ensino'
  | 'escola_capacidade_salas'
  | 'universidade_capacidade_total'
  | 'universidade_capacidade_por_curso'
  | 'instituto_capacidade_total'
  | 'instituto_capacidade_por_modulo';

/**
 * Mapa central que define quais cards devem aparecer conforme o tipo de instituição
 */
export const ANALYTICS_CARDS_BY_INSTITUTION_TYPE: Record<TipoInstituicao, AnalyticsCardType[]> = {
  escola: [
    'escola_capacidade_salas',
    'estudantes_ativos',
    'rendimento_medio',
    'taxa_aprovacao',
    'eficiencia_ensino'
  ],
  instituto: [
    'instituto_capacidade_total',
    'instituto_capacidade_por_modulo',
    'estudantes_ativos',
    'rendimento_medio',
    'taxa_aprovacao'
  ],
  universidade: [
    'universidade_capacidade_total',
    'universidade_capacidade_por_curso',
    'estudantes_ativos',
    'rendimento_medio',
    'taxa_aprovacao'
  ],
  global: [
    'universidade_capacidade_total',
    'escola_capacidade_salas',
    'estudantes_ativos',
    'rendimento_medio',
    'taxa_aprovacao'
  ]
};

/**
 * Retorna a lista de cards configurados para a instituição ativa
 */
export function getAnalyticsCardsForInstitution(tipo?: TipoInstituicao | string | null): AnalyticsCardType[] {
  const norm = (tipo || 'escola').toLowerCase() as TipoInstituicao;
  return ANALYTICS_CARDS_BY_INSTITUTION_TYPE[norm] || ANALYTICS_CARDS_BY_INSTITUTION_TYPE.escola;
}

/**
 * Função unificada e estrita para validação de associação entre Classe e Escola
 * Usada no cadastro de estudante, na importação de turmas/estudantes e no backend
 */
export interface ClassSchoolAssociationParams {
  classeEscolarId?: string | null;
  escolaId?: string | null;
  classesEscolares: Array<{ id: string; escola_id?: string; nome?: string }>;
  disciplinas?: Array<{ 
    id?: string; 
    escola_id?: string; 
    escolas_ids?: string[]; 
    classe_escolar_id?: string; 
    classes_associadas_ids?: string[]; 
  }>;
  isUniversidade?: boolean;
}

export function validateClassSchoolAssociation(params: ClassSchoolAssociationParams): {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  const { classeEscolarId, escolaId, classesEscolares, disciplinas = [], isUniversidade } = params;

  // Em ambiente universitário, os alunos associam-se a cursos e faculdades, não a classes primárias/secundárias
  if (isUniversidade) {
    return { isValid: true };
  }

  // Se não foi informada classe ou escola, a validação de associação não se aplica diretamente
  if (!classeEscolarId || !escolaId) {
    return { isValid: true };
  }

  const cleanClasseId = String(classeEscolarId).trim();
  const cleanEscolaId = String(escolaId).trim();

  // 1. Procurar a classe escolar na listagem
  const targetClasse = classesEscolares.find(c => String(c.id).trim() === cleanClasseId);
  if (!targetClasse) {
    return {
      isValid: false,
      errorCode: 'CLASSE_NOT_FOUND',
      errorMessage: `A classe identificada por "${cleanClasseId}" não foi encontrada no cadastro do sistema.`
    };
  }

  // 2. Se a classe foi criada em nível de tenant (sem escola_id específica), é válida para todas as escolas
  if (!targetClasse.escola_id || String(targetClasse.escola_id).trim() === '' || String(targetClasse.escola_id).trim() === 'todas') {
    return { isValid: true };
  }

  // 3. Se a classe possui escola_id atribuída diretamente
  if (String(targetClasse.escola_id).trim() === cleanEscolaId) {
    return { isValid: true };
  }

  // 4. Verificar se alguma disciplina vincula esta classe a esta escola (associação N:N)
  const isLinkedViaDiscipline = disciplinas.some(d => {
    const dSchools = (d.escolas_ids && d.escolas_ids.length > 0) 
      ? d.escolas_ids.map(s => String(s).trim())
      : (d.escola_id ? [String(d.escola_id).trim()] : []);
    
    const dClasses = (d.classes_associadas_ids && d.classes_associadas_ids.length > 0)
      ? d.classes_associadas_ids.map(c => String(c).trim())
      : (d.classe_escolar_id ? [String(d.classe_escolar_id).trim()] : []);

    const schoolMatches = dSchools.length === 0 || dSchools.includes(cleanEscolaId);
    const classMatches = dClasses.includes(cleanClasseId);

    return schoolMatches && classMatches;
  });

  if (isLinkedViaDiscipline) {
    return { isValid: true };
  }

  return {
    isValid: false,
    errorCode: 'CLASS_SCHOOL_MISMATCH',
    errorMessage: `A classe "${targetClasse.nome || cleanClasseId}" não está associada à escola selecionada (ID: ${cleanEscolaId}).`
  };
}
