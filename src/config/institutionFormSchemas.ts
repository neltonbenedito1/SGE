/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Schemas Declarativos de Formulários por Tipo de Instituição
 */

import { TipoInstituicao } from '../types';

export interface FormFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'readonly';
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  options?: { value: string; label: string }[];
  helperText?: string;
  gridSpan?: 'full' | 'half' | 'third';
}

export interface InstitutionFormSchema {
  tipo: TipoInstituicao;
  title: string;
  subtitle: string;
  fields: FormFieldDefinition[];
}

export const INSTITUTION_FORM_SCHEMAS: Record<TipoInstituicao, InstitutionFormSchema> = {
  escola: {
    tipo: 'escola',
    title: 'Cadastro de Escola (Ensino Geral)',
    subtitle: 'Unidade escolar de Ensino Primário e/ou Secundário Geral.',
    fields: [
      {
        name: 'nome',
        label: 'Nome da Escola',
        type: 'text',
        placeholder: 'Ex: Escola Secundária Josina Machel',
        required: true,
        gridSpan: 'full'
      },
      {
        name: 'codigo_oficial',
        label: 'Código Oficial (MEC)',
        type: 'text',
        placeholder: 'Ex: MEC-MZ-2026-042',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'tipo_escola',
        label: 'Tipo de Escola',
        type: 'select',
        required: true,
        defaultValue: 'Secundária',
        options: [
          { value: 'Primária', label: 'Primária (1ª à 6ª Classe)' },
          { value: 'Secundária', label: 'Secundária (7ª à 12ª Classe)' },
          { value: 'Ambas', label: 'Ambas (Primária e Secundária)' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'regime_funcionamento',
        label: 'Regime de Funcionamento',
        type: 'select',
        required: true,
        defaultValue: 'Ambos',
        options: [
          { value: 'Diurno', label: 'Diurno' },
          { value: 'Noturno', label: 'Noturno' },
          { value: 'Ambos', label: 'Diurno e Noturno (Ambos)' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'diretor_responsavel',
        label: 'Diretor(a) / Responsável',
        type: 'text',
        placeholder: 'Nome completo do(a) Diretor(a)',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'nuit',
        label: 'NIF / NUIT Institucional',
        type: 'text',
        placeholder: 'Ex: 400123456',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'capacidade_total',
        label: 'Capacidade Total de Alunos',
        type: 'number',
        placeholder: 'Ex: 1500',
        required: false,
        gridSpan: 'half'
      },
      {
        name: 'regime_avaliacao',
        label: 'Regime de Avaliação Curricular',
        type: 'readonly',
        defaultValue: 'Formativa, Sumativa e Exames Oficiais',
        helperText: 'Padrão oficial do Ministério da Educação e Desenvolvimento Humano.',
        gridSpan: 'full'
      }
    ]
  },

  universidade: {
    tipo: 'universidade',
    title: 'Cadastro de Faculdade / Universidade',
    subtitle: 'Ensino Superior Universitário com graus académicos e regime de créditos ECTS.',
    fields: [
      {
        name: 'nome',
        label: 'Nome da Faculdade / Instituto Superior',
        type: 'text',
        placeholder: 'Ex: Faculdade de Engenharia e Tecnologias',
        required: true,
        gridSpan: 'full'
      },
      {
        name: 'sigla_registo',
        label: 'Sigla / Código de Registo Superior',
        type: 'text',
        placeholder: 'Ex: UEM-FET / ISCTEM-ENG',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'universidade_afiliacao',
        label: 'Universidade de Afiliação / Tutela',
        type: 'text',
        placeholder: 'Ex: Universidade Eduardo Mondlane',
        required: false,
        gridSpan: 'half'
      },
      {
        name: 'regime_ensino',
        label: 'Regime de Ensino Universitário',
        type: 'select',
        required: true,
        defaultValue: 'Semestral',
        options: [
          { value: 'Semestral', label: 'Semestral (2 Semestres por ano)' },
          { value: 'Créditos ECTS', label: 'Créditos ECTS / Sistema de Bolonha' },
          { value: 'Anual', label: 'Regime Anual' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'modalidade_oferta',
        label: 'Modalidade da Oferta Formativa',
        type: 'select',
        required: true,
        defaultValue: 'Presencial',
        options: [
          { value: 'Presencial', label: 'Presencial' },
          { value: 'Semipresencial', label: 'Semipresencial / B-learning' },
          { value: 'EAD', label: 'Ensino à Distância (EAD)' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'decano_faculdade',
        label: 'Decano(a) / Director(a) de Faculdade',
        type: 'text',
        placeholder: 'Prof. Doutor(a) Responsável',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'acreditacao_governamental',
        label: 'Acreditação Governamental (CNAQ)',
        type: 'select',
        required: true,
        defaultValue: 'Acreditada',
        options: [
          { value: 'Acreditada', label: 'Acreditada Oficialmente' },
          { value: 'Em Processo', label: 'Em Processo de Acreditação' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'campus_endereco',
        label: 'Campus Universitário / Polo Académico',
        type: 'text',
        placeholder: 'Ex: Campus Principal de Inhambane - Bloco B',
        required: false,
        gridSpan: 'full'
      },
      {
        name: 'sistema_avaliacao',
        label: 'Sistema de Avaliação Adotado',
        type: 'readonly',
        defaultValue: 'Avaliação Contínua, Frequências, Exames Finais e TCC com Júri',
        helperText: 'Padrão do Ensino Superior Universitário.',
        gridSpan: 'full'
      }
    ]
  },

  instituto: {
    tipo: 'instituto',
    title: 'Cadastro de Instituto Técnico / Profissional',
    subtitle: 'Formação Técnico-Profissional com qualificação baseada em competências (QNC/NQF).',
    fields: [
      {
        name: 'nome',
        label: 'Nome do Instituto Técnico / Profissional',
        type: 'text',
        placeholder: 'Ex: Instituto Industrial e Comercial de Maputo',
        required: true,
        gridSpan: 'full'
      },
      {
        name: 'codigo_licenciamento',
        label: 'Código de Licenciamento Técnico (ANEP/SETEC)',
        type: 'text',
        placeholder: 'Ex: ANEP-TVET-2026-089',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'area_especializacao',
        label: 'Área de Especialização Principal',
        type: 'select',
        required: true,
        defaultValue: 'Tecnologia',
        options: [
          { value: 'Indústria', label: 'Indústria & Mecânica' },
          { value: 'Tecnologia', label: 'Tecnologias de Informação & Telecomunicações' },
          { value: 'Serviços', label: 'Serviços, Gestão & Contabilidade' },
          { value: 'Saúde', label: 'Saúde & Enfermagem' },
          { value: 'Agro-Pecuária', label: 'Agro-Pecuária & Recursos Naturais' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'regime_ensino',
        label: 'Regime de Ensino Profissional',
        type: 'select',
        required: true,
        defaultValue: 'Modular',
        options: [
          { value: 'Modular', label: 'Modular por Competências (QNC/NQF)' },
          { value: 'Aprendizagem Baseada em Competências', label: 'Aprendizagem Dual / Prática Intensiva' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'diretor_responsavel',
        label: 'Director(a) do Centro / Instituto',
        type: 'text',
        placeholder: 'Nome completo do(a) Gestor(a)',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'parcerias_empresas',
        label: 'Possui Parcerias Ativas com Empresas/Mercado?',
        type: 'select',
        required: true,
        defaultValue: 'true',
        options: [
          { value: 'true', label: 'Sim (Estágios e Inserção Laboral Garantidos)' },
          { value: 'false', label: 'Não (Em desenvolvimento)' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'instalacoes_oficinas',
        label: 'Instalações & Oficinas Disponíveis',
        type: 'multiselect',
        options: [
          { value: 'Laboratórios', label: 'Laboratórios Especializados' },
          { value: 'Oficinas', label: 'Oficinas Mecânicas / Industriais' },
          { value: 'Simuladores', label: 'Simuladores Digitais / Técnicos' },
          { value: 'Campo Prático', label: 'Campo Agro-Experimental' }
        ],
        gridSpan: 'full'
      },
      {
        name: 'modelo_avaliacao',
        label: 'Modelo de Avaliação por Competências',
        type: 'readonly',
        defaultValue: 'Demonstração Prática por Competência + Portfólio + Estágio Supervisionado',
        helperText: 'Aptidão certificada segundo o Quadro Nacional de Qualificações.',
        gridSpan: 'full'
      }
    ]
  },

  global: {
    tipo: 'global',
    title: 'Cadastro de Instituição Global (Complexo Educacional)',
    subtitle: 'Gestão multi-nível e integrada de Escolas, Institutos Técnicos e Faculdades Superiores.',
    fields: [
      {
        name: 'nome',
        label: 'Nome da Instituição Global / Complexo',
        type: 'text',
        placeholder: 'Ex: Complexo Educacional Politécnico e Universitário São Tomás',
        required: true,
        gridSpan: 'full'
      },
      {
        name: 'codigo_oficial',
        label: 'Código de Registo / Licenciamento Geral',
        type: 'text',
        placeholder: 'Ex: GLO-MZ-2026-901',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'diretor_responsavel',
        label: 'Reitor(a) / Administrador(a) Geral',
        type: 'text',
        placeholder: 'Nome completo do(a) Responsável',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'nuit',
        label: 'NUIT do Complexo',
        type: 'text',
        placeholder: 'Ex: 400987654',
        required: true,
        gridSpan: 'half'
      },
      {
        name: 'regime_ensino',
        label: 'Regime Principal de Operação',
        type: 'select',
        required: true,
        defaultValue: 'Semestral',
        options: [
          { value: 'Semestral', label: 'Semestral (Ensino Superior/Geral)' },
          { value: 'Trimestral', label: 'Trimestral (Ensino Básico)' },
          { value: 'Modular', label: 'Modular (Cursos Profissionais)' },
          { value: 'Multi-regime', label: 'Multi-regime Concorrente' }
        ],
        gridSpan: 'half'
      },
      {
        name: 'modelo_avaliacao',
        label: 'Política de Avaliação Curricular',
        type: 'readonly',
        defaultValue: 'Flexível e isolada por cada Nível de Ensino cadastrado (Escola, Instituto e Universidade)',
        helperText: 'Cada curso ou classe definirá o seu regime e sistema de avaliação.',
        gridSpan: 'full'
      }
    ]
  }
};
