/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Configuração Central e Estrutural dos Tipos de Instituição
 */

import { TipoInstituicao } from '../types';

export const INSTITUTION_TYPES = ['escola', 'instituto', 'universidade', 'global'] as const;

export interface InstitutionTerminology {
  student: string;
  studentPlural: string;
  discipline: string;
  disciplinePlural: string;
  classCourse: string;
  classCoursePlural: string;
  period: string;
  periodDefaultLabel: string;
}

export interface InstitutionTypeDefinition {
  id: TipoInstituicao;
  label: string;
  shortLabel: string;
  badgeColor: string;
  description: string;
  allowedStudentLevels: ('primario' | 'secundario' | 'superior' | 'profissional')[];
  allowedRegimes: string[];
  visibleTabs: ('classes' | 'cursos')[];
  terminology: InstitutionTerminology;
  defaultPeriodType: 'trimestre' | 'semestre' | 'modulo' | 'ano';
}

export const INSTITUTION_TYPE_CONFIG: Record<TipoInstituicao, InstitutionTypeDefinition> = {
  escola: {
    id: 'escola',
    label: 'Escola (Primária e Secundária)',
    shortLabel: 'Escola',
    badgeColor: 'sky',
    description: 'Ensino Geral (1ª à 12ª Classe) com organização por Trimestres e Disciplinas curriculares oficiais.',
    allowedStudentLevels: ['primario', 'secundario'],
    allowedRegimes: ['Diurno', 'Noturno', 'Ambos'],
    visibleTabs: ['classes'],
    defaultPeriodType: 'trimestre',
    terminology: {
      student: 'Aluno',
      studentPlural: 'Alunos',
      discipline: 'Disciplina',
      disciplinePlural: 'Disciplinas',
      classCourse: 'Classe',
      classCoursePlural: 'Classes',
      period: 'Trimestre',
      periodDefaultLabel: '1º Trimestre'
    }
  },
  instituto: {
    id: 'instituto',
    label: 'Instituto (Formação Técnica/Profissional)',
    shortLabel: 'Instituto',
    badgeColor: 'emerald',
    description: 'Qualificação Profissional baseada em competências (QNC/NQF) com Módulos práticos, oficinas e estágios.',
    allowedStudentLevels: ['profissional'],
    allowedRegimes: ['Modular', 'Aprendizagem Baseada em Competências', 'Manhã', 'Tarde', 'Pós-Laboral'],
    visibleTabs: ['cursos'],
    defaultPeriodType: 'modulo',
    terminology: {
      student: 'Formando',
      studentPlural: 'Formandos',
      discipline: 'Módulo de Competência',
      disciplinePlural: 'Módulos',
      classCourse: 'Qualificação Técnica',
      classCoursePlural: 'Qualificações Técnicas',
      period: 'Mês / Módulo',
      periodDefaultLabel: 'Módulo 1'
    }
  },
  universidade: {
    id: 'universidade',
    label: 'Universidade (Ensino Superior)',
    shortLabel: 'Universidade',
    badgeColor: 'purple',
    description: 'Graus de Licenciatura, Mestrado e Doutoramento com Cadeiras semestrais, Créditos Académicos (ECTS) e TCC.',
    allowedStudentLevels: ['superior'],
    allowedRegimes: ['Semestral', 'Anual', 'Créditos ECTS', 'Presencial', 'Semipresencial', 'EAD'],
    visibleTabs: ['cursos'],
    defaultPeriodType: 'semestre',
    terminology: {
      student: 'Estudante',
      studentPlural: 'Estudantes',
      discipline: 'Cadeira / Disciplina Superior',
      disciplinePlural: 'Cadeiras',
      classCourse: 'Curso de Graduação',
      classCoursePlural: 'Cursos de Graduação',
      period: 'Semestre',
      periodDefaultLabel: '1º Semestre'
    }
  },
  global: {
    id: 'global',
    label: 'Global (Multi-oferta Integrada)',
    shortLabel: 'Global',
    badgeColor: 'amber',
    description: 'Complexo educacional completo: escolas, institutos técnicos e faculdades universitárias sob a mesma administração.',
    allowedStudentLevels: ['primario', 'secundario', 'superior', 'profissional'],
    allowedRegimes: ['Semestral', 'Trimestral', 'Modular', 'Anual', 'Créditos ECTS', 'Diurno', 'Noturno', 'Presencial', 'EAD'],
    visibleTabs: ['classes', 'cursos'],
    defaultPeriodType: 'semestre',
    terminology: {
      student: 'Estudante / Aluno / Formando',
      studentPlural: 'Estudantes / Alunos',
      discipline: 'Cadeira / Disciplina / Módulo',
      disciplinePlural: 'Disciplinas / Cadeiras',
      classCourse: 'Curso / Classe',
      classCoursePlural: 'Cursos / Classes',
      period: 'Período Lectivo',
      periodDefaultLabel: '1º Período'
    }
  }
};

/**
 * Retorna a configuração do tipo de instituição com fallback seguro para 'escola'
 */
export function getInstitutionConfig(tipo?: string | null): InstitutionTypeDefinition {
  const normalized = (tipo || 'escola').toLowerCase() as TipoInstituicao;
  return INSTITUTION_TYPE_CONFIG[normalized] || INSTITUTION_TYPE_CONFIG.escola;
}

/**
 * Valida se uma instituição é compatível com um nível de ensino de estudante
 * Regra 4.1 e 8.1:
 * - superior -> universidade ou global
 * - profissional -> instituto ou global
 * - primario / secundario -> escola ou global
 * - global -> compatível com todos os níveis
 */
export function isInstitutionCompatibleWithLevel(
  institutionType: TipoInstituicao | undefined,
  nivelEnsino: string
): boolean {
  const normalizedType = (institutionType || 'escola').toLowerCase() as TipoInstituicao;
  if (normalizedType === 'global') return true;

  const cfg = INSTITUTION_TYPE_CONFIG[normalizedType] || INSTITUTION_TYPE_CONFIG.escola;
  return cfg.allowedStudentLevels.includes(nivelEnsino as any);
}

/**
 * Hook para obter facilmente recursos e terminologias da instituição ativa
 */
export function useInstitutionFeatures(tipoInstituicao?: string | null) {
  const config = getInstitutionConfig(tipoInstituicao);
  
  return {
    config,
    tipo: config.id,
    isEscola: config.id === 'escola',
    isInstituto: config.id === 'instituto',
    isUniversidade: config.id === 'universidade',
    isGlobal: config.id === 'global',
    allowedLevels: config.allowedStudentLevels,
    visibleTabs: config.visibleTabs,
    terms: config.terminology,
    allowsClasses: config.visibleTabs.includes('classes'),
    allowsCursos: config.visibleTabs.includes('cursos')
  };
}
