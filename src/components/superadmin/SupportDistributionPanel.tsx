import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  Plus,
  Search,
  Edit3,
  Trash2,
  Play,
  Sliders,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Bot,
  User,
  Pause,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import type {
  SupportAgent,
  SupportAiAgentWithConfig,
  SupportDepartment,
  SupportDistributionOverview,
  SupportDistributionRebalanceResult,
  SupportDistributionRule,
  SupportDistributionSimulationResult,
  SupportDistributionStrategy,
  SupportTicketPriority,
} from '../../types';
import type { SupportContextSnapshot } from './AssistantManagementModule';

interface SupportDistributionPanelProps {
  supportContext?: SupportContextSnapshot | null;
  departments: SupportDepartment[];
  showNotification?: (message: string, type?: 'sucesso' | 'erro' | 'info') => void;
  tenantsList?: Array<{ id: string; nome: string }>;
}

async function buildAdminHeaders(includeJson = true, idempotencyKey?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';

  const csrfToken = getCookie('sysedu_csrf_token') || localStorage.getItem('sysedu_csrf_token') || '';
  const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  if (sessId) headers['x-session-id'] = sessId;
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch {}
  }
  return headers;
}

const STRATEGIES: SupportDistributionStrategy[] = [
  'ia_primeiro',
  'round_robin',
  'menor_carga',
  'especialidade',
  'fila_departamento',
];

const PRIORITIES: SupportTicketPriority[] = ['baixa', 'normal', 'alta', 'urgente'];
const CHANNELS: Array<'portal' | 'superadmin' | 'ia'> = ['portal', 'superadmin', 'ia'];

