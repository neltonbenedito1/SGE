/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cookie Policy Modal & Full Page View Component
 * LGPD / GDPR Educational Privacy & Transparency
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Cookie, 
  Lock, 
  Check, 
  Trash2, 
  Info, 
  HelpCircle, 
  Sliders, 
  FileText, 
  ExternalLink,
  Users,
  GraduationCap,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { 
  SYSTEM_COOKIES_REGISTRY, 
  getCookie, 
  saveConsentDecision, 
  revokeAllNonEssentialCookies,
  CookiePreferences,
  CookieCategory,
  CURRENT_POLICY_VERSION
} from '../lib/cookies';

interface CookiePolicyModalProps {
  onClose: () => void;
  onUpdateConsent?: (categories: CookiePreferences) => void;
}

export function CookiePolicyModal({ onClose, onUpdateConsent }: CookiePolicyModalProps) {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todas');
  const [consentStatus, setConsentStatus] = useState<string>('non_decided');
  const [activePreferences, setActivePreferences] = useState<CookiePreferences>({
    essential: true,
    preferences: true,
    functional: true,
    analytics: false
  });
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  useEffect(() => {
    const consent = getCookie('user_cookie_consent') || 'non_decided';
    setConsentStatus(consent);

    try {
      const savedCats = getCookie('user_cookie_categories');
      if (savedCats) {
        setActivePreferences(JSON.parse(savedCats));
      }
    } catch (e) {
      console.warn('Could not parse cookie categories', e);
    }
  }, []);

  const notify = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleSavePreferences = () => {
    const decision = saveConsentDecision('custom', activePreferences);
    setConsentStatus(decision.consentType);
    if (onUpdateConsent) onUpdateConsent(decision.categories);
    notify('Preferências de cookies atualizadas com sucesso!');
  };

  const handleRevokeAll = () => {
    revokeAllNonEssentialCookies();
    const decision = saveConsentDecision('essential_only');
    setConsentStatus('essential_only');
    setActivePreferences({
      essential: true,
      preferences: false,
      functional: false,
      analytics: false
    });
    setShowRevokeConfirm(false);
    if (onUpdateConsent) onUpdateConsent(decision.categories);
    notify('Todos os cookies não-essenciais foram revogados e eliminados!');
  };

  const filteredCookies = SYSTEM_COOKIES_REGISTRY.filter(c => {
    if (selectedCategoryFilter === 'todas') return true;
    return c.category === selectedCategoryFilter;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-[9999] animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black font-sans text-slate-900 dark:text-white">
                  Política de Cookies & Proteção de Dados
                </h2>
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  v{CURRENT_POLICY_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plataforma de Gestão Educacional SysEdu • Conformidade LGPD & GDPR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs leading-relaxed font-sans">
          
          {/* Notification toast inside modal */}
          {notificationMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-2xl font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{notificationMsg}</span>
            </div>
          )}

          {/* Section 1: Plain Language Introduction */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-4 sm:p-5 rounded-2xl space-y-2">
            <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <Cookie className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> O que são cookies e por que os utilizamos?
            </h3>
            <p className="text-slate-700 dark:text-slate-300">
              Cookies são pequenos arquivos de texto armazenados com segurança no seu navegador quando acede ao nosso aplicativo educacional. No <strong>SysEdu</strong>, os cookies servem para autenticar professores, alunos e encarregados de educação, manter a sessão ativa com expiração automática de segurança, e recordar as suas preferências (como idioma e tema).
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Concebido especialmente para escolas, preservando a privacidade de menores de idade.</span>
            </div>
          </div>

          {/* Section 2: Minor & Student Data Protection Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                <Lock className="w-4 h-4" /> Sem Terceiros / Publicidade
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Não utilizamos cookies de publicidade, redes sociais ou rastreamento comercial de terceiros. Todos os cookies são exclusivamente first-party.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" /> Minimização de Dados
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Nenhum dado pessoal sensível (nomes, notas, contatos) é guardado no cookie. Apenas tokens criptográficos aleatórios referenciados no servidor.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                <Calendar className="w-4 h-4" /> Expiração por Inatividade
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                A sessão de login HttpOnly expira automaticamente após 30 minutos de inatividade para proteger o acesso a diários de classe e notas.
              </p>
            </div>
          </div>

          {/* Section 3: Interactive Consent Management Widget */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Seu Painel de Consentimento de Cookies
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Estado atual: <strong className="text-indigo-600 dark:text-indigo-400 uppercase font-mono">{consentStatus}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revogar Não-Essenciais
              </button>
            </div>

            {/* Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Essenciais & Sessão</span>
                  <span className="text-[10px] text-slate-400 block">Autenticação, CSRF, Inatividade (Obrigatórios)</span>
                </div>
                <input type="checkbox" checked={true} disabled={true} className="rounded text-indigo-600 w-4 h-4 opacity-50 cursor-not-allowed" />
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Preferências do Utilizador</span>
                  <span className="text-[10px] text-slate-400 block">Tema visual, idioma, acessibilidade</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={activePreferences.preferences} 
                  onChange={(e) => setActivePreferences({ ...activePreferences, preferences: e.target.checked })} 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
                />
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Funcionais Educacionais</span>
                  <span className="text-[10px] text-slate-400 block">Filtros de turma/alunos, rascunhos de pauta</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={activePreferences.functional} 
                  onChange={(e) => setActivePreferences({ ...activePreferences, functional: e.target.checked })} 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
                />
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Analítica Interna</span>
                  <span className="text-[10px] text-slate-400 block">Métricas anónimas de desempenho</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={activePreferences.analytics} 
                  onChange={(e) => setActivePreferences({ ...activePreferences, analytics: e.target.checked })} 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
                />
              </div>

            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Aplicar e Salvar Preferências
              </button>
            </div>
          </div>

          {/* Section 4: System Cookies Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Tabela Informativa de Cookies Utilizados
              </h3>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('todas')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${selectedCategoryFilter === 'todas' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('essential')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${selectedCategoryFilter === 'essential' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Essenciais
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('preferences')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${selectedCategoryFilter === 'preferences' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Preferências
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('functional')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${selectedCategoryFilter === 'functional' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Funcionais
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    <th className="p-3">Nome do Cookie</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Duração / Validade</th>
                    <th className="p-3">Atributos de Segurança</th>
                    <th className="p-3">Finalidade / Propósito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCookies.map((item) => (
                    <tr key={item.name} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {item.name}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.category === 'essential' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                          item.category === 'preferences' ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' :
                          item.category === 'functional' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700'
                        }`}>
                          {item.category === 'essential' ? 'Essencial' :
                           item.category === 'preferences' ? 'Preferência' :
                           item.category === 'functional' ? 'Funcional' : 'Analítica'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        {item.duration}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {item.securityAttributes}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {item.purpose}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Browser Cookie Removal Instructions */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Como gerir ou apagar cookies no seu navegador?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              Além do painel acima, pode configurar o seu navegador para bloquear ou apagar cookies. Note que o bloqueio de cookies essenciais impedirá o início de sessão no portal educacional.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                Google Chrome <ExternalLink className="w-3 h-3" />
              </a>
              <span>•</span>
              <a href="https://support.mozilla.org/pt-PT/kb/protecao-reforcada-contra-rastreio-firefox-desktop" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                Mozilla Firefox <ExternalLink className="w-3 h-3" />
              </a>
              <span>•</span>
              <a href="https://support.apple.com/pt-pt/guide/safari/sfri11471/mac" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                Apple Safari <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Dúvidas de privacidade? Contacte o encarregado de dados da sua escola.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer shadow"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Revoking All Non-Essential Cookies */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black">Revogar e Apagar Cookies?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação irá remover imediatamente do seu navegador todos os cookies de preferências, temas e rascunhos salvos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRevokeAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow"
              >
                Confirmar e Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
