import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Plus,
  RefreshCw,
  Send,
  Paperclip,
  ArrowRightLeft,
  CheckCircle2,
  RotateCcw,
  Lock,
  AlertTriangle,
  Clock,
  FileText,
  Image as ImageIcon,
  Download,
  X,
  Star,
  ChevronLeft,
  ChevronRight,
  Inbox,
  History,
  Bot,
  GitBranch,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import type {
  SupportAgent,
  SupportAssignmentRecord,
  SupportAttachment,
  SupportDepartment,
  SupportEvent,
  SupportMessage,
  SupportMessageType,
  SupportRating,
  SupportTicket,
  SupportTicketInboxSummary,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../types';
import type { SupportContextSnapshot } from './AssistantManagementModule';

interface SupportInboxPanelProps {
  supportContext?: SupportContextSnapshot | null;
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler ficheiro.'));
    reader.readAsDataURL(file);
  });
}

function getTicketStatusClasses(status: SupportTicketStatus): string {
  switch (status) {
    case 'aberto':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
    case 'em_atendimento':
      return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
    case 'pendente':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'resolvido':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'reaberto':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
  }
}

function getPriorityClasses(priority: SupportTicketPriority): string {
  switch (priority) {
    case 'urgente':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
    case 'alta':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'normal':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'baixa':
    default:
      return 'bg-slate-500/5 text-slate-500 dark:text-slate-400 border-slate-500/20';
  }
}

