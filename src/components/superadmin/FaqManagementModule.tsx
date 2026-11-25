import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  History,
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  BookOpen,
  HelpCircle,
  Send,
  Archive,
  EyeOff,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import { sanitizeHtml } from '../../lib/sanitize';
import { RichTextEditor } from '../RichTextEditor';
import type {
  FaqArticle,
  FaqAttachment,
  FaqCategory,
  FaqEstado,
  FaqOverviewStats,
  FaqTipo,
  FaqVisibilidade,
} from '../../types';

export type FaqSubTab =
  | 'faq_overview'
  | 'faq_questions'
  | 'faq_categories'
  | 'faq_articles'
  | 'faq_publishing';

interface FaqManagementModuleProps {
  activeSubTab: FaqSubTab;
  onNavigateSubTab?: (tab: FaqSubTab) => void;
  showNotification?: (message: string, type?: 'sucesso' | 'erro' | 'info') => void;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function getStatusClasses(estado: FaqEstado): string {
  switch (estado) {
    case 'publicado':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'rascunho':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'despublicado':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'arquivado':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30';
  }
}

export const FaqManagementModule: React.FC<FaqManagementModuleProps> = ({
  activeSubTab,
  onNavigateSubTab,
  showNotification,
}) => {
  const { t } = useTranslation('common');

  const [overview, setOverview] = useState<FaqOverviewStats | null>(null);
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [articles, setArticles] = useState<FaqArticle[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [catSearchQuery, setCatSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todas');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [filterAi, setFilterAi] = useState<'todos' | 'true' | 'false'>('todos');

  // Category modal state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<FaqCategory | null>(null);
  const [catNome, setCatNome] = useState('');
  const [catDescricao, setCatDescricao] = useState('');
  const [catOrdem, setCatOrdem] = useState(0);
  const [catAtivo, setCatAtivo] = useState(true);
  const [catVisibilidade, setCatVisibilidade] = useState<FaqVisibilidade>('todos');
  const [catSaving, setCatSaving] = useState(false);

  // Article / Question modal state
  const [isArtModalOpen, setIsArtModalOpen] = useState(false);
  const [editingArt, setEditingArt] = useState<FaqArticle | null>(null);
  const [artTipo, setArtTipo] = useState<FaqTipo>('faq');
  const [artTitulo, setArtTitulo] = useState('');
  const [artCategoriaId, setArtCategoriaId] = useState('');
  const [artRespostaHtml, setArtRespostaHtml] = useState('');
  const [artKeywords, setArtKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [artAnexos, setArtAnexos] = useState<FaqAttachment[]>([]);
  const [artEstado, setArtEstado] = useState<FaqEstado>('rascunho');
  const [artPrioridade, setArtPrioridade] = useState(50);
  const [artVisibilidade, setArtVisibilidade] = useState<FaqVisibilidade>('todos');
  const [artUtilizavelIa, setArtUtilizavelIa] = useState(true);
  const [artNotaAlteracao, setArtNotaAlteracao] = useState('');
  const [artSaving, setArtSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // History modal state
  const [historyArticle, setHistoryArticle] = useState<FaqArticle | null>(null);

  // Confirm delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'article'; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/faq/categories', { headers, credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar categorias.');
      const data = await res.json();
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar categorias.');
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/faq/overview', { headers, credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar visão geral.');
      const data = await res.json();
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar visão geral.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (filterCategoria !== 'todas') params.set('categoria_id', filterCategoria);
      if (filterEstado !== 'todos') params.set('estado', filterEstado);
      if (filterAi !== 'todos') params.set('utilizavel_ia', filterAi);

      if (activeSubTab === 'faq_questions') {
        params.set('tipo', 'faq');
      } else if (activeSubTab === 'faq_articles') {
        params.set('tipo', 'artigo_tutorial');
      }

      const res = await fetch(`/api/superadmin/faq/articles?${params.toString()}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar perguntas e artigos.');
      const data = await res.json();
      setArticles(Array.isArray(data.items) ? data.items : []);
      setTotalArticles(Number(data.total || 0));
      setTotalPages(Number(data.totalPages || 1));
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar perguntas e artigos.');
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, filterAi, filterCategoria, filterEstado, page, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [activeSubTab, searchQuery, filterCategoria, filterEstado, filterAi]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (activeSubTab === 'faq_overview') {
      void fetchOverview();
    } else if (activeSubTab !== 'faq_categories') {
      void fetchArticles();
    }
  }, [activeSubTab, fetchOverview, fetchArticles]);

  const openNewCategoryModal = () => {
    setEditingCat(null);
    setCatNome('');
    setCatDescricao('');
    setCatOrdem(categories.length + 1);
    setCatAtivo(true);
    setCatVisibilidade('todos');
    setIsCatModalOpen(true);
  };

  const openEditCategoryModal = (cat: FaqCategory) => {
    setEditingCat(cat);
    setCatNome(cat.nome);
    setCatDescricao(cat.descricao || '');
    setCatOrdem(cat.ordem);
    setCatAtivo(cat.ativo);
    setCatVisibilidade(cat.visibilidade_padrao || 'todos');
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNome.trim()) return;
    setCatSaving(true);
    setErrorMsg('');
    try {
      const idemKey = editingCat ? undefined : `cat_${Date.now()}_${catNome.trim()}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const url = editingCat
        ? `/api/superadmin/faq/categories/${editingCat.id}`
        : '/api/superadmin/faq/categories';
      const method = editingCat ? 'PUT' : 'POST';
      const payload = editingCat
        ? {
            nome: catNome.trim(),
            descricao: catDescricao.trim(),
            ordem: Number(catOrdem),
            ativo: catAtivo,
            visibilidade_padrao: catVisibilidade,
          }
        : {
            tenant_id: 'global',
            nome: catNome.trim(),
            descricao: catDescricao.trim(),
            ordem: Number(catOrdem),
            ativo: catAtivo,
            visibilidade_padrao: catVisibilidade,
          };

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao guardar categoria.');

      setIsCatModalOpen(false);
      notify(editingCat ? 'Categoria actualizada com sucesso.' : 'Categoria criada com sucesso.', 'sucesso');
      await fetchCategories();
      if (activeSubTab === 'faq_overview') await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao guardar categoria.');
    } finally {
      setCatSaving(false);
    }
  };

  const openNewArticleModal = (defaultTipo: FaqTipo = 'faq') => {
    setEditingArt(null);
    setArtTipo(defaultTipo);
    setArtTitulo('');
    setArtCategoriaId(categories.find((c) => c.ativo)?.id || categories[0]?.id || '');
    setArtRespostaHtml('');
    setArtKeywords([]);
    setKeywordInput('');
    setArtAnexos([]);
    setArtEstado('rascunho');
    setArtPrioridade(50);
    setArtVisibilidade('todos');
    setArtUtilizavelIa(true);
    setArtNotaAlteracao('');
    setIsArtModalOpen(true);
  };

  const openEditArticleModal = (item: FaqArticle) => {
    setEditingArt(item);
    setArtTipo(item.tipo || 'faq');
    setArtTitulo(item.titulo || '');
    setArtCategoriaId(item.categoria_id || '');
    setArtRespostaHtml(item.resposta_html || '');
    setArtKeywords(item.palavras_chave || []);
    setKeywordInput('');
    setArtAnexos(item.anexos || []);
    setArtEstado(item.estado || 'rascunho');
    setArtPrioridade(item.prioridade || 50);
    setArtVisibilidade(item.visibilidade || 'todos');
    setArtUtilizavelIa(Boolean(item.utilizavel_ia));
    setArtNotaAlteracao('');
    setIsArtModalOpen(true);
  };

  const handleAddKeyword = () => {
    const clean = keywordInput.trim().replace(/,+$/, '');
    if (!clean) return;
    if (!artKeywords.includes(clean) && artKeywords.length < 20) {
      setArtKeywords([...artKeywords, clean]);
    }
    setKeywordInput('');
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Apenas imagens PNG, JPEG, WEBP e documentos PDF são permitidos.');
      return;
    }
    if (file.size > 700 * 1024) {
      setErrorMsg('O ficheiro excede o limite de 700 KB.');
      return;
    }
    if (artAnexos.length >= 5) {
      setErrorMsg('Máximo de 5 anexos por item.');
      return;
    }

    setUploadingFile(true);
    setErrorMsg('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler o ficheiro.'));
        reader.readAsDataURL(file);
      });

