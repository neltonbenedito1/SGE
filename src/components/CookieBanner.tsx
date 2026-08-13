/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cookie Consent Banner Component
 * Compliance: LGPD / GDPR / Protection of Minor Educational Data
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, Settings, Check, X, Lock, Info, Sliders, ChevronDown, ChevronUp, FileText, AlertCircle } from 'lucide-react';
import { 
  getCookie, 
  saveConsentDecision, 
  CookiePreferences, 
  DEFAULT_PREFERENCES, 
  SYSTEM_COOKIES_REGISTRY 
} from '../lib/cookies';
import { CookiePolicyModal } from './CookiePolicyModal';

interface CookieBannerProps {
  onConsentChange?: (preferences: CookiePreferences) => void;
  openPolicyInitially?: boolean;
}

export function CookieBanner({ onConsentChange, openPolicyInitially = false }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(openPolicyInitially);
  
  const [categories, setCategories] = useState<CookiePreferences>({
    essential: true,
    preferences: true,
    functional: true,
    analytics: false, // Default off for analytics
  });

  useEffect(() => {
    const existingConsent = getCookie('user_cookie_consent');
    if (!existingConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const decision = saveConsentDecision('all');
    setIsVisible(false);
    if (onConsentChange) onConsentChange(decision.categories);
  };

  const handleEssentialOnly = () => {
    const decision = saveConsentDecision('essential_only');
    setIsVisible(false);
    if (onConsentChange) onConsentChange(decision.categories);
  };

  const handleSaveCustom = () => {
    const decision = saveConsentDecision('custom', categories);
    setIsVisible(false);
    setIsCustomizing(false);
    if (onConsentChange) onConsentChange(decision.categories);
  };

  return (
    <>
      {/* Main Cookie Banner (Fixed Bottom Anchor) */}
      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-[9990] p-3 sm:p-4 md:p-6 animate-in slide-in-from-bottom-6 duration-300 pointer-events-auto">
          <div className="max-w-5xl mx-auto bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-xl border border-slate-700/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 ring-1 ring-white/10">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              
              {/* Header Info & Text */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
                  <Cookie className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black font-sans text-white tracking-tight">
                      Privacidade & Gestão de Cookies
                    </h3>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" /> Sem Cookies de Terceiros
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    Utilizamos cookies essenciais e seguros para garantir o login, a segurança de sessão e a navegação fluida de alunos, encarregados de educação e professores. 
                    <strong className="text-indigo-300 font-semibold"> Não coletamos dados para fins publicitários nem compartilhamos informações com terceiros.</strong>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0 justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPolicyOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Política
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" /> Personalizar
                </button>

                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                >
                  Apenas Essenciais
                </button>

                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" /> Aceitar Todos
                </button>
              </div>
            </div>

            {/* Collapsible Category Customization Panel */}
            {isCustomizing && (
              <div className="mt-5 pt-5 border-t border-slate-800 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-400" /> Configuração por Categoria de Cookie
                  </h4>
                  <span className="text-[11px] text-slate-400">Pode alterar estas definições a qualquer momento</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Essential */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-white">Essenciais & Sessão</span>
                        <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Obrigatórios</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Login seguro (HttpOnly), proteção CSRF, expiração por inatividade e prevenção de acesso não autorizado.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="mt-1 rounded border-slate-600 text-indigo-600 focus:ring-0 opacity-60 w-4 h-4 cursor-not-allowed"
                    />
                  </div>

                  {/* Preferences */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Preferências de Utilizador</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Lembrar tema visual (claro/escuro), idioma da plataforma (PT/EN/ES/FR) e definições de acessibilidade.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={categories.preferences}
                      onChange={(e) => setCategories({ ...categories, preferences: e.target.checked })}
                      className="mt-1 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {/* Functional */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Funcionais Educacionais</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Salvar filtros de pesquisa de turmas/alunos, posição de navegação, estado de painéis e rascunhos de formulários.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={categories.functional}
                      onChange={(e) => setCategories({ ...categories, functional: e.target.checked })}
                      className="mt-1 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {/* Analytics */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Analítica Interna</span>
                        <span className="text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">Anónimo</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Estatísticas internas para avaliar o tempo de resposta e padrões de uso das funcionalidades da plataforma.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={categories.analytics}
                      onChange={(e) => setCategories({ ...categories, analytics: e.target.checked })}
                      className="mt-1 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomizing(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow cursor-pointer"
                  >
                    Guardar Minhas Preferências
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cookie Policy Modal */}
      {isPolicyOpen && (
        <CookiePolicyModal 
          onClose={() => setIsPolicyOpen(false)} 
          onUpdateConsent={(updatedCategories) => {
            if (onConsentChange) onConsentChange(updatedCategories);
          }}
        />
      )}
    </>
  );
}
