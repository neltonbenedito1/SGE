import { IntervaloHorario, ModuleActions, ModulePermissionConfig, UserCategoryPermission } from '../types';

export interface SystemModuleInfo {
  key: string;
  label: string;
  category: 'Geral' | 'Estrutura' | 'Académico' | 'Comunicação' | 'Administração';
  description: string;
}

export const SYSTEM_MODULES: SystemModuleInfo[] = [
  { key: 'dashboard', label: 'Dashboard Principal', category: 'Geral', description: 'Painel geral com resumos e estatísticas operacionais' },
  { key: 'atividades', label: 'Actividades Pendentes', category: 'Geral', description: 'Gestão de tarefas, prazos, atribuições e notas de finalização' },
  { key: 'analise_administrativa', label: 'Análise Administrativa', category: 'Geral', description: 'Visão executiva e alertas institucionais' },
  { key: 'analytics', label: 'Análises & Analytics (BI)', category: 'Geral', description: 'Relatórios avançados e inteligência de dados' },

  { key: 'provincias', label: 'Distritos / Províncias', category: 'Estrutura', description: 'Mapeamento territorial das instituições' },
  { key: 'escolas', label: 'Escolas & Unidades', category: 'Estrutura', description: 'Cadastro e gestão de unidades escolares' },
  { key: 'salas', label: 'Salas de Aula', category: 'Estrutura', description: 'Capacidade e alocação de salas físicas' },

  { key: 'docentes', label: 'Docentes & Professores', category: 'Académico', description: 'Ficha, disciplinas e distribuição de corpo docente' },
  { key: 'estudantes', label: 'Matrículas & Estudantes', category: 'Académico', description: 'Inscrições, dossiês e dados acadêmicos dos alunos' },
  { key: 'turmas', label: 'Gestão de Turmas', category: 'Académico', description: 'Abertura, lotação e acompanhamento de turmas' },
  { key: 'disciplinas', label: 'Disciplinas & Matérias', category: 'Académico', description: 'Programa curicular e atribuição de cadeiras' },
  { key: 'classes_escolares', label: 'Classes Lectivas', category: 'Académico', description: 'Níveis de ensino (7ª Classe, 10ª Classe, etc.)' },
  { key: 'calendario', label: 'Calendário & Horários', category: 'Académico', description: 'Horário de aulas, exames e eventos acadêmicos' },
  { key: 'plano_aulas', label: 'Plano de Aulas', category: 'Académico', description: 'Registo e acompanhamento dos tópicos e matérias leccionadas' },
  { key: 'pauta_geral', label: 'Pauta Geral de Notas', category: 'Académico', description: 'Visão consolidada de todas as notas por turma' },
  { key: 'pautas', label: 'Lançamento de Notas', category: 'Académico', description: 'Digitador de notas por disciplinas e trimestres' },
  { key: 'assiduidade', label: 'Controle de Assiduidade', category: 'Académico', description: 'Presenças, faltas e relatórios de assiduidade' },
  { key: 'biblioteca', label: 'Biblioteca Digital', category: 'Académico', description: 'Consultas de acervo e repositório de livros PDF' },
  { key: 'processos', label: 'Processo Individual', category: 'Académico', description: 'Históricos, transferências e certidões' },

  { key: 'notificacoes', label: 'Notificações & Alertas', category: 'Comunicação', description: 'Envio de mensagens, avisos e comunicados' },

  { key: 'usuarios', label: 'Utilizadores & Acessos', category: 'Administração', description: 'Contas do sistema, perfis e redefinições' },
  { key: 'configuracao', label: 'Configurações da Unidade', category: 'Administração', description: 'Parâmetros académicos, ano letivo e finanças' },
  { key: 'auditoria', label: 'Logs de Auditoria', category: 'Administração', description: 'Rastreabilidade de ações e segurança da informação' }
];

export const FULL_ACTIONS: ModuleActions = {
  visualizar: true,
  criar: true,
  editar: true,
  excluir: true,
  exportar: true,
  aprovar: true
};

export const READONLY_ACTIONS: ModuleActions = {
  visualizar: true,
  criar: false,
  editar: false,
  excluir: false,
  exportar: false,
  aprovar: false
};

export const NONE_ACTIONS: ModuleActions = {
  visualizar: false,
  criar: false,
  editar: false,
  excluir: false,
  exportar: false,
  aprovar: false
};

export const DEFAULT_CATEGORIES: UserCategoryPermission[] = [
  {
    id: 'estudantes',
    codigo: 'estudante',
    nome: 'Estudantes',
    descricao: 'Acesso restrito para consulta de horários, notas de pauta e biblioteca digital.',
    cor_badge: 'sky',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = ['dashboard', 'atividades', 'estudantes', 'turmas', 'disciplinas', 'pauta_geral', 'pautas', 'processos', 'calendario', 'plano_aulas', 'assiduidade', 'biblioteca'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...READONLY_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'professores',
    codigo: 'docente',
    nome: 'Professores e Docentes',
    descricao: 'Gestão de pautas, lançamento de notas, faltas e consulta às turmas atribuídas.',
    cor_badge: 'indigo',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = !['usuarios', 'configuracao', 'provincias', 'escolas', 'auditoria'].includes(mod.key);
      const isWriteAllowed = ['pautas', 'atividades', 'assiduidade', 'processos', 'biblioteca', 'plano_aulas'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? (isWriteAllowed ? { ...FULL_ACTIONS } : { ...READONLY_ACTIONS }) : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'pais_encarregados',
    codigo: 'pai',
    nome: 'Pais e Encarregados de Educação',
    descricao: 'Consulta de aproveitamento escolar, presenças e propinas dos educandos.',
    cor_badge: 'amber',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = ['dashboard', 'atividades', 'estudantes', 'pauta_geral', 'pautas', 'assiduidade', 'notificacoes', 'processos', 'plano_aulas'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...READONLY_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'directores',
    codigo: 'director',
    nome: 'Directores e Gestores Escolares',
    descricao: 'Acesso amplo para supervisão académica, relatórios, homologação de pautas e gestão de docentes.',
    cor_badge: 'emerald',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'suporte_tecnico',
    codigo: 'suporte',
    nome: 'Suporte Técnico',
    descricao: 'Configuração de parâmetros, manutenção de dados, gestão de utilizadores e auditoria.',
    cor_badge: 'violet',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'secretaria',
    codigo: 'secretaria',
    nome: 'Secretaria Geral',
    descricao: 'Emissão de certificados, matrículas, gestão de turmas e dotação de turmas.',
    cor_badge: 'rose',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isForbidden = ['analise_administrativa', 'configuracao', 'auditoria'];
      const isAllowed = !isForbidden.includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...FULL_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'administradores',
    codigo: 'admin',
    nome: 'Administradores do Sistema',
    descricao: 'Acesso total e irrestrito a todas as funcionalidades e configurações do portal.',
    cor_badge: 'slate',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  }
];

export const DEFAULT_INTERVALOS: IntervaloHorario[] = [
  { id: 'int-m1', nome: 'Recreio da Manhã', turno: 'manha', hora_inicio: '09:15', hora_fim: '09:30', ativo: true },
  { id: 'int-t1', nome: 'Recreio da Tarde', turno: 'tarde', hora_inicio: '14:15', hora_fim: '14:30', ativo: true },
  { id: 'int-n1', nome: 'Intervalo da Noite', turno: 'noite', hora_inicio: '20:15', hora_fim: '20:30', ativo: true },
];