      const idemKey = `att_${Date.now()}_${file.name}_${file.size}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const res = await fetch('/api/superadmin/faq/attachments', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          nome: file.name,
          mime_type: file.type,
          dataBase64: base64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar anexo.');

      setArtAnexos((prev) => [...prev, data.attachment]);
      notify('Anexo carregado com segurança.', 'sucesso');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar anexo.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artTitulo.trim() || !artCategoriaId) {
      setErrorMsg('Preencha o título/pergunta e seleccione a categoria.');
      return;
    }
    const cleanHtml = sanitizeHtml(artRespostaHtml);
    if (!cleanHtml.replace(/<[^>]+>/g, '').trim()) {
      setErrorMsg('Introduza uma resposta válida no editor.');
      return;
    }

    setArtSaving(true);
    setErrorMsg('');
    try {
      const idemKey = editingArt ? undefined : `art_${Date.now()}_${artTitulo.trim().slice(0, 24)}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const url = editingArt
        ? `/api/superadmin/faq/articles/${editingArt.id}`
        : '/api/superadmin/faq/articles';
      const method = editingArt ? 'PUT' : 'POST';

      const bodyPayload: Record<string, any> = {
        tipo: artTipo,
        titulo: artTitulo.trim(),
        pergunta: artTitulo.trim(),
        resposta_html: cleanHtml,
        categoria_id: artCategoriaId,
        palavras_chave: artKeywords,
        anexos: artAnexos,
        estado: artEstado,
        prioridade: Number(artPrioridade),
        visibilidade: artVisibilidade,
        utilizavel_ia: artUtilizavelIa,
      };
      if (!editingArt) {
        bodyPayload.tenant_id = 'global';
      } else if (artNotaAlteracao.trim()) {
        bodyPayload.nota_alteracao = artNotaAlteracao.trim();
      }

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao guardar pergunta/artigo.');