export const SupportDistributionPanel: React.FC<SupportDistributionPanelProps> = ({
  supportContext,
  departments,
  showNotification,
  tenantsList = [],
}) => {
  const { t } = useTranslation('common');
  const canManage = Boolean(supportContext?.isSuperAdmin || supportContext?.permissions?.gerir_funcionarios);

  const [overview, setOverview] = useState<SupportDistributionOverview>({
    totalRegras: 0,
    regrasActivas: 0,
    ticketsSemResponsavel: 0,
    ticketsAlertasSla: 0,
    equipaOnlineDisponivel: 0,
    capacidadeLivreHumanos: 0,
    agentesIaActivos: 0,
  });
  const [rules, setRules] = useState<SupportDistributionRule[]>([]);
  const [humanStaff, setHumanStaff] = useState<SupportAgent[]>([]);
  const [aiAgents, setAiAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'true' | 'false'>('todos');

  // Rebalance banner state
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<SupportDistributionRebalanceResult | null>(null);

  // Rule Create / Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SupportDistributionRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formOrdem, setFormOrdem] = useState(10);
  const [formTenantId, setFormTenantId] = useState('global');
  const [formMetodo, setFormMetodo] = useState<SupportDistributionStrategy>('menor_carga');
  const [formDestDeptId, setFormDestDeptId] = useState('');
  const [formDestAgentId, setFormDestAgentId] = useState('');
  const [formCategorias, setFormCategorias] = useState('');
  const [formPrioridades, setFormPrioridades] = useState<SupportTicketPriority[]>([]);
  const [formCanais, setFormCanais] = useState<Array<'portal' | 'superadmin' | 'ia'>>([]);
  const [formPalavrasChave, setFormPalavrasChave] = useState('');
  const [formAutoExecIa, setFormAutoExecIa] = useState(true);
  const [formFallbackHuman, setFormFallbackHuman] = useState(true);
  const [formRespectSchedule, setFormRespectSchedule] = useState(true);
  const [formRequireOnline, setFormRequireOnline] = useState(true);
  const [formAllowBusy, setFormAllowBusy] = useState(false);
  const [formAtivo, setFormAtivo] = useState(true);

  // Simulator modal
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [simTenantId, setSimTenantId] = useState('global');
  const [simDeptId, setSimDeptId] = useState('');
  const [simCategoria, setSimCategoria] = useState('Geral');
  const [simPrioridade, setSimPrioridade] = useState<SupportTicketPriority>('normal');
  const [simCanal, setSimCanal] = useState<'portal' | 'superadmin' | 'ia'>('portal');
  const [simAssunto, setSimAssunto] = useState('Dúvida sobre emissão de recibo de propina');
  const [simMensagem, setSimMensagem] = useState('');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<SupportDistributionSimulationResult | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<SupportDistributionRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const activeDepartments = useMemo(() => departments.filter((d) => d.ativo), [departments]);

  const tenantNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of tenantsList) {
      m.set(item.id, item.nome);
    }
    return m;
  }, [tenantsList]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const params = new URLSearchParams();
      if (filterStatus !== 'todos') params.set('ativo', filterStatus);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const [ovRes, rulesRes, staffRes, aiRes] = await Promise.all([
        fetch('/api/superadmin/assistant/distribution/overview', { headers, credentials: 'include' }),
        fetch(`/api/superadmin/assistant/distribution/rules?${params.toString()}`, {
          headers,
          credentials: 'include',
        }),
        fetch('/api/superadmin/assistant/staff?page=1&pageSize=100', { headers, credentials: 'include' }),
        fetch('/api/superadmin/assistant/ai-agents', { headers, credentials: 'include' }),
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json().catch(() => null);
        if (ovData) setOverview(ovData);
      }

      const rulesData = await rulesRes.json().catch(() => ({}));
      if (!rulesRes.ok) {
        throw new Error(rulesData.error || rulesData.message || 'Erro ao carregar regras de distribuição.');
      }
      setRules(Array.isArray(rulesData.rules) ? rulesData.rules : []);

      const staffData = await staffRes.json().catch(() => ({}));
      if (!staffRes.ok) {
        throw new Error(staffData.error || staffData.message || 'Erro ao carregar funcionários de atendimento.');
      }
      setHumanStaff(Array.isArray(staffData.items) ? staffData.items : []);

      const aiData = await aiRes.json().catch(() => ({}));
      if (!aiRes.ok) {
        throw new Error(aiData.error || aiData.message || 'Erro ao carregar agentes IA.');
      }
      const aiItems: SupportAiAgentWithConfig[] = Array.isArray(aiData.items) ? aiData.items : [];
      setAiAgents(aiItems.map((entry) => entry.agent).filter(Boolean));
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar dados da distribuição automática.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setIsSimOpen(false);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectableAgents = useMemo(() => {
    const combined = [...aiAgents, ...humanStaff].filter((a) => a.estado === 'activo');
    if (!formDestDeptId) return combined;
    return combined.filter(
      (a) =>
        a.departamento_id === formDestDeptId ||
        (Array.isArray(a.departamentos_autorizados) && a.departamentos_autorizados.includes(formDestDeptId))
    );
  }, [aiAgents, humanStaff, formDestDeptId]);

  const openCreateModal = () => {
    const defaultDept = activeDepartments.find((d) => d.padrao)?.id || activeDepartments[0]?.id || '';
    setEditingRule(null);
    setFormNome('');
    setFormDescricao('');
    setFormOrdem((rules.length + 1) * 10);
    setFormTenantId('global');
    setFormMetodo('menor_carga');
    setFormDestDeptId(defaultDept);
    setFormDestAgentId('');
    setFormCategorias('');
    setFormPrioridades([]);
    setFormCanais([]);
    setFormPalavrasChave('');
    setFormAutoExecIa(true);
    setFormFallbackHuman(true);
    setFormRespectSchedule(true);
    setFormRequireOnline(true);
    setFormAllowBusy(false);
    setFormAtivo(true);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: SupportDistributionRule) => {
    setEditingRule(rule);
    setFormNome(rule.nome);
    setFormDescricao(rule.descricao || '');
    setFormOrdem(rule.ordem ?? 10);
    setFormTenantId(rule.tenant_id || 'global');
    setFormMetodo(rule.metodo || 'menor_carga');
    setFormDestDeptId(rule.destino_departamento_id);
    setFormDestAgentId(rule.destino_agent_id || '');
    setFormCategorias((rule.condicoes?.categorias || []).join(', '));
    setFormPrioridades(rule.condicoes?.prioridades || []);
    setFormCanais(rule.condicoes?.canais || []);
    setFormPalavrasChave((rule.condicoes?.palavras_chave || []).join(', '));
    setFormAutoExecIa(rule.auto_executar_ia !== false);
    setFormFallbackHuman(rule.escalonar_para_humano_se_ia_falhar !== false);
    setFormRespectSchedule(rule.respeitar_horario_atendimento !== false);
    setFormRequireOnline(rule.exigir_disponibilidade_online !== false);
    setFormAllowBusy(Boolean(rule.permitir_ocupado_se_sem_online));
    setFormAtivo(rule.ativo !== false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const togglePriority = (p: SupportTicketPriority) => {
    setFormPrioridades((prev) => (prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]));
  };

  const toggleChannel = (c: 'portal' | 'superadmin' | 'ia') => {
    setFormCanais((prev) => (prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]));
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formDestDeptId) {
      setErrorMsg('Preencha o nome da regra e seleccione o departamento de destino.');
      return;
    }
    setSavingRule(true);
    setErrorMsg('');
    try {
      const idemKey = editingRule ? undefined : `dist_rule_${Date.now()}_${formNome.trim()}`;
      const headers = await buildAdminHeaders(true, idemKey);

      const condicoes = {
        categorias: formCategorias
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        prioridades: formPrioridades,
        canais: formCanais,
        departamentos_origem: [],
        palavras_chave: formPalavrasChave
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const payload: Record<string, any> = {
        nome: formNome.trim(),
        descricao: formDescricao.trim(),
        ordem: Number(formOrdem) || 0,
        metodo: formMetodo,
        destino_departamento_id: formDestDeptId,
        destino_agent_id: formDestAgentId.trim() || null,
        condicoes,
        auto_executar_ia: formAutoExecIa,
        escalonar_para_humano_se_ia_falhar: formFallbackHuman,
        respeitar_horario_atendimento: formRespectSchedule,
        exigir_disponibilidade_online: formRequireOnline,
        permitir_ocupado_se_sem_online: formAllowBusy,
        ativo: formAtivo,
      };
      if (!editingRule) {
        payload.tenant_id = formTenantId || 'global';
      }

      const url = editingRule
        ? `/api/superadmin/assistant/distribution/rules/${editingRule.id}`
        : '/api/superadmin/assistant/distribution/rules';
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao guardar regra de distribuição.');

      setIsModalOpen(false);
      notify(editingRule ? 'Regra actualizada com sucesso.' : 'Regra criada com sucesso.', 'sucesso');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao guardar regra de distribuição.');
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleActive = async (rule: SupportDistributionRule) => {
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/distribution/rules/${rule.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ ativo: !rule.ativo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar estado da regra.');
      notify(rule.ativo ? 'Regra pausada.' : 'Regra activada.', 'sucesso');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao actualizar estado da regra.');
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/distribution/rules/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao eliminar regra.');
      setDeleteTarget(null);
      notify('Regra de distribuição eliminada.', 'sucesso');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível eliminar a regra.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRebalanceNow = async () => {
    if (rebalancing) return;
    setRebalancing(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch('/api/superadmin/assistant/distribution/rebalance', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          incluir_alertas_sla: true,
          reatribuir_offline: true,
          dry_run: false,
          limite: 50,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao balancear filas.');
      setRebalanceResult(data as SupportDistributionRebalanceResult);
      notify(
        t('distribution.rebalance_done', {
          assigned: Number(data.atribuidos || 0),
          sla: Number(data.escalonados_sla || 0),
          skipped: Number(data.sem_elegivel || 0),
        }),
        'sucesso'
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar balanceamento das filas.');
    } finally {
      setRebalancing(false);
    }
  };

  const openSimulator = () => {
    setSimDeptId(activeDepartments[0]?.id || '');
    setSimResult(null);
    setErrorMsg('');
    setIsSimOpen(true);
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simAssunto.trim()) return;
    setSimRunning(true);
    setSimResult(null);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch('/api/superadmin/assistant/distribution/simulate', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          tenant_id: simTenantId || 'global',
          categoria: simCategoria.trim() || 'Geral',
          prioridade: simPrioridade,
          canal: simCanal,
          departamento_id: simDeptId || '',
          assunto: simAssunto.trim(),
          mensagem: simMensagem.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao simular roteamento.');
      setSimResult(data as SupportDistributionSimulationResult);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro na simulação de roteamento.');
    } finally {
      setSimRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 hover:opacity-70 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {rebalanceResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300 tabular-nums">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {t('distribution.rebalance_done', {
                  assigned: rebalanceResult.atribuidos,
                  sla: rebalanceResult.escalonados_sla,
                  skipped: rebalanceResult.sem_elegivel,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRebalanceResult(null)}
              className="p-1 text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {rebalanceResult.detalhes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {rebalanceResult.detalhes.slice(0, 6).map((item) => (
                <div
                  key={item.ticket_id}
                  className="bg-white/80 dark:bg-slate-900/70 border border-emerald-200/80 dark:border-emerald-800/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-slate-900 dark:text-white mr-2 tabular-nums">
                      {item.codigo}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 truncate">{item.motivo}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">{item.departamento_nome}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('distribution.kpi_rules')}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {overview.regrasActivas}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('distribution.kpi_rules_sub', { total: overview.totalRegras })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('distribution.kpi_unassigned')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {overview.ticketsSemResponsavel}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('distribution.kpi_unassigned_sub', { sla: overview.ticketsAlertasSla })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('distribution.kpi_online_team')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {overview.equipaOnlineDisponivel}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {t('distribution.kpi_online_sub', { capacity: overview.capacidadeLivreHumanos })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('distribution.kpi_ai_ready')}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 tabular-nums">
            {overview.agentesIaActivos}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t('distribution.kpi_ai_sub')}</p>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('distribution.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'todos' | 'true' | 'false')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('distribution.filter_all_states')}</option>
            <option value="true">{t('distribution.filter_active')}</option>
            <option value="false">{t('distribution.filter_inactive')}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openSimulator}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('distribution.simulate_btn')}</span>
          </button>

          {canManage && (
            <button
              type="button"
              disabled={rebalancing}
              onClick={() => void handleRebalanceNow()}
              className="px-3.5 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rebalancing ? 'animate-spin' : ''}`} />
              <span>{rebalancing ? t('distribution.rebalancing') : t('distribution.rebalance_btn')}</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('distribution.new_rule')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading && rules.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">{t('loading')}</div>
        ) : rules.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center mx-auto">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('distribution.empty_title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t('distribution.empty_subtitle')}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('distribution.new_rule')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((rule) => {
              const scopeLabel =
                rule.tenant_id === 'global'
                  ? 'Global'
                  : tenantNameMap.get(rule.tenant_id) || rule.tenant_id;

              const conditionParts: string[] = [];
              if (rule.condicoes?.categorias?.length) {
                conditionParts.push(`Categorias: ${rule.condicoes.categorias.join(', ')}`);
              }
              if (rule.condicoes?.prioridades?.length) {
                conditionParts.push(`Prioridades: ${rule.condicoes.prioridades.join(', ')}`);
              }
              if (rule.condicoes?.canais?.length) {
                conditionParts.push(`Canais: ${rule.condicoes.canais.join(', ')}`);
              }
              if (rule.condicoes?.palavras_chave?.length) {
                conditionParts.push(`Termos: ${rule.condicoes.palavras_chave.join(', ')}`);
              }

              return (
                <div
                  key={rule.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {t('distribution.order_label', { order: rule.ordem })}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                          rule.ativo
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {rule.ativo ? 'Activa' : 'Pausada'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rule.nome}</h4>
                    </div>

                    {rule.descricao && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{rule.descricao}</p>
                    )}

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {t(`distribution.strategy_${rule.metodo}`)} · Fila:{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {rule.destino_departamento_nome || rule.destino_departamento_id}
                      </span>
                      {rule.destino_agent_nome ? ` · Preferencial: ${rule.destino_agent_nome}` : ''} · Escopo:{' '}
                      {scopeLabel} · {t('distribution.assignments_count', { count: rule.total_atribuicoes || 0 })}
                    </p>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {conditionParts.length > 0
                        ? conditionParts.join(' · ')
                        : 'Aplica-se a todos os pedidos sem filtro restritivo'}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(rule)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        {rule.ativo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{rule.ativo ? t('distribution.action_pause') : t('distribution.action_activate')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(rule)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={t('distribution.edit_rule')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(rule)}
                        className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        title={t('assistant.action_delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: CREATE / EDIT RULE */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRule ? t('distribution.edit_rule') : t('distribution.new_rule')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_order')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={formOrdem}
                    onChange={(e) => setFormOrdem(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('distribution.field_description')}
                </label>
                <input
                  type="text"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_strategy')}
                  </label>
                  <select
                    value={formMetodo}
                    onChange={(e) => setFormMetodo(e.target.value as SupportDistributionStrategy)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s} value={s}>
                        {t(`distribution.strategy_${s}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_tenant')}
                  </label>
                  <select
                    value={formTenantId}
                    disabled={Boolean(editingRule)}
                    onChange={(e) => setFormTenantId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="global">Todas as instituições (Global)</option>
                    {tenantsList.map((tn) => (
                      <option key={tn.id} value={tn.id}>
                        {tn.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_target_dept')}
                  </label>
                  <select
                    required
                    value={formDestDeptId}
                    onChange={(e) => setFormDestDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Seleccione --</option>
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_target_agent')}
                  </label>
                  <select
                    value={formDestAgentId}
                    onChange={(e) => setFormDestAgentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">{t('distribution.field_target_agent_auto')}</option>
                    {selectableAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.tipo === 'ia' ? `[IA] ${a.nome}` : `${a.nome} (${a.disponibilidade})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_categories')}
                  </label>
                  <input
                    type="text"
                    value={formCategorias}
                    onChange={(e) => setFormCategorias(e.target.value)}
                    placeholder="Ex.: Financeiro, Propina, Matrículas"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('distribution.field_priorities')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRIORITIES.map((p) => (
                        <label
                          key={p}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formPrioridades.includes(p)}
                            onChange={() => togglePriority(p)}
                            className="w-3.5 h-3.5 accent-indigo-600"
                          />
                          <span>{t(`helpdesk.priority_${p}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('distribution.field_channels')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNELS.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formCanais.includes(c)}
                            onChange={() => toggleChannel(c)}
                            className="w-3.5 h-3.5 accent-indigo-600"
                          />
                          <span className="uppercase">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_keywords')}
                  </label>
                  <input
                    type="text"
                    value={formPalavrasChave}
                    onChange={(e) => setFormPalavrasChave(e.target.value)}
                    placeholder="Ex.: recibo, boleto, senha, bloqueado"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                {formMetodo === 'ia_primeiro' && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAutoExecIa}
                        onChange={(e) => setFormAutoExecIa(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{t('distribution.field_auto_exec_ia')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formFallbackHuman}
                        onChange={(e) => setFormFallbackHuman(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        {t('distribution.field_fallback_human')}
                      </span>
                    </label>
                  </>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRespectSchedule}
                    onChange={(e) => setFormRespectSchedule(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {t('distribution.field_respect_schedule')}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequireOnline}
                    onChange={(e) => setFormRequireOnline(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t('distribution.field_require_online')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAllowBusy}
                    onChange={(e) => setFormAllowBusy(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t('distribution.field_allow_busy')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAtivo}
                    onChange={(e) => setFormAtivo(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    {t('distribution.field_active')}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingRule ? t('loading') : t('assistant.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ROUTING SIMULATOR */}
      {isSimOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSimOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('distribution.sim_title')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('distribution.sim_subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSimOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_tenant')}
                  </label>
                  <select
                    value={simTenantId}
                    onChange={(e) => setSimTenantId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="global">Global</option>
                    {tenantsList.map((tn) => (
                      <option key={tn.id} value={tn.id}>
                        {tn.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.field_target_dept')}
                  </label>
                  <select
                    value={simDeptId}
                    onChange={(e) => setSimDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.sim_channel')}
                  </label>
                  <select
                    value={simCanal}
                    onChange={(e) => setSimCanal(e.target.value as 'portal' | 'superadmin' | 'ia')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.sim_subject')}
                  </label>
                  <input
                    type="text"
                    required
                    value={simAssunto}
                    onChange={(e) => setSimAssunto(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={simCategoria}
                    onChange={(e) => setSimCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('distribution.sim_message')}
                  </label>
                  <input
                    type="text"
                    value={simMensagem}
                    onChange={(e) => setSimMensagem(e.target.value)}
                    placeholder="Texto inicial opcional para avaliação de palavras-chave"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Prioridade</label>
                  <select
                    value={simPrioridade}
                    onChange={(e) => setSimPrioridade(e.target.value as SupportTicketPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {t(`helpdesk.priority_${p}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={simRunning}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{simRunning ? t('distribution.sim_running') : t('distribution.sim_run')}</span>
                </button>
              </div>

              {simResult && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                      <p className="text-[11px] font-medium text-slate-500">{t('distribution.sim_result_rule')}</p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {simResult.matched_rule ? simResult.matched_rule.nome : t('distribution.sim_result_none')}
                      </p>
                      {simResult.matched_rule && (
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {t('distribution.order_label', { order: simResult.matched_rule.ordem })} ·{' '}
                          {t(`distribution.strategy_${simResult.matched_rule.metodo}`)}
                        </p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                      <p className="text-[11px] font-medium text-slate-500">{t('distribution.sim_result_assignee')}</p>
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {simResult.responsavel_selecionado ? (
                          <>
                            {simResult.responsavel_selecionado.tipo === 'ia' ? (
                              <Bot className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span>{simResult.responsavel_selecionado.nome}</span>
                          </>
                        ) : (
                          <span>{t('distribution.sim_result_unassigned')}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">Fila: {simResult.destino_departamento_nome}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    {simResult.motivo}
                  </div>

                  {simResult.candidatos_avaliados.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('distribution.sim_candidates')}
                      </p>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Agente</th>
                              <th className="px-3 py-2 font-semibold">Tipo</th>
                              <th className="px-3 py-2 font-semibold">Estado</th>
                              <th className="px-3 py-2 font-semibold">Carga</th>
                              <th className="px-3 py-2 font-semibold">Elegibilidade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {simResult.candidatos_avaliados.map((c) => (
                              <tr key={`${c.tipo}_${c.agent_id}`}>
                                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{c.nome}</td>
                                <td className="px-3 py-2 uppercase text-slate-500">{c.tipo}</td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.disponibilidade}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {c.carga_actual}/{c.limite_simultaneo}
                                </td>
                                <td className="px-3 py-2">
                                  {c.elegivel ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Elegível</span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400">
                                      {c.motivo_exclusao || 'Excluído'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('assistant.delete_confirm_title')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem a certeza que deseja eliminar a regra "{deleteTarget.nome}"? Esta operação será registada nos logs de
              auditoria.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {t('assistant.action_cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteRule}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {deleting ? t('loading') : t('assistant.action_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportDistributionPanel;