export const SupportInboxPanel: React.FC<SupportInboxPanelProps> = ({
  supportContext,
  showNotification,
  tenantsList = [],
}) => {
  const { t } = useTranslation('common');

  const canRespond = Boolean(supportContext?.isSuperAdmin || supportContext?.permissions?.responder);
  const canTransfer = Boolean(supportContext?.isSuperAdmin || supportContext?.permissions?.transferir);
  const canClose = Boolean(supportContext?.isSuperAdmin || supportContext?.permissions?.encerrar);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [summary, setSummary] = useState<SupportTicketInboxSummary>({
    total: 0,
    abertos: 0,
    emAtendimento: 0,
    pendentes: 0,
    resolvidos: 0,
    reabertos: 0,
    alertasSla: 0,
    semResposta: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [staffList, setStaffList] = useState<SupportAgent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | SupportTicketStatus>('todos');
  const [filterPriority, setFilterPriority] = useState<'todas' | SupportTicketPriority>('todas');
  const [filterDept, setFilterDept] = useState('todos');
  const [filterAssignee, setFilterAssignee] = useState('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Ticket Thread State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [assignments, setAssignments] = useState<SupportAssignmentRecord[]>([]);
  const [events, setEvents] = useState<SupportEvent[]>([]);
  const [rating, setRating] = useState<SupportRating | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  // Composer State
  const [replyMode, setReplyMode] = useState<SupportMessageType>('mensagem');
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [invokingAi, setInvokingAi] = useState(false);
  const [autoDistributing, setAutoDistributing] = useState(false);

  // Transfer Modal State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferDeptId, setTransferDeptId] = useState('');
  const [transferAgentId, setTransferAgentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

  // Create Ticket Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Geral');
  const [newDeptId, setNewDeptId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState<SupportTicketPriority>('normal');
  const [newMessage, setNewMessage] = useState('');
  const [newSolicitanteNome, setNewSolicitanteNome] = useState('');
  const [newSolicitanteEmail, setNewSolicitanteEmail] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Attachment Preview Modal (for images)
  const [previewImage, setPreviewImage] = useState<{ nome: string; url: string } | null>(null);

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const loadMetadata = useCallback(async () => {
    try {
      const headers = await buildAdminHeaders(false);
      const [deptRes, staffRes, metaRes] = await Promise.all([
        fetch('/api/superadmin/assistant/departments?includeInactive=false', { headers, credentials: 'include' }),
        fetch('/api/superadmin/assistant/staff?page=1&pageSize=100', { headers, credentials: 'include' }),
        fetch('/api/support/meta', { headers, credentials: 'include' }),
      ]);
      if (deptRes.ok) {
        const dd = await deptRes.json().catch(() => ({}));
        setDepartments(Array.isArray(dd.departments) ? dd.departments : []);
      } else {
        const dd = await deptRes.json().catch(() => ({}));
        setErrorMsg(dd.error || dd.message || 'Erro ao carregar departamentos de atendimento.');
      }
      if (staffRes.ok) {
        const sd = await staffRes.json().catch(() => ({}));
        setStaffList(Array.isArray(sd.items) ? sd.items : []);
      } else {
        const sd = await staffRes.json().catch(() => ({}));
        setErrorMsg(sd.error || sd.message || 'Erro ao carregar funcionários de atendimento.');
      }
      if (metaRes.ok) {
        const md = await metaRes.json().catch(() => ({}));
        setCategories(Array.isArray(md.categories) ? md.categories : []);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar metadados da central de atendimento.');
    }
  }, []);

  const fetchTickets = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', '20');
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (filterEstado !== 'todos') params.set('estado', filterEstado);
        if (filterPriority !== 'todas') params.set('prioridade', filterPriority);
        if (filterDept !== 'todos') params.set('departamento_id', filterDept);
        if (filterAssignee !== 'todos') params.set('responsavel_id', filterAssignee);
        if (filterCategory !== 'todas') params.set('categoria', filterCategory);
        if (filterDateStart) params.set('data_inicio', filterDateStart);
        if (filterDateEnd) params.set('data_fim', filterDateEnd);
        if (onlyAlerts) params.set('apenas_alertas', 'true');

        const headers = await buildAdminHeaders(false);
        const res = await fetch(`/api/superadmin/assistant/tickets?${params.toString()}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar tickets.');
        setTickets(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        if (data.summary) setSummary(data.summary);
      } catch (err: any) {
        if (!silent) setErrorMsg(err.message || 'Erro ao listar solicitações.');
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [
      page,
      searchQuery,
      filterEstado,
      filterPriority,
      filterDept,
      filterAssignee,
      filterCategory,
      filterDateStart,
      filterDateEnd,
      onlyAlerts,
    ]
  );

  const fetchTicketDetail = useCallback(async (ticketId: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/tickets/${ticketId}`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar conversa.');
      setSelectedTicket(data.ticket || null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setRating(data.rating || null);
    } catch (err: any) {
      if (!silent) setErrorMsg(err.message || 'Erro ao abrir ticket.');
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterEstado, filterPriority, filterDept, filterAssignee, filterCategory, filterDateStart, filterDateEnd, onlyAlerts]);

  useEffect(() => {
    void fetchTickets(false);
  }, [fetchTickets]);

  useEffect(() => {
    if (selectedId) {
      void fetchTicketDetail(selectedId, false);
    } else {
      setSelectedTicket(null);
      setMessages([]);
      setAssignments([]);
      setEvents([]);
      setRating(null);
    }
  }, [selectedId, fetchTicketDetail]);

  // Live polling (every 5s while tab visible)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void fetchTickets(true);
      if (selectedId) {
        void fetchTicketDetail(selectedId, true);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchTickets, fetchTicketDetail, selectedId]);

  useEffect(() => {
    return () => {
      if (previewImage?.url) {
        URL.revokeObjectURL(previewImage.url);
      }
    };
  }, [previewImage]);

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Apenas imagens (PNG, JPG, WEBP) ou documentos PDF são aceites.');
      return;
    }
    if (file.size > 700 * 1024) {
      setErrorMsg('O ficheiro excede o limite de 700 KB.');
      return;
    }

    setUploadingAtt(true);
    setErrorMsg('');
    try {
      const base64Data = await fileToBase64(file);
      const headers = await buildAdminHeaders(true);
      const res = await fetch('/api/support/attachments', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
          ticketId: selectedId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar anexo.');
      if (data.attachment) {
        setReplyAttachments((prev) => [...prev, data.attachment]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar anexo.');
    } finally {
      setUploadingAtt(false);
    }
  };

  const handleOpenAttachment = async (att: SupportAttachment) => {
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(att.url, { headers, credentials: 'include' });
      if (!res.ok) throw new Error('Sem autorização para aceder ao anexo.');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      if (att.tipo === 'image') {
        setPreviewImage({ nome: att.nome, url: objUrl });
      } else {
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = att.nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao abrir anexo.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSendingReply(true);
    setErrorMsg('');
    try {
      const idemKey = `adm_reply_${selectedId}_${Date.now()}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const res = await fetch(`/api/superadmin/assistant/tickets/${selectedId}/messages`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          tipo: replyMode,
          conteudo: replyText.trim(),
          anexos: replyAttachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem.');

      setReplyText('');
      setReplyAttachments([]);
      notify(replyMode === 'nota_interna' ? 'Nota interna registada.' : 'Resposta enviada ao utilizador.', 'sucesso');
      await Promise.all([fetchTicketDetail(selectedId, true), fetchTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleInvokeAi = async () => {
    if (!selectedId || invokingAi) return;
    setInvokingAi(true);
    setErrorMsg('');
    try {
      const idemKey = `tk_ai_${selectedId}_${Date.now()}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const res = await fetch(`/api/superadmin/assistant/tickets/${selectedId}/ai-respond`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao acionar agente IA.');

      if (data.escalonado) {
        notify(t('helpdesk.ai_invoke_escalated'), 'info');
      } else {
        const pct = Math.round(Number(data.confianca ?? 0.85) * 100);
        notify(t('helpdesk.ai_invoke_replied', { confidence: pct }), 'sucesso');
      }
      await Promise.all([fetchTicketDetail(selectedId, true), fetchTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível acionar o agente IA.');
    } finally {
      setInvokingAi(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!selectedId || autoDistributing) return;
    setAutoDistributing(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/tickets/${selectedId}/auto-distribute`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao auto-distribuir solicitação.');

      if (data.atribuido && data.responsavel_nome) {
        notify(
          t('helpdesk.auto_distribute_assigned', {
            assignee: data.responsavel_nome,
            dept: data.departamento_nome || 'Geral',
          }),
          'sucesso'
        );
      } else {
        notify(
          t('helpdesk.auto_distribute_queued', {
            reason: data.motivo || 'Sem elegível disponível no momento.',
          }),
          'info'
        );
      }
      await Promise.all([fetchTicketDetail(selectedId, true), fetchTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível executar a distribuição automática.');
    } finally {
      setAutoDistributing(false);
    }
  };

  const handleChangeStatus = async (nextStatus: SupportTicketStatus) => {
    if (!selectedId) return;
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/tickets/${selectedId}/status`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ estado: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível alterar o estado.');
      notify(`Estado actualizado para ${t(`helpdesk.status_${nextStatus}`)}.`, 'sucesso');
      await Promise.all([fetchTicketDetail(selectedId, true), fetchTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao actualizar estado.');
    }
  };

  const openTransferModal = () => {
    if (!selectedTicket) return;
    setTransferDeptId(selectedTicket.departamento_id || departments[0]?.id || '');
    setTransferAgentId(selectedTicket.responsavel_id || '');
    setTransferReason('');
    setIsTransferOpen(true);
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !transferDeptId) return;
    setTransferSaving(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/tickets/${selectedId}/transfer`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          departamento_id: transferDeptId,
          responsavel_id: transferAgentId || null,
          motivo: transferReason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao transferir ticket.');
      setIsTransferOpen(false);
      notify('Solicitação transferida com sucesso.', 'sucesso');
      await Promise.all([fetchTicketDetail(selectedId, true), fetchTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao transferir ticket.');
    } finally {
      setTransferSaving(false);
    }
  };

  const openCreateModal = () => {
    setNewTenantId(tenantsList[0]?.id || 'global');
    setNewSubject('');
    setNewCategory(categories[0] || 'Geral');
    setNewDeptId(departments[0]?.id || '');
    setNewAssigneeId('');
    setNewPriority('normal');
    setNewMessage('');
    setNewSolicitanteNome('');
    setNewSolicitanteEmail('');
    setIsCreateOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantId.trim() || !newSubject.trim() || !newMessage.trim()) {
      setErrorMsg('Preencha instituição, assunto e descrição inicial.');
      return;
    }
    setCreatingTicket(true);
    setErrorMsg('');
    try {
      const idemKey = `adm_tk_${Date.now()}_${newTenantId}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const payload: Record<string, any> = {
        tenant_id: newTenantId.trim(),
        assunto: newSubject.trim(),
        categoria: newCategory || 'Geral',
        departamento_id: newDeptId || undefined,
        responsavel_id: newAssigneeId || null,
        prioridade: newPriority,
        mensagem: newMessage.trim(),
      };
      if (newSolicitanteNome.trim()) payload.solicitante_nome = newSolicitanteNome.trim();
      if (newSolicitanteEmail.trim()) payload.solicitante_email = newSolicitanteEmail.trim();

      const res = await fetch('/api/superadmin/assistant/tickets', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao criar ticket.');
      setIsCreateOpen(false);
      notify('Ticket criado com sucesso.', 'sucesso');
      await fetchTickets(false);
      if (data.ticket?.id) {
        setSelectedId(data.ticket.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  const activeHumanStaff = useMemo(
    () => staffList.filter((s) => s.estado === 'activo'),
    [staffList]
  );

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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setOnlyAlerts(false);
            setFilterEstado('aberto');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-sky-400 transition-colors cursor-pointer"
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('helpdesk.kpi_open')}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {summary.abertos + summary.reabertos}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setOnlyAlerts(false);
            setFilterEstado('em_atendimento');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-indigo-400 transition-colors cursor-pointer"
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('helpdesk.kpi_in_progress')}</p>
          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {summary.emAtendimento}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setOnlyAlerts(false);
            setFilterEstado('pendente');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-amber-400 transition-colors cursor-pointer"
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('helpdesk.kpi_pending')}</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {summary.pendentes}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setOnlyAlerts(false);
            setFilterEstado('resolvido');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-emerald-400 transition-colors cursor-pointer"
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('helpdesk.kpi_resolved')}</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {summary.resolvidos}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterEstado('todos');
            setOnlyAlerts((v) => !v);
          }}
          className={`text-left border rounded-xl p-4 transition-colors cursor-pointer ${
            onlyAlerts
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400'
          }`}
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('helpdesk.kpi_sla_alerts')}</p>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {summary.alertasSla + summary.semResposta > 0
              ? Math.max(summary.alertasSla, summary.semResposta)
              : 0}
          </p>
        </button>
      </div>

      {/* Alert notice when SLA or unanswered items exist */}
      {(summary.alertasSla > 0 || summary.semResposta > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium tabular-nums">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {t('helpdesk.alerts_banner', {
                sla: summary.alertasSla,
                unanswered: summary.semResposta,
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterEstado('todos');
              setOnlyAlerts((v) => !v);
            }}
            className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline cursor-pointer"
          >
            {onlyAlerts ? t('helpdesk.filter_all_states') : t('helpdesk.filter_alerts_only')}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('helpdesk.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchTickets(false)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('helpdesk.live_sync_active')}</span>
            </button>

            {canRespond && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('helpdesk.open_ticket')}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as any)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('helpdesk.filter_all_states')}</option>
            <option value="aberto">{t('helpdesk.status_aberto')}</option>
            <option value="em_atendimento">{t('helpdesk.status_em_atendimento')}</option>
            <option value="pendente">{t('helpdesk.status_pendente')}</option>
            <option value="reaberto">{t('helpdesk.status_reaberto')}</option>
            <option value="resolvido">{t('helpdesk.status_resolvido')}</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todas">{t('helpdesk.filter_all_priorities')}</option>
            <option value="urgente">{t('helpdesk.priority_urgente')}</option>
            <option value="alta">{t('helpdesk.priority_alta')}</option>
            <option value="normal">{t('helpdesk.priority_normal')}</option>
            <option value="baixa">{t('helpdesk.priority_baixa')}</option>
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('helpdesk.filter_all_departments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todos">{t('helpdesk.filter_all_staff')}</option>
            <option value="__unassigned__">{t('helpdesk.filter_unassigned')}</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="todas">{t('helpdesk.filter_all_categories')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              title={t('helpdesk.filter_date_from')}
              className="w-1/2 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 tabular-nums"
            />
            <input
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              title={t('helpdesk.filter_date_to')}
              className="w-1/2 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Ticket List + Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List */}
        <div
          className={`lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ${
            selectedId ? 'hidden lg:block' : 'block'
          }`}
        >
          {loadingList && tickets.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">{t('loading')}</div>
          ) : tickets.length === 0 ? (
            <div className="py-14 px-5 text-center space-y-2 text-xs text-slate-500">
              <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
              <p>{t('helpdesk.empty_inbox')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
              {tickets.map((tk) => {
                const isActive = tk.id === selectedId;
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => setSelectedId(tk.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer space-y-2 ${
                      isActive
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {tk.codigo}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getPriorityClasses(
                            tk.prioridade
                          )}`}
                        >
                          {t(`helpdesk.priority_${tk.prioridade}`)}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getTicketStatusClasses(
                            tk.estado
                          )}`}
                        >
                          {t(`helpdesk.status_${tk.estado}`)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{tk.assunto}</p>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{tk.solicitante_nome}</span>
                      <span>·</span>
                      <span>{tk.tenant_nome || tk.tenant_id}</span>
                      <span>·</span>
                      <span>{tk.departamento_nome || 'Geral'}</span>
                    </div>

                    {(tk.sla_status !== 'ok' || tk.sem_resposta_ha_minutos > 0) && tk.estado !== 'resolvido' && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {tk.sla_status !== 'ok' && <span>{t(`helpdesk.sla_${tk.sla_status}`)}</span>}
                        {tk.sem_resposta_ha_minutos > 0 && (
                          <span>
                            {tk.sla_status !== 'ok' ? '· ' : ''}
                            {t('helpdesk.unanswered_since', { minutes: tk.sem_resposta_ha_minutos })}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums pt-0.5">
                      <span>{tk.responsavel_nome || t('helpdesk.filter_unassigned')}</span>
                      <span>{new Date(tk.ultima_interacao).toLocaleString('pt-PT')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="tabular-nums">
                {t('assistant.pagination_info', { page, totalPages, total })}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Conversation Panel */}
        <div
          className={`lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ${
            selectedId ? 'block' : 'hidden lg:block'
          }`}
        >
          {!selectedId ? (
            <div className="py-24 px-6 text-center text-xs text-slate-500 space-y-2">
              <Inbox className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
              <p>{t('helpdesk.select_ticket_hint')}</p>
            </div>
          ) : loadingDetail && !selectedTicket ? (
            <div className="py-20 text-center text-xs text-slate-500">{t('loading')}</div>
          ) : selectedTicket ? (
            <div className="flex flex-col h-full">
              {/* Ticket Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="lg:hidden px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Voltar</span>
                      </button>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {selectedTicket.codigo}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getTicketStatusClasses(
                          selectedTicket.estado
                        )}`}
                      >
                        {t(`helpdesk.status_${selectedTicket.estado}`)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getPriorityClasses(
                          selectedTicket.prioridade
                        )}`}
                      >
                        {t(`helpdesk.priority_${selectedTicket.prioridade}`)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedTicket.assunto}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {selectedTicket.solicitante_nome} ({selectedTicket.solicitante_email}) ·{' '}
                      {selectedTicket.tenant_nome || selectedTicket.tenant_id} · {selectedTicket.categoria} · Fila:{' '}
                      {selectedTicket.departamento_nome || 'Geral'} · Responsável:{' '}
                      {selectedTicket.responsavel_nome || t('helpdesk.filter_unassigned')}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {canTransfer && (
                    <button
                      type="button"
                      onClick={openTransferModal}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{t('helpdesk.transfer_action')}</span>
                    </button>
                  )}

                  {canRespond && selectedTicket.estado !== 'pendente' && selectedTicket.estado !== 'resolvido' && (
                    <button
                      type="button"
                      onClick={() => void handleChangeStatus('pendente')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                    >
                      {t('helpdesk.pending_action')}
                    </button>
                  )}

                  {canRespond && selectedTicket.estado !== 'resolvido' && (
                    <button
                      type="button"
                      disabled={invokingAi}
                      onClick={() => void handleInvokeAi()}
                      className="px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>{invokingAi ? t('helpdesk.ai_invoke_running') : t('helpdesk.ai_invoke_action')}</span>
                    </button>
                  )}

                  {canTransfer && selectedTicket.estado !== 'resolvido' && (
                    <button
                      type="button"
                      disabled={autoDistributing}
                      onClick={() => void handleAutoDistribute()}
                      className="px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>
                        {autoDistributing
                          ? t('helpdesk.auto_distribute_running')
                          : t('helpdesk.auto_distribute_action')}
                      </span>
                    </button>
                  )}

                  {canClose && selectedTicket.estado !== 'resolvido' && (
                    <button
                      type="button"
                      onClick={() => void handleChangeStatus('resolvido')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('helpdesk.resolve_action')}</span>
                    </button>
                  )}

                  {canRespond && selectedTicket.estado === 'resolvido' && (
                    <button
                      type="button"
                      onClick={() => void handleChangeStatus('reaberto')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('helpdesk.reopen_action')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAuditHistory((v) => !v)}
                    className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>
                      {t('helpdesk.history_transfers')} ({assignments.length})
                    </span>
                  </button>
                </div>

                {showAuditHistory && (
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 space-y-2 text-[11px]">
                    {assignments.length === 0 && events.length === 0 ? (
                      <p className="text-slate-500">Sem transferências registadas.</p>
                    ) : (
                      events.slice(0, 8).map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                          <span>{ev.descricao}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            {new Date(ev.created_at).toLocaleString('pt-PT')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* User Satisfaction Banner if rated */}
                {rating && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                      <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                      <span className="tabular-nums">{t('helpdesk.rating_submitted', { score: rating.nota })}</span>
                    </div>
                    {rating.comentario && (
                      <span className="text-slate-600 dark:text-slate-300 italic">"{rating.comentario}"</span>
                    )}
                  </div>
                )}
              </div>

              {/* Conversation Thread */}
              <div className="p-4 sm:p-5 space-y-4 max-h-[430px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/30">
                {messages.map((m) => {
                  if (m.tipo === 'sistema') {
                    return (
                      <div key={m.id} className="text-center py-1">
                        <span className="inline-block px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {m.conteudo} · {new Date(m.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                    );
                  }

                  const isInternal = m.tipo === 'nota_interna';
                  const isStaff = m.remetente_tipo === 'funcionario' || m.remetente_tipo === 'ia';

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl p-4 border text-xs space-y-2 ${
                        isInternal
                          ? 'bg-amber-50/90 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                          : isStaff
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{m.remetente_nome}</span>
                          {isInternal ? (
                            <span className="px-2 py-0.5 rounded-md border border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>{t('helpdesk.internal_note_badge')}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isStaff ? 'Equipa de Suporte' : 'Solicitante'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(m.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>

                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {m.conteudo}
                      </p>

                      {m.anexos && m.anexos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {m.anexos.map((ax) => (
                            <button
                              key={ax.id}
                              type="button"
                              onClick={() => void handleOpenAttachment(ax)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                            >
                              {ax.tipo === 'pdf' ? (
                                <FileText className="w-3.5 h-3.5 text-rose-500" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                              )}
                              <span className="max-w-[160px] truncate">{ax.nome}</span>
                              <Download className="w-3 h-3 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              {canRespond && (
                <form
                  onSubmit={handleSendReply}
                  className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setReplyMode('mensagem')}
                      className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer transition-colors ${
                        replyMode === 'mensagem'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t('helpdesk.reply_public_tab')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyMode('nota_interna')}
                      className={`px-3 py-1.5 rounded-lg font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        replyMode === 'nota_interna'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t('helpdesk.reply_internal_tab')}</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      replyMode === 'nota_interna'
                        ? t('helpdesk.internal_note_placeholder')
                        : t('helpdesk.reply_placeholder')
                    }
                    className={`w-full px-3 py-2 rounded-lg border text-xs text-slate-900 dark:text-white focus:outline-none ${
                      replyMode === 'nota_interna'
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                    }`}
                  />

                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {replyAttachments.map((att) => (
                        <span
                          key={att.id}
                          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] flex items-center gap-1.5"
                        >
                          <span className="truncate max-w-[150px]">{att.nome}</span>
                          <button
                            type="button"
                            onClick={() => setReplyAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{uploadingAtt ? t('loading') : t('helpdesk.attach_file')}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={handleUploadAttachment}
                        disabled={uploadingAtt}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className={`px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        replyMode === 'nota_interna'
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {sendingReply
                          ? t('loading')
                          : replyMode === 'nota_interna'
                          ? t('helpdesk.save_internal_note')
                          : t('helpdesk.send_reply')}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* MODAL: TRANSFER TICKET */}
      {isTransferOpen && selectedTicket && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTransferOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('helpdesk.transfer_title')}</h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {selectedTicket.codigo} · {selectedTicket.assunto}
                </p>
              </div>
              <button type="button" onClick={() => setIsTransferOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.field_department')}
                </label>
                <select
                  required
                  value={transferDeptId}
                  onChange={(e) => setTransferDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.field_assignee')}
                </label>
                <select
                  value={transferAgentId}
                  onChange={(e) => setTransferAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">{t('helpdesk.filter_unassigned')}</option>
                  {activeHumanStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.carga_actual}/{s.limite_simultaneo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.transfer_reason')}
                </label>
                <textarea
                  rows={2}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={transferSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {transferSaving ? t('loading') : t('helpdesk.transfer_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TICKET (ADMIN) */}
      {isCreateOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('helpdesk.open_ticket')}</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('helpdesk.field_tenant')}
                  </label>
                  {tenantsList.length > 0 ? (
                    <select
                      required
                      value={newTenantId}
                      onChange={(e) => setNewTenantId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="global">Global / Plataforma SGE</option>
                      {tenantsList.map((tn) => (
                        <option key={tn.id} value={tn.id}>
                          {tn.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={newTenantId}
                      onChange={(e) => setNewTenantId(e.target.value)}
                      placeholder="ID da instituição"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('helpdesk.field_priority')}
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as SupportTicketPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="baixa">{t('helpdesk.priority_baixa')}</option>
                    <option value="normal">{t('helpdesk.priority_normal')}</option>
                    <option value="alta">{t('helpdesk.priority_alta')}</option>
                    <option value="urgente">{t('helpdesk.priority_urgente')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.field_subject')}
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('helpdesk.field_category')}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('helpdesk.field_department')}
                  </label>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('helpdesk.field_assignee')}
                  </label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">{t('helpdesk.filter_unassigned')}</option>
                    {activeHumanStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Solicitante (opcional)
                  </label>
                  <input
                    type="text"
                    value={newSolicitanteNome}
                    onChange={(e) => setNewSolicitanteNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail do Solicitante (opcional)
                  </label>
                  <input
                    type="email"
                    value={newSolicitanteEmail}
                    onChange={(e) => setNewSolicitanteEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.field_message')}
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={8}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {creatingTicket ? t('loading') : t('assistant.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE ATTACHMENT LIGHTBOX */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-[130]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-4 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-white">
              <span>{previewImage.nome}</span>
              <button type="button" onClick={() => setPreviewImage(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={previewImage.url} alt={previewImage.nome} className="max-h-[75vh] mx-auto rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportInboxPanel;