      setIsArtModalOpen(false);
      notify(editingArt ? 'Conteúdo actualizado com histórico registado.' : 'Conteúdo criado com sucesso.', 'sucesso');
      await Promise.all([fetchArticles(), fetchCategories()]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao guardar item.');
    } finally {
      setArtSaving(false);
    }
  };

  const handleQuickStatusChange = async (item: FaqArticle, nextEstado: FaqEstado) => {
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/faq/articles/${item.id}/status`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ estado: nextEstado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao actualizar estado.');
      notify(`Estado alterado para "${t(`faq.status_${nextEstado}`)}".`, 'sucesso');
      await fetchArticles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar estado.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const endpoint =
        deleteTarget.type === 'category'
          ? `/api/superadmin/faq/categories/${deleteTarget.id}`
          : `/api/superadmin/faq/articles/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao eliminar registo.');

      setDeleteTarget(null);
      notify('Registo eliminado com sucesso.', 'sucesso');
      await fetchCategories();
      if (activeSubTab !== 'faq_categories' && activeSubTab !== 'faq_overview') {
        await fetchArticles();
      } else if (activeSubTab === 'faq_overview') {
        await fetchOverview();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao eliminar registo.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderSectionHeader = () => {
    const titleKey =
      activeSubTab === 'faq_overview'
        ? 'faq.overview_title'
        : activeSubTab === 'faq_categories'
        ? 'faq.categories_title'
        : activeSubTab === 'faq_articles'
        ? 'faq.articles_title'
        : activeSubTab === 'faq_publishing'
        ? 'faq.publishing_title'
        : 'faq.questions_title';

    const subtitleKey =
      activeSubTab === 'faq_overview'
        ? 'faq.overview_subtitle'
        : activeSubTab === 'faq_categories'
        ? 'faq.categories_subtitle'
        : activeSubTab === 'faq_articles'
        ? 'faq.articles_subtitle'
        : activeSubTab === 'faq_publishing'
        ? 'faq.publishing_subtitle'
        : 'faq.questions_subtitle';

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t(titleKey)}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t(subtitleKey)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {activeSubTab === 'faq_categories' ? (
            <button
              type="button"
              onClick={openNewCategoryModal}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('faq.new_category')}</span>
            </button>
          ) : activeSubTab === 'faq_overview' ? (
            <>
              <button
                type="button"
                onClick={openNewCategoryModal}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{t('faq.new_category')}</span>
              </button>
              <button
                type="button"
                onClick={() => openNewArticleModal('faq')}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('faq.new_question')}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openNewArticleModal(activeSubTab === 'faq_articles' ? 'artigo_tutorial' : 'faq')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{activeSubTab === 'faq_articles' ? t('faq.new_article') : t('faq.new_question')}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const filteredCategories = categories.filter((c) => {
    if (!catSearchQuery.trim()) return true;
    const q = catSearchQuery.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.descricao || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {renderSectionHeader()}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* 1. VISÃO GERAL                                                     */}
      {/* ================================================================== */}
      {activeSubTab === 'faq_overview' && (
        <div className="space-y-6">
          {loading && !overview ? (
            <div className="p-10 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>A carregar estatísticas da base de conhecimento...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_total_items')}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                    {overview?.totalPerguntas ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {overview?.totalFaqs ?? 0} FAQ · {overview?.totalArtigosTutoriais ?? 0} tutoriais
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_categories')}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                    {overview?.totalCategorias ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {t('faq.kpi_categories_active', { count: overview?.categoriasAtivas ?? 0 })}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_published')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
                    {overview?.publicadas ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {overview?.despublicadas ?? 0} despublicadas
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_drafts')}
                  </p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
                    {overview?.rascunhos ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {overview?.arquivadas ?? 0} arquivadas
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_ai_ready')}
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 tabular-nums">
                    {overview?.utilizavelIa ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Elegíveis para agentes IA
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('faq.kpi_views')}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                    {overview?.totalVisualizacoes ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Leituras reais no portal
                  </p>
                </div>
              </div>

              {!overview || overview.totalPerguntas === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
                  <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('faq.empty_overview')}</p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigateSubTab?.('faq_categories')}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Gerir Categorias
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewArticleModal('faq')}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      {t('faq.new_question')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('faq.by_category')}</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {overview.porCategoria.map((c) => (
                        <div key={c.categoria_id} className="py-2.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{c.nome}</span>
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                            {c.publicadas}/{c.total} publicadas · {c.visualizacoes} leituras
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('faq.top_viewed')}</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {overview.topArtigos.map((a) => (
                        <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{a.titulo}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {a.categoria_nome} {a.utilizavel_ia ? '· Base IA' : ''}
                            </p>
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                            {a.visualizacoes} leituras
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 2. CATEGORIAS CRUD                                                 */}
      {/* ================================================================== */}
      {activeSubTab === 'faq_categories' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catSearchQuery}
                onChange={(e) => setCatSearchQuery(e.target.value)}
                placeholder={t('faq.search_categories')}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredCategories.length} categoria(s)
            </span>
          </div>

          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-500">
              <p>{t('faq.empty_categories')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4">{t('faq.field_cat_order')}</th>
                    <th className="py-2.5 pr-4">{t('faq.field_cat_name')}</th>
                    <th className="py-2.5 pr-4">{t('faq.field_visibility')}</th>
                    <th className="py-2.5 pr-4">Itens</th>
                    <th className="py-2.5 pr-4">Estado</th>
                    <th className="py-2.5 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-500">{cat.ordem}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{cat.nome}</p>
                        {cat.descricao && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{cat.descricao}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {t(`faq.visibility_${cat.visibilidade_padrao}`)}
                      </td>
                      <td className="py-3 pr-4 tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {cat.artigos_count ?? 0}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                            cat.ativo
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {cat.ativo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditCategoryModal(cat)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Editar Categoria"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'category', id: cat.id, label: cat.nome })}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Eliminar Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 3. LISTAGEM PAGINADA (PERGUNTAS / ARTIGOS / PUBLICAÇÃO)            */}
      {/* ================================================================== */}
      {(activeSubTab === 'faq_questions' ||
        activeSubTab === 'faq_articles' ||
        activeSubTab === 'faq_publishing') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="relative md:col-span-5">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('faq.search_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="md:col-span-3 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="todas">{t('faq.all_categories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="md:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="todos">{t('faq.all_statuses')}</option>
              <option value="rascunho">{t('faq.status_rascunho')}</option>
              <option value="publicado">{t('faq.status_publicado')}</option>
              <option value="despublicado">{t('faq.status_despublicado')}</option>
              <option value="arquivado">{t('faq.status_arquivado')}</option>
            </select>

            <select
              value={filterAi}
              onChange={(e) => setFilterAi(e.target.value as 'todos' | 'true' | 'false')}
              className="md:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="todos">{t('faq.ai_filter_all')}</option>
              <option value="true">{t('faq.ai_filter_yes')}</option>
              <option value="false">{t('faq.ai_filter_no')}</option>
            </select>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>A carregar conteúdos...</span>
            </div>
          ) : articles.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-500">
              <BookOpen className="w-7 h-7 text-slate-400 mx-auto" />
              <p>{t('faq.empty_articles')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {articles.map((item) => (
                <div
                  key={item.id}
                  className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getStatusClasses(
                          item.estado
                        )}`}
                      >
                        {t(`faq.status_${item.estado}`)}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {t(`faq.type_${item.tipo}`)}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.categoria_nome || 'Sem categoria'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        · Visibilidade: {t(`faq.visibility_${item.visibilidade}`)}
                      </span>
                      {item.utilizavel_ia && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          Utilizável pela IA
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {item.resposta_texto}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="tabular-nums">Prioridade {item.prioridade}</span>
                      <span className="tabular-nums">{item.visualizacoes} leituras</span>
                      {item.anexos?.length > 0 && (
                        <span className="tabular-nums">{item.anexos.length} anexo(s)</span>
                      )}
                      {item.palavras_chave?.length > 0 && (
                        <span className="truncate max-w-md">
                          Palavras-chave: {item.palavras_chave.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {activeSubTab === 'faq_publishing' && (
                      <>
                        {item.estado !== 'publicado' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(item, 'publicado')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{t('faq.action_publish')}</span>
                          </button>
                        )}
                        {item.estado === 'publicado' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(item, 'despublicado')}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{t('faq.action_unpublish')}</span>
                          </button>
                        )}
                        {item.estado !== 'arquivado' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(item, 'arquivado')}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{t('faq.action_archive')}</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setHistoryArticle(item)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      title={t('faq.action_history')}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('faq.action_history')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditArticleModal(item)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: 'article', id: item.id, label: item.titulo })}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                {t('faq.pagination_info', { page, totalPages, total: totalArticles })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('faq.prev_page')}</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('faq.next_page')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: CATEGORIA CRUD                                              */}
      {/* ================================================================== */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCat ? t('faq.edit_category') : t('faq.new_category')}
              </h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('faq.field_cat_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  placeholder="Ex: Matrículas e Admissões"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('faq.field_cat_desc')}
                </label>
                <textarea
                  rows={2}
                  value={catDescricao}
                  onChange={(e) => setCatDescricao(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_cat_order')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={catOrdem}
                    onChange={(e) => setCatOrdem(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_visibility')}
                  </label>
                  <select
                    value={catVisibilidade}
                    onChange={(e) => setCatVisibilidade(e.target.value as FaqVisibilidade)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="todos">{t('faq.visibility_todos')}</option>
                    <option value="tenant_admin">{t('faq.visibility_tenant_admin')}</option>
                    <option value="docentes">{t('faq.visibility_docentes')}</option>
                    <option value="estudantes">{t('faq.visibility_estudantes')}</option>
                    <option value="encarregados">{t('faq.visibility_encarregados')}</option>
                    <option value="super_admin">{t('faq.visibility_super_admin')}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catAtivo}
                  onChange={(e) => setCatAtivo(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{t('faq.field_cat_active')}</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {t('faq.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={catSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
                >
                  {catSaving ? 'A guardar...' : t('faq.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: PERGUNTA / ARTIGO CRUD                                      */}
      {/* ================================================================== */}
      {isArtModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl my-8 p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingArt ? t('faq.edit_item') : artTipo === 'artigo_tutorial' ? t('faq.new_article') : t('faq.new_question')}
              </h3>
              <button
                type="button"
                onClick={() => setIsArtModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_type')}
                  </label>
                  <select
                    value={artTipo}
                    onChange={(e) => setArtTipo(e.target.value as FaqTipo)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="faq">{t('faq.type_faq')}</option>
                    <option value="artigo_tutorial">{t('faq.type_artigo_tutorial')}</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_category')} *
                  </label>
                  <select
                    required
                    value={artCategoriaId}
                    onChange={(e) => setArtCategoriaId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="">Seleccione uma categoria...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('faq.field_title')} *
                </label>
                <input
                  type="text"
                  required
                  value={artTitulo}
                  onChange={(e) => setArtTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  placeholder="Ex: Como lançar notas finais na pauta semestral?"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('faq.field_answer')} *
                </label>
                <RichTextEditor value={artRespostaHtml} onChange={setArtRespostaHtml} />
              </div>

              {/* Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('faq.field_keywords')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder={t('faq.field_keywords_placeholder')}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
                {artKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {artKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => setArtKeywords(artKeywords.filter((k) => k !== kw))}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_attachments')}
                  </label>
                  <label className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingFile ? 'A carregar...' : t('faq.attachments_add')}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleAttachmentUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {artAnexos.length === 0 ? (
                  <p className="text-[11px] text-slate-400">{t('faq.attachments_empty')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {artAnexos.map((ax) => (
                      <div
                        key={ax.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ax.tipo === 'pdf' ? (
                            <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                          )}
                          <span className="truncate font-medium text-slate-800 dark:text-slate-200">{ax.nome}</span>
                          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                            ({formatBytes(ax.tamanho_bytes)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={ax.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setArtAnexos(artAnexos.filter((item) => item.id !== ax.id))}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_status')}
                  </label>
                  <select
                    value={artEstado}
                    onChange={(e) => setArtEstado(e.target.value as FaqEstado)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="rascunho">{t('faq.status_rascunho')}</option>
                    <option value="publicado">{t('faq.status_publicado')}</option>
                    <option value="despublicado">{t('faq.status_despublicado')}</option>
                    <option value="arquivado">{t('faq.status_arquivado')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_visibility')}
                  </label>
                  <select
                    value={artVisibilidade}
                    onChange={(e) => setArtVisibilidade(e.target.value as FaqVisibilidade)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="todos">{t('faq.visibility_todos')}</option>
                    <option value="tenant_admin">{t('faq.visibility_tenant_admin')}</option>
                    <option value="docentes">{t('faq.visibility_docentes')}</option>
                    <option value="estudantes">{t('faq.visibility_estudantes')}</option>
                    <option value="encarregados">{t('faq.visibility_encarregados')}</option>
                    <option value="super_admin">{t('faq.visibility_super_admin')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_priority')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={artPrioridade}
                    onChange={(e) => setArtPrioridade(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={artUtilizavelIa}
                  onChange={(e) => setArtUtilizavelIa(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{t('faq.field_ai_usable')}</span>
              </label>

              {editingArt && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('faq.field_change_note')}
                  </label>
                  <input
                    type="text"
                    value={artNotaAlteracao}
                    onChange={(e) => setArtNotaAlteracao(e.target.value)}
                    placeholder="Descreva resumidamente o motivo desta edição..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsArtModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {t('faq.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={artSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
                >
                  {artSaving ? 'A guardar...' : t('faq.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: HISTÓRICO DE ALTERAÇÕES                                     */}
      {/* ================================================================== */}
      {historyArticle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('faq.history_title')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-lg">
                  {historyArticle.titulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryArticle(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!historyArticle.historico_alteracoes?.length ? (
                <p className="py-8 text-center text-xs text-slate-500">{t('faq.history_empty')}</p>
              ) : (
                historyArticle.historico_alteracoes.map((entry) => (
                  <div key={entry.id} className="py-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {entry.autor_email || entry.autor_nome}
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {new Date(entry.data).toLocaleString('pt-PT')}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{entry.resumo}</p>
                    {entry.alteracoes && entry.alteracoes.length > 0 && (
                      <div className="mt-2 space-y-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-[11px]">
                        {entry.alteracoes.map((diff, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2">
                            <span className="col-span-3 font-semibold text-slate-600 dark:text-slate-300">
                              {diff.campo}
                            </span>
                            <span className="col-span-4 text-slate-400 truncate">
                              {diff.antes !== null && diff.antes !== undefined ? String(diff.antes) : '—'}
                            </span>
                            <span className="col-span-5 text-slate-800 dark:text-slate-100 truncate">
                              {diff.depois !== null && diff.depois !== undefined ? String(diff.depois) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryArticle(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('faq.action_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: CONFIRMAR ELIMINAÇÃO                                        */}
      {/* ================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold">{t('faq.delete_confirm')}</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deseja eliminar permanentemente "{deleteTarget.label}"? Esta acção fica registada na auditoria.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('faq.action_cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'A eliminar...' : 'Confirmar Eliminação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
