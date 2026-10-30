/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Configuração Data-Driven dos Formulários de Cadastro de Estudantes por Nível de Ensino
 */

export type NivelEnsino = 'primario' | 'secundario' | 'superior' | 'profissional';

export interface FieldOption {
  value: string;
  label: string;
}

export interface StudentFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'tel' | 'email' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
  helpText?: string;
  visibilityCondition?: (data: Record<string, any>) => boolean;
  requiredCondition?: (data: Record<string, any>) => boolean;
  colSpan?: 1 | 2;
}

export interface StudentFormSection {
  id: string;
  title: string;
  description?: string;
  fields: StudentFormField[];
  visibilityCondition?: (data: Record<string, any>) => boolean;
}

export interface StudentLevelSchema {
  id: NivelEnsino;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  classesDisponiveis: string[];
  sections: StudentFormSection[];
}

export const PROVINCIAS_MOCAMBIQUE_OPTIONS: FieldOption[] = [
  { value: 'Maputo Cidade', label: 'Maputo Cidade' },
  { value: 'Maputo Província', label: 'Maputo Província' },
  { value: 'Gaza', label: 'Gaza' },
  { value: 'Inhambane', label: 'Inhambane' },
  { value: 'Sofala', label: 'Sofala' },
  { value: 'Manica', label: 'Manica' },
  { value: 'Tete', label: 'Tete' },
  { value: 'Zambézia', label: 'Zambézia' },
  { value: 'Nampula', label: 'Nampula' },
  { value: 'Cabo Delgado', label: 'Cabo Delgado' },
  { value: 'Niassa', label: 'Niassa' },
];

