import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  BookOpen,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import { sanitizeHtml } from '../../lib/sanitize';
import { useInstitutionFeatures } from '../../config/institutionTypes';
import type { FaqArticle, FaqCategory, TipoInstituicao } from '../../types';

interface PublicFaqViewProps {
  tipoInstituicao?: TipoInstituicao;
  onOpenSupport?: () => void;
}

async function buildPortalHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
  if (sessId) headers['x-session-id'] = sessId;
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch {}
  }
  return headers;
}

export const PublicFaqView: React.FC<PublicFaqViewProps> = ({ tipoInstituicao, onOpenSupport }) => {
  const { t } = useTranslation('common');
  const features = useInstitutionFeatures(tipoInstituicao);

  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [articles, setArticles] = useState<FaqArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const viewedRef = useRef<Set<string>>(new Set());

  const loadCategories = useCallback(async () => {
    try {
      const headers = await buildPortalHeaders();
      const res = await fetch('/api/faq/public/categories', { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch {}
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildPortalHeaders();
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (selectedCategory !== 'todas') params.set('categoria_id', selectedCategory);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/faq/public?${params.toString()}`, { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setArticles(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setTotalPages(Number(data.totalPages || 1));
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedCategory]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const handleToggleArticle = async (articleId: string) => {
    const nextExpanded = expandedId === articleId ? null : articleId;
    setExpandedId(nextExpanded);

    if (nextExpanded && !viewedRef.current.has(articleId)) {
      viewedRef.current.add(articleId);
      try {
        const headers = await buildPortalHeaders();
        await fetch(`/api/faq/public/${articleId}/view`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
      } catch {}
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('faq.portal_title')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('faq.portal_subtitle')} ({features.terms.disciplinePlural} / {features.terms.classCoursePlural})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('faq.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          {onOpenSupport && (
            <button
              type="button"
              onClick={onOpenSupport}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              {t('helpdesk.open_ticket_portal')}
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('todas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            selectedCategory === 'todas'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {t('faq.all_categories')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer tabular-nums ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat.nome} ({cat.artigos_count ?? 0})
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>A carregar base de conhecimento...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-14 text-center space-y-2 text-xs text-slate-500">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p>{t('faq.empty_public')}</p>
          </div>
        ) : (
          articles.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <div key={item.id} className="p-5">
                <button
                  type="button"
                  onClick={() => handleToggleArticle(item.id)}
                  className="w-full text-left flex items-start justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {item.categoria_nome || 'Geral'}
                      </span>
                      <span>·</span>
                      <span>{t(`faq.type_${item.tipo}`)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.titulo}</h3>
                    {!isOpen && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {item.resposta_texto}
                      </p>
                    )}
                  </div>
                  <div className="p-1.5 text-slate-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <div
                      className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-2 [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-indigo-600 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.resposta_html) }}
                    />

                    {item.anexos && item.anexos.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Anexos de apoio</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.anexos.map((ax) => (
                            <a
                              key={ax.id}
                              href={ax.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {ax.tipo === 'pdf' ? (
                                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                                )}
                                <span className="truncate">{ax.nome}</span>
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{t('faq.pagination_info', { page, totalPages, total })}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t('faq.prev_page')}</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <span>{t('faq.next_page')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
