import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Send,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Star,
  FileText,
  Image as ImageIcon,
  Download,
  X,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import { useInstitutionFeatures } from '../../config/institutionTypes';
import type {
  SupportAttachment,
  SupportMessage,
  SupportRating,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
  TipoInstituicao,
} from '../../types';

interface UserSupportPortalProps {
  tipoInstituicao?: TipoInstituicao;
  showNotification?: (message: string, type?: 'sucesso' | 'erro' | 'info') => void;
}

async function buildPortalHeaders(includeJson = false, idempotencyKey?: string): Promise<Record<string, string>> {
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

export const UserSupportPortal: React.FC<UserSupportPortalProps> = ({
  tipoInstituicao,
  showNotification,
}) => {
  const { t } = useTranslation('common');
  const features = useInstitutionFeatures(tipoInstituicao);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canViewTenantScope, setCanViewTenantScope] = useState(false);
  const [scope, setScope] = useState<'own' | 'tenant'>('own');

  const [departments, setDepartments] = useState<Array<{ id: string; nome: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | SupportTicketStatus>('todos');
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Ticket Detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [rating, setRating] = useState<SupportRating | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reply State
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const [uploadingAtt, setUploadingAtt] = useState(false);

  // Create Ticket Modal
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Geral');
  const [newDeptId, setNewDeptId] = useState('');
  const [newPriority, setNewPriority] = useState<SupportTicketPriority>('normal');
  const [newMessage, setNewMessage] = useState('');
  const [newAttachments, setNewAttachments] = useState<SupportAttachment[]>([]);
  const [creating, setCreating] = useState(false);

  // Rating Form State
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Attachment Preview Modal
  const [previewImage, setPreviewImage] = useState<{ nome: string; url: string } | null>(null);

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const loadMeta = useCallback(async () => {
    try {
      const headers = await buildPortalHeaders(false);
      const res = await fetch('/api/support/meta', { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setCategories(Array.isArray(data.categories) ? data.categories : ['Geral']);
    } catch {}
  }, []);

  const loadTickets = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', '15');
        params.set('scope', scope);
        if (filterEstado !== 'todos') params.set('estado', filterEstado);
        if (searchQuery.trim()) params.set('q', searchQuery.trim());

        const headers = await buildPortalHeaders(false);
        const res = await fetch(`/api/support/tickets?${params.toString()}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar solicitações.');
        setTickets(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        setCanViewTenantScope(Boolean(data.canViewTenantScope));
      } catch (err: any) {
        if (!silent) setErrorMsg(err.message || 'Erro ao carregar solicitações.');
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [page, scope, filterEstado, searchQuery]
  );

  const loadDetail = useCallback(async (ticketId: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const headers = await buildPortalHeaders(false);
      const res = await fetch(`/api/support/tickets/${ticketId}`, { headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar detalhes do pedido.');
      setSelectedTicket(data.ticket || null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setRating(data.rating || null);
    } catch (err: any) {
      if (!silent) setErrorMsg(err.message || 'Erro ao abrir solicitação.');
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    setPage(1);
  }, [scope, filterEstado, searchQuery]);

  useEffect(() => {
    void loadTickets(false);
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId, false);
    } else {
      setSelectedTicket(null);
      setMessages([]);
      setRating(null);
    }
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void loadTickets(true);
      if (selectedId) {
        void loadDetail(selectedId, true);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadTickets, loadDetail, selectedId]);

  useEffect(() => {
    return () => {
      if (previewImage?.url) {
        URL.revokeObjectURL(previewImage.url);
      }
    };
  }, [previewImage]);

  const uploadAttachment = async (file: File, target: 'reply' | 'new') => {
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
      const headers = await buildPortalHeaders(true);
      const res = await fetch('/api/support/attachments', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
          ticketId: target === 'reply' ? selectedId || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar ficheiro.');
      if (data.attachment) {
        if (target === 'reply') {
          setReplyAttachments((prev) => [...prev, data.attachment]);
        } else {
          setNewAttachments((prev) => [...prev, data.attachment]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar anexo.');
    } finally {
      setUploadingAtt(false);
    }
  };

  const handleOpenAttachment = async (att: SupportAttachment) => {
    try {
      const headers = await buildPortalHeaders(false);
      const res = await fetch(att.url, { headers, credentials: 'include' });
      if (!res.ok) throw new Error('Não foi possível abrir o anexo.');
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
      setErrorMsg(err.message || 'Erro ao aceder ao ficheiro.');
    }
  };

  const handleOpenNewModal = () => {
    setNewSubject('');
    setNewCategory(categories[0] || 'Geral');
    setNewDeptId(departments[0]?.id || '');
    setNewPriority('normal');
    setNewMessage('');
    setNewAttachments([]);
    setIsNewOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    setErrorMsg('');
    try {
      const idemKey = `portal_tk_${Date.now()}_${newSubject.trim().slice(0, 12)}`;
      const headers = await buildPortalHeaders(true, idemKey);
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          assunto: newSubject.trim(),
          categoria: newCategory || 'Geral',
          departamento_id: newDeptId || undefined,
          prioridade: newPriority,
          mensagem: newMessage.trim(),
          anexos: newAttachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar solicitação.');
      setIsNewOpen(false);
      notify('Solicitação aberta com sucesso.', 'sucesso');
      await loadTickets(false);
      if (data.ticket?.id) {
        setSelectedId(data.ticket.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao abrir solicitação.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSendingReply(true);
    setErrorMsg('');
    try {
      const idemKey = `portal_msg_${selectedId}_${Date.now()}`;
      const headers = await buildPortalHeaders(true, idemKey);
      const res = await fetch(`/api/support/tickets/${selectedId}/messages`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          tipo: 'mensagem',
          conteudo: replyText.trim(),
          anexos: replyAttachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem.');
      setReplyText('');
      setReplyAttachments([]);
      await Promise.all([loadDetail(selectedId, true), loadTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar resposta.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedId) return;
    setErrorMsg('');
    try {
      const headers = await buildPortalHeaders(true);
      const res = await fetch(`/api/support/tickets/${selectedId}/reopen`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ motivo: 'Reaberto pelo utilizador no portal' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao reabrir pedido.');
      notify('Solicitação reaberta.', 'sucesso');
      await Promise.all([loadDetail(selectedId, true), loadTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao reabrir solicitação.');
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmittingRating(true);
    setErrorMsg('');
    try {
      const headers = await buildPortalHeaders(true);
      const res = await fetch(`/api/support/tickets/${selectedId}/rating`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          nota: ratingScore,
          comentario: ratingComment.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao guardar avaliação.');
      notify('Obrigado pela sua avaliação!', 'sucesso');
      setRatingComment('');
      await Promise.all([loadDetail(selectedId, true), loadTickets(true)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao registar avaliação.');
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('helpdesk.portal_title')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('helpdesk.portal_subtitle')} ({features.terms.disciplinePlural} / {features.terms.classCoursePlural})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewTenantScope && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950 text-xs">
              <button
                type="button"
                onClick={() => setScope('own')}
                className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                  scope === 'own' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
                }`}
              >
                {t('helpdesk.scope_own')}
              </button>
              <button
                type="button"
                onClick={() => setScope('tenant')}
                className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                  scope === 'tenant' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
                }`}
              >
                {t('helpdesk.scope_tenant')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('helpdesk.open_ticket_portal')}</span>
          </button>
        </div>
      </div>

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

      {/* Search & Status Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por código ou assunto..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          />
        </div>

        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="todos">{t('helpdesk.filter_all_states')}</option>
          <option value="aberto">{t('helpdesk.status_aberto')}</option>
          <option value="em_atendimento">{t('helpdesk.status_em_atendimento')}</option>
          <option value="pendente">{t('helpdesk.status_pendente')}</option>
          <option value="reaberto">{t('helpdesk.status_reaberto')}</option>
          <option value="resolvido">{t('helpdesk.status_resolvido')}</option>
        </select>

        <button
          type="button"
          onClick={() => void loadTickets(false)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Main Workspace */}
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
            <div className="py-14 px-5 text-center space-y-3 text-xs text-slate-500">
              <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
              <p>{t('helpdesk.empty_portal')}</p>
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
              >
                {t('helpdesk.open_ticket_portal')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
              {tickets.map((tk) => (
                <button
                  key={tk.id}
                  type="button"
                  onClick={() => setSelectedId(tk.id)}
                  className={`w-full text-left p-4 space-y-2 transition-colors cursor-pointer ${
                    tk.id === selectedId
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {tk.codigo}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getTicketStatusClasses(
                        tk.estado
                      )}`}
                    >
                      {t(`helpdesk.status_${tk.estado}`)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{tk.assunto}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{tk.departamento_nome || tk.categoria}</span>
                    <span>{new Date(tk.ultima_interacao).toLocaleString('pt-PT')}</span>
                  </div>
                  {tk.avaliacao_nota && (
                    <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 tabular-nums">
                      <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                      <span>{t('helpdesk.rating_submitted', { score: tk.avaliacao_nota })}</span>
                    </div>
                  )}
                </button>
              ))}
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

        {/* Right Thread */}
        <div
          className={`lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ${
            selectedId ? 'block' : 'hidden lg:block'
          }`}
        >
          {!selectedId ? (
            <div className="py-24 px-6 text-center text-xs text-slate-500 space-y-2">
              <MessageSquare className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
              <p>{t('helpdesk.select_ticket_hint')}</p>
            </div>
          ) : loadingDetail && !selectedTicket ? (
            <div className="py-20 text-center text-xs text-slate-500">{t('loading')}</div>
          ) : selectedTicket ? (
            <div className="flex flex-col">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="lg:hidden px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
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
                  </div>

                  {selectedTicket.estado === 'resolvido' && (
                    <button
                      type="button"
                      onClick={handleReopenTicket}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('helpdesk.reopen_action')}</span>
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedTicket.assunto}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Fila: {selectedTicket.departamento_nome || 'Geral'} · Categoria: {selectedTicket.categoria} ·
                  Prioridade: {t(`helpdesk.priority_${selectedTicket.prioridade}`)}
                  {selectedTicket.responsavel_nome ? ` · Atendente: ${selectedTicket.responsavel_nome}` : ''}
                </p>
              </div>

              {/* Messages */}
              <div className="p-4 sm:p-5 space-y-4 max-h-[420px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/30">
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

                  const isStaff = m.remetente_tipo === 'funcionario' || m.remetente_tipo === 'ia';
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl p-4 border text-xs space-y-2 ${
                        isStaff
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {m.remetente_nome} {isStaff ? '· Equipa de Suporte' : ''}
                        </span>
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
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] flex items-center gap-1.5 cursor-pointer"
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

              {/* Satisfaction Rating Box when Resolved */}
              {selectedTicket.estado === 'resolvido' && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/15">
                  {rating ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                        <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                        <span className="tabular-nums">{t('helpdesk.rating_submitted', { score: rating.nota })}</span>
                      </div>
                      {rating.comentario && (
                        <p className="text-slate-600 dark:text-slate-300 italic">"{rating.comentario}"</p>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitRating} className="space-y-3 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{t('helpdesk.rating_title')}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('helpdesk.rating_subtitle')}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setRatingScore(num)}
                            aria-label={`Nota ${num}`}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                num <= ratingScore
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                          {ratingScore}/5
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          placeholder={t('helpdesk.rating_comment_placeholder')}
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={submittingRating}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {submittingRating ? t('loading') : t('helpdesk.rating_submit')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Reply Box (when not resolved) */}
              {selectedTicket.estado !== 'resolvido' && (
                <form
                  onSubmit={handleSendReply}
                  className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900"
                >
                  <textarea
                    rows={3}
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escreva uma mensagem adicional ou responda à equipa de suporte..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
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
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void uploadAttachment(f, 'reply');
                        }}
                        disabled={uploadingAtt}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingReply ? t('loading') : t('helpdesk.send_reply')}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* MODAL: NEW PORTAL TICKET */}
      {isNewOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('helpdesk.open_ticket_portal')}</h3>
              <button type="button" onClick={() => setIsNewOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
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
                  placeholder="Ex.: Erro na emissão da pauta ou matrícula"
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
                  {t('helpdesk.field_message')}
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={8}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Descreva em detalhe o problema ou pedido..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('helpdesk.field_attachments')}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{uploadingAtt ? t('loading') : t('helpdesk.attach_file')}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void uploadAttachment(f, 'new');
                      }}
                      disabled={uploadingAtt}
                      className="hidden"
                    />
                  </label>
                  {newAttachments.map((att) => (
                    <span
                      key={att.id}
                      className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] flex items-center gap-1.5"
                    >
                      <span className="truncate max-w-[140px]">{att.nome}</span>
                      <button
                        type="button"
                        onClick={() => setNewAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {creating ? t('loading') : t('helpdesk.open_ticket_portal')}
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

export default UserSupportPortal;