export const STUDENT_LEVEL_SCHEMAS: Record<NivelEnsino, StudentLevelSchema> = {
  primario: {
    id: 'primario',
    title: 'Ensino Primário',
    badgeLabel: '1ª à 6ª Classe',
    badgeColor: 'sky',
    description: 'Formulário oficial para alunos do Ensino Primário Geral.',
    classesDisponiveis: ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe'],
    sections: [
      {
        id: 'dados_pessoais',
        title: 'A. Dados Pessoais do Aluno',
        fields: [
          { id: 'nome', label: 'Nome Completo', type: 'text', required: true, colSpan: 2 },
          { id: 'data_nascimento', label: 'Data de Nascimento', type: 'date', required: true },
          { id: 'genero', label: 'Sexo / Género', type: 'select', required: true, options: [{ value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }] },
          { id: 'naturalidade_provincia', label: 'Naturalidade (Província)', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'naturalidade_distrito', label: 'Distrito de Nascimento', type: 'text', required: true, placeholder: 'Ex: KaMpfumo' },
          { id: 'nacionalidade', label: 'Nacionalidade', type: 'text', required: true, placeholder: 'Moçambicana' },
          { id: 'certidao_nascimento_numero', label: 'Nº da Certidão de Nascimento', type: 'text', required: true, placeholder: 'Nº do assento / certidão' },
          { id: 'lingua_materna', label: 'Língua Materna', type: 'text', placeholder: 'Ex: Português, Changana, Sena...' },
          { id: 'religiao', label: 'Religião (Opcional)', type: 'text', placeholder: 'Opcional' },
        ]
      },
      {
        id: 'residencia',
        title: 'B. Residência',
        fields: [
          { id: 'residencia_provincia', label: 'Província de Residência', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'residencia_distrito', label: 'Distrito de Residência', type: 'text', required: true, placeholder: 'Ex: Matola' },
          { id: 'residencia_bairro', label: 'Bairro', type: 'text', required: true, placeholder: 'Ex: Fomento' },
          { id: 'residencia_endereco', label: 'Rua / Av. / Quarteirão / Casa', type: 'text', placeholder: 'Ex: Av. Samora Machel, Q. 12, Casa 45' },
        ]
      },
      {
        id: 'emergencia_saude',
        title: 'C. Emergência e Saúde',
        fields: [
          { id: 'contacto_emergencia_nome', label: 'Contacto de Emergência (Nome)', type: 'text', required: true },
          { id: 'contacto_emergencia_telefone', label: 'Telefone de Emergência', type: 'tel', required: true, placeholder: '+258 84 000 0000' },
          { id: 'grupo_sanguineo', label: 'Grupo Sanguíneo', type: 'select', options: [
            { value: 'desconhecido', label: 'Não sei' },
            { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
            { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
            { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
            { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
          ]},
          { id: 'alergias_doencas_cronicas', label: 'Alergias ou Doenças Crónicas', type: 'textarea', placeholder: 'Descreva caso existam, ou deixe em branco', colSpan: 2 },
          { id: 'necessidades_educativas_especiais', label: 'Necessidades Educativas Especiais', type: 'select', options: [
            { value: 'Não', label: 'Não' },
            { value: 'Visual', label: 'Visual' },
            { value: 'Auditiva', label: 'Auditiva' },
            { value: 'Motora', label: 'Motora' },
            { value: 'Intelectual', label: 'Intelectual' },
            { value: 'Outra', label: 'Outra' },
          ]},
          { 
            id: 'necessidades_detalhes', 
            label: 'Detalhes das Necessidades Especiais', 
            type: 'text', 
            placeholder: 'Especifique para adaptação pedagógica',
            visibilityCondition: (d) => d.necessidades_educativas_especiais && d.necessidades_educativas_especiais !== 'Não'
          },
        ]
      },
      {
        id: 'matricula',
        title: 'D. Matrícula Escolar',
        fields: [
          { id: 'tipo_matricula', label: 'Tipo de Matrícula', type: 'select', required: true, options: [
            { value: 'Nova matrícula', label: 'Nova Matrícula' },
            { value: 'Renovação', label: 'Renovação' },
            { value: 'Transferência', label: 'Transferência' },
          ]},
          { id: 'classe', label: 'Classe a Frequentar', type: 'select', required: true, options: [
            { value: '1ª Classe', label: '1ª Classe' },
            { value: '2ª Classe', label: '2ª Classe' },
            { value: '3ª Classe', label: '3ª Classe' },
            { value: '4ª Classe', label: '4ª Classe' },
            { value: '5ª Classe', label: '5ª Classe' },
            { value: '6ª Classe', label: '6ª Classe' },
          ]},
          { id: 'turno', label: 'Turno Preferencial', type: 'select', options: [{ value: 'Manhã', label: 'Manhã' }, { value: 'Tarde', label: 'Tarde' }] },
          { id: 'ano_lectivo', label: 'Ano Lectivo', type: 'text', required: true, placeholder: '2026' },
          { id: 'escola_anterior', label: 'Escola Anterior (se aplicável)', type: 'text', placeholder: 'Nome da escola anterior' },
          { id: 'usa_transporte_escolar', label: 'Usa Transporte Escolar', type: 'checkbox' },
          { id: 'frequentou_pre_escolar', label: 'Frequentou Pré-Escolar / Escolinha', type: 'checkbox' },
        ]
      },
      {
        id: 'encarregado',
        title: 'E. Encarregado de Educação (Obrigatório)',
        fields: [
          { id: 'encarregado_nome', label: 'Nome do Encarregado', type: 'text', required: true, colSpan: 2 },
          { id: 'encarregado_parentesco', label: 'Grau de Parentesco', type: 'select', required: true, options: [
            { value: 'Pai', label: 'Pai' },
            { value: 'Mãe', label: 'Mãe' },
            { value: 'Avô/Avó', label: 'Avô / Avó' },
            { value: 'Tio/Tia', label: 'Tio / Tia' },
            { value: 'Irmão/Irmã', label: 'Irmão / Irmã' },
            { value: 'Tutor legal', label: 'Tutor Legal' },
            { value: 'Outro', label: 'Outro' },
          ]},
          { id: 'encarregado_bi', label: 'Nº do BI / Identificação', type: 'text', required: true },
          { id: 'encarregado_telefone', label: 'Telemóvel Principal', type: 'tel', required: true, placeholder: '+258 84 000 0000' },
          { id: 'encarregado_telefone_alternativo', label: 'Telemóvel Alternativo', type: 'tel' },
          { id: 'encarregado_profissao', label: 'Profissão', type: 'text' },
          { id: 'encarregado_local_trabalho', label: 'Local de Trabalho', type: 'text' },
        ]
      },
      {
        id: 'documentos_entregues',
        title: 'F. Documentos Entregues (Checklist)',
        fields: [
          { id: 'doc_certidao_nascimento', label: 'Certidão de Nascimento', type: 'checkbox' },
          { id: 'doc_cartao_vacinas', label: 'Cartão de Vacinas Actualizado', type: 'checkbox' },
          { id: 'doc_fotos_tipo_passe', label: '2 Fotografias Tipo Passe', type: 'checkbox' },
          { id: 'doc_declaracao_transferencia', label: 'Declaração de Transferência (se aplicável)', type: 'checkbox' },
          { id: 'doc_bi_encarregado', label: 'Cópia do BI do Encarregado de Educação', type: 'checkbox' },
        ]
      }
    ]
  },

  secundario: {
    id: 'secundario',
    title: 'Ensino Secundário',
    badgeLabel: '8ª à 12ª Classe',
    badgeColor: 'indigo',
    description: 'Formulário oficial para alunos do Ensino Secundário Geral (1º e 2º Ciclos).',
    classesDisponiveis: ['8ª Classe', '9ª Classe', '10ª Classe', '11ª Classe', '12ª Classe'],
    sections: [
      {
        id: 'dados_pessoais',
        title: 'A. Dados Pessoais do Aluno',
        fields: [
          { id: 'nome', label: 'Nome Completo', type: 'text', required: true, colSpan: 2 },
          { id: 'data_nascimento', label: 'Data de Nascimento', type: 'date', required: true },
          { id: 'genero', label: 'Sexo / Género', type: 'select', required: true, options: [{ value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }] },
          { id: 'naturalidade_provincia', label: 'Naturalidade (Província)', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'naturalidade_distrito', label: 'Distrito de Nascimento', type: 'text', required: true },
          { id: 'nacionalidade', label: 'Nacionalidade', type: 'text', required: true, placeholder: 'Moçambicana' },
          { id: 'tipo_documento', label: 'Tipo de Documento', type: 'select', required: true, options: [
            { value: 'Bilhete de Identidade', label: 'Bilhete de Identidade (BI)' },
            { value: 'Passaporte', label: 'Passaporte' },
            { value: 'DIRE', label: 'DIRE' },
            { value: 'Cartão de eleitor', label: 'Cartão de Eleitor' },
            { value: 'Outro', label: 'Outro' },
          ]},
          { id: 'numero_documento', label: 'Nº do Documento', type: 'text', required: true },
          { id: 'validade_documento', label: 'Validade do Documento', type: 'date' },
          { id: 'lingua_materna', label: 'Língua Materna', type: 'text' },
          { id: 'estado_civil', label: 'Estado Civil', type: 'select', options: [
            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
            { value: 'Casado(a)', label: 'Casado(a)' },
            { value: 'União de facto', label: 'União de Facto' },
            { value: 'Outro', label: 'Outro' },
          ]},
        ]
      },
      {
        id: 'residencia_contato',
        title: 'B. Residência e Contactos',
        fields: [
          { id: 'residencia_provincia', label: 'Província', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'residencia_distrito', label: 'Distrito', type: 'text', required: true },
          { id: 'residencia_bairro', label: 'Bairro', type: 'text', required: true },
          { id: 'residencia_endereco', label: 'Rua / Av. / Quarteirão / Casa', type: 'text' },
          { id: 'telemovel', label: 'Telemóvel do Aluno', type: 'tel', required: true, placeholder: '+258 84 000 0000' },
          { id: 'email', label: 'E-mail do Aluno', type: 'email', placeholder: 'aluno@escola.mz' },
        ]
      },
      {
        id: 'emergencia_saude',
        title: 'C. Emergência e Saúde',
        fields: [
          { id: 'contacto_emergencia_nome', label: 'Contacto de Emergência (Nome)', type: 'text', required: true },
          { id: 'contacto_emergencia_telefone', label: 'Telefone de Emergência', type: 'tel', required: true },
          { id: 'grupo_sanguineo', label: 'Grupo Sanguíneo', type: 'select', options: [
            { value: 'desconhecido', label: 'Não sei' },
            { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
            { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
            { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
            { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
          ]},
          { id: 'alergias_doencas_cronicas', label: 'Alergias ou Condições de Saúde', type: 'textarea', colSpan: 2 },
          { id: 'necessidades_educativas_especiais', label: 'Necessidades Educativas Especiais', type: 'select', options: [
            { value: 'Não', label: 'Não' },
            { value: 'Visual', label: 'Visual' },
            { value: 'Auditiva', label: 'Auditiva' },
            { value: 'Motora', label: 'Motora' },
            { value: 'Intelectual', label: 'Intelectual' },
            { value: 'Outra', label: 'Outra' },
          ]},
          { 
            id: 'necessidades_detalhes', 
            label: 'Detalhes das Necessidades', 
            type: 'text',
            visibilityCondition: (d) => d.necessidades_educativas_especiais && d.necessidades_educativas_especiais !== 'Não'
          },
        ]
      },
      {
        id: 'matricula',
        title: 'D. Matrícula e Percurso Académico',
        fields: [
          { id: 'tipo_matricula', label: 'Tipo de Matrícula', type: 'select', required: true, options: [
            { value: 'Nova matrícula', label: 'Nova Matrícula' },
            { value: 'Renovação', label: 'Renovação' },
            { value: 'Transferência', label: 'Transferência' },
          ]},
          { id: 'ciclo', label: 'Ciclo', type: 'select', required: true, options: [
            { value: '1º Ciclo (8ª-10ª)', label: '1º Ciclo (8ª à 10ª Classe)' },
            { value: '2º Ciclo (11ª-12ª)', label: '2º Ciclo (11ª à 12ª Classe)' },
          ]},
          { id: 'classe', label: 'Classe', type: 'select', required: true, options: [
            { value: '8ª Classe', label: '8ª Classe' },
            { value: '9ª Classe', label: '9ª Classe' },
            { value: '10ª Classe', label: '10ª Classe' },
            { value: '11ª Classe', label: '11ª Classe' },
            { value: '12ª Classe', label: '12ª Classe' },
          ]},
          { 
            id: 'area', 
            label: 'Área de Estudos (só 11ª e 12ª)', 
            type: 'select', 
            options: [
              { value: 'Ciências', label: 'Secção de Ciências' },
              { value: 'Letras', label: 'Secção de Letras' },
            ],
            visibilityCondition: (d) => d.classe === '11ª Classe' || d.classe === '12ª Classe' || d.ciclo?.includes('2º Ciclo'),
            requiredCondition: (d) => d.classe === '11ª Classe' || d.classe === '12ª Classe'
          },
          { id: 'regime', label: 'Regime', type: 'select', required: true, options: [{ value: 'Diurno', label: 'Diurno' }, { value: 'Nocturno', label: 'Nocturno' }] },
          { id: 'disciplina_opcao', label: 'Disciplina de Opção', type: 'text', placeholder: 'Ex: Desenho, Francês...' },
          { id: 'escola_anterior', label: 'Escola Anterior', type: 'text', required: true },
          { id: 'media_anterior', label: 'Média Final da Classe Anterior', type: 'number', placeholder: 'Ex: 14' },
          { id: 'ano_lectivo', label: 'Ano Lectivo', type: 'text', required: true, placeholder: '2026' },
          { id: 'repetiu_classe', label: 'Já repetiu alguma classe no percurso?', type: 'checkbox' },
        ]
      },
      {
        id: 'encarregado',
        title: 'E. Encarregado de Educação',
        description: 'Obrigatório para alunos menores de 18 anos.',
        fields: [
          { id: 'encarregado_nome', label: 'Nome do Encarregado', type: 'text', colSpan: 2 },
          { id: 'encarregado_parentesco', label: 'Grau de Parentesco', type: 'select', options: [
            { value: 'Pai', label: 'Pai' },
            { value: 'Mãe', label: 'Mãe' },
            { value: 'Avô/Avó', label: 'Avô / Avó' },
            { value: 'Tio/Tia', label: 'Tio / Tia' },
            { value: 'Irmão/Irmã', label: 'Irmão / Irmã' },
            { value: 'Tutor legal', label: 'Tutor Legal' },
            { value: 'Outro', label: 'Outro' },
          ]},
          { id: 'encarregado_bi', label: 'Nº do BI / Documento', type: 'text' },
          { id: 'encarregado_telefone', label: 'Telemóvel do Encarregado', type: 'tel' },
          { id: 'encarregado_telefone_alternativo', label: 'Telemóvel Alternativo', type: 'tel' },
          { id: 'encarregado_profissao', label: 'Profissão', type: 'text' },
          { id: 'encarregado_local_trabalho', label: 'Local de Trabalho', type: 'text' },
        ]
      },
      {
        id: 'documentos_entregues',
        title: 'F. Documentos Entregues',
        fields: [
          { id: 'doc_certificado_anterior', label: 'Certificado ou Declaração da Classe Anterior', type: 'checkbox' },
          { id: 'doc_bi_ou_cedula', label: 'Cópia do BI ou Cédula', type: 'checkbox' },
          { id: 'doc_fotos_tipo_passe', label: '2 Fotografias Tipo Passe', type: 'checkbox' },
          { id: 'doc_cartao_vacinas', label: 'Cartão de Vacinas', type: 'checkbox' },
          { id: 'doc_bi_encarregado', label: 'Cópia do BI do Encarregado', type: 'checkbox' },
        ]
      }
    ]
  },

  superior: {
    id: 'superior',
    title: 'Ensino Superior',
    badgeLabel: 'Universidade / Instituto Superior',
    badgeColor: 'purple',
    description: 'Formulário oficial para graduação, licenciaturas e pós-graduações.',
    classesDisponiveis: ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    sections: [
      {
        id: 'dados_pessoais',
        title: 'A. Dados Pessoais do Estudante',
        fields: [
          { id: 'nome', label: 'Nome Completo', type: 'text', required: true, colSpan: 2 },
          { id: 'data_nascimento', label: 'Data de Nascimento', type: 'date', required: true },
          { id: 'genero', label: 'Sexo / Género', type: 'select', required: true, options: [{ value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }] },
          { id: 'naturalidade_provincia', label: 'Naturalidade (Província)', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'naturalidade_distrito', label: 'Distrito de Nascimento', type: 'text', required: true },
          { id: 'nacionalidade', label: 'Nacionalidade', type: 'text', required: true, placeholder: 'Moçambicana' },
          { id: 'tipo_documento', label: 'Tipo de Documento', type: 'select', required: true, options: [
            { value: 'Bilhete de Identidade', label: 'Bilhete de Identidade (BI)' },
            { value: 'Passaporte', label: 'Passaporte' },
            { value: 'DIRE', label: 'DIRE' },
            { value: 'Outro', label: 'Outro' },
          ]},
          { id: 'numero_documento', label: 'Nº do Documento', type: 'text', required: true },
          { id: 'validade_documento', label: 'Validade do Documento', type: 'date' },
          { id: 'nuit', label: 'NUIT (Nº Único de Identificação Tributária)', type: 'text', placeholder: 'Ex: 123456789' },
          { id: 'estado_civil', label: 'Estado Civil', type: 'select', options: [
            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
            { value: 'Casado(a)', label: 'Casado(a)' },
            { value: 'União de facto', label: 'União de Facto' },
            { value: 'Divorciado(a)', label: 'Divorciado(a)' },
            { value: 'Viúvo(a)', label: 'Viúvo(a)' },
          ]},
          { id: 'numero_filhos', label: 'Nº de Filhos', type: 'number', placeholder: '0' },
        ]
      },
      {
        id: 'residencia_contato',
        title: 'B. Residência e Contactos',
        fields: [
          { id: 'residencia_provincia', label: 'Província', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'residencia_distrito', label: 'Distrito', type: 'text', required: true },
          { id: 'residencia_bairro', label: 'Bairro', type: 'text', required: true },
          { id: 'residencia_endereco', label: 'Rua / Av. / Quarteirão / Casa', type: 'text' },
          { id: 'telemovel', label: 'Telemóvel', type: 'tel', required: true, placeholder: '+258 84 000 0000' },
          { id: 'email', label: 'E-mail Principal', type: 'email', placeholder: 'estudante@universidade.ac.mz' },
        ]
      },
      {
        id: 'emergencia_saude',
        title: 'C. Emergência e Saúde',
        fields: [
          { id: 'contacto_emergencia_nome', label: 'Contacto de Emergência (Nome)', type: 'text', required: true },
          { id: 'contacto_emergencia_telefone', label: 'Telefone de Emergência', type: 'tel', required: true },
          { id: 'condicoes_saude_relevantes', label: 'Alergias ou Condições de Saúde Relevantes', type: 'textarea', colSpan: 2 },
        ]
      },
      {
        id: 'formacao_anterior',
        title: 'D. Formação Anterior',
        fields: [
          { id: 'escola_ensino_medio', label: 'Escola onde concluiu o Ensino Médio', type: 'text', required: true, colSpan: 2 },
          { id: 'ano_conclusao_medio', label: 'Ano de Conclusão do Médio', type: 'text', required: true, placeholder: '2025' },
          { id: 'media_final_medio', label: 'Média Final do Ensino Médio', type: 'number', placeholder: 'Ex: 15' },
          { id: 'habilitacoes_obtidas', label: 'Habilitações já Obtidas', type: 'select', required: true, options: [
            { value: '12ª classe', label: '12ª Classe' },
            { value: 'Técnico médio', label: 'Técnico Médio Profissional' },
            { value: 'Bacharelato', label: 'Bacharelato' },
            { value: 'Licenciatura', label: 'Licenciatura' },
            { value: 'Mestrado', label: 'Mestrado' },
          ]},
        ]
      },
      {
        id: 'ingresso_curso',
        title: 'E. Ingresso e Curso Superior',
        fields: [
          { id: 'faculdade_departamento', label: 'Faculdade / Departamento', type: 'text', required: true },
          { id: 'curso', label: 'Curso Superior', type: 'text', required: true },
          { id: 'forma_ingresso', label: 'Forma de Ingresso', type: 'select', required: true, options: [
            { value: 'Exame de admissão', label: 'Exame de Admissão' },
            { value: 'Transferência', label: 'Transferência' },
            { value: 'Mudança de curso', label: 'Mudança de Curso' },
            { value: 'Graduado', label: 'Graduado' },
            { value: 'Bolsa de estudo', label: 'Bolsa de Estudo' },
            { value: 'Outra', label: 'Outra' },
          ]},
          { id: 'ano_ingresso', label: 'Ano de Ingresso', type: 'text', required: true, placeholder: '2026' },
          { id: 'regime', label: 'Regime de Frequência', type: 'select', required: true, options: [
            { value: 'Laboral', label: 'Laboral (Diurno)' },
            { value: 'Pós-laboral', label: 'Pós-Laboral' },
            { value: 'À distância', label: 'À Distância (EaD)' },
          ]},
          { id: 'ano_frequencia', label: 'Ano de Frequência', type: 'select', required: true, options: [
            { value: '1º Ano', label: '1º Ano' },
            { value: '2º Ano', label: '2º Ano' },
            { value: '3º Ano', label: '3º Ano' },
            { value: '4º Ano', label: '4º Ano' },
            { value: '5º Ano', label: '5º Ano' },
          ]},
          { id: 'numero_candidatura_ou_matricula', label: 'Nº de Candidatura / Matrícula Universitária', type: 'text' },
          { id: 'financiamento', label: 'Financiamento dos Estudos', type: 'select', options: [
            { value: 'Próprio', label: 'Próprio' },
            { value: 'Familiar', label: 'Familiar' },
            { value: 'Bolsa do Estado', label: 'Bolsa do Estado' },
            { value: 'Bolsa privada', label: 'Bolsa Privada' },
            { value: 'Empregador', label: 'Empregador' },
          ]},
          { id: 'trabalha_actualmente', label: 'Trabalha Actualmente?', type: 'checkbox' },
          { 
            id: 'empregador', 
            label: 'Nome da Empresa / Empregador', 
            type: 'text',
            visibilityCondition: (d) => !!d.trabalha_actualmente
          },
        ]
      },
      {
        id: 'documentos_entregues',
        title: 'F. Documentos Entregues',
        fields: [
          { id: 'doc_certificado_medio_autenticado', label: 'Certificado do Ensino Médio (Autenticado)', type: 'checkbox' },
          { id: 'doc_bi_ou_passaporte', label: 'Cópia do BI ou Passaporte', type: 'checkbox' },
          { id: 'doc_comprovativo_nuit', label: 'Comprovativo do NUIT', type: 'checkbox' },
          { id: 'doc_fotos_tipo_passe', label: '2 Fotografias Tipo Passe', type: 'checkbox' },
          { id: 'doc_comprovativo_pagamento_inscricao', label: 'Comprovativo de Pagamento da Inscrição', type: 'checkbox' },
        ]
      }
    ]
  },

  profissional: {
    id: 'profissional',
    title: 'Formação Profissional',
    badgeLabel: 'Técnico-Profissional',
    badgeColor: 'emerald',
    description: 'Formulário oficial para institutos técnicos, centros de formação profissional e cursos médios.',
    classesDisponiveis: ['Nível Básico', 'Nível Médio', 'Curta Duração'],
    sections: [
      {
        id: 'dados_pessoais',
        title: 'A. Dados Pessoais do Formando',
        fields: [
          { id: 'nome', label: 'Nome Completo', type: 'text', required: true, colSpan: 2 },
          { id: 'data_nascimento', label: 'Data de Nascimento', type: 'date', required: true },
          { id: 'genero', label: 'Sexo / Género', type: 'select', required: true, options: [{ value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }] },
          { id: 'naturalidade_provincia', label: 'Naturalidade (Província)', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'naturalidade_distrito', label: 'Distrito de Nascimento', type: 'text', required: true },
          { id: 'nacionalidade', label: 'Nacionalidade', type: 'text', required: true, placeholder: 'Moçambicana' },
          { id: 'tipo_documento', label: 'Tipo de Documento', type: 'select', required: true, options: [
            { value: 'Bilhete de Identidade', label: 'Bilhete de Identidade (BI)' },
            { value: 'Passaporte', label: 'Passaporte' },
            { value: 'DIRE', label: 'DIRE' },
            { value: 'Cartão de eleitor', label: 'Cartão de Eleitor' },
            { value: 'Outro', label: 'Outro' },
          ]},
          { id: 'numero_documento', label: 'Nº do Documento', type: 'text', required: true },
          { id: 'validade_documento', label: 'Validade do Documento', type: 'date' },
          { id: 'nuit', label: 'NUIT', type: 'text' },
          { id: 'estado_civil', label: 'Estado Civil', type: 'select', options: [
            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
            { value: 'Casado(a)', label: 'Casado(a)' },
            { value: 'União de facto', label: 'União de Facto' },
            { value: 'Outro', label: 'Outro' },
          ]},
        ]
      },
      {
        id: 'residencia_contato',
        title: 'B. Residência e Contactos',
        fields: [
          { id: 'residencia_provincia', label: 'Província', type: 'select', required: true, options: PROVINCIAS_MOCAMBIQUE_OPTIONS },
          { id: 'residencia_distrito', label: 'Distrito', type: 'text', required: true },
          { id: 'residencia_bairro', label: 'Bairro', type: 'text', required: true },
          { id: 'residencia_endereco', label: 'Rua / Av. / Quarteirão / Casa', type: 'text' },
          { id: 'telemovel', label: 'Telemóvel', type: 'tel', required: true, placeholder: '+258 84 000 0000' },
          { id: 'email', label: 'E-mail', type: 'email' },
        ]
      },
      {
        id: 'emergencia_saude',
        title: 'C. Emergência e Saúde',
        fields: [
          { id: 'contacto_emergencia_nome', label: 'Contacto de Emergência (Nome)', type: 'text', required: true },
          { id: 'contacto_emergencia_telefone', label: 'Telefone de Emergência', type: 'tel', required: true },
          { id: 'condicoes_saude_relevantes', label: 'Alergias ou Condições de Saúde Relevantes', type: 'textarea', colSpan: 2 },
        ]
      },
      {
        id: 'escolaridade',
        title: 'D. Escolaridade e Experiência Anterior',
        fields: [
          { id: 'nivel_concluido', label: 'Nível Escolar Concluído', type: 'select', required: true, options: [
            { value: '7ª classe', label: '7ª Classe' },
            { value: '9ª classe', label: '9ª Classe' },
            { value: '10ª classe', label: '10ª Classe' },
            { value: '12ª classe', label: '12ª Classe' },
            { value: 'Técnico básico', label: 'Técnico Básico' },
            { value: 'Técnico médio', label: 'Técnico Médio' },
            { value: 'Superior', label: 'Superior' },
          ]},
          { id: 'ultima_escola_frequentada', label: 'Última Escola Frequentada', type: 'text', required: true, colSpan: 2 },
          { id: 'ano_conclusao', label: 'Ano de Conclusão', type: 'text', placeholder: '2024' },
          { id: 'experiencia_profissional_area', label: 'Experiência Profissional na Área', type: 'textarea', placeholder: 'Descreva eventuais experiências práticas anteriores...', colSpan: 2 },
        ]
      },
      {
        id: 'curso_profissional',
        title: 'E. Curso Profissional Pretendido',
        fields: [
          { id: 'nivel_formacao', label: 'Nível de Formação', type: 'select', required: true, options: [
            { value: 'Básico', label: 'Nível Básico' },
            { value: 'Médio', label: 'Nível Médio' },
            { value: 'Curta duração', label: 'Curta Duração / Certificação' },
          ]},
          { id: 'area_formacao', label: 'Área de Formação', type: 'select', required: true, options: [
            { value: 'Informática', label: 'Informática e Tecnologias' },
            { value: 'Electricidade', label: 'Electricidade e Electrónica' },
            { value: 'Mecânica', label: 'Mecânica Auto / Industrial' },
            { value: 'Construção civil', label: 'Construção Civil' },
            { value: 'Contabilidade e gestão', label: 'Contabilidade e Gestão' },
            { value: 'Agropecuária', label: 'Agropecuária e Agricultura' },
            { value: 'Hotelaria e turismo', label: 'Hotelaria e Turismo' },
            { value: 'Saúde', label: 'Saúde Comunitária / Enfermagem' },
            { value: 'Costura e alfaiataria', label: 'Costura e Alfaiataria' },
            { value: 'Outra', label: 'Outra Área Técnica' },
          ]},
          { id: 'curso', label: 'Nome do Curso', type: 'text', required: true },
          { id: 'regime', label: 'Regime', type: 'select', required: true, options: [
            { value: 'Diurno', label: 'Diurno' },
            { value: 'Pós-laboral', label: 'Pós-Laboral' },
            { value: 'Nocturno', label: 'Nocturno' },
          ]},
          { id: 'data_inicio', label: 'Data de Início Prevista', type: 'date', required: true },
          { id: 'quem_paga_formacao', label: 'Quem paga a formação?', type: 'select', options: [
            { value: 'Próprio', label: 'Próprio' },
            { value: 'Familiar', label: 'Familiar' },
            { value: 'Empregador', label: 'Empregador' },
            { value: 'Bolsa ou projecto', label: 'Bolsa ou Projecto Social' },
          ]},
          { id: 'disponivel_para_estagio', label: 'Disponível para Estágio Curricular / Profissional', type: 'checkbox' },
          { id: 'empregado_actualmente', label: 'Empregado Actualmente?', type: 'checkbox' },
        ]
      },
      {
        id: 'documentos_entregues',
        title: 'F. Documentos Entregues',
        fields: [
          { id: 'doc_certificado_habilitacoes', label: 'Certificado de Habilitações Literárias', type: 'checkbox' },
          { id: 'doc_bi_ou_passaporte', label: 'Cópia do BI ou Passaporte', type: 'checkbox' },
          { id: 'doc_fotos_tipo_passe', label: '2 Fotografias Tipo Passe', type: 'checkbox' },
          { id: 'doc_atestado_medico', label: 'Atestado Médico de Aptidão Física', type: 'checkbox' },
          { id: 'doc_comprovativo_pagamento', label: 'Comprovativo de Pagamento', type: 'checkbox' },
        ]
      }
    ]
  }
};
