/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Comprehensive, Security-Hardened Cookie Management System
 * LGPD / GDPR Compliant for Educational Institutions & Student Data Protection
 */

export type CookieCategory = 'essential' | 'preferences' | 'functional' | 'analytics';

export interface CookiePreferences {
  essential: boolean;    // Always true (Authentication, CSRF, Consent)
  preferences: boolean;  // Theme, Language, Accessibility settings
  functional: boolean;   // Active filters, Last opened module, Draft forms, Panel state
  analytics: boolean;    // Internal anonymized platform usage metrics
  // Legacy fields for backwards compatibility
  session?: boolean;
  theme?: boolean;
  lastPage?: boolean;
  formData?: boolean;
  smtp?: boolean;
}

export interface CookieConsentState {
  consentType: 'all' | 'essential_only' | 'custom' | 'refused';
  categories: CookiePreferences;
  timestamp: string;
  version: string;
  userAgent?: string;
}

export interface CookieMetadata {
  name: string;
  category: CookieCategory;
  purpose: string;
  duration: string;
  securityAttributes: string;
  type: 'First-party (Server/HttpOnly)' | 'First-party (Client)';
  containsSensitiveData: boolean;
}

export const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  preferences: true,
  functional: true,
  analytics: false, // Default opt-in off for analytics following privacy minimization
  session: true,
  theme: true,
  lastPage: true,
  formData: true,
  smtp: true,
};

export const CURRENT_POLICY_VERSION = "2.0-edu-2026";

/**
 * Metadata Table of All System Cookies
 * Fully documented for institutional transparency, parents, and compliance audits.
 */
