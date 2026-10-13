import React, { useState, useMemo } from 'react';
import {
  Settings,
  Building,
  Calendar,
  Clock,
  Award,
  DollarSign,
  BookOpen,
  Users,
  GraduationCap,
  Mail,
  ShieldCheck,
  Search,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Upload,
  Globe,
  Sliders,
  Server,
  RefreshCw,
  Percent,
  Check,
  FileText,
  Bell,
  BookMarked
} from 'lucide-react';
import { TenantConfig, IntervaloHorario } from '../types';
import { LANGUAGES } from '../lib/translation';

interface ModuloConfiguracoesProps {
  config: TenantConfig;
  onSaveConfig: (updatedConfig: TenantConfig) => Promise<void>;
  onResetSection?: (sectionKey: string) => void;
  showNotification: (msg: string, type?: 'sucesso' | 'erro' | 'info' | 'config' | 'cadastro') => void;
  onBackupExport: () => void;
  renderRefreshButton?: (moduleName: string) => React.ReactNode;
  canEdit?: boolean;
  systemLang?: string;
  onChangeLanguage?: (lang: string) => void;
  aiTranslationEnabled?: boolean;
  onToggleAiTranslation?: (enabled: boolean) => void;
  worldCountries?: { name: string; code: string }[];
  onSyncHolidays?: (country: string) => Promise<void>;
  existingClasses?: any[];
}

export const DEFAULT_INTERVALOS: IntervaloHorario[] = [
  { id: 'int-m1', nome: 'Recreio da Manhã', turno: 'manha', hora_inicio: '09:15', hora_fim: '09:30', ativo: true },
  { id: 'int-t1', nome: 'Recreio da Tarde', turno: 'tarde', hora_inicio: '14:15', hora_fim: '14:30', ativo: true },
  { id: 'int-n1', nome: 'Intervalo da Noite', turno: 'noite', hora_inicio: '20:15', hora_fim: '20:30', ativo: true },
];

