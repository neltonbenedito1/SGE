import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Monitor, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Sliders, 
  ShieldCheck, 
  School, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Library, 
  DollarSign, 
  MessageSquare, 
  Settings, 
  Check, 
  X, 
  CheckSquare, 
  Square, 
  Info, 
  RotateCcw, 
  Sparkles, 
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserCategoryPermission } from '../types';

export interface ActionNotificationRule {
  id: string;
  label: string;
  description: string;
  channels: {
    push: boolean;
    email: boolean;
    popup: boolean;
  };
  categories: string[];
}

export interface ModuleNotificationGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: ActionNotificationRule[];
}

// Default initial module notification configurations for the entire platform
export const INITIAL_MODULE_NOTIFICATIONS: ModuleNotificationGroup[] = [
  {
    id: 'escolas',
    name: 'Unidades & Escolas',
    icon: 'School',
    description: 'Alertas sobre criação de novas escolas, atualizações cadastrais e inativações de unidades.',
    actions: [
      {
        id: 'escolas_criar',
        label: 'Nova Escola Registada',
        description: 'Notifica quando uma nova unidade escolar for cadastrada no portal.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'escolas_editar',
        label: 'Alteração de Dados da Unidade',
        description: 'Notifica modificações em moradas, contactos ou diretoria da escola.',
        channels: { push: false, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'escolas_desativar',
        label: 'Suspensão / Inativação de Unidade',
        description: 'Alerta crítico sobre suspensão ou alteração de estado operacional da escola.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      }
    ]
  },
  {
    id: 'usuarios',
    name: 'Utilizadores & Permissões',
    icon: 'Users',
    description: 'Gestão de notificações de novos utilizadores, segurança de conta e trocas de categoria.',
    actions: [
      {
        id: 'usuarios_criar',
        label: 'Cadastro de Novo Utilizador',
        description: 'Notifica a criação de contas de funcionários, docentes ou administradores.',
        channels: { push: true, email: true, popup: false },
        categories: ['admin', 'director', 'secretaria']
      },
      {
        id: 'usuarios_permissao',
        label: 'Alteração de Permissão ou Categoria',
        description: 'Alerta sobre modificação de nível de acesso ou cargo do utilizador.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'usuarios_bloquear',
        label: 'Bloqueio de Conta de Acesso',
        description: 'Notifica inativação ou bloqueio de utilizadores por razões administrativas.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'usuarios_login_falho',
        label: 'Múltiplas Falhas de Login',
        description: 'Alerta de segurança ao detetar tentativas sucessivas de acesso inválido.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      }
    ]
  },
  {
    id: 'estudantes',
    name: 'Estudantes & Matrículas',
    icon: 'GraduationCap',
    description: 'Eventos sobre inscrições, confirmação de matrículas e transferências de estudantes.',
    actions: [
      {
        id: 'estudantes_inscricao',
        label: 'Nova Inscrição / Pré-matrícula',
        description: 'Notifica quando um novo estudante se inscreve no portal.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria']
      },
      {
        id: 'estudantes_matricula_confirmar',
        label: 'Confirmação Oficial de Matrícula',
        description: 'Informa a efetivação e emissão de comprovativo de matrícula do aluno.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria', 'pai', 'estudante']
      },
      {
        id: 'estudantes_transferencia',
        label: 'Solicitação de Transferência',
        description: 'Alerta pedidos de mudança de turma ou de unidade escolar.',
        channels: { push: true, email: true, popup: false },
        categories: ['admin', 'director', 'secretaria', 'pai']
      },
      {
        id: 'estudantes_anulacao',
        label: 'Anulação de Matrícula / Desistência',
        description: 'Notifica o cancelamento ou desistência do aluno do ano letivo.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria', 'pai']
      }
    ]
  },
  {
    id: 'docentes',
    name: 'Corpo Docente',
    icon: 'Users',
    description: 'Informa admissões de professores, atribuição de matérias e registo de faltas do docente.',
    actions: [
      {
        id: 'docentes_contratar',
        label: 'Contratação / Admissão de Docente',
        description: 'Notifica o registo e admissão de novos professores no sistema.',
        channels: { push: false, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria']
      },
      {
        id: 'docentes_atribuir_turmas',
        label: 'Atribuição de Turmas e Disciplinas',
        description: 'Dispara alertas aos professores quando novas turmas lhes são atribuídas.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente']
      },
      {
        id: 'docentes_falta',
        label: 'Registo de Falta do Docente',
        description: 'Alerta a direção e a secretaria quando um professor falta a uma aula.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria']
      }
    ]
  },
  {
    id: 'turmas',
    name: 'Turmas, Classes & Horários',
    icon: 'BookOpen',
    description: 'Gestão de avisos sobre alterações de turmas, salas e horários de aulas.',
    actions: [
      {
        id: 'turmas_criar',
        label: 'Abertura de Nova Turma',
        description: 'Informa a criação de turmas e definição de limites de vagas.',
        channels: { push: false, email: true, popup: true },
        categories: ['admin', 'director', 'secretaria']
      },
      {
        id: 'turmas_alterar_horario',
        label: 'Alteração de Horário ou Sala',
        description: 'Dispara aviso urgente ao mudar sala, dia ou horário de aulas da turma.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente', 'pai', 'estudante']
      },
      {
        id: 'turmas_lotacao',
        label: 'Lotação Máxima da Turma (≥90%)',
        description: 'Alerta quando a capacidade de inscritos atinge o limite da sala.',
        channels: { push: true, email: false, popup: true },
        categories: ['admin', 'director', 'secretaria']
      }
    ]
  },
  {
    id: 'pautas',
    name: 'Pautas & Avaliações Académicas',
    icon: 'FileSpreadsheet',
    description: 'Publicação de pautas, lançamento de notas e alertas de aproveitamento crítico.',
    actions: [
      {
        id: 'pautas_lancamento_nota',
        label: 'Lançamento de Nota / Avaliação',
        description: 'Dispara notificação quando o professor introduz novas notas no sistema.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'estudante', 'director']
      },
      {
        id: 'pautas_publicacao_pauta',
        label: 'Publicação de Pauta Oficial',
        description: 'Notifica a disponibilização da pauta final do trimestre aos alunos e pais.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente', 'pai', 'estudante']
      },
      {
        id: 'pautas_aproveitamento_critico',
        label: 'Aproveitamento Académico Crítico (<10v)',
        description: 'Alerta se a média do estudante descer abaixo da nota mínima de aprovação.',
        channels: { push: true, email: true, popup: true },
        categories: ['director', 'docente', 'pai', 'estudante']
      },
      {
        id: 'pautas_fechamento_trimestre',
        label: 'Fechamento Oficial do Trimestre',
        description: 'Informa o encerramento do prazo para alteração e lançamento de notas.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente', 'secretaria']
      },
      {
        id: 'pautas_reavaliacao',
        label: 'Pedido de Reavaliação / Recurso',
        description: 'Notifica quando um encarregado ou aluno solicita recurso de nota.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente', 'secretaria']
      }
    ]
  },
  {
    id: 'processos',
    name: 'Processos & Histórico do Aluno',
    icon: 'FileText',
    description: 'Notificações de ocorrências disciplinares, solicitações de declarações e pareceres.',
    actions: [
      {
        id: 'processos_disciplinar',
        label: 'Registo de Ocorrência Disciplinar',
        description: 'Alerta imediato aos pais sobre faltas de comportamento ou advertências.',
        channels: { push: true, email: true, popup: true },
        categories: ['director', 'docente', 'pai', 'secretaria']
      },
      {
        id: 'processos_solicitacao_doc',
        label: 'Solicitação de Declaração / Certificado',
        description: 'Notifica a secretaria sobre pedidos de documentos académicos.',
        channels: { push: true, email: true, popup: false },
        categories: ['secretaria', 'director', 'pai']
      },
      {
        id: 'processos_submeter_doc',
        label: 'Envio de Documentação Pendente',
        description: 'Confirma o envio de fotos, BI ou boletins antigos pelo utilizador.',
        channels: { push: false, email: true, popup: true },
        categories: ['secretaria', 'pai']
      },
      {
        id: 'processos_despacho',
        label: 'Despacho / Parecer Final do Processo',
        description: 'Informa a resolução oficial do requerimento ou processo do aluno.',
        channels: { push: true, email: true, popup: true },
        categories: ['director', 'secretaria', 'pai', 'estudante']
      }
    ]
  },
  {
    id: 'assiduidade',
    name: 'Assiduidade & Faltas dos Alunos',
    icon: 'Calendar',
    description: 'Alertas automáticos de faltas diárias, excesso de ausências e justificações.',
    actions: [
      {
        id: 'assiduidade_falta_diaria',
        label: 'Registo de Falta Diária do Estudante',
        description: 'Envia notificação instantânea no momento em que a falta é marcada na chamada.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'director']
      },
      {
        id: 'assiduidade_excesso_faltas',
        label: 'Alerta de Excesso de Faltas (>20%)',
        description: 'Notifica quando o número de ausências aproxima do limite de chumbo.',
        channels: { push: true, email: true, popup: true },
        categories: ['director', 'docente', 'pai', 'estudante']
      },
      {
        id: 'assiduidade_submeter_justificativa',
        label: 'Submissão de Justificativa de Falta',
        description: 'Informa a receção de atestado médico ou declaração do encarregado.',
        channels: { push: true, email: true, popup: false },
        categories: ['director', 'docente', 'secretaria']
      },
      {
        id: 'assiduidade_aprovar_justificativa',
        label: 'Deferimento / Aprovação de Justificativa',
        description: 'Informa se a falta foi devidamente abonada pela direção.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'estudante']
      }
    ]
  },
  {
    id: 'biblioteca',
    name: 'Biblioteca Escolar',
    icon: 'Library',
    description: 'Avisos de requisição de livros, confirmação de devolução e multas por atraso.',
    actions: [
      {
        id: 'biblioteca_emprestimo',
        label: 'Registo de Empréstimo de Livro',
        description: 'Notifica a retirada de obra física ou licença digital da biblioteca.',
        channels: { push: true, email: true, popup: false },
        categories: ['bibliotecario', 'estudante', 'docente', 'pai']
      },
      {
        id: 'biblioteca_devolucao',
        label: 'Confirmação de Devolução de Obra',
        description: 'Emite recibo digital confirmando a devolução do livro sem danos.',
        channels: { push: false, email: true, popup: true },
        categories: ['bibliotecario', 'estudante', 'docente', 'pai']
      },
      {
        id: 'biblioteca_atraso',
        label: 'Alerta de Atraso e Taxa de Multa',
        description: 'Avisa quando o prazo de devolução expirou e há cobrança pendente.',
        channels: { push: true, email: true, popup: true },
        categories: ['bibliotecario', 'estudante', 'pai', 'financeiro']
      }
    ]
  },
  {
    id: 'financeiro',
    name: 'Gestão Financeira & Facturação',
    icon: 'DollarSign',
    description: 'Disparo de cobranças de propina, confirmação de pagamentos e faturas vencidas.',
    actions: [
      {
        id: 'financeiro_emissao_propina',
        label: 'Emissão de Factura / Propina Mensal',
        description: 'Notifica a geração da propina e disponibiliza o código de pagamento.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'financeiro', 'estudante']
      },
      {
        id: 'financeiro_pagamento_confirmado',
        label: 'Confirmação de Pagamento & Recibo',
        description: 'Confirma a liquidação do valor e emite recibo com valor fiscal.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'financeiro', 'admin']
      },
      {
        id: 'financeiro_vencimento_proximo',
        label: 'Lembrete de Vencimento Próximo',
        description: 'Aviso preventivo enviado 3 dias antes da data limite da mensatilidade.',
        channels: { push: true, email: true, popup: false },
        categories: ['pai', 'estudante']
      },
      {
        id: 'financeiro_propina_atraso',
        label: 'Factura em Atraso / Aplicação de Multa',
        description: 'Informa sobre propina não liquidada após o vencimento e acréscimo de taxa.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'financeiro', 'director', 'admin']
      }
    ]
  },
  {
    id: 'comunicacao',
    name: 'Comunicação & Mensagens',
    icon: 'MessageSquare',
    description: 'Distribuição de circulares oficiais, avisos urgentes e recados entre escola e pais.',
    actions: [
      {
        id: 'comunicacao_circular',
        label: 'Publicação de Circular ou Aviso Geral',
        description: 'Dispara comunicados institucionais emitidos pela direção geral.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director', 'docente', 'pai', 'estudante', 'secretaria', 'financeiro']
      },
      {
        id: 'comunicacao_mensagem_direta',
        label: 'Mensagem Direta Escola - Encarregado',
        description: 'Notifica o envio de mensagem individual da secretaria ou professor.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'docente', 'director', 'secretaria']
      },
      {
        id: 'comunicacao_reuniao',
        label: 'Convocatória para Reunião Geral de Pais',
        description: 'Envia convite com data, hora e ordem de trabalhos para reunião.',
        channels: { push: true, email: true, popup: true },
        categories: ['pai', 'director', 'docente']
      }
    ]
  },
  {
    id: 'configuracao',
    name: 'Configurações & Segurança do Sistema',
    icon: 'Settings',
    description: 'Alertas técnicos sobre servidor SMTP, relatórios de backup e auditoria de parâmetros.',
    actions: [
      {
        id: 'configuracao_parametro_alterado',
        label: 'Alteração em Parâmetros Gerais',
        description: 'Notifica modificações nas configurações acadêmicas ou financeiras.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'configuracao_smtp_falha',
        label: 'Falha ou Erro no Servidor SMTP',
        description: 'Alerta urgente em caso de impossibilidade de envio de e-mails pelo servidor.',
        channels: { push: true, email: true, popup: true },
        categories: ['admin', 'director']
      },
      {
        id: 'configuracao_backup_executado',
        label: 'Exportação / Restauração de Backup',
        description: 'Informa a realização de cópias de segurança da base de dados.',
        channels: { push: false, email: true, popup: false },
        categories: ['admin']
      }
    ]
  }
];