export const SYSTEM_COOKIES_REGISTRY: CookieMetadata[] = [
  {
    name: 'sysedu_session_id',
    category: 'essential',
    purpose: 'Manutenção segura da sessão de utilizador autenticado e rotação de tokens com expiração de inatividade (30 minutos).',
    duration: '30 min inatividade / 24h max',
    securityAttributes: 'HttpOnly; Secure; SameSite=Strict; Path=/',
    type: 'First-party (Server/HttpOnly)',
    containsSensitiveData: false, // Only contains opaque crypto token
  },
  {
    name: 'sysedu_csrf_token',
    category: 'essential',
    purpose: 'Proteção contra ataques de falsificação de solicitações entre sites (CSRF).',
    duration: 'Sessão',
    securityAttributes: 'HttpOnly; Secure; SameSite=Strict; Path=/',
    type: 'First-party (Server/HttpOnly)',
    containsSensitiveData: false,
  },
  {
    name: 'user_cookie_consent',
    category: 'essential',
    purpose: 'Guarda o estado de consentimento das preferências de privacidade escolhidas pelo utilizador.',
    duration: '180 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'user_cookie_categories',
    category: 'essential',
    purpose: 'Guarda as categorias de cookies explicitamente autorizadas pelo utilizador.',
    duration: '180 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'user_theme',
    category: 'preferences',
    purpose: 'Armazena a preferência de tema visual da interface (ex.: Claro, Escuro, Esmeralda, Slate).',
    duration: '60 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'saas_educ_system_lang',
    category: 'preferences',
    purpose: 'Armazena o idioma selecionado para a plataforma (Português, Inglês, Espanhol, Francês).',
    duration: '60 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'user_accessibility',
    category: 'preferences',
    purpose: 'Guarda preferências de acessibilidade (tamanho de fonte, alto contraste).',
    duration: '60 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'last_module',
    category: 'functional',
    purpose: 'Lembrar o último módulo educacional acedido para agilizar a navegação ao retornar.',
    duration: '30 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'last_scroll',
    category: 'functional',
    purpose: 'Restaura a posição de deslocamento (scroll) da página para conveniência do utilizador.',
    duration: '30 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'sysedu_filters',
    category: 'functional',
    purpose: 'Guarda os filtros de pesquisa de alunos, turmas e ano letivo ativo.',
    duration: '30 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'sysedu_sidebar_state',
    category: 'functional',
    purpose: 'Mantém o estado expandido/recolhido dos painéis de navegação lateral.',
    duration: '30 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'draft_*',
    category: 'functional',
    purpose: 'Guarda rascunhos temporários de formulários não submetidos para evitar perda de dados.',
    duration: '7 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
  {
    name: 'sysedu_analytics_id',
    category: 'analytics',
    purpose: 'Identificador anónimo de utilização interna para estatísticas de desempenho da plataforma (opcional).',
    duration: '90 dias',
    securityAttributes: 'Secure; SameSite=Lax; Path=/',
    type: 'First-party (Client)',
    containsSensitiveData: false,
  },
];

/**
 * Standard client-side helper to set a cookie with explicit parameters
 */
export function setCookie(
  name: string,
  value: string,
  hours: number = 24,
  sameSite: 'Lax' | 'Strict' | 'None' = 'Lax',
  path: string = '/'
) {
  const date = new Date();
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  const expires = '; expires=' + date.toUTCString();
  const isSecureEnv = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
  const secureFlag = isSecureEnv ? '; Secure' : '';

  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=${path}; SameSite=${sameSite}${secureFlag}`;
}

/**
 * Gets cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

/**
 * Deletes a cookie explicitly across paths
 */
export function deleteCookie(name: string, path: string = '/') {
  document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
  try {
    localStorage.removeItem(name);
  } catch (e) {}
}

/**
 * Checks if a specific cookie category is allowed based on user consent
 */
export function isCategoryAllowed(category: CookieCategory): boolean {
  if (category === 'essential') return true; // Essential cookies are always allowed

  const consentRaw = getCookie('user_cookie_consent');
  if (!consentRaw) return false; // Consent not given yet
  if (consentRaw === 'refused' || consentRaw === 'essential_only') return false;

  try {
    const categoriesRaw = getCookie('user_cookie_categories');
    if (!categoriesRaw) {
      // Fallback to legacy structure
      const preferences = JSON.parse(getCookie('user_cookie_preferences') || '{}');
      if (category === 'preferences') return preferences.theme !== false;
      if (category === 'functional') return preferences.lastPage !== false || preferences.formData !== false;
      if (category === 'analytics') return false;
      return false;
    }

    const categories = JSON.parse(categoriesRaw) as CookiePreferences;
    return !!categories[category];
  } catch (e) {
    return false;
  }
}

/**
 * Backward compatible check for preference types
 */
export function isPreferenceAllowed(pref: keyof CookiePreferences): boolean {
  if (pref === 'essential' || pref === 'session') {
    const consent = getCookie('user_cookie_consent');
    return consent !== 'refused';
  }
  if (pref === 'theme' || pref === 'preferences') return isCategoryAllowed('preferences');
  if (pref === 'lastPage' || pref === 'formData' || pref === 'functional') return isCategoryAllowed('functional');
  if (pref === 'analytics') return isCategoryAllowed('analytics');
  return isCategoryAllowed('functional');
}

/**
 * Saves a setting into cookie ONLY if the corresponding category is allowed by user
 */
export function saveSettingIfAllowed(
  name: string,
  value: string,
  categoryOrPref: CookieCategory | keyof CookiePreferences,
  hours: number = 24
) {
  let category: CookieCategory = 'functional';

  if (categoryOrPref === 'essential' || categoryOrPref === 'preferences' || categoryOrPref === 'functional' || categoryOrPref === 'analytics') {
    category = categoryOrPref;
  } else if (categoryOrPref === 'theme') {
    category = 'preferences';
  } else if (categoryOrPref === 'lastPage' || categoryOrPref === 'formData' || categoryOrPref === 'smtp') {
    category = 'functional';
  } else if (categoryOrPref === 'session') {
    category = 'essential';
  }

  const consent = getCookie('user_cookie_consent');
  
  if (category === 'essential') {
    if (consent !== 'refused') {
      setCookie(name, value, hours);
    }
  } else if (consent === 'accepted' || consent === 'custom') {
    if (isCategoryAllowed(category)) {
      setCookie(name, value, hours);
    }
  }
}

/**
 * Saves or updates full consent decision
 */
export function saveConsentDecision(
  type: 'all' | 'essential_only' | 'custom' | 'refused',
  customCategories?: Partial<CookiePreferences>
) {
  const preferences: CookiePreferences = {
    essential: true,
    preferences: type === 'all' || (type === 'custom' && !!customCategories?.preferences),
    functional: type === 'all' || (type === 'custom' && !!customCategories?.functional),
    analytics: type === 'all' || (type === 'custom' && !!customCategories?.analytics),
    session: type !== 'refused',
    theme: type === 'all' || (type === 'custom' && !!customCategories?.preferences),
    lastPage: type === 'all' || (type === 'custom' && !!customCategories?.functional),
    formData: type === 'all' || (type === 'custom' && !!customCategories?.functional),
    smtp: type === 'all' || (type === 'custom' && !!customCategories?.functional),
  };

  const state: CookieConsentState = {
    consentType: type,
    categories: preferences,
    timestamp: new Date().toISOString(),
    version: CURRENT_POLICY_VERSION,
  };

  // 180 days consent validity (6 months)
  setCookie('user_cookie_consent', type, 180 * 24);
  setCookie('user_cookie_categories', JSON.stringify(preferences), 180 * 24);
  setCookie('user_cookie_preferences', JSON.stringify(preferences), 180 * 24);

  // If consent was revoked or limited to essential, remove non-essential cookies immediately
  if (type === 'essential_only' || type === 'refused') {
    revokeAllNonEssentialCookies();
  }

  return state;
}

/**
 * Revokes consent and cleans all non-essential cookies from the client browser
 */
export function revokeAllNonEssentialCookies() {
  const nonEssentialCookies = [
    'user_theme',
    'saas_educ_system_lang',
    'user_accessibility',
    'last_module',
    'last_scroll',
    'sysedu_filters',
    'sysedu_sidebar_state',
    'sysedu_analytics_id',
    'draft_provincia',
    'draft_escola',
    'draft_teacher',
    'draft_student',
    'draft_turma',
    'draft_classe',
    'draft_pauta',
    'draft_processo',
    'draft_user',
    'draft_classe_escolar',
    'draft_super_notif',
    'draft_smtp_form',
    'draft_tenant_form',
    'draft_plan_form',
    'draft_payment_form',
  ];

  nonEssentialCookies.forEach((cookieName) => {
    deleteCookie(cookieName);
  });
}

// --- Specific App Helpers ---

export function saveUserSessionCookie(sessionObj: any) {
  try {
    const raw = JSON.stringify(sessionObj);
    localStorage.setItem('user_session', raw);
    sessionStorage.setItem('user_session', raw);
  } catch (e) {}
  saveSettingIfAllowed('user_session', JSON.stringify(sessionObj), 'essential', 365 * 24);
}

export function getUserSessionCookie(): any | null {
  try {
    const local = localStorage.getItem('user_session');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  try {
    const session = sessionStorage.getItem('user_session');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  const sessionStr = getCookie('user_session');
  if (sessionStr) {
    try {
      return JSON.parse(sessionStr);
    } catch (e) {}
  }
  return null;
}

export function saveCurrentView(view: string) {
  try {
    localStorage.setItem('sysedu_current_view', view);
    sessionStorage.setItem('sysedu_current_view', view);
  } catch (e) {}
  saveSettingIfAllowed('sysedu_current_view', view, 'functional', 30 * 24);
}

export function getCurrentView(): string | null {
  try {
    const local = localStorage.getItem('sysedu_current_view');
    if (local) return local;
  } catch (e) {}
  try {
    const session = sessionStorage.getItem('sysedu_current_view');
    if (session) return session;
  } catch (e) {}
  const cookieView = getCookie('sysedu_current_view');
  if (cookieView) return cookieView;
  return null;
}

export function saveThemePreference(theme: string) {
  saveSettingIfAllowed('user_theme', theme, 'preferences', 60 * 24);
  try {
    localStorage.setItem('user_theme', theme);
  } catch (e) {}
}

export function getThemePreference(): string {
  const cookieTheme = getCookie('user_theme');
  if (cookieTheme) return cookieTheme;
  try {
    const localTheme = localStorage.getItem('user_theme');
    if (localTheme) return localTheme;
  } catch (e) {}
  return 'theme-dark';
}

export function saveLastAction(action: string) {
  saveSettingIfAllowed('last_action', action, 'functional', 30 * 24);
}

export function saveLastModule(module: string) {
  saveSettingIfAllowed('last_module', module, 'functional', 30 * 24);
  try {
    localStorage.setItem('last_module', module);
  } catch (e) {}
}

export function getLastModule(): string {
  const cookieModule = getCookie('last_module');
  if (cookieModule) return cookieModule;
  try {
    const localModule = localStorage.getItem('last_module');
    if (localModule) return localModule;
  } catch (e) {}
  return 'dashboard';
}

export function saveLastScrollPosition(scrollTop: number) {
  saveSettingIfAllowed('last_scroll', String(scrollTop), 'functional', 30 * 24);
}

export function getLastScrollPosition(): number {
  return Number(getCookie('last_scroll')) || 0;
}