export const ModuloConfiguracoes: React.FC<ModuloConfiguracoesProps> = ({
  config,
  onSaveConfig,
  showNotification,
  onBackupExport,
  renderRefreshButton,
  canEdit = true,
  systemLang = 'pt',
  onChangeLanguage,
  aiTranslationEnabled = true,
  onToggleAiTranslation,
  worldCountries = [],
  onSyncHolidays,
  existingClasses = []
}) => {
  const [activeSection, setActiveSection] = useState<string>('geral');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<TenantConfig>(() => ({
    ...config,
    horarios_intervalos: config.horarios_intervalos && config.horarios_intervalos.length > 0 
      ? config.horarios_intervalos 
      : DEFAULT_INTERVALOS,
    financeiro_formas_pagamento: config.financeiro_formas_pagamento || ['M-Pesa', 'E-Mola', 'Transferência Bancária', 'Dinheiro'],
    notificacoes_canais: config.notificacoes_canais || { email: true, push: true, sistema: true }
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictsList, setConflictsList] = useState<string[]>([]);

  // Sync external config updates
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ...config,
      horarios_intervalos: config.horarios_intervalos && config.horarios_intervalos.length > 0
        ? config.horarios_intervalos
        : (prev.horarios_intervalos || DEFAULT_INTERVALOS),
      financeiro_formas_pagamento: config.financeiro_formas_pagamento || prev.financeiro_formas_pagamento || ['M-Pesa', 'E-Mola', 'Transferência Bancária', 'Dinheiro'],
      notificacoes_canais: config.notificacoes_canais || prev.notificacoes_canais || { email: true, push: true, sistema: true }
    }));
  }, [config]);

  // Seções modulares de configurações
  const SECTIONS = [
    { id: 'geral', label: 'Geral & Institucional', icon: Building, desc: 'Identidade da instituição, logo, fuso horário, país e feriados nacionais.' },
    { id: 'pautas', label: 'Pautas & Avaliações', icon: Award, desc: 'Escalas de notas, médias mínimas de aprovação/admissão e regras de exame.' },
    { id: 'calendario', label: 'Calendário & Horários', icon: Calendar, desc: 'Duração de aulas, turnos de funcionamento e intervalos/recreios oficiais.' },
    { id: 'assiduidade', label: 'Frequência & Assiduidade', icon: Clock, desc: 'Presença mínima obrigatória, prazo de justificativas e alerta de faltas.' },
    { id: 'financeiro', label: 'Financeiro & Facturação', icon: DollarSign, desc: 'Moeda padrão, mensalidades base, taxas de IVA, multas e juros de mora.' },
    { id: 'biblioteca', label: 'Biblioteca Escolar', icon: BookOpen, desc: 'Prazos de empréstimo, limites de livros, multas de atraso e permissões.' },
    { id: 'estudantes', label: 'Turmas, Alunos & Matrículas', icon: GraduationCap, desc: 'Capacidade padrão de turmas, máscara de matrícula e idade mínima.' },
    { id: 'docentes', label: 'Docentes & Carga Horária', icon: Users, desc: 'Limites de carga horária semanal e quantidade máxima de turmas.' },
    { id: 'disciplinas', label: 'Disciplinas & Matriz Curricular', icon: BookMarked, desc: 'Carga horária padrão semanal e formato de matriz curricular.' },
    { id: 'relatorios', label: 'Relatórios & Documentos Oficiais', icon: FileText, desc: 'Cabeçalho e rodapé oficial de pautas/certificados e formato de exportação.' },
    { id: 'notificacoes', label: 'Comunicados & Notificações', icon: Bell, desc: 'Canais ativos de aviso e modelos padronizados de mensagens.' },
    { id: 'smtp', label: 'Servidor de E-mail (SMTP)', icon: Mail, desc: 'Servidor corporativo ou Gmail para envio de comunicados e notificações.' },
    { id: 'seguranca', label: 'Segurança & Permissões', icon: ShieldCheck, desc: 'Política de senhas, tempo de inatividade da sessão e bloqueios.' },
  ];

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(s => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }, [searchQuery]);

  // Validador aprimorado de intervalos de horário com regras de turno e conflito (Tarefa 3)
  const validateIntervalos = (intervalos: IntervaloHorario[]): { error?: string; conflicts?: string[] } => {
    for (let i = 0; i < intervalos.length; i++) {
      const it = intervalos[i];
      if (!it.hora_inicio || !it.hora_fim) {
        return { error: `O intervalo "${it.nome || 'Sem nome'}" precisa de hora de início e hora de fim.` };
      }
      if (it.hora_fim <= it.hora_inicio) {
        return { error: `No intervalo "${it.nome || 'Sem nome'}", a hora final (${it.hora_fim}) deve ser maior que a hora inicial (${it.hora_inicio}).` };
      }

      // Validação de horário de funcionamento por turno:
      if (it.turno === 'manha') {
        if (it.hora_inicio < '06:00' || it.hora_fim > '13:00') {
          return { error: `O intervalo da manhã "${it.nome}" (${it.hora_inicio} - ${it.hora_fim}) deve estar dentro do horário de funcionamento do turno matutino (06:00 às 13:00).` };
        }
      } else if (it.turno === 'tarde') {
        if (it.hora_inicio < '12:00' || it.hora_fim > '18:30') {
          return { error: `O intervalo da tarde "${it.nome}" (${it.hora_inicio} - ${it.hora_fim}) deve estar dentro do horário de funcionamento do turno vespertino (12:00 às 18:30).` };
        }
      } else if (it.turno === 'noite') {
        if (it.hora_inicio < '17:30' || it.hora_fim > '23:30') {
          return { error: `O intervalo da noite "${it.nome}" (${it.hora_inicio} - ${it.hora_fim}) deve estar dentro do horário de funcionamento do turno noturno (17:30 às 23:30).` };
        }
      }

      // Checar sobreposição com outros intervalos do mesmo turno (ou 'todos')
      for (let j = i + 1; j < intervalos.length; j++) {
        const other = intervalos[j];
        const sameTurno = it.turno === other.turno || it.turno === 'todos' || other.turno === 'todos';
        if (sameTurno && it.ativo && other.ativo) {
          const overlap = it.hora_inicio < other.hora_fim && it.hora_fim > other.hora_inicio;
          if (overlap) {
            return { error: `Conflito de sobreposição entre intervalos: "${it.nome}" (${it.hora_inicio}-${it.hora_fim}) e "${other.nome}" (${other.hora_inicio}-${other.hora_fim}).` };
          }
        }
      }
    }

    // Checar conflitos com aulas já configuradas na grade
    const conflicts: string[] = [];
    if (existingClasses && existingClasses.length > 0) {
      const parseMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      for (const it of intervalos) {
        if (!it.ativo || !it.hora_inicio || !it.hora_fim) continue;
        const intStart = parseMin(it.hora_inicio);
        const intEnd = parseMin(it.hora_fim);

        for (const c of existingClasses) {
          if (!c.horario) continue;
          const [cStartStr, cEndStr] = c.horario.split(' - ').map((s: string) => s?.trim());
          if (!cStartStr || !cEndStr) continue;
          const cStart = parseMin(cStartStr);
          const cEnd = parseMin(cEndStr);

          if (intStart < cEnd && intEnd > cStart) {
            conflicts.push(`A aula "${c.nome || c.disciplina_nome || 'Aula'}" (${c.horario}${c.dia_semana ? ` - ${c.dia_semana}` : ''}) sobrepõe o intervalo "${it.nome}" (${it.hora_inicio} - ${it.hora_fim}).`);
            if (conflicts.length >= 5) break;
          }
        }
      }
    }

    return { conflicts };
  };

  // Salvar seção atual
  const executeSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig(formData);
      showNotification(`Configurações da seção "${SECTIONS.find(s => s.id === activeSection)?.label}" salvas com sucesso!`, 'sucesso');
    } catch (e: any) {
      showNotification(`Erro ao salvar: ${e?.message || e}`, 'erro');
    } finally {
      setIsSaving(false);
      setConflictModalOpen(false);
    }
  };

  const handleSaveCurrentSection = async () => {
    if (!canEdit) {
      showNotification('Você não tem permissão para alterar as configurações.', 'erro');
      return;
    }

    // Validar seção específica
    if (activeSection === 'calendario' && formData.horarios_intervalos) {
      const { error, conflicts } = validateIntervalos(formData.horarios_intervalos);
      if (error) {
        setValidationError(error);
        showNotification(error, 'erro');
        return;
      }
      if (conflicts && conflicts.length > 0) {
        setConflictsList(conflicts);
        setConflictModalOpen(true);
        return;
      }
    }
    setValidationError(null);
    await executeSave();
  };

  // Restaurar padrão da seção
  const handleResetCurrentSection = () => {
    if (activeSection === 'calendario') {
      setFormData(prev => ({
        ...prev,
        horarios_duracao_minutos: 45,
        horarios_dias_letivos: 5,
        horarios_hora_inicio_manha: '07:00',
        horarios_hora_inicio_tarde: '12:00',
        horarios_hora_inicio_noite: '18:00',
        horarios_intervalos: DEFAULT_INTERVALOS
      }));
      showNotification('Intervalos e horários restaurados para o padrão!', 'info');
    } else if (activeSection === 'pautas') {
      setFormData(prev => ({
        ...prev,
        escala_avaliacao: '0-20',
        num_avaliacoes: 3,
        metodo_calculo: 'aritmetica_simples',
        pautas_nota_aprovacao: 9.5,
        pautas_nota_admissao: 9.5,
        pautas_arredondamento: 'padrao'
      }));
      showNotification('Parâmetros de pautas restaurados para o padrão!', 'info');
    } else if (activeSection === 'assiduidade') {
      setFormData(prev => ({
        ...prev,
        assiduidade_minima_aprovacao: 75,
        prazo_justificativa_dias: 5,
        limite_faltas_alerta: 3
      }));
      showNotification('Parâmetros de frequência restaurados para o padrão!', 'info');
    } else if (activeSection === 'financeiro') {
      setFormData(prev => ({
        ...prev,
        moeda_padrao: 'MZN',
        taxa_propina_base: 3500,
        taxa_multa_atraso: 10,
        financeiro_taxa_juros_diario: 0.1,
        taxa_iva: 16,
        dia_vencimento_padrao: 10,
        financeiro_formas_pagamento: ['M-Pesa', 'E-Mola', 'Transferência Bancária', 'Dinheiro']
      }));
      showNotification('Parâmetros financeiros restaurados para o padrão!', 'info');
    } else if (activeSection === 'biblioteca') {
      setFormData(prev => ({
        ...prev,
        biblioteca_prazo_dias: 15,
        biblioteca_limite_livros: 3,
        biblioteca_multa_diaria: 20,
        biblioteca_permitir_renovacao: true,
        biblioteca_permitir_download: true
      }));
      showNotification('Parâmetros da biblioteca restaurados para o padrão!', 'info');
    } else if (activeSection === 'estudantes') {
      setFormData(prev => ({
        ...prev,
        capacidade_padrao_turma: 30,
        prefixo_matricula: 'MAT',
        idade_minima_matricula: 5
      }));
      showNotification('Parâmetros de turmas e matrículas restaurados para o padrão!', 'info');
    } else if (activeSection === 'docentes') {
      setFormData(prev => ({
        ...prev,
        carga_horaria_maxima_docente: 32,
        limite_turmas_docente: 6
      }));
      showNotification('Parâmetros docentes restaurados para o padrão!', 'info');
    } else if (activeSection === 'disciplinas') {
      setFormData(prev => ({
        ...prev,
        disciplinas_carga_horaria_padrao: 4,
        disciplinas_permitir_semestrais: true
      }));
      showNotification('Parâmetros de disciplinas restaurados para o padrão!', 'info');
    } else if (activeSection === 'relatorios') {
      setFormData(prev => ({
        ...prev,
        relatorios_cabecalho_oficial: 'REPÚBLICA DE MOÇAMBIQUE / MINISTÉRIO DA EDUCAÇÃO',
        relatorios_rodape_oficial: 'Documento oficial processado por computador - SysEdu SaaS',
        relatorios_formato_exportacao: 'ambos',
        relatorios_orientacao_padrao: 'retrato'
      }));
      showNotification('Parâmetros de relatórios restaurados para o padrão!', 'info');
    } else if (activeSection === 'notificacoes') {
      setFormData(prev => ({
        ...prev,
        notificacoes_canais: { email: true, push: true, sistema: true },
        notificacoes_modelo_falta: 'Exmo(a) Encarregado(a), informamos que o(a) educando(a) faltou à aula programada.',
        notificacoes_modelo_cobranca: 'Exmo(a) Encarregado(a), lembramos que a propina vence no dia {dia}. Por favor, regularize.'
      }));
      showNotification('Modelos de notificação restaurados para o padrão!', 'info');
    } else if (activeSection === 'seguranca') {
      setFormData(prev => ({
        ...prev,
        tamanho_minimo_senha: 8,
        exigir_alteracao_primeiro_login: true,
        tempo_inatividade_sessao_minutos: 60,
        tentativas_maximas_login: 5
      }));
      showNotification('Políticas de segurança restauradas para o padrão!', 'info');
    } else {
      showNotification('Seção mantida com valores padrão vigentes.', 'info');
    }
  };

  // Manipulação de Intervalos de Horário (Tarefa 3)
  const handleAddIntervalo = () => {
    const newId = `int-${Date.now().toString(36)}`;
    const newInterval: IntervaloHorario = {
      id: newId,
      nome: 'Novo Intervalo de Recreio',
      turno: 'manha',
      hora_inicio: '10:00',
      hora_fim: '10:15',
      ativo: true
    };
    setFormData(prev => ({
      ...prev,
      horarios_intervalos: [...(prev.horarios_intervalos || []), newInterval]
    }));
  };

  const handleUpdateIntervalo = (id: string, updates: Partial<IntervaloHorario>) => {
    setFormData(prev => ({
      ...prev,
      horarios_intervalos: (prev.horarios_intervalos || []).map(it => 
        it.id === id ? { ...it, ...updates } : it
      )
    }));
  };

  const handleRemoveIntervalo = (id: string) => {
    setFormData(prev => ({
      ...prev,
      horarios_intervalos: (prev.horarios_intervalos || []).filter(it => it.id !== id)
    }));
  };

  const currentSectionMeta = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];

  return (
    <div className="space-y-6 w-full animate-fadeIn max-w-full overflow-hidden">
      {/* Top Bar com Título, Busca e Ações Rápidas */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                Painel de Configurações Modulares
              </h2>
              {renderRefreshButton && renderRefreshButton('Configurações')}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Parametrização independente por módulo com isolamento por instituição.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={onBackupExport}
            className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            title="Exportar cópia dos dados em JSON"
          >
            <Upload className="w-4 h-4 rotate-180" /> Exportar Backup (JSON)
          </button>
          <button
            type="button"
            onClick={handleSaveCurrentSection}
            disabled={isSaving || !canEdit}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98 min-h-[44px]"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Seção
          </button>
        </div>
      </div>

      {/* Seletor Mobile Rápido (Drill-down adaptável em telas pequenas) */}
      <div className="lg:hidden bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Módulo de Configuração Ativo:
        </label>
        <select
          value={activeSection}
          onChange={(e) => {
            setActiveSection(e.target.value);
            setValidationError(null);
          }}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-900 dark:text-slate-100 min-h-[44px]"
        >
          {SECTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Layout Modular: Navegação Lateral por Módulo + Conteúdo da Seção */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Menu Lateral de Módulos (Desktop) */}
        <div className="hidden lg:block lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar configuração ou módulo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <nav className="flex flex-col gap-1" aria-label="Módulos de Configuração">
            {filteredSections.map(s => {
              const Icon = s.icon;
              const isSelected = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(s.id);
                    setValidationError(null);
                  }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all w-full cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Painel Central com Opções do Módulo Ativo */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-4 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 overflow-hidden">
          {/* Cabeçalho da Seção */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <currentSectionMeta.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {currentSectionMeta.label}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {currentSectionMeta.desc}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleResetCurrentSection}
                className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                title="Restaurar valores padrão desta seção"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentSection}
                disabled={isSaving || !canEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5" /> Salvar Seção
              </button>
            </div>
          </div>

          {/* Erros de Validação da Seção */}
          {validationError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 1: GERAL & INSTITUCIONAL                           */}
          {/* ======================================================== */}
          {activeSection === 'geral' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nome Oficial da Instituição
                  </label>
                  <input
                    type="text"
                    value={formData.nome_instituicao || ''}
                    onChange={(e) => setFormData({ ...formData, nome_instituicao: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-slate-100"
                    placeholder="Ex: Instituto Médio Politécnico"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Logotipo Oficial da Unidade
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 overflow-hidden">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex flex-wrap gap-2">
                        <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5 min-h-[38px]">
                          <Upload className="w-3.5 h-3.5" /> Escolher Imagem
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (f.size > 2 * 1024 * 1024) {
                                  showNotification('O logotipo deve ter no máximo 2MB', 'erro');
                                  return;
                                }
                                const r = new FileReader();
                                r.onloadend = () => {
                                  setFormData(prev => ({ ...prev, logo_url: r.result as string }));
                                };
                                r.readAsDataURL(f);
                              }
                            }}
                          />
                        </label>
                        {formData.logo_url && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                            className="bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold px-3 py-1.5 rounded-lg text-xs min-h-[38px]"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Ou digite a URL da imagem (https://...)"
                        value={formData.logo_url || ''}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Endereço / Província
                  </label>
                  <input
                    type="text"
                    value={formData.endereco || ''}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Contacto Telefónico
                  </label>
                  <input
                    type="text"
                    value={formData.contacto || ''}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Ano Letivo Vigente
                  </label>
                  <input
                    type="text"
                    value={formData.ano_letivo_atual || ''}
                    onChange={(e) => setFormData({ ...formData, ano_letivo_atual: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Fuso Horário
                  </label>
                  <select
                    value={formData.fuso_horario || 'Africa/Maputo'}
                    onChange={(e) => setFormData({ ...formData, fuso_horario: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  >
                    <option value="Africa/Maputo">Africa/Maputo [UTC+2]</option>
                    <option value="Africa/Luanda">Africa/Luanda [UTC+1]</option>
                    <option value="Europe/Lisbon">Europe/Lisbon [UTC+0 / UTC+1]</option>
                    <option value="America/Sao_Paulo">America/Sao_Paulo [UTC-3]</option>
                    <option value="UTC">UTC [UTC+0]</option>
                  </select>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    País Sede (Feriados Nacionais Automáticos)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.pais || 'Moçambique'}
                      onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                      className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold"
                    >
                      {worldCountries.map(c => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {onSyncHolidays && (
                      <button
                        type="button"
                        onClick={() => onSyncHolidays(formData.pais || 'Moçambique')}
                        className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/60"
                        title="Sincronizar Feriados"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Sincronizar Feriados
                      </button>
                    )}
                  </div>
                </div>

                {onChangeLanguage && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Idioma Padrão da Plataforma
                      </label>
                      <select
                        value={systemLang}
                        onChange={(e) => onChangeLanguage(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium"
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                        ))}
                      </select>
                    </div>

                    {onToggleAiTranslation && (
                      <div className="flex items-center gap-2.5 pt-6">
                        <input
                          type="checkbox"
                          id="ai_trans"
                          checked={aiTranslationEnabled}
                          onChange={(e) => onToggleAiTranslation(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <label htmlFor="ai_trans" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                          Tradução por Inteligência Artificial em Segundo Plano
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 2: PAUTAS & AVALIAÇÕES (NOTAS)                     */}
          {/* ======================================================== */}
          {activeSection === 'pautas' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Escala de Avaliação
                  </label>
                  <select
                    value={formData.escala_avaliacao || '0-20'}
                    onChange={(e) => setFormData({ ...formData, escala_avaliacao: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="0-20">0 a 20 Valores (Moçambique / Angola / Portugal)</option>
                    <option value="0-10">0 a 10 Pontos (Brasil)</option>
                    <option value="A-F">Letras A-F (Padrão Internacional)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Define o intervalo aceito para lançamentos de notas no portal.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nº de Avaliações Contínuas por Período
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.num_avaliacoes || 3}
                    onChange={(e) => setFormData({ ...formData, num_avaliacoes: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Ex: 3 avaliações contínuas antes do exame final.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Método de Cálculo da Média
                  </label>
                  <select
                    value={formData.metodo_calculo || 'aritmetica_simples'}
                    onChange={(e) => setFormData({ ...formData, metodo_calculo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="aritmetica_simples">Média Aritmética Simples</option>
                    <option value="aritmetica_ponderada">Média Ponderada (Exame Peso 2)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nota Mínima de Aprovação Direta
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={20}
                    value={formData.pautas_nota_aprovacao ?? 9.5}
                    onChange={(e) => setFormData({ ...formData, pautas_nota_aprovacao: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Média mínima requerida para aprovação curricular (padrão: 9.5).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nota Mínima de Admissão a Exame
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={20}
                    value={formData.pautas_nota_admissao ?? 9.5}
                    onChange={(e) => setFormData({ ...formData, pautas_nota_admissao: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Média mínima para qualificar o aluno para exame regular.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Critério de Arredondamento
                  </label>
                  <select
                    value={formData.pautas_arredondamento || 'padrao'}
                    onChange={(e) => setFormData({ ...formData, pautas_arredondamento: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="padrao">Padrão Matemático (0.5 arredonda para cima)</option>
                    <option value="cima">Sempre para Cima (Teto)</option>
                    <option value="baixo">Sempre para Baixo (Truncamento)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 3: CALENDÁRIO & HORÁRIOS COM INTERVALOS (TAREFA 3) */}
          {/* ======================================================== */}
          {activeSection === 'calendario' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-150 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Duração Padrão da Aula (Minutos)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={120}
                    step={5}
                    value={formData.horarios_duracao_minutos || 45}
                    onChange={(e) => setFormData({ ...formData, horarios_duracao_minutos: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Duração mínima de um bloco de aula curricular (padrão: 45 min).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Dias Letivos Semanais
                  </label>
                  <select
                    value={formData.horarios_dias_letivos || 5}
                    onChange={(e) => setFormData({ ...formData, horarios_dias_letivos: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value={5}>5 Dias (Segunda a Sexta-feira)</option>
                    <option value={6}>6 Dias (Segunda a Sábado)</option>
                    <option value={7}>7 Dias (Segunda a Domingo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Horário Início - Turno Manhã
                  </label>
                  <input
                    type="time"
                    value={formData.horarios_hora_inicio_manha || '07:00'}
                    onChange={(e) => setFormData({ ...formData, horarios_hora_inicio_manha: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Horário Início - Turno Tarde
                  </label>
                  <input
                    type="time"
                    value={formData.horarios_hora_inicio_tarde || '12:00'}
                    onChange={(e) => setFormData({ ...formData, horarios_hora_inicio_tarde: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              {/* GESTÃO DE INTERVALOS / RECREIOS (TAREFA 3) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      ☕ Intervalos Oficiais & Recreios da Grade
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cadastre os períodos de recreio/pausa por turno. Nenhuma aula pode ser agendada durante o intervalo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIntervalo}
                    className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800/60 self-start sm:self-auto cursor-pointer min-h-[38px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Intervalo
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.horarios_intervalos || []).length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                      Nenhum intervalo cadastrado. Clique em &quot;Adicionar Intervalo&quot; para definir recreios na grade.
                    </div>
                  ) : (
                    (formData.horarios_intervalos || []).map((it) => (
                      <div
                        key={it.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 transition-colors"
                      >
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nome da Pausa</label>
                          <input
                            type="text"
                            value={it.nome}
                            onChange={(e) => handleUpdateIntervalo(it.id, { nome: e.target.value })}
                            placeholder="Ex: Recreio da Manhã"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="w-full sm:w-36">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Turno</label>
                          <select
                            value={it.turno}
                            onChange={(e) => handleUpdateIntervalo(it.id, { turno: e.target.value as any })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                          >
                            <option value="manha">Manhã (06h-13h)</option>
                            <option value="tarde">Tarde (12h-18h30)</option>
                            <option value="noite">Noite (17h30-23h30)</option>
                            <option value="todos">Todos os Turnos</option>
                          </select>
                        </div>

                        <div className="w-full sm:w-28">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Hora Início (24h)</label>
                          <input
                            type="time"
                            value={it.hora_inicio}
                            onChange={(e) => handleUpdateIntervalo(it.id, { hora_inicio: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="w-full sm:w-28">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Hora Fim (24h)</label>
                          <input
                            type="time"
                            value={it.hora_fim}
                            onChange={(e) => handleUpdateIntervalo(it.id, { hora_fim: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-4 self-end sm:self-center">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer min-h-[38px]">
                            <input
                              type="checkbox"
                              checked={it.ativo}
                              onChange={(e) => handleUpdateIntervalo(it.id, { ativo: e.target.checked })}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span>Ativo</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveIntervalo(it.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                            title="Remover Intervalo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 4: FREQUÊNCIA & ASSIDUIDADE                        */}
          {/* ======================================================== */}
          {activeSection === 'assiduidade' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Frequência Mínima Obrigatória (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={formData.assiduidade_minima_aprovacao ?? 75}
                      onChange={(e) => setFormData({ ...formData, assiduidade_minima_aprovacao: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-8 text-sm font-bold"
                    />
                    <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Estudantes abaixo desta percentagem de presença ficam retidos por faltas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Prazo para Submissão de Justificativa (Dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.prazo_justificativa_dias ?? 5}
                    onChange={(e) => setFormData({ ...formData, prazo_justificativa_dias: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prazo concedido aos encarregados para anexar justificativa de falta.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Limite de Faltas Consecutivas para Alerta
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.limite_faltas_alerta ?? 3}
                    onChange={(e) => setFormData({ ...formData, limite_faltas_alerta: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dispara notificação automática de ausência ao encarregado de educação.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 5: FINANCEIRO & FACTURAÇÃO                         */}
          {/* ======================================================== */}
          {activeSection === 'financeiro' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Moeda Padrão de Cobrança
                  </label>
                  <select
                    value={formData.moeda_padrao || 'MZN'}
                    onChange={(e) => setFormData({ ...formData, moeda_padrao: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="MZN">Metical de Moçambique (MZN)</option>
                    <option value="USD">Dólar Americano (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="ZAR">Rand Sul-Africano (ZAR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Dia de Vencimento Padrão do Mês
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={formData.dia_vencimento_padrao ?? 10}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento_padrao: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Dia do mês em que a propina deve ser liquidada.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Mensalidade Escolar Base ({formData.moeda_padrao || 'MZN'})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.taxa_propina_base ?? 3500}
                    onChange={(e) => setFormData({ ...formData, taxa_propina_base: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Multa por Atraso (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.taxa_multa_atraso ?? 10}
                    onChange={(e) => setFormData({ ...formData, taxa_multa_atraso: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Taxa de Juros de Mora Diária (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={5}
                    value={formData.financeiro_taxa_juros_diario ?? 0.1}
                    onChange={(e) => setFormData({ ...formData, financeiro_taxa_juros_diario: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Incide a cada dia útil posterior ao vencimento.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Taxa de IVA (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.taxa_iva ?? 16}
                    onChange={(e) => setFormData({ ...formData, taxa_iva: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Formas de Pagamento Aceites
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['M-Pesa', 'E-Mola', 'Transferência Bancária', 'Dinheiro', 'POS / Cartão'].map(metodo => {
                      const list = formData.financeiro_formas_pagamento || [];
                      const isChecked = list.includes(metodo);
                      return (
                        <button
                          key={metodo}
                          type="button"
                          onClick={() => {
                            const updated = isChecked
                              ? list.filter(m => m !== metodo)
                              : [...list, metodo];
                            setFormData({ ...formData, financeiro_formas_pagamento: updated });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer min-h-[38px] ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '} {metodo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 6: BIBLIOTECA ESCOLAR                              */}
          {/* ======================================================== */}
          {activeSection === 'biblioteca' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Prazo Padrão de Empréstimo (Dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={formData.biblioteca_prazo_dias ?? 15}
                    onChange={(e) => setFormData({ ...formData, biblioteca_prazo_dias: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Limite Máximo de Livros Simultâneos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.biblioteca_limite_livros ?? 3}
                    onChange={(e) => setFormData({ ...formData, biblioteca_limite_livros: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Multa Diária por Atraso ({formData.moeda_padrao || 'MZN'})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.biblioteca_multa_diaria ?? 20}
                    onChange={(e) => setFormData({ ...formData, biblioteca_multa_diaria: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-6">
                  <input
                    type="checkbox"
                    id="bib_renova"
                    checked={formData.biblioteca_permitir_renovacao !== false}
                    onChange={(e) => setFormData({ ...formData, biblioteca_permitir_renovacao: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <label htmlFor="bib_renova" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Permitir Renovação Online de Empréstimos pelos Alunos
                  </label>
                </div>

                <div className="sm:col-span-2 flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="bib_down"
                    checked={formData.biblioteca_permitir_download !== false}
                    onChange={(e) => setFormData({ ...formData, biblioteca_permitir_download: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <label htmlFor="bib_down" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Permitir Download Offline de Ficheiros PDF do Acervo
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 7: TURMAS, ALUNOS & MATRÍCULAS                     */}
          {/* ======================================================== */}
          {activeSection === 'estudantes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Capacidade Padrão por Turma (Vagas)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={formData.capacidade_padrao_turma ?? 30}
                    onChange={(e) => setFormData({ ...formData, capacidade_padrao_turma: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Prefixo Padrão da Matrícula
                  </label>
                  <input
                    type="text"
                    value={formData.prefixo_matricula || 'MAT'}
                    onChange={(e) => setFormData({ ...formData, prefixo_matricula: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Ex: MAT2026/001</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Idade Mínima para Matrícula (Anos)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={18}
                    value={formData.idade_minima_matricula ?? 5}
                    onChange={(e) => setFormData({ ...formData, idade_minima_matricula: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 8: DOCENTES & CARGA HORÁRIA                        */}
          {/* ======================================================== */}
          {activeSection === 'docentes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Carga Horária Máxima Semanal (Horas)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={50}
                    value={formData.carga_horaria_maxima_docente ?? 32}
                    onChange={(e) => setFormData({ ...formData, carga_horaria_maxima_docente: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Gera alerta caso o agendamento de aulas exceda o teto semanal do docente.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Limite Máximo de Turmas por Docente
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formData.limite_turmas_docente ?? 6}
                    onChange={(e) => setFormData({ ...formData, limite_turmas_docente: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 9: DISCIPLINAS & MATRIZ CURRICULAR                 */}
          {/* ======================================================== */}
          {activeSection === 'disciplinas' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Carga Horária Semanal Padrão (Horas)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={formData.disciplinas_carga_horaria_padrao ?? 4}
                    onChange={(e) => setFormData({ ...formData, disciplinas_carga_horaria_padrao: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Carga horária padrão sugerida para novas disciplinas no plano curricular.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 pt-6">
                  <input
                    type="checkbox"
                    id="disc_semestral"
                    checked={formData.disciplinas_permitir_semestrais !== false}
                    onChange={(e) => setFormData({ ...formData, disciplinas_permitir_semestrais: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <label htmlFor="disc_semestral" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Habilitar Regime Modular / Semestral para Disciplinas
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 10: RELATÓRIOS & DOCUMENTOS OFICIAIS               */}
          {/* ======================================================== */}
          {activeSection === 'relatorios' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Cabeçalho Oficial nos Relatórios e Termos
                  </label>
                  <input
                    type="text"
                    value={formData.relatorios_cabecalho_oficial || 'REPÚBLICA DE MOÇAMBIQUE / MINISTÉRIO DA EDUCAÇÃO'}
                    onChange={(e) => setFormData({ ...formData, relatorios_cabecalho_oficial: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Texto de Rodapé Padrão
                  </label>
                  <input
                    type="text"
                    value={formData.relatorios_rodape_oficial || 'Documento oficial processado por computador - SysEdu SaaS'}
                    onChange={(e) => setFormData({ ...formData, relatorios_rodape_oficial: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Formato Padrão de Exportação
                  </label>
                  <select
                    value={formData.relatorios_formato_exportacao || 'ambos'}
                    onChange={(e) => setFormData({ ...formData, relatorios_formato_exportacao: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="ambos">PDF e Excel (Recomendado)</option>
                    <option value="pdf">Apenas PDF Oficial</option>
                    <option value="excel">Apenas Planilha Excel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Orientação de Impressão Padrão
                  </label>
                  <select
                    value={formData.relatorios_orientacao_padrao || 'retrato'}
                    onChange={(e) => setFormData({ ...formData, relatorios_orientacao_padrao: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  >
                    <option value="retrato">Retrato (Vertical - Padrão)</option>
                    <option value="paisagem">Paisagem (Horizontal - Ideal para Pautas)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 11: COMUNICADOS & NOTIFICAÇÕES                     */}
          {/* ======================================================== */}
          {activeSection === 'notificacoes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Canais de Notificação Ativos
                  </label>
                  <div className="flex flex-wrap gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer min-h-[38px]">
                      <input
                        type="checkbox"
                        checked={formData.notificacoes_canais?.email !== false}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificacoes_canais: { ...(prev.notificacoes_canais || { email: true, push: true, sistema: true }), email: e.target.checked }
                        }))}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>E-mail Corporativo</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer min-h-[38px]">
                      <input
                        type="checkbox"
                        checked={formData.notificacoes_canais?.push !== false}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificacoes_canais: { ...(prev.notificacoes_canais || { email: true, push: true, sistema: true }), push: e.target.checked }
                        }))}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Notificações Push no Navegador</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer min-h-[38px]">
                      <input
                        type="checkbox"
                        checked={formData.notificacoes_canais?.sistema !== false}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificacoes_canais: { ...(prev.notificacoes_canais || { email: true, push: true, sistema: true }), sistema: e.target.checked }
                        }))}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Painel de Notificações do Sistema</span>
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Modelo de Mensagem de Ausência / Falta aos Pais
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notificacoes_modelo_falta || 'Exmo(a) Encarregado(a), informamos que o(a) educando(a) faltou à aula programada.'}
                    onChange={(e) => setFormData({ ...formData, notificacoes_modelo_falta: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Modelo de Mensagem de Lembrete Financeiro
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notificacoes_modelo_cobranca || 'Exmo(a) Encarregado(a), lembramos que a mensalidade vence no dia previsto. Agradecemos a regularização.'}
                    onChange={(e) => setFormData({ ...formData, notificacoes_modelo_cobranca: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 12: SERVIDOR DE E-MAIL (SMTP)                      */}
          {/* ======================================================== */}
          {activeSection === 'smtp' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, smtp_provider: 'system' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    (formData.smtp_provider || 'system') === 'system'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5" /> Provedor do Sistema (Global)
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Usa o servidor SMTP padrão configurado para a plataforma.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, smtp_provider: 'custom' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    formData.smtp_provider === 'custom'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" /> Servidor Próprio / Gmail da Escola
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Configure o e-mail oficial próprio da sua instituição.</p>
                </button>
              </div>

              {formData.smtp_provider === 'custom' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, smtp_type: 'manual' }))}
                      className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all min-h-[44px] ${
                        (formData.smtp_type || 'manual') !== 'gmail'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Configuração Manual (Host / Porta)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        smtp_type: 'gmail',
                        smtp_host: 'smtp.gmail.com',
                        smtp_port: 465,
                        smtp_secure: true
                      }))}
                      className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all min-h-[44px] ${
                        formData.smtp_type === 'gmail'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Google Gmail
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">E-mail Remetente</label>
                      <input
                        type="email"
                        value={formData.smtp_sender_email || ''}
                        onChange={(e) => setFormData({ ...formData, smtp_sender_email: e.target.value })}
                        placeholder="notificacoes@escola.edu"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Nome de Exibição</label>
                      <input
                        type="text"
                        value={formData.smtp_sender_name || ''}
                        onChange={(e) => setFormData({ ...formData, smtp_sender_name: e.target.value })}
                        placeholder="Secretaria Escolar"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO 13: SEGURANÇA & PERMISSÕES                         */}
          {/* ======================================================== */}
          {activeSection === 'seguranca' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Comprimento Mínimo de Senha
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={20}
                    value={formData.tamanho_minimo_senha ?? 8}
                    onChange={(e) => setFormData({ ...formData, tamanho_minimo_senha: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Exigido ao criar ou redefinir credenciais de acesso.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Tempo Limite de Inatividade da Sessão (Minutos)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    value={formData.tempo_inatividade_sessao_minutos ?? 60}
                    onChange={(e) => setFormData({ ...formData, tempo_inatividade_sessao_minutos: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Encerra a sessão do usuário caso permaneça ocioso.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Tentativas Máximas de Login Falhadas
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={formData.tentativas_maximas_login ?? 5}
                    onChange={(e) => setFormData({ ...formData, tentativas_maximas_login: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Bloqueia temporariamente após tentativas incorretas.</p>
                </div>

                <div className="flex items-center gap-2.5 pt-6">
                  <input
                    type="checkbox"
                    id="troca_pwd"
                    checked={formData.exigir_alteracao_primeiro_login !== false}
                    onChange={(e) => setFormData({ ...formData, exigir_alteracao_primeiro_login: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="troca_pwd" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Forçar alteração de senha no primeiro login de novo utilizador
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE AVISO DE CONFLITO COM AULAS (TAREFA 3) */}
      {conflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Atenção: Conflito Detectado com Aulas Agendadas!
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Os novos intervalos de horário definidos colidem com as seguintes aulas já cadastradas na grade:
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 font-medium">
              {conflictsList.map((c, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Deseja salvar as configurações mesmo assim? As aulas em conflito continuarão registradas, mas novas aulas não poderão ser criadas durante os intervalos.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 min-h-[44px]"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm min-h-[44px]"
              >
                {isSaving ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