interface NotificationSettingsModuleProps {
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  globalCategories: UserCategoryPermission[];
  onSave?: () => void;
  notify?: (msg: string, type?: 'sucesso' | 'erro' | 'info') => void;
}

export const NotificationSettingsModule: React.FC<NotificationSettingsModuleProps> = ({
  config,
  setConfig,
  globalCategories,
  onSave,
  notify
}) => {
  // Modules State loaded from config or default
  const [modules, setModules] = useState<ModuleNotificationGroup[]>(() => {
    if (config?.notification_modules && Array.isArray(config.notification_modules) && config.notification_modules.length > 0) {
      return config.notification_modules;
    }
    return INITIAL_MODULE_NOTIFICATIONS;
  });

  // Accordion state: track which modules are expanded
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    pautas: true,
    assiduidade: true,
    financeiro: true
  });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'todos' | 'push' | 'email' | 'popup'>('todos');

  // Track open Category Selection Dropdowns per action (actionId)
  const [openCategoryDropdownId, setOpenCategoryDropdownId] = useState<string | null>(null);

  // Sync state to parent config whenever modules change
  useEffect(() => {
    setConfig((prev: any) => {
      if (!prev) return prev;
      return { ...prev, notification_modules: modules };
    });
  }, [modules]);

  // Toggle Module Accordion
  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    modules.forEach(m => { allExpanded[m.id] = true; });
    setExpandedModules(allExpanded);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  // Channel Toggle Handler
  const handleToggleChannel = (moduleId: string, actionId: string, channel: 'push' | 'email' | 'popup') => {
    setModules(prevModules =>
      prevModules.map(mod => {
        if (mod.id !== moduleId) return mod;
        return {
          ...mod,
          actions: mod.actions.map(act => {
            if (act.id !== actionId) return act;
            return {
              ...act,
              channels: {
                ...act.channels,
                [channel]: !act.channels[channel]
              }
            };
          })
        };
      })
    );
  };

  // Category Toggle Handler for a specific Action
  const handleToggleCategoryForAction = (moduleId: string, actionId: string, categoryCode: string) => {
    setModules(prevModules =>
      prevModules.map(mod => {
        if (mod.id !== moduleId) return mod;
        return {
          ...mod,
          actions: mod.actions.map(act => {
            if (act.id !== actionId) return act;
            const hasCat = act.categories.includes(categoryCode);
            const newCats = hasCat
              ? act.categories.filter(c => c !== categoryCode)
              : [...act.categories, categoryCode];
            return {
              ...act,
              categories: newCats
            };
          })
        };
      })
    );
  };

  // Select / Deselect All Categories for an Action
  const handleSetAllCategoriesForAction = (moduleId: string, actionId: string, enableAll: boolean) => {
    const allCatCodes = globalCategories.map(c => c.codigo || c.id);
    setModules(prevModules =>
      prevModules.map(mod => {
        if (mod.id !== moduleId) return mod;
        return {
          ...mod,
          actions: mod.actions.map(act => {
            if (act.id !== actionId) return act;
            return {
              ...act,
              categories: enableAll ? allCatCodes : []
            };
          })
        };
      })
    );
  };

  // Bulk Channel Toggles across filtered/all actions
  const handleBulkToggleChannel = (channel: 'push' | 'email' | 'popup', enable: boolean) => {
    setModules(prevModules =>
      prevModules.map(mod => ({
        ...mod,
        actions: mod.actions.map(act => ({
          ...act,
          channels: {
            ...act.channels,
            [channel]: enable
          }
        }))
      }))
    );
    if (notify) {
      notify(`Canal ${channel.toUpperCase()} ${enable ? 'ativado' : 'desativado'} em todas as ações.`, 'info');
    }
  };

  // Reset to Factory Defaults
  const handleResetDefaults = () => {
    if (window.confirm('Deseja realmente restaurar todas as configurações de notificações para os padrões do sistema?')) {
      setModules(INITIAL_MODULE_NOTIFICATIONS);
      if (notify) notify('Configurações de notificações restauradas para o padrão.', 'sucesso');
    }
  };

  // Map icon strings to Lucide icon elements
  const renderModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'School': return <School className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'Users': return <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'GraduationCap': return <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'FileText': return <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'Calendar': return <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
      case 'Library': return <Library className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      case 'DollarSign': return <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'MessageSquare': return <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'Settings': return <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
      default: return <Bell className="w-5 h-5 text-indigo-600" />;
    }
  };

  // Filter modules and actions based on search and selected channel filter
  const filteredModules = modules.map(mod => {
    const matchesModuleSearch = mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const filteredActions = mod.actions.filter(act => {
      const matchesActionSearch = matchesModuleSearch ||
        act.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesActionSearch) return false;

      if (channelFilter === 'push') return act.channels.push;
      if (channelFilter === 'email') return act.channels.email;
      if (channelFilter === 'popup') return act.channels.popup;

      return true;
    });

    return { ...mod, actions: filteredActions };
  }).filter(mod => mod.actions.length > 0 || mod.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Calculate global summary stats
  let totalActions = 0;
  let activePushCount = 0;
  let activeEmailCount = 0;
  let activePopupCount = 0;

  modules.forEach(m => {
    m.actions.forEach(a => {
      totalActions++;
      if (a.channels.push) activePushCount++;
      if (a.channels.email) activeEmailCount++;
      if (a.channels.popup) activePopupCount++;
    });
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner with Statistics & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 backdrop-blur-3xl -skew-x-12 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5 animate-pulse" /> Matriz Global de Notificações por Módulo
            </div>
            <h2 className="text-xl md:text-2xl font-black font-sans tracking-tight">
              Configuração de Notificações em Drop-down
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Defina com precisão cirúrgica quais ações de cada módulo disparam alertas por <strong>Push</strong>, <strong>E-mail</strong> ou <strong>Pop-up</strong> no portal, e selecione quais <strong>categorias de utilizadores</strong> serão notificadas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Restaurar padrões do sistema"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Padrões
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-950/50 transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Guardar Notificações
              </button>
            )}
          </div>
        </div>

        {/* Channels Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-800/40 relative z-10">
          <div className="bg-slate-800/60 backdrop-blur-xs border border-indigo-500/20 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Ações</p>
            <h4 className="text-lg font-black text-white mt-0.5">{totalActions} Regras</h4>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xs border border-indigo-500/20 p-3 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-indigo-400" /> Push
              </p>
              <h4 className="text-lg font-black text-white mt-0.5">{activePushCount} Ações</h4>
            </div>
            <div className="flex flex-col gap-1">
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('push', true)}
                className="text-[9px] bg-indigo-600/50 hover:bg-indigo-600 px-1.5 py-0.5 rounded text-indigo-100 font-bold"
              >
                Ligar
              </button>
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('push', false)}
                className="text-[9px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-slate-300 font-bold"
              >
                Desligar
              </button>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xs border border-indigo-500/20 p-3 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3 h-3 text-blue-400" /> Email
              </p>
              <h4 className="text-lg font-black text-white mt-0.5">{activeEmailCount} Ações</h4>
            </div>
            <div className="flex flex-col gap-1">
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('email', true)}
                className="text-[9px] bg-blue-600/50 hover:bg-blue-600 px-1.5 py-0.5 rounded text-blue-100 font-bold"
              >
                Ligar
              </button>
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('email', false)}
                className="text-[9px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-slate-300 font-bold"
              >
                Desligar
              </button>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xs border border-indigo-500/20 p-3 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Monitor className="w-3 h-3 text-purple-400" /> Pop-up
              </p>
              <h4 className="text-lg font-black text-white mt-0.5">{activePopupCount} Ações</h4>
            </div>
            <div className="flex flex-col gap-1">
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('popup', true)}
                className="text-[9px] bg-purple-600/50 hover:bg-purple-600 px-1.5 py-0.5 rounded text-purple-100 font-bold"
              >
                Ligar
              </button>
              <button 
                type="button"
                onClick={() => handleBulkToggleChannel('popup', false)}
                className="text-[9px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-slate-300 font-bold"
              >
                Desligar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar módulo ou ação (ex: pautas, nota, falta, factura)..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Filter Pills */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setChannelFilter('todos')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${channelFilter === 'todos' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('push')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'push' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <Smartphone className="w-3 h-3" /> Push
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('email')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'email' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <Mail className="w-3 h-3" /> Email
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('popup')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'popup' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <Monitor className="w-3 h-3" /> Pop-up
            </button>
          </div>

          {/* Expand / Collapse All */}
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Expandir
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Recolher
          </button>
        </div>
      </div>

      {/* Main Drop-down / Accordion Modules List */}
      <div className="space-y-4">
        {filteredModules.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Nenhum módulo ou ação encontrada</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tente ajustar o termo de pesquisa ou limpar os filtros ativados.</p>
            <button
              onClick={() => { setSearchQuery(''); setChannelFilter('todos'); }}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          filteredModules.map((mod) => {
            const isExpanded = !!expandedModules[mod.id];
            const activeActionsCount = mod.actions.filter(a => a.channels.push || a.channels.email || a.channels.popup).length;

            return (
              <div
                key={mod.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Module Dropdown Header Bar */}
                <button
                  type="button"
                  onClick={() => toggleModule(mod.id)}
                  className={`w-full p-4 md:p-5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer select-none ${
                    isExpanded 
                      ? 'bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                      {renderModuleIcon(mod.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight truncate">
                          {mod.name}
                        </h3>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                          {mod.actions.length} {mod.actions.length === 1 ? 'Ação' : 'Ações'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 font-medium">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                      activeActionsCount > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {activeActionsCount} Ativas
                    </span>

                    <div className={`p-1.5 rounded-lg text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-indigo-100 dark:bg-slate-800 text-indigo-600' : ''}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </button>

                {/* Module Body Content (Expanded Dropdown List of Actions) */}
                {isExpanded && (
                  <div className="p-4 md:p-6 space-y-4 bg-white dark:bg-slate-900 animate-fadeIn">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4 rounded-l-xl">Ação Executada no Módulo</th>
                            <th className="py-3 px-3 text-center">Notificação Push</th>
                            <th className="py-3 px-3 text-center">Por E-mail</th>
                            <th className="py-3 px-3 text-center">Alerta Pop-up</th>
                            <th className="py-3 px-4 rounded-r-xl">Categorias Notificadas (Destinatários)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {mod.actions.map((act) => {
                            const isDropdownOpen = openCategoryDropdownId === act.id;
                            const notifiedCount = act.categories.length;
                            const isAllSelected = globalCategories.length > 0 && notifiedCount === globalCategories.length;

                            return (
                              <tr 
                                key={act.id} 
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Action Label & Description */}
                                <td className="py-3.5 px-4 min-w-[220px]">
                                  <p className="font-extrabold text-slate-900 dark:text-white text-xs">
                                    {act.label}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-0.5">
                                    {act.description}
                                  </p>
                                </td>

                                {/* Channel: Push */}
                                <td className="py-3.5 px-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={act.channels.push}
                                      onChange={() => handleToggleChannel(mod.id, act.id, 'push')}
                                      className="sr-only peer"
                                    />
                                    <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                                      act.channels.push 
                                        ? 'bg-indigo-600 dark:bg-indigo-500' 
                                        : 'bg-slate-200 dark:bg-slate-700'
                                    }`}>
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${
                                        act.channels.push ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </div>
                                  </label>
                                </td>

                                {/* Channel: Email */}
                                <td className="py-3.5 px-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={act.channels.email}
                                      onChange={() => handleToggleChannel(mod.id, act.id, 'email')}
                                      className="sr-only peer"
                                    />
                                    <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                                      act.channels.email 
                                        ? 'bg-blue-600 dark:bg-blue-500' 
                                        : 'bg-slate-200 dark:bg-slate-700'
                                    }`}>
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${
                                        act.channels.email ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </div>
                                  </label>
                                </td>

                                {/* Channel: Pop-up */}
                                <td className="py-3.5 px-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none p-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={act.channels.popup}
                                      onChange={() => handleToggleChannel(mod.id, act.id, 'popup')}
                                      className="sr-only peer"
                                    />
                                    <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                                      act.channels.popup 
                                        ? 'bg-purple-600 dark:bg-purple-500' 
                                        : 'bg-slate-200 dark:bg-slate-700'
                                    }`}>
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${
                                        act.channels.popup ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </div>
                                  </label>
                                </td>

                                {/* Target User Categories Dropdown Selector */}
                                <td className="py-3.5 px-4 min-w-[240px] relative">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setOpenCategoryDropdownId(isDropdownOpen ? null : act.id)}
                                      className={`w-full flex items-center justify-between gap-2 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                        isDropdownOpen
                                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                        <span className="truncate">
                                          {isAllSelected 
                                            ? 'Todas as Categorias' 
                                            : notifiedCount === 0 
                                            ? 'Nenhuma Categoria' 
                                            : `${notifiedCount} Categorias Notificadas`}
                                        </span>
                                      </div>
                                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                                    </button>

                                    {/* Selected Category Tags Preview */}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {act.categories.slice(0, 4).map(catCode => {
                                        const cat = globalCategories.find(c => c.codigo === catCode || c.id === catCode);
                                        const labelName = cat ? cat.nome : catCode;
                                        return (
                                          <span
                                            key={catCode}
                                            className="bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50"
                                          >
                                            {labelName}
                                          </span>
                                        );
                                      })}
                                      {act.categories.length > 4 && (
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                          +{act.categories.length - 4}
                                        </span>
                                      )}
                                    </div>

                                    {/* Dropdown Floating Panel with Checkboxes for User Categories */}
                                    {isDropdownOpen && (
                                      <>
                                        {/* Overlay to close when clicking outside */}
                                        <div 
                                          className="fixed inset-0 z-30 bg-transparent" 
                                          onClick={() => setOpenCategoryDropdownId(null)} 
                                        />

                                        <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-40 p-3 space-y-3 animate-in zoom-in-95 duration-150 text-left">
                                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                            <div>
                                              <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                                Categorias de Utilizadores
                                              </p>
                                              <p className="text-[10px] text-slate-400 font-medium">
                                                Defina quem recebe esta notificação
                                              </p>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => setOpenCategoryDropdownId(null)}
                                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Quick Toggle All / None */}
                                          <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-1">
                                            <button
                                              type="button"
                                              onClick={() => handleSetAllCategoriesForAction(mod.id, act.id, true)}
                                              className="hover:underline cursor-pointer"
                                            >
                                              Selecionar Todas
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSetAllCategoriesForAction(mod.id, act.id, false)}
                                              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                                            >
                                              Desmarcar
                                            </button>
                                          </div>

                                          {/* Checkbox List of Categories */}
                                          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                            {globalCategories.map((cat) => {
                                              const catCode = cat.codigo || cat.id;
                                              const isChecked = act.categories.includes(catCode);

                                              return (
                                                <label
                                                  key={cat.id}
                                                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer select-none text-xs font-semibold transition-colors ${
                                                    isChecked
                                                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <input
                                                      type="checkbox"
                                                      checked={isChecked}
                                                      onChange={() => handleToggleCategoryForAction(mod.id, act.id, catCode)}
                                                      className="w-4 h-4 text-indigo-600 dark:text-indigo-500 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span className="truncate font-bold">{cat.nome}</span>
                                                  </div>

                                                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase shrink-0">
                                                    {catCode}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>

                                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                                            <button
                                              type="button"
                                              onClick={() => setOpenCategoryDropdownId(null)}
                                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                            >
                                              Aplicar
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
