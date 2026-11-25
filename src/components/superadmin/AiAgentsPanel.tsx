import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Plus,
  Search,
  Edit3,
  Trash2,
  Play,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  BookOpen,
  GitBranch,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import type {
  SupportAgentStatus,
  SupportAiAgentWithConfig,
  SupportAiExecutionMode,
  SupportAiModel,
  SupportAiProviderStatus,
  SupportAiSandboxResult,
  SupportDepartment,
} from '../../types';
import type { SupportContextSnapshot } from './AssistantManagementModule';

interface AiAgentsPanelProps {
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

function getStatusClasses(estado: SupportAgentStatus): string {
  switch (estado) {
    case 'activo':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'inactivo':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'suspenso':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'arquivado':
    default:
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
  }
}

export const AiAgentsPanel: React.FC<AiAgentsPanelProps> = ({
  supportContext,
  departments,
  showNotification,
  tenantsList = [],
}) => {
  const { t } = useTranslation('common');
  const canConfigureAi = Boolean(supportContext?.isSuperAdmin || supportContext?.permissions?.configurar_ia);

  const [items, setItems] = useState<SupportAiAgentWithConfig[]>([]);
  const [providerStatus, setProviderStatus] = useState<SupportAiProviderStatus>({
    geminiConfigured: false,
    n8nSecretConfigured: false,
    defaultModel: 'gemini-4-hydrogen',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | SupportAgentStatus>('todos');
  const [filterDept, setFilterDept] = useState('todos');

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupportAiAgentWithConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formAuthDepts, setFormAuthDepts] = useState<string[]>([]);
  const [formFallbackDeptId, setFormFallbackDeptId] = useState('');
  const [formEstado, setFormEstado] = useState<SupportAgentStatus>('activo');
  const [formModelo, setFormModelo] = useState<SupportAiModel>('gemini-4-hydrogen');
  const [formModo, setFormModo] = useState<SupportAiExecutionMode>('gemini_direct');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formPersonalidade, setFormPersonalidade] = useState('Profissional, objectivo e claro');
  const [formPrompt, setFormPrompt] = useState(
    'Atue como assistente oficial do Sistema de Gestão Escolar (SGE). Responda com rigor técnico, passos práticos e nunca invente dados académicos ou financeiros.'
  );
  const [formThreshold, setFormThreshold] = useState(0.7);
  const [formMaxTurns, setFormMaxTurns] = useState(4);
  const [formFaqOnly, setFormFaqOnly] = useState(true);
  const [formAutoReply, setFormAutoReply] = useState(false);
  const [formKeywords, setFormKeywords] = useState('humano, urgente, reclamação, falar com atendente');

  // Sandbox Modal
  const [sandboxItem, setSandboxItem] = useState<SupportAiAgentWithConfig | null>(null);
  const [sbSubject, setSbSubject] = useState('Dúvida sobre emissão de recibo');
  const [sbTenantId, setSbTenantId] = useState('global');
  const [sbRole, setSbRole] = useState('tenant_admin');
  const [sbMessage, setSbMessage] = useState('');
  const [sbRunning, setSbRunning] = useState(false);
  const [sbError, setSbError] = useState('');
  const [sbResult, setSbResult] = useState<SupportAiSandboxResult | null>(null);

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const activeDepartments = useMemo(() => departments.filter((d) => d.ativo), [departments]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (filterEstado !== 'todos') params.set('estado', filterEstado);
      if (filterDept !== 'todos') params.set('departamento_id', filterDept);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/ai-agents?${params.toString()}`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar agentes IA.');

      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.providerStatus) setProviderStatus(data.providerStatus);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar agentes IA.');
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterDept, searchQuery]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const openCreateModal = () => {
    const defaultDept = activeDepartments.find((d) => d.padrao)?.id || activeDepartments[0]?.id || '';
    setEditingItem(null);
    setFormNome('');
    setFormEmail('');
    setFormDeptId(defaultDept);
    setFormAuthDepts(defaultDept ? [defaultDept] : []);
    setFormFallbackDeptId(defaultDept);
    setFormEstado('activo');
    setFormModelo('gemini-4-hydrogen');
    setFormModo('gemini_direct');
    setFormWebhookUrl('');
    setFormPersonalidade('Profissional, objectivo e claro');
    setFormPrompt(
      'Atue como assistente oficial do Sistema de Gestão Escolar (SGE). Responda com rigor técnico, passos práticos e nunca invente dados académicos ou financeiros.'
    );
    setFormThreshold(0.7);
    setFormMaxTurns(4);
    setFormFaqOnly(true);
    setFormAutoReply(false);
    setFormKeywords('humano, urgente, reclamação, falar com atendente');
    setErrorMsg('');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupportAiAgentWithConfig) => {
    const { agent, config } = item;
    setEditingItem(item);
    setFormNome(agent.nome);
    setFormEmail(agent.email || '');
    setFormDeptId(agent.departamento_id);
    setFormAuthDepts(agent.departamentos_autorizados || [agent.departamento_id]);
    setFormFallbackDeptId(config.fallback_departamento_id || agent.departamento_id);
    setFormEstado(agent.estado);
    setFormModelo(config.modelo || 'gemini-4-hydrogen');
    setFormModo(config.modo_execucao || 'gemini_direct');
    setFormWebhookUrl(config.n8n_webhook_url || '');
    setFormPersonalidade(config.personalidade || 'Profissional, objectivo e claro');
    setFormPrompt(config.prompt_sistema || '');
    setFormThreshold(Number(config.limiar_confianca ?? 0.7));
    setFormMaxTurns(Number(config.max_turnos_ia ?? 4));
    setFormFaqOnly(config.usar_apenas_faq_autorizada !== false);
    setFormAutoReply(Boolean(config.auto_responder_tickets));
    setFormKeywords((config.palavras_chave_escalonamento || []).join(', '));
    setErrorMsg('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formDeptId) {
      setModalError('Preencha o nome e o departamento principal do agente IA.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setModalError('');
    try {
      const keywords = formKeywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);

      const payload: Record<string, any> = {
        nome: formNome.trim(),
        departamento_id: formDeptId,
        departamentos_autorizados: Array.from(new Set([formDeptId, ...formAuthDepts])),
        fallback_departamento_id: formFallbackDeptId || formDeptId,
        estado: formEstado,
        modelo: formModelo,
        modo_execucao: formModo,
        n8n_webhook_url: formWebhookUrl.trim(),
        personalidade: formPersonalidade.trim(),
        prompt_sistema: formPrompt.trim(),
        limiar_confianca: Number(formThreshold),
        max_turnos_ia: Number(formMaxTurns),
        usar_apenas_faq_autorizada: formFaqOnly,
        auto_responder_tickets: formAutoReply,
        palavras_chave_escalonamento: keywords,
      };
      if (formEmail.trim()) {
        payload.email = formEmail.trim().toLowerCase();
      }

      const headers = await buildAdminHeaders(
        true,
        editingItem ? undefined : `ai_agent_${Date.now()}_${formNome.trim().slice(0, 12)}`
      );

      const url = editingItem
        ? `/api/superadmin/assistant/ai-agents/${editingItem.agent.id}`
        : '/api/superadmin/assistant/ai-agents';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao guardar agente IA.');

      setIsModalOpen(false);
      notify(editingItem ? 'Agente IA actualizado com sucesso.' : 'Agente IA criado com sucesso.', 'sucesso');
      await fetchAgents();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao guardar agente IA.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: SupportAiAgentWithConfig, nextStatus: SupportAgentStatus) => {
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/ai-agents/${item.agent.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ estado: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar estado do agente IA.');
      notify(`Agente IA actualizado para ${t(`assistant.status_${nextStatus}`)}.`, 'sucesso');
      await fetchAgents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao actualizar estado.');
    }
  };

  const handleDeleteAgent = async (item: SupportAiAgentWithConfig) => {
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/ai-agents/${item.agent.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível eliminar o agente IA.');
      notify('Agente IA eliminado com sucesso.', 'sucesso');
      await fetchAgents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao eliminar agente IA.');
    }
  };

  const openSandbox = (item: SupportAiAgentWithConfig) => {
    setSandboxItem(item);
    setSbSubject('Dúvida sobre sistema SGE');
    setSbTenantId(tenantsList[0]?.id || 'global');
    setSbRole('tenant_admin');
    setSbMessage('');
    setSbError('');
    setSbResult(null);
  };

  const isSandboxProviderReady = useMemo(() => {
    if (!sandboxItem) return false;
    const mode = sandboxItem.config.modo_execucao;
    const hasWebhook = Boolean(sandboxItem.config.n8n_webhook_url?.trim());
    if (mode === 'n8n_webhook') {
      return providerStatus.n8nSecretConfigured && hasWebhook;
    }
    if (mode === 'hibrido') {
      return providerStatus.geminiConfigured || (providerStatus.n8nSecretConfigured && hasWebhook);
    }
    return providerStatus.geminiConfigured;
  }, [sandboxItem, providerStatus]);

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxItem || !sbMessage.trim()) return;
    if (!isSandboxProviderReady) {
      setSbError(t('aiAgents.sandbox_provider_unavailable'));
      return;
    }
    setSbRunning(true);
    setSbError('');
    setSbResult(null);

    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/ai-agents/${sandboxItem.agent.id}/test`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          assunto: sbSubject.trim(),
          tenant_id: sbTenantId,
          role: sbRole,
          mensagem: sbMessage.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Falha ao executar teste IA.');
      setSbResult(data.result || null);
    } catch (err: any) {
      setSbError(err.message || 'Erro na execução do teste IA.');
    } finally {
      setSbRunning(false);
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
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Server Integration Status Strip (Read-Only Env Readiness — ZERO key inputs) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('aiAgents.env_status_title')}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('aiAgents.env_security_note')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              providerStatus.geminiConfigured
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}
          >
            {providerStatus.geminiConfigured ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>
              {providerStatus.geminiConfigured ? t('aiAgents.env_gemini_ready') : t('aiAgents.env_gemini_missing')}
            </span>
          </span>

          <span
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              providerStatus.n8nSecretConfigured
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            <span>
              {providerStatus.n8nSecretConfigured ? t('aiAgents.env_n8n_ready') : t('aiAgents.env_n8n_missing')}
            </span>
          </span>
        </div>
      </div>

      {/* Filters + Create Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('aiAgents.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as any)}
            className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('aiAgents.all_statuses')}</option>
            <option value="activo">{t('assistant.status_activo')}</option>
            <option value="inactivo">{t('assistant.status_inactivo')}</option>
            <option value="arquivado">{t('assistant.status_arquivado')}</option>
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('aiAgents.all_departments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchAgents()}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canConfigureAi && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('aiAgents.new_agent')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Agents Grid */}
      {loading && items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-14 text-center text-xs text-slate-500">
          {t('loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('aiAgents.empty_title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{t('aiAgents.empty_subtitle')}</p>
          {canConfigureAi && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('aiAgents.new_agent')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const { agent, config } = item;
            return (
              <div
                key={agent.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{agent.nome}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getStatusClasses(
                          agent.estado
                        )}`}
                      >
                        {t(`assistant.status_${agent.estado}`)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {agent.departamento_nome || 'Geral'} · {t(`aiAgents.mode_${config.modo_execucao}`)} ·{' '}
                      <span className="font-mono">{config.modelo}</span>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{config.prompt_sistema}</p>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400">{t('aiAgents.kpi_confidence')}</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {Math.round(config.limiar_confianca * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">{t('aiAgents.kpi_max_turns')}</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {config.max_turnos_ia}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">{t('aiAgents.kpi_interactions')}</p>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums mt-0.5">
                      {config.total_interacoes}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">{t('aiAgents.kpi_escalations')}</p>
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                      {config.total_escalonamentos}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>
                      {config.usar_apenas_faq_autorizada ? t('aiAgents.faq_only_on') : t('aiAgents.faq_only_off')}
                    </span>
                    <span>·</span>
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>{config.fallback_departamento_nome || agent.departamento_nome}</span>
                  </div>

                  {canConfigureAi && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openSandbox(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1 hover:bg-indigo-100 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>{t('aiAgents.action_test')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{t('assistant.action_edit')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleStatus(item, agent.estado === 'activo' ? 'inactivo' : 'activo')
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {agent.estado === 'activo' ? t('aiAgents.action_pause') : t('aiAgents.action_activate')}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteAgent(item)}
                        title={t('assistant.action_delete')}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT AI AGENT MODAL */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingItem ? t('aiAgents.edit_agent') : t('aiAgents.new_agent')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalError('');
                  setIsModalOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError('')}
                  className="text-rose-600 hover:text-rose-800 dark:text-rose-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAgent} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex.: Assistente Virtual Académico"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_email')}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ia-suporte@sge.local"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_department')}
                  </label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
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
                    {t('aiAgents.field_fallback_dept')}
                  </label>
                  <select
                    value={formFallbackDeptId}
                    onChange={(e) => setFormFallbackDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
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
                    {t('aiAgents.field_status')}
                  </label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value as SupportAgentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="activo">{t('assistant.status_activo')}</option>
                    <option value="inactivo">{t('assistant.status_inactivo')}</option>
                    <option value="arquivado">{t('assistant.status_arquivado')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_mode')}
                  </label>
                  <select
                    value={formModo}
                    onChange={(e) => setFormModo(e.target.value as SupportAiExecutionMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="gemini_direct">{t('aiAgents.mode_gemini_direct')}</option>
                    <option value="n8n_webhook">{t('aiAgents.mode_n8n_webhook')}</option>
                    <option value="hibrido">{t('aiAgents.mode_hibrido')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_model')}
                  </label>
                  <select
                    value={formModelo}
                    onChange={(e) => setFormModelo(e.target.value as SupportAiModel)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="gemini-4-hydrogen">{t('aiAgents.model_hydrogen')}</option>
                    <option value="gemini-3.1-flash-lite">{t('aiAgents.model_flash_lite')}</option>
                  </select>
                </div>
              </div>

              {(formModo === 'n8n_webhook' || formModo === 'hibrido') && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_webhook_url')}
                  </label>
                  <input
                    type="url"
                    required
                    value={formWebhookUrl}
                    onChange={(e) => setFormWebhookUrl(e.target.value)}
                    placeholder="https://n8n.instituicao.example/webhook/sge-suporte"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{t('aiAgents.field_webhook_hint')}</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('aiAgents.field_personality')}
                </label>
                <input
                  type="text"
                  value={formPersonalidade}
                  onChange={(e) => setFormPersonalidade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('aiAgents.field_system_prompt')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_confidence_threshold')}:{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {Math.round(formThreshold * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={0.95}
                    step={0.05}
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.field_max_turns')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formMaxTurns}
                    onChange={(e) => setFormMaxTurns(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('aiAgents.field_keywords')}
                </label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFaqOnly}
                    onChange={(e) => setFormFaqOnly(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{t('aiAgents.field_faq_only')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoReply}
                    onChange={(e) => setFormAutoReply(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {t('aiAgents.field_auto_reply')}
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
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving ? t('loading') : t('assistant.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SANDBOX TEST MODAL */}
      {sandboxItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSandboxItem(null);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('aiAgents.sandbox_title')}</h3>
                <p className="text-[11px] text-slate-500">{sandboxItem.agent.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setSandboxItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">{t('aiAgents.sandbox_subtitle')}</p>

            {!isSandboxProviderReady && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t('aiAgents.sandbox_provider_unavailable')}</span>
              </div>
            )}

            <form onSubmit={handleRunSandbox} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.sandbox_tenant')}
                  </label>
                  <select
                    value={sbTenantId}
                    onChange={(e) => setSbTenantId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="global">Global (Todas as instituições)</option>
                    {tenantsList.map((tn) => (
                      <option key={tn.id} value={tn.id}>
                        {tn.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiAgents.sandbox_role')}
                  </label>
                  <select
                    value={sbRole}
                    onChange={(e) => setSbRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="tenant_admin">Administrador da Instituição</option>
                    <option value="docente">Docente / Professor</option>
                    <option value="estudante">Estudante</option>
                    <option value="encarregado">Encarregado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('aiAgents.sandbox_subject')}
                </label>
                <input
                  type="text"
                  value={sbSubject}
                  onChange={(e) => setSbSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('aiAgents.sandbox_message')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={sbMessage}
                  onChange={(e) => setSbMessage(e.target.value)}
                  placeholder={t('aiAgents.sandbox_message_placeholder')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sbRunning || !isSandboxProviderReady}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{sbRunning ? t('aiAgents.sandbox_running') : t('aiAgents.sandbox_run')}</span>
                </button>
              </div>
            </form>

            {sbError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {sbError}
              </div>
            )}

            {sbResult && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{t('aiAgents.sandbox_result_title')}</span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                    <span
                      className={`px-2 py-0.5 rounded-md border font-semibold ${
                        sbResult.escalonar_humano
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {sbResult.escalonar_humano ? t('aiAgents.sandbox_escalated') : t('aiAgents.sandbox_direct_reply')}
                    </span>
                    <span className="text-slate-500">
                      {t('aiAgents.sandbox_confidence')}: {Math.round(sbResult.confianca * 100)}%
                    </span>
                    <span className="text-slate-500">
                      {t('aiAgents.sandbox_latency')}: {sbResult.latencia_ms}ms
                    </span>
                  </div>
                </div>

                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {sbResult.resposta}
                </p>

                {sbResult.motivo_escalonamento && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Motivo do escalonamento: {sbResult.motivo_escalonamento}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {t('aiAgents.sandbox_faq_used')}:
                  </p>
                  {sbResult.artigos_faq_usados.length === 0 ? (
                    <p className="text-[11px] text-slate-500">{t('aiAgents.sandbox_no_faq')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {sbResult.artigos_faq_usados.map((ref) => (
                        <li key={ref.id} className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                          {ref.titulo} ({ref.categoria_nome || 'Geral'} · relevância {ref.score})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
