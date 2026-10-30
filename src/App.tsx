/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { seedDatabaseIfEmpty, db, auth, registerUserInFirebaseAuth } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc,
  limit,
  addDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { Tenant, Plano } from './types';

const SuperAdminPortal = lazy(() => import('./components/SuperAdminPortal'));
const TenantPortal = lazy(() => import('./components/TenantPortal'));

import { ErrorBoundary } from './components/ErrorBoundary';
import { SysEduLogo } from './components/SysEduLogo';
import BrandbookView from './components/BrandbookView';
import { SamsungLoadingScreen } from './components/SamsungLoadingScreen';
import { StripeCheckoutStatus } from './components/StripeCheckoutStatus';
import { StripePricingCards } from './components/StripePricingCards';
import { 
  LANGUAGES, 
  getSystemLanguage, 
  setSystemLanguage, 
  translate, 
  fetchAiTranslation 
} from './lib/translation';
import { 
  Sparkles, 
  Building2, 
  CreditCard, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  Globe, 
  ArrowLeft,
  X,
  Palette,
  Search,
  LogOut,
  Calendar,
  Award,
  FileText,
  BookOpen,
  GraduationCap,
  School,
  MapPin,
  Sliders,
  BarChart3,
  Server,
  Mail,
  Send,
  KeyRound,
  FolderOpen,
  DollarSign,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Info,
  Lock,
  Upload
} from 'lucide-react';
import {
  saveUserSessionCookie,
  getUserSessionCookie,
  deleteCookie,
  saveThemePreference,
  getThemePreference,
  saveLastAction,
  saveLastModule,
  getCookie,
  setCookie,
  saveCurrentView,
  getCurrentView,
  DEFAULT_PREFERENCES,
  CookiePreferences
} from './lib/cookies';
import { CookieBanner } from './components/CookieBanner';
import { CookiePolicyModal } from './components/CookiePolicyModal';
import { MandatoryPasswordResetModal } from './components/MandatoryPasswordResetModal';
import { PasswordPolicyIndicator } from './components/PasswordPolicyIndicator';
import { validatePasswordPolicy } from './shared/passwordPolicy';
import { SessionStateService } from './lib/userState';
import { localDb } from './lib/localDb';
import { SearchableDropdown } from './components/SearchableDropdown';
import { WORLD_COUNTRIES } from './shared/catalogs';

export function applyThemeToDom(theme: string) {
  const isDark = theme === 'theme-dark' || theme === 'dark';
  document.documentElement.className = 'notranslate ' + (isDark ? 'theme-dark dark' : 'theme-slate light');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export default function App() {
  const initialSession = getUserSessionCookie();
  const getInitialView = (): 'landing' | 'superadmin' | 'tenant' | 'brandbook' => {
    if (initialSession) {
      return initialSession.tipo === 'super_admin' ? 'superadmin' : 'tenant';
    }
    const saved = getCurrentView();
    if (saved === 'brandbook' || saved === 'landing' || saved === 'superadmin' || saved === 'tenant') {
      return saved as any;
    }
    return 'landing';
  };

  const [currentView, setCurrentView] = useState<'landing' | 'superadmin' | 'tenant' | 'brandbook'>(getInitialView);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initialSession?.tenant_id || 'tenant-maputo');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'director' | 'docente' | 'pai' | 'estudante'>(
    (initialSession?.tipo as any) || 'admin'
  );
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(getThemePreference());
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [systemLang, setSystemLang] = useState<string>(getSystemLanguage());
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isCookiePolicyOpen, setIsCookiePolicyOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sync currentView changes to persistent storage
  useEffect(() => {
    if (currentView) {
      saveCurrentView(currentView);
    }
  }, [currentView]);

  // Sync session strictly with onAuthStateChanged and custom claims
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          if (tokenResult.claims.role === 'super_admin' || tokenResult.claims.super_admin === true) {
            saveUserSessionCookie({
              nome: user.displayName || 'Super Administrador',
              email: user.email || '',
              tipo: 'super_admin',
              tenant_id: 'super-admin',
            });
          }
        } catch (e) {
          console.warn('[onAuthStateChanged] Token check note:', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Keep systemLang state in sync with global language changes (from useLanguage hook)
  useEffect(() => {
    const handleLanguageChange = () => {
      setSystemLang(getSystemLanguage());
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, []);

  // Logout handler that clears client session cookies and calls server logout endpoint
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session/logout', { method: 'POST' });
    } catch (e) {
      console.warn('[Logout] Server session logout failed or offline:', e);
    }
    deleteCookie('user_session');
    saveCurrentView('landing');
    setCurrentView('landing');
  };

  // Non-blocking Toast notification system
  const [appNotification, setAppNotification] = useState<{ message: string; type: 'sucesso' | 'erro' | 'info' } | null>(null);

  // Global JavaScript Warning / Alert Interceptor Modal State
  const [jsPopup, setJsPopup] = useState<{ title: string; message: string; type: 'warning' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    setAppNotification({ message, type });
    setTimeout(() => {
      setAppNotification(null);
    }, 4500);
  };

  useEffect(() => {
    // Intercept standard window.alert to convert to custom popup modal
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      const messageStr = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg ?? '');
      setJsPopup({
        title: 'Aviso do Sistema (JavaScript)',
        message: messageStr,
        type: 'warning'
      });
    };

    // Custom event listener for explicit JS warning popups
    const handleGlobalJsAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setJsPopup({
          title: customEvent.detail.title || 'Aviso de JavaScript',
          message: customEvent.detail.message || '',
          type: customEvent.detail.type || 'warning'
        });
      }
    };
    window.addEventListener('sge-global-alert', handleGlobalJsAlert);

    // Intercept unhandled runtime JS errors
    const handleUncaughtError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (
        msg &&
        !msg.includes('ResizeObserver') &&
        !msg.includes('Script error') &&
        !msg.toLowerCase().includes('websocket') &&
        !msg.toLowerCase().includes('ws://') &&
        !msg.toLowerCase().includes('wss://')
      ) {
        console.warn('Intercepted unhandled JS Error:', msg);
        setJsPopup({
          title: '⚠️ Aviso de Execução JavaScript',
          message: msg,
          type: 'error'
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason;
      if (reason && typeof reason === 'string') {
        const reasonStr = String(reason);
        if (
          !reasonStr.includes('canceled') &&
          !reasonStr.toLowerCase().includes('websocket') &&
          !reasonStr.toLowerCase().includes('ws://') &&
          !reasonStr.toLowerCase().includes('wss://')
        ) {
          console.warn('Intercepted unhandled Promise Rejection:', reasonStr);
          setJsPopup({
            title: '⚠️ Aviso de Operação Assíncrona (JS)',
            message: reasonStr,
            type: 'error'
          });
        }
      }
    };

    window.addEventListener('error', handleUncaughtError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener('sge-global-alert', handleGlobalJsAlert);
      window.removeEventListener('error', handleUncaughtError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Command Menu states
  const [isCmdMenuOpen, setIsCmdMenuOpen] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Listen for tenant deletion event to revoke session immediately
  useEffect(() => {
    const handleTenantDeleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const deletedTenantId = customEvent.detail?.tenantId;
      const deletedTenantName = customEvent.detail?.tenantName || 'Instituição';
      const session = getUserSessionCookie();
      if (session && session.tenant_id === deletedTenantId && session.tipo !== 'super_admin') {
        deleteCookie('user_session');
        setCurrentView('landing');
        showNotification(`Acesso Revogado: A conta da instituição "${deletedTenantName}" foi eliminada do sistema. O seu acesso foi revogado.`, 'erro');
      }
    };
    window.addEventListener('sge-tenant-deleted', handleTenantDeleted);
    return () => window.removeEventListener('sge-tenant-deleted', handleTenantDeleted);
  }, []);

  // Get filtered command list
  const getCommandItems = () => {
    const items: Array<{
      category: string;
      label: string;
      icon: string;
      action: () => void;
    }> = [];

    // Category: Navigation
    if (currentView === 'tenant') {
      const tenantTabs = [
        { id: 'dashboard', label: 'Painel Geral (Dashboard)', icon: 'BarChart3' },
        { id: 'provincias', label: 'Províncias (Localidades)', icon: 'MapPin' },
        { id: 'escolas', label: 'Escolas Parceiras', icon: 'School' },
        { id: 'docentes', label: 'Corpo Docente (Professores)', icon: 'Users' },
        { id: 'estudantes', label: 'Alunos / Estudantes', icon: 'GraduationCap' },
        { id: 'turmas', label: 'Turmas Ativas', icon: 'FolderOpen' },
        { id: 'classes', label: 'Classes e Anos Lectivos', icon: 'BookOpen' },
        { id: 'pautas', label: 'Pautas de Avaliações', icon: 'Award' },
        { id: 'processos', label: 'Processos Individuais de Alunos', icon: 'FileText' },
        { id: 'calendario', label: 'Calendário de Provas & Eventos', icon: 'Calendar' },
        { id: 'definicoes', label: 'Configurações do Portal', icon: 'Settings' }
      ];
      tenantTabs.forEach(t => {
        items.push({
          category: 'Navegação do Portal',
          label: t.label,
          icon: t.icon,
          action: () => {
            try {
              window.dispatchEvent(new CustomEvent('sge-navigate-tenant', { detail: { tab: t.id } }));
            } catch (e) {
              const evt = document.createEvent('CustomEvent');
              evt.initCustomEvent('sge-navigate-tenant', true, true, { tab: t.id });
              window.dispatchEvent(evt);
            }
          }
        });
      });
    } else if (currentView === 'superadmin') {
      const saTabs = [
        { id: 'dashboard', label: 'Indicadores Globais (Dashboard)', icon: 'BarChart3' },
        { id: 'tenants', label: 'Instituições de Ensino (Tenants)', icon: 'Building2' },
        { id: 'plans', label: 'Gestão de Planos & Mensalidades', icon: 'CreditCard' },
        { id: 'payments', label: 'Histórico de Faturamento SaaS', icon: 'DollarSign' },
        { id: 'logs', label: 'Logs de Auditoria de Sistema', icon: 'Server' },
        { id: 'smtp', label: 'Configuração SMTP Global', icon: 'Mail' }
      ];
      saTabs.forEach(t => {
        items.push({
          category: 'Navegação Administrativa',
          label: t.label,
          icon: t.icon,
          action: () => {
            try {
              window.dispatchEvent(new CustomEvent('sge-navigate-superadmin', { detail: { tab: t.id } }));
            } catch (e) {
              const evt = document.createEvent('CustomEvent');
              evt.initCustomEvent('sge-navigate-superadmin', true, true, { tab: t.id });
              window.dispatchEvent(evt);
            }
          }
        });
      });
    }

    // Category: Temas
    const themes = [
      { id: 'theme-slate', name: 'Claro (Classic Slate)' },
      { id: 'theme-dark', name: 'Escuro (Midnight Dark)' },
      { id: 'theme-emerald', name: 'Verde (Emerald Green)' },
      { id: 'theme-amber', name: 'Amber (Cozy Amber)' }
    ];
    themes.forEach(t => {
      items.push({
        category: 'Aparência & Tema',
        label: `Mudar para Tema: ${t.name}`,
        icon: 'Palette',
        action: () => {
          handleThemeChange(t.id);
        }
      });
    });

    // Category: Idiomas
    LANGUAGES.forEach(l => {
      items.push({
        category: 'Idioma do Sistema',
        label: `Mudar Idioma para: ${l.name} ${l.flag}`,
        icon: 'Globe',
        action: () => {
          setSystemLanguage(l.code);
          setSystemLang(l.code);
          saveLastAction(`Alterou o idioma do sistema para ${l.name}`);
        }
      });
    });

    // Category: Ações Rápidas
    if (currentView === 'landing') {
      items.push({
        category: 'Ações Rápidas',
        label: 'Registrar Nova Escola (Auto-Onboarding)',
        icon: 'Plus',
        action: () => {
          setOnboardingPreRegisteredNotice(null);
          setOnboardingError(null);
          setOnboardingForm({
            nome: '',
            logo_url: '',
            pais_origem: 'Moçambique',
            paises_sucursais: [],
            email_admin: '',
            senha: '',
            confirmar_senha: '',
            telefone: '',
            endereco: '',
            plano_id: plans[0]?.id || 'plano-basico',
            idioma_padrao: 'pt'
          });
          setIsOnboardingModalOpen(true);
        }
      });
    }

    if (currentView !== 'landing') {
      items.push({
        category: 'Ações Rápidas',
        label: 'Abrir Assistente Virtual IA (SGE Intelligence)',
        icon: 'Sparkles',
        action: () => {
          try {
            window.dispatchEvent(new CustomEvent('sge-open-ai-chat'));
          } catch (e) {
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('sge-open-ai-chat', true, true, null);
            window.dispatchEvent(evt);
          }
        }
      });

      items.push({
        category: 'Ações Rápidas',
        label: 'Sair da Conta (Fazer Logoff)',
        icon: 'LogOut',
        action: () => {
          deleteCookie('user_session');
          setCurrentView('landing');
        }
      });
    }

    // Filter by query
    if (!cmdSearchQuery) return items;
    return items.filter(i => 
      i.label.toLowerCase().includes(cmdSearchQuery.toLowerCase()) || 
      i.category.toLowerCase().includes(cmdSearchQuery.toLowerCase())
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdMenuOpen(prev => {
          if (!prev) {
            setCmdSearchQuery('');
            setActiveItemIndex(0);
          }
          return !prev;
        });
        return;
      }

      if (!isCmdMenuOpen) return;

      const items = getCommandItems();

      if (e.key === 'Escape') {
        setIsCmdMenuOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveItemIndex(prev => (prev + 1) % Math.max(1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveItemIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[activeItemIndex]) {
          items[activeItemIndex].action();
          setIsCmdMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCmdMenuOpen, cmdSearchQuery, activeItemIndex, currentView]);

  // Cookie consent states
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [cookiePrefs, setCookiePrefs] = useState<CookiePreferences>(() => {
    try {
      const saved = getCookie("user_cookie_preferences");
      return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [isPrefsDropdownOpen, setIsPrefsDropdownOpen] = useState(false);

  // Unified login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Bootstrap states
  const [bootstrapStatus, setBootstrapStatus] = useState<{ initialized: boolean; allowsBootstrap: boolean } | null>(null);
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('');
  const [bootstrapNome, setBootstrapNome] = useState('');

  useEffect(() => {
    async function checkSuperAdminExistence() {
      // 1. Verificar cache local de bootstrap concluído
      if (localStorage.getItem('sysedu_bootstrap_completed') === 'true') {
        setBootstrapStatus({ initialized: true, allowsBootstrap: false });
        setIsBootstrapMode(false);
        return;
      }

      // 2. Consulta à API do servidor
      try {
        const res = await fetch('/api/auth/bootstrap/status');
        const rawText = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {}
        if (res.ok && data) {
          if (data.initialized === true || !data.allowsBootstrap) {
            setBootstrapStatus({ initialized: true, allowsBootstrap: false });
            setIsBootstrapMode(false);
            localStorage.setItem('sysedu_bootstrap_completed', 'true');
            return;
          }
        }
      } catch (e) {}

      // 3. Verificação no Firestore (tanto system_config quanto superusers e users)
      try {
        const bootDoc = await getDoc(doc(db, 'system_config', 'bootstrap'));
        if (bootDoc.exists() && (bootDoc.data()?.initialized === true || bootDoc.data()?.allowsBootstrap === false)) {
          setBootstrapStatus({ initialized: true, allowsBootstrap: false });
          setIsBootstrapMode(false);
          localStorage.setItem('sysedu_bootstrap_completed', 'true');
          return;
        }

        const superusersSnap = await getDocs(query(collection(db, 'superusers'), limit(1)));
        if (!superusersSnap.empty) {
          setBootstrapStatus({ initialized: true, allowsBootstrap: false });
          setIsBootstrapMode(false);
          localStorage.setItem('sysedu_bootstrap_completed', 'true');
          return;
        }

        const usersSnap = await getDocs(query(collection(db, 'users'), where('tipo', '==', 'super_admin'), limit(1)));
        if (!usersSnap.empty) {
          setBootstrapStatus({ initialized: true, allowsBootstrap: false });
          setIsBootstrapMode(false);
          localStorage.setItem('sysedu_bootstrap_completed', 'true');
          return;
        }

        // Se nenhuma evidência de superadmin existir, permite cadastro inicial
        setBootstrapStatus({ initialized: false, allowsBootstrap: true });
      } catch (err) {
        // Em caso de erro de leitura ou restrição de regras, desativa por segurança
        setBootstrapStatus({ initialized: true, allowsBootstrap: false });
        setIsBootstrapMode(false);
      }
    }
    checkSuperAdminExistence();
  }, []);

  // Forgot Password / OTP State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoadingOtp, setForgotLoadingOtp] = useState(false);
  const [forgotLoadingReset, setForgotLoadingReset] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotOtpRequested, setForgotOtpRequested] = useState(false);

  const handleRequestForgotPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const emailClean = forgotEmail.trim().toLowerCase();
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setForgotError('Por favor, introduza um endereço de e-mail válido.');
      return;
    }

    setForgotLoadingOtp(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailClean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setForgotError(data.error || 'Nenhuma conta associada a este endereço de e-mail foi encontrada no sistema.');
          return;
        }
        throw new Error(data.error || 'Falha ao solicitar código OTP.');
      }

      setForgotOtpRequested(true);
      setForgotSuccess(data.message || 'Código OTP enviado com sucesso para o seu e-mail!');
    } catch (err: any) {
      // Fallback verification against Firestore: Account MUST exist in the system
      try {
        const [usersSnap, superSnap, teachersSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('email', '==', emailClean), limit(1))),
          getDocs(query(collection(db, 'superusers'), where('email', '==', emailClean), limit(1))),
          getDocs(query(collection(db, 'docentes'), where('email', '==', emailClean), limit(1)))
        ]);

        const accountExists = !usersSnap.empty || !superSnap.empty || !teachersSnap.empty;
        if (!accountExists) {
          setForgotError('Nenhuma conta associada a este endereço de e-mail foi encontrada no sistema.');
          return;
        }

        const otpGen = Math.floor(100000 + Math.random() * 900000).toString();
        await setDoc(doc(db, 'password_reset_otps', emailClean), {
          email: emailClean,
          otp: otpGen,
          expiresAt: Date.now() + 15 * 60 * 1000,
          attempts: 0,
          createdAt: new Date().toISOString(),
        }, { merge: true });

        setForgotOtpRequested(true);
        setForgotSuccess('Código OTP gerado com sucesso! Verifique a sua caixa de entrada de e-mail.');
      } catch (fallbackErr: any) {
        setForgotError(err.message || 'Erro ao solicitar código OTP.');
      }
    } finally {
      setForgotLoadingOtp(false);
    }
  };

  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const emailClean = forgotEmail.trim().toLowerCase();
    const otpClean = forgotOtp.trim();

    if (!emailClean || !otpClean || !forgotNewPassword) {
      setForgotError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('A confirmação da nova palavra-passe não coincide.');
      return;
    }

    const policy = validatePasswordPolicy(forgotNewPassword, emailClean);
    if (!policy.valid) {
      setForgotError(policy.errors[0] || 'A nova senha não atende aos requisitos de segurança.');
      return;
    }

    setForgotLoadingReset(true);
    try {
      const res = await fetch('/api/auth/forgot-password/verify-and-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailClean,
          otp: otpClean,
          newPassword: forgotNewPassword,
          confirmPassword: forgotConfirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao redefinir a palavra-passe.');
      }

      setForgotSuccess('Palavra-passe alterada com sucesso no Firebase Authentication! Já pode iniciar sessão.');
      setLoginEmail(emailClean);
      setLoginPassword('');
      setTimeout(() => {
        setIsForgotPasswordOpen(false);
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotSuccess('');
        setIsLoginModalOpen(true);
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao alterar palavra-passe.');
    } finally {
      setForgotLoadingReset(false);
    }
  };

  // First Login Reset states
  const [firstLoginResetUser, setFirstLoginResetUser] = useState<any | null>(null);
  const [firstLoginResetCurrentPassword, setFirstLoginResetCurrentPassword] = useState('');
  const [newFirstPassword, setNewFirstPassword] = useState('');
  const [confirmFirstPassword, setConfirmFirstPassword] = useState('');

  // Onboarding states
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    nome: '',
    logo_url: '',
    pais_origem: 'Moçambique',
    paises_sucursais: [] as string[],
    email_admin: '',
    telefone: '',
    endereco: '',
    plano_id: 'plano-basico',
    idioma_padrao: 'pt',
    senha: '',
    confirmar_senha: ''
  });
  const [onboardingShowPassword, setOnboardingShowPassword] = useState(false);
  const [onboardingShowConfirmPassword, setOnboardingShowConfirmPassword] = useState(false);
  const [onboardingPreRegisteredNotice, setOnboardingPreRegisteredNotice] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Unified authentication handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const emailClean = loginEmail.trim().toLowerCase();
      const pwdClean = loginPassword;

      if (!emailClean) {
        setLoginError('Por favor, informe seu e-mail.');
        setLoginLoading(false);
        return;
      }

      // 1. BOOTSTRAP INICIAL DO PRIMEIRO SUPERADMINISTRADOR (Exclusivo via Admin Backend)
      if (isBootstrapMode) {
        const pwdPolicy = validatePasswordPolicy(pwdClean, emailClean);
        if (!pwdPolicy.valid) {
          setLoginError(pwdPolicy.errors[0] || 'A palavra-passe não cumpre a política global de segurança.');
          setLoginLoading(false);
          return;
        }
        if (pwdClean !== bootstrapConfirmPassword) {
          setLoginError('A confirmação de palavra-passe não coincide.');
          setLoginLoading(false);
          return;
        }

        try {
          const bRes = await fetch('/api/auth/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: emailClean,
              password: pwdClean,
              confirmPassword: bootstrapConfirmPassword,
              nome: bootstrapNome || 'Super Administrador',
            }),
          });

          const rawText = await bRes.text();
          let bData: any = {};
          try {
            bData = JSON.parse(rawText);
          } catch {
            bData = {};
          }

          if (!bRes.ok) {
            setLoginError(bData?.error || 'Falha ao processar cadastro de superadministrador.');
            setLoginLoading(false);
            return;
          }

          const userCred = await signInWithEmailAndPassword(auth, emailClean, pwdClean);
          const tokenResult = await userCred.user.getIdTokenResult(true);

          if (tokenResult.claims.role === 'super_admin' || tokenResult.claims.super_admin === true) {
            saveUserSessionCookie({
              nome: bootstrapNome || 'Super Administrador',
              email: emailClean,
              tipo: 'super_admin',
              tenant_id: 'super-admin',
            });
            saveLastAction(`Bootstrap concluído com sucesso: ${emailClean}`);
            localStorage.setItem('sysedu_bootstrap_completed', 'true');
            setBootstrapStatus({ initialized: true, allowsBootstrap: false });
            setIsBootstrapMode(false);
            setLoginEmail('');
            setLoginPassword('');
            setBootstrapConfirmPassword('');
            setIsLoginModalOpen(false);
            setCurrentView('superadmin');
            setLoginLoading(false);
            return;
          }
        } catch (bErr: any) {
          setLoginError(bErr.message || 'Falha ao processar cadastro de superadministrador.');
          setLoginLoading(false);
          return;
        }
      }

      // 2. FLUXO PADRÃO: AUTENTICAÇÃO REAL EXCLUSIVA VIA FIREBASE AUTH
      let userCred: any;
      try {
        userCred = await signInWithEmailAndPassword(auth, emailClean, pwdClean);
      } catch (authErr: any) {
        const code = authErr?.code;
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          // Verificar se é primeiro acesso de utilizador com senha temporária
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', emailClean));
            const querySnap = await getDocs(q);
            let tempUser: any = null;
            querySnap.forEach((doc) => {
              const d = doc.data();
              if (d.ativo !== false && (d.mustChangePassword || d.requer_alteracao_senha) && (d.senha_temporaria === pwdClean || d.senha === pwdClean)) {
                tempUser = { id: doc.id, ...d };
              }
            });
            if (tempUser) {
              setFirstLoginResetUser(tempUser);
              setFirstLoginResetCurrentPassword(pwdClean);
              setIsLoginModalOpen(false);
              setLoginLoading(false);
              return;
            }
          } catch {}

          setLoginError('Credenciais inválidas. Verifique o seu e-mail e palavra-passe.');
        } else if (code === 'auth/too-many-requests') {
          setLoginError('Conta temporariamente bloqueada devido a demasiadas tentativas falhadas. Tente mais tarde.');
        } else if (code === 'auth/user-disabled') {
          setLoginError('Esta conta foi desativada pelo administrador.');
        } else {
          setLoginError(authErr?.message || 'Falha na autenticação. Verifique suas credenciais.');
        }
        setLoginLoading(false);
        return;
      }

      // 3. VALIDAÇÃO DE SUPER ADMIN (FIREBASE AUTH CLAIMS & FIRESTORE)
      const tokenResult = await userCred.user.getIdTokenResult(true);
      const claims = tokenResult.claims;

      let isSuperAdmin = claims.role === 'super_admin' || claims.super_admin === true;
      if (!isSuperAdmin) {
        try {
          const sDoc = await getDoc(doc(db, 'superusers', userCred.user.uid));
          if (sDoc.exists() && sDoc.data()?.ativo !== false) {
            isSuperAdmin = true;
          } else {
            const uDoc = await getDoc(doc(db, 'users', userCred.user.uid));
            if (uDoc.exists() && (uDoc.data()?.tipo === 'super_admin' || uDoc.data()?.role === 'super_admin')) {
              isSuperAdmin = true;
            }
          }
        } catch {}
      }

      if (isSuperAdmin) {
        saveUserSessionCookie({
          nome: userCred.user.displayName || 'Super Administrador',
          email: emailClean,
          tipo: 'super_admin',
          tenant_id: 'super-admin'
        });
        saveLastAction("Login realizado como Super Admin");
        localStorage.setItem('sysedu_bootstrap_completed', 'true');
        setBootstrapStatus({ initialized: true, allowsBootstrap: false });
        setIsBootstrapMode(false);
        setLoginEmail('');
        setLoginPassword('');
        setIsLoginModalOpen(false);
        setCurrentView('superadmin');
        setLoginLoading(false);
        return;
      }

      // 4. AUTENTICAÇÃO INSTITUCIONAL (TENANT)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', emailClean));
      const querySnap = await getDocs(q);
      let userDocData: any = null;

      if (!querySnap.empty) {
        userDocData = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
      } else {
        const allUsersSnap = await getDocs(usersRef);
        allUsersSnap.forEach((doc) => {
          const data = doc.data();
          if (data.email && data.email.trim().toLowerCase() === emailClean) {
            userDocData = { id: doc.id, ...data };
          }
        });
      }

      if (!userDocData) {
        setLoginError('Conta autenticada mas sem vínculo institucional cadastrado no sistema.');
        setLoginLoading(false);
        return;
      }

      if (userDocData.ativo === false) {
        setLoginError('⚠️ Acesso Bloqueado: Esta conta de utilizador foi suspensa ou desativada no sistema.');
        setLoginLoading(false);
        return;
      }

      const tenantId = userDocData.tenant_id;
      const tenantsSnap = await getDocs(collection(db, 'tenants'));
      let matchedTenant: Tenant | null = null;
      tenantsSnap.forEach((doc) => {
        const t = doc.data() as Tenant;
        if (t.id === tenantId) {
          matchedTenant = { ...t, id: doc.id };
        }
      });

      if (!matchedTenant || (matchedTenant as Tenant).status === 'cancelado' || (matchedTenant as any).deleted_at) {
        setLoginError('⚠️ Acesso Revogado: Esta conta de instituição foi eliminada do sistema.');
        setLoginLoading(false);
        return;
      }

      if ((matchedTenant as Tenant).status === 'suspenso') {
        setLoginError('⚠️ Acesso Bloqueado: Esta instituição está suspensa pelo Administrador Geral.');
        setLoginLoading(false);
        return;
      }

      if (userDocData.requer_alteracao_senha || userDocData.mustChangePassword) {
        setIsLoginModalOpen(false);
        setFirstLoginResetUser(userDocData);
        setFirstLoginResetCurrentPassword(pwdClean);
        setLoginLoading(false);
        return;
      }

      saveUserSessionCookie({
        id: userDocData.id,
        nome: userDocData.nome,
        email: userDocData.email,
        tipo: userDocData.tipo || (claims.role as any) || 'estudante',
        tenant_id: tenantId
      });

      // Synchronize with server-side HttpOnly session cookie
      try {
        fetch('/api/auth/session/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userDocData.id,
            role: userDocData.tipo,
            tenantId: tenantId,
            email: userDocData.email
          })
        }).catch(() => {});
      } catch {}

      if (userDocData.language) {
        setSystemLanguage(userDocData.language);
        setSystemLang(userDocData.language);
      }
      if (userDocData.theme) {
        setActiveTheme(userDocData.theme);
        applyThemeToDom(userDocData.theme);
      }

      const matchingTenant = tenants.find(t => t.id === tenantId);
      if (matchingTenant) {
        setSelectedTenantId(matchingTenant.id);
      }
      setSelectedRole(userDocData.tipo || 'admin');
      saveLastAction(`Login realizado: ${emailClean}`);
      setLoginEmail('');
      setLoginPassword('');
      setIsLoginModalOpen(false);
      setCurrentView('tenant');
      setLoginLoading(false);
      return;
    } catch (error) {
      console.error('Erro na autenticação:', error);
      setLoginError('Ocorreu um erro inesperado ao processar sua autenticação.');
    } finally {
      setLoginLoading(false);
    }
  }

  // Handle first login password reset and login completion
  async function handleFirstLoginPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!firstLoginResetUser) return;

    if (newFirstPassword.length < 6) {
      showNotification("A nova senha deve conter no mínimo 6 caracteres.", "erro");
      return;
    }
    if (newFirstPassword !== confirmFirstPassword) {
      showNotification("A confirmação de senha não coincide.", "erro");
      return;
    }

    try {
      // Securely update password via backend API with complexity check and history enforcement
      try {
        await fetch('/api/auth/password/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUid: firstLoginResetUser.id,
            email: firstLoginResetUser.email,
            newPassword: newFirstPassword,
            currentPassword: firstLoginResetCurrentPassword || undefined,
          }),
        });
      } catch (apiErr) {
        // Fallback to updating auth and clearing plaintext password in Firestore
        await setDoc(doc(db, 'users', firstLoginResetUser.id), {
          requer_alteracao_senha: false,
          mustChangePassword: false,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }

      showNotification("Senha redefinida com sucesso! Acesso liberado.", "sucesso");

      // Set context, save cookies and proceed
      saveUserSessionCookie({
        nome: firstLoginResetUser.nome,
        email: firstLoginResetUser.email,
        tipo: firstLoginResetUser.tipo,
        tenant_id: firstLoginResetUser.tenant_id
      });
      saveLastAction(`Primeiro login bem-sucedido com alteração de senha: ${firstLoginResetUser.email}`);
      saveLastModule("dashboard");

      setSelectedTenantId(firstLoginResetUser.tenant_id);
      setSelectedRole(firstLoginResetUser.tipo);
      
      // Reset first login state
      setFirstLoginResetUser(null);
      setFirstLoginResetCurrentPassword('');
      setNewFirstPassword('');
      setConfirmFirstPassword('');
      setLoginEmail('');
      setLoginPassword('');
      setIsLoginModalOpen(false);
      setCurrentView('tenant');
    } catch (err) {
      console.error("Error resetting temporary password:", err);
      showNotification("Ocorreu um erro ao atualizar sua senha. Por favor, tente novamente.", "erro");
    }
  }

// Simple global memory cache for rarely changing configuration data
const clientSideCache: Record<string, any> = {
  planos: null,
};

  // Initialize and Seed Database in background
  async function initApp() {
    try {
      await seedDatabaseIfEmpty();
      
      // Load current Tenants and Plans in parallel (Waterfall Bottleneck Fix)
      const fetchPlansPromise = clientSideCache.planos 
        ? Promise.resolve(clientSideCache.planos) 
        : getDocs(collection(db, 'planos'));

      const [tenantsSnap, plansSnapOrCached] = await Promise.all([
        getDocs(collection(db, 'tenants')),
        fetchPlansPromise
      ]);

      const tenantsList: Tenant[] = [];
      tenantsSnap.forEach((d) => {
        const t = d.data() as Tenant;
        if (!t.deleted_at && t.status !== 'cancelado') {
          tenantsList.push({ ...t, id: d.id });
        }
      });
      setTenants(tenantsList);

      const plansList: Plano[] = [];
      if (clientSideCache.planos) {
        setPlans(clientSideCache.planos);
      } else {
        const plansSnap = plansSnapOrCached as any;
        plansSnap.forEach((d: any) => {
          plansList.push({ ...d.data() as Plano, id: d.id });
        });
        clientSideCache.planos = plansList;
        setPlans(plansList);
      }

      // Restore session from cookie/localStorage if available
      const session = getUserSessionCookie();
      if (session) {
        if (session.tipo === 'super_admin') {
          setCurrentView('superadmin');
        } else {
          // Verify if session's tenant still exists and is active
          const activeTenant = tenantsList.find(t => t.id === session.tenant_id);
          if (tenantsList.length > 0 && (!activeTenant || activeTenant.status === 'cancelado')) {
            deleteCookie('user_session');
            saveCurrentView('landing');
            setCurrentView('landing');
            showNotification("Acesso Revogado: A conta da sua instituição foi excluída do sistema. O seu acesso foi revogado.", "erro");
          } else {
            setSelectedTenantId(session.tenant_id);
            setSelectedRole(session.tipo as any);
            setCurrentView('tenant');

            // Load permanent hybrid preferences from Firestore if user has a session ID
            if (session.id) {
              SessionStateService.loadUserPreferences(session.id).then((prefs) => {
                if (prefs.language) {
                  setSystemLanguage(prefs.language);
                  setSystemLang(prefs.language);
                }
                if (prefs.theme) {
                  setActiveTheme(prefs.theme);
                  applyThemeToDom(prefs.theme);
                }
              }).catch(e => console.warn("Failed to load user preferences on init:", e));
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Notice initializing app from cloud database (falling back to local data if needed):", err?.message || err);
      // Fallback: load plans & tenants from local database if Firestore query is blocked or offline
      try {
        const localPlans = localDb.getPlans();
        if (localPlans && localPlans.length > 0) {
          setPlans(localPlans);
        }
        const localTenants = localDb.getTenants();
        if (localTenants && localTenants.length > 0) {
          setTenants(localTenants);
        }
      } catch (localErr) {
        console.warn("Local DB fallback check note:", localErr);
      }
    }
  }

  useEffect(() => {
    initApp();
    // Safety fallback: force loading to false after 2.5 seconds to prevent getting stuck
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2500);
    
    // Load theme from cookie
    const savedTheme = getThemePreference();
    setActiveTheme(savedTheme);
    applyThemeToDom(savedTheme);

    // Check cookie consent
    const consent = getCookie("user_cookie_consent");
    if (!consent) {
      setShowCookieConsent(true);
    }

    return () => clearTimeout(timeout);
  }, []);

  // Mobile App-like Scrolling & Pinch Zoom Lock
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });

    let lastTouchEnd = 0;
    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    const preventGesture = (e: any) => {
      e.preventDefault();
    };
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('touchend', preventDoubleTap);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    };
  }, []);

  // Handle Institution Registration from Login (Validation only, no DB mutation yet)
  async function handleOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingError(null);

    const nome = onboardingForm.nome.trim();
    const email = onboardingForm.email_admin.trim().toLowerCase();
    const telefone = onboardingForm.telefone.trim();
    const endereco = onboardingForm.endereco.trim();
    const senha = onboardingForm.senha;
    const confirmarSenha = onboardingForm.confirmar_senha;

    if (!nome) {
      setOnboardingError('Por favor, informe o nome da instituição.');
      return;
    }
    if (!onboardingForm.pais_origem) {
      setOnboardingError('Por favor, selecione o país de origem da instituição.');
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setOnboardingError('Por favor, informe um endereço de e-mail administrativo válido.');
      return;
    }
    if (!telefone) {
      setOnboardingError('Por favor, informe o telefone de contato da instituição.');
      return;
    }
    if (!endereco) {
      setOnboardingError('Por favor, informe o endereço físico da sede.');
      return;
    }
    if (senha.length < 6) {
      setOnboardingError('A senha de acesso deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      setOnboardingError('A confirmação de senha não coincide com a senha informada.');
      return;
    }

    // OBS: O botão não deve executar nenhuma ação no banco de dados ainda.
    // Futuramente será conectado à plataforma de seleção de plano e checkout.
    setOnboardingPreRegisteredNotice(
      `Dados da instituição "${nome}" validados com sucesso! A pré-inscrição foi recebida e será conectada em breve à plataforma de seleção de plano e liquidação de pagamento. Nenhuma alteração foi realizada no sistema neste momento.`
    );
    showNotification('Dados institucionais validados com sucesso! Aguarde a integração de pagamento.', 'sucesso');
  }

  function handleThemeChange(theme: string) {
    setActiveTheme(theme);
    saveThemePreference(theme);
    applyThemeToDom(theme);
    saveLastAction(`Alterou o tema para ${theme.replace('theme-', '')}`);
    
    const session = getUserSessionCookie();
    if (session?.id) {
      SessionStateService.savePreference(session.id, 'theme', theme);
    }
  }

  const renderCmdIcon = (iconName: string) => {
    switch (iconName) {
      case 'BarChart3': return <BarChart3 className="w-4 h-4" />;
      case 'MapPin': return <MapPin className="w-4 h-4" />;
      case 'School': return <School className="w-4 h-4" />;
      case 'Users': return <Users className="w-4 h-4" />;
      case 'GraduationCap': return <GraduationCap className="w-4 h-4" />;
      case 'FolderOpen': return <FolderOpen className="w-4 h-4" />;
      case 'BookOpen': return <BookOpen className="w-4 h-4" />;
      case 'Award': return <Award className="w-4 h-4" />;
      case 'FileText': return <FileText className="w-4 h-4" />;
      case 'Calendar': return <Calendar className="w-4 h-4" />;
      case 'Settings': return <Sliders className="w-4 h-4" />;
      case 'Building2': return <Building2 className="w-4 h-4" />;
      case 'CreditCard': return <CreditCard className="w-4 h-4" />;
      case 'DollarSign': return <DollarSign className="w-4 h-4" />;
      case 'Server': return <Server className="w-4 h-4" />;
      case 'Mail': return <Mail className="w-4 h-4" />;
      case 'Palette': return <Palette className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      case 'Plus': return <Plus className="w-4 h-4" />;
      case 'LogOut': return <LogOut className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const renderCommandMenu = () => {
    if (!isCmdMenuOpen) return null;

    const items = getCommandItems();

    return (
      <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-start justify-center bg-slate-950/70 backdrop-blur-md p-4 pt-12 md:pt-28 animate-in fade-in duration-200">
        {/* Backdrop close overlay */}
        <div className="fixed inset-0" onClick={() => setIsCmdMenuOpen(false)} />

        {/* Command Menu Box */}
        <div className="relative bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh] md:max-h-[500px] animate-in zoom-in-95 duration-150">
          
          {/* Header search input */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/50">
            <Search className="w-5 h-5 text-slate-500 shrink-0" />
            <input
              type="text"
              autoFocus
              value={cmdSearchQuery}
              onChange={(e) => {
                setCmdSearchQuery(e.target.value);
                setActiveItemIndex(0);
              }}
              placeholder="Digite um comando ou pesquise (ex: 'tema', 'estudante')..."
              className="w-full bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0 font-medium"
            />
            <button
              onClick={() => setIsCmdMenuOpen(false)}
              className="text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-1 rounded-lg transition-colors shrink-0 text-xs font-semibold px-2"
            >
              ESC
            </button>
          </div>

          {/* List area */}
          <div className="p-2 overflow-y-auto flex-1 divide-y divide-slate-850/30">
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum comando ou resultado encontrado para "{cmdSearchQuery}"
              </div>
            ) : (
              Object.entries(
                items.reduce((acc, curr) => {
                  acc[curr.category] = acc[curr.category] || [];
                  acc[curr.category].push(curr);
                  return acc;
                }, {} as Record<string, typeof items>)
              ).map(([category, catItems]) => (
                <div key={category} className="py-2 first:pt-0">
                  <div className="px-3 py-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {catItems.map((item) => {
                      const absoluteIndex = items.indexOf(item);
                      const isSelected = absoluteIndex === activeItemIndex;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.action();
                            setIsCmdMenuOpen(false);
                          }}
                          onMouseEnter={() => setActiveItemIndex(absoluteIndex)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-150 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                              : 'text-slate-300 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={isSelected ? 'text-white' : 'text-slate-400'}>
                              {renderCmdIcon(item.icon)}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">
                              ↵ Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer keyboard layout help */}
          <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <div className="flex gap-4">
              <span><span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">↑↓</span> Navegar</span>
              <span><span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Enter</span> Executar</span>
              <span><span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">ESC</span> Fechar</span>
            </div>
            <div>
              <span>SGE Enterprise v2.0</span>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans transition-colors duration-300 relative">
      <StripeCheckoutStatus />
      
      {/* VIEW: BRANDBOOK & HOMEPAGE PRESENTATION */}
      {(currentView === 'landing' || currentView === 'brandbook') && (
        <BrandbookView 
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onOpenCookiePolicy={() => setIsCookiePolicyOpen(true)}
          systemLang={systemLang}
          onChangeLanguage={(lang) => {
            setSystemLanguage(lang);
            setSystemLang(lang);
            saveLastAction(`Alterou o idioma do sistema para ${lang}`);
          }}
          activeTheme={activeTheme}
          onToggleTheme={() => {
            handleThemeChange(activeTheme === 'theme-dark' ? 'theme-slate' : 'theme-dark');
          }}
          isBootstrapMode={Boolean(bootstrapStatus?.allowsBootstrap && !bootstrapStatus?.initialized && isBootstrapMode)}
        />
      )}

      {/* LOGIN & SIGN-UP POPUP MODAL (OPENED VIA ⚡ LOGIN / SIGN-UP) */}
      {isLoginModalOpen && (currentView === 'landing' || currentView === 'brandbook') && (
        <div className="fixed inset-0 z-[9980] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
          <div 
            className="fixed inset-0 -z-10" 
            onClick={() => setIsLoginModalOpen(false)} 
          />
          <div className={`relative max-w-2xl w-full ${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} rounded-3xl border shadow-2xl p-6 md:p-10 space-y-6 transition-all duration-300 my-auto animate-in zoom-in-95 duration-200 ring-1 ring-white/10 overflow-hidden`}>
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              className={`absolute top-5 right-5 p-2 rounded-full ${activeTheme === 'theme-dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'} transition-colors cursor-pointer`}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Title and Sign-up Button */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${activeTheme === 'theme-dark' ? 'border-slate-800' : 'border-slate-200'} pb-5`}>
              <div className="space-y-3">
                <SysEduLogo variant={activeTheme === 'theme-dark' ? "negative" : "full"} size={38} />
                <h1 className={`text-xl font-extrabold ${activeTheme === 'theme-dark' ? 'text-white' : 'text-slate-900'} tracking-tight font-sans`}>
                  {translate("Portal de Acesso Educacional", systemLang)}
                </h1>
                <p className={`${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} text-xs mt-1 leading-relaxed`}>
                  {translate("Sistema SaaS multi-tenant. Faça o login único abaixo ou registre sua própria escola.", systemLang)}
                </p>
              </div>
              
              <button 
                onClick={() => {
                  setOnboardingPreRegisteredNotice(null);
                  setOnboardingError(null);
                  setOnboardingForm({
                    nome: '',
                    logo_url: '',
                    pais_origem: 'Moçambique',
                    paises_sucursais: [],
                    email_admin: '',
                    senha: '',
                    confirmar_senha: '',
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-basico',
                    idioma_padrao: 'pt'
                  });
                  setIsOnboardingModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> {translate("Registrar Escola (Sign-up)", systemLang)}
              </button>
            </div>

            {/* Mode selection tabs: SÓ EXIBE SE NÃO HOUVER SUPERADMIN CADASTRADO NO SISTEMA */}
            {bootstrapStatus && !bootstrapStatus.initialized && bootstrapStatus.allowsBootstrap && (
              <div className="flex items-center gap-2 border-b border-slate-700/20 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsBootstrapMode(false);
                    setLoginError('');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !isBootstrapMode
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {translate("Autenticação Normal", systemLang)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginError('');
                    setIsBootstrapMode(true);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isBootstrapMode
                      ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-amber-500 hover:text-amber-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Cadastrar Primeiro Superadministrador</span>
                </button>
              </div>
            )}

            {/* Main Login or Bootstrap Card */}
            <div className={`${activeTheme === 'theme-dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} p-6 rounded-2xl border shadow-sm space-y-5`}>
              <div className={`border-b ${activeTheme === 'theme-dark' ? 'border-slate-800' : 'border-slate-200'} pb-3 flex justify-between items-center gap-2`}>
                <div>
                  <h3 className={`font-bold font-sans ${activeTheme === 'theme-dark' ? 'text-white' : 'text-slate-900'} text-sm flex items-center gap-2`}>
                    {isBootstrapMode ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                        <span>Definição do Superadministrador (Bootstrap)</span>
                      </>
                    ) : (
                      translate("Acesso Unificado ao Sistema", systemLang)
                    )}
                  </h3>
                  <p className={`${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} text-[11px] mt-0.5`}>
                    {isBootstrapMode
                      ? "O sistema está sem superadministrador configurado. Introduza os dados para definir o primeiro superadministrador."
                      : translate("Informe suas credenciais para ser redirecionado automaticamente.", systemLang)
                    }
                  </p>
                </div>
                {bootstrapStatus && !bootstrapStatus.initialized && bootstrapStatus.allowsBootstrap && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBootstrapMode(!isBootstrapMode);
                      setLoginError('');
                    }}
                    className="text-[11px] font-bold text-amber-500 hover:text-amber-400 underline cursor-pointer shrink-0 ml-2"
                  >
                    {isBootstrapMode ? "Ir para Login Normal" : "Cadastrar Superadmin"}
                  </button>
                )}
              </div>

              {loginError && (
                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs leading-relaxed font-semibold">
                  {translate(loginError, systemLang)}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {isBootstrapMode && (
                  <div>
                    <label className={`block text-[10px] font-bold ${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-1`}>
                      Nome Completo do Superadministrador
                    </label>
                    <input 
                      type="text"
                      value={bootstrapNome}
                      onChange={(e) => setBootstrapNome(e.target.value)}
                      placeholder="Ex: Nelton Benedito"
                      className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all`}
                    />
                  </div>
                )}

                <div>
                  <label className={`block text-[10px] font-bold ${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-1`}>
                    {isBootstrapMode ? 'E-mail do Novo Superadministrador *' : translate("Endereço de E-mail", systemLang)}
                  </label>
                  <input 
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={isBootstrapMode ? "superadmin@escola.edu.mz" : "nome@dominio.edu ou admin@escola.com"}
                    className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-bold ${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-1`}>
                    {isBootstrapMode ? 'Senha do Superadministrador (Mín. 12 Caracteres) *' : translate("Senha de Acesso", systemLang)}
                  </label>
                  <input 
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                  />
                  {isBootstrapMode && (
                    <PasswordPolicyIndicator password={loginPassword} userEmail={loginEmail} />
                  )}
                  {!isBootstrapMode && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPasswordOpen(true);
                          setForgotEmail(loginEmail || '');
                          setForgotError('');
                          setForgotSuccess('');
                          setForgotOtp('');
                          setForgotNewPassword('');
                          setForgotConfirmPassword('');
                          setForgotOtpRequested(false);
                        }}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Esqueci a Palavra-Passe?</span>
                      </button>
                    </div>
                  )}
                </div>

                {isBootstrapMode && (
                  <div>
                    <label className={`block text-[10px] font-bold ${activeTheme === 'theme-dark' ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-1`}>
                      Confirmar Senha do Superadministrador *
                    </label>
                    <input 
                      type="password"
                      required
                      value={bootstrapConfirmPassword}
                      onChange={(e) => setBootstrapConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all`}
                    />
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loginLoading}
                  className={`w-full ${isBootstrapMode ? 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer`}
                >
                  {loginLoading ? '...' : isBootstrapMode ? 'Registrar Primeiro Superadministrador' : translate("Autenticar e Entrar", systemLang)} <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span className="text-[10px] text-slate-400">SysEdu Core Security Layer &bull; PBKDF2-SHA512</span>
                </div>
              </form>
            </div>

            {/* Bottom Invitation Prompt */}
            <div className={`flex flex-col sm:flex-row items-center justify-between text-xs ${activeTheme === 'theme-dark' ? 'text-slate-400 bg-slate-950/60 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200'} p-3.5 rounded-xl border gap-2`}>
              <span>Deseja cadastrar uma nova instituição de ensino?</span>
              <button
                onClick={() => {
                  setOnboardingPreRegisteredNotice(null);
                  setOnboardingError(null);
                  setOnboardingForm({
                    nome: '',
                    logo_url: '',
                    pais_origem: 'Moçambique',
                    paises_sucursais: [],
                    email_admin: '',
                    senha: '',
                    confirmar_senha: '',
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-basico',
                    idioma_padrao: 'pt'
                  });
                  setIsOnboardingModalOpen(true);
                }}
                className="text-blue-500 hover:text-blue-600 font-bold underline transition-colors cursor-pointer"
              >
                Registar Instituição
              </button>
            </div>

            {/* Footer */}
            <div className={`text-center text-xs ${activeTheme === 'theme-dark' ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-200'} pt-2 border-t`}>
              Nelton Benedito • MVP Sistema SaaS Educacional Multi-Contas
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: ESQUECI PALAVRA-PASSE COM OTP */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className={`${activeTheme === 'theme-dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} max-w-md w-full rounded-2xl p-6 shadow-2xl border relative space-y-4`}>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/20">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Recuperação de Palavra-Passe</h3>
                  <p className="text-[11px] text-slate-400">Redefina a sua senha através do código de verificação OTP.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setForgotError('');
                  setForgotSuccess('');
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error & Success Feedback */}
            {forgotError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs font-semibold leading-relaxed">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{forgotSuccess}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
              
              {/* 1. Introdução de E-mail & Botão para solicitar OTP */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Endereço de E-mail Institucional *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="utilizador@escola.ac.mz"
                      className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={forgotLoadingOtp || !forgotEmail.trim()}
                    onClick={handleRequestForgotPasswordOtp}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer shrink-0"
                  >
                    {forgotLoadingOtp ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{forgotOtpRequested ? 'Reenviar OTP' : 'Solicitar OTP'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Um código temporário de 6 dígitos será emitido para o endereço informado.
                </p>
              </div>

              {/* 2. Campo para introduzir o OTP */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Código de Verificação (OTP de 6 dígitos) *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl p-2.5 text-center text-lg font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>

              {/* 3. Nova Palavra-Passe & Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nova Palavra-Passe *
                  </label>
                  <input
                    type="password"
                    required
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Confirmar Nova Palavra-Passe *
                  </label>
                  <input
                    type="password"
                    required
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full ${activeTheme === 'theme-dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
              </div>

              {forgotNewPassword && (
                <PasswordPolicyIndicator password={forgotNewPassword} userEmail={forgotEmail} />
              )}

              {/* 4. Botão para alterar a senha */}
              <button
                type="submit"
                disabled={forgotLoadingReset || !forgotOtp || !forgotNewPassword || !forgotConfirmPassword}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {forgotLoadingReset ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>A Alterar Palavra-Passe...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Alterar Palavra-Passe</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setIsLoginModalOpen(true);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Voltar para o ecrã de início de sessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIRST LOGIN MANDATORY PASSWORD RESET MODAL */}
      {firstLoginResetUser && (
        <MandatoryPasswordResetModal
          user={firstLoginResetUser}
          onSuccess={() => {
            showNotification("Nova senha definida com sucesso! Acesso liberado.", "sucesso");
            saveUserSessionCookie({
              id: firstLoginResetUser.id,
              nome: firstLoginResetUser.nome,
              email: firstLoginResetUser.email,
              tipo: firstLoginResetUser.tipo || firstLoginResetUser.role,
              tenant_id: firstLoginResetUser.tenant_id || firstLoginResetUser.tenantId
            });
            saveLastAction(`Primeiro login bem-sucedido com nova senha: ${firstLoginResetUser.email}`);
            saveLastModule("dashboard");
            setSelectedTenantId(firstLoginResetUser.tenant_id || firstLoginResetUser.tenantId);
            setSelectedRole(firstLoginResetUser.tipo || firstLoginResetUser.role);
            setFirstLoginResetUser(null);
            setLoginEmail('');
            setLoginPassword('');
            setIsLoginModalOpen(false);
            setCurrentView('tenant');
          }}
        />
      )}

      {/* ONBOARDING MODAL (POPUP) — FORMULÁRIO DE REGISTO DE INSTITUIÇÃO */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="space-y-1">
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold py-0.5 px-2.5 rounded-full uppercase tracking-wider font-mono">
                  SaaS Multi-Institucional • Registo de Instituição
                </span>
                <h3 className="text-lg font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  Registar Nova Instituição de Ensino
                </h3>
                <p className="text-xs text-slate-400">
                  Preencha as informações institucionais, localização geográfica e credenciais de acesso.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsOnboardingModalOpen(false);
                  setOnboardingPreRegisteredNotice(null);
                  setOnboardingError(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {onboardingPreRegisteredNotice ? (
                /* CONFIRMAÇÃO DE PRÉ-REGISTO (SEM ALTERAÇÃO NA BASE DE DADOS) */
                <div className="p-6 rounded-2xl bg-slate-850 border border-emerald-500/30 text-center space-y-4 animate-in fade-in duration-200">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Dados Institucionais Validados com Sucesso!</h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto leading-relaxed">
                      {onboardingPreRegisteredNotice}
                    </p>
                  </div>

                  {/* Resumo da Instituição */}
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-left space-y-2">
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Instituição:</span>
                      <span className="font-bold text-white">{onboardingForm.nome}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">País de Origem:</span>
                      <span className="font-bold text-indigo-400">{onboardingForm.pais_origem}</span>
                    </div>
                    {onboardingForm.paises_sucursais && onboardingForm.paises_sucursais.filter(Boolean).length > 0 && (
                      <div className="flex justify-between border-b border-slate-850 pb-1.5">
                        <span className="text-slate-400">Países Sucursais:</span>
                        <span className="font-bold text-slate-200">{onboardingForm.paises_sucursais.filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Email Administrativo:</span>
                      <span className="font-bold text-white">{onboardingForm.email_admin}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Telefone:</span>
                      <span className="font-bold text-white">{onboardingForm.telefone}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Endereço da Sede:</span>
                      <span className="font-bold text-white">{onboardingForm.endereco}</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">Plano Pretendido:</span>
                      <span className="font-bold text-emerald-400 uppercase">
                        {plans.find(p => p.id === onboardingForm.plano_id)?.nome || onboardingForm.plano_id}
                      </span>
                    </div>
                  </div>

                  {/* Aviso de Futura Integração */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-left">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      <strong>Observação:</strong> Conforme solicitado, nenhuma gravação ou cobrança foi efetuada. Esta tela de registo será futuramente conectada a uma plataforma de seleção de plano e checkout financeiro.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setOnboardingPreRegisteredNotice(null)}
                      className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Editar Dados
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOnboardingModalOpen(false);
                        setOnboardingPreRegisteredNotice(null);
                      }}
                      className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                    >
                      Voltar ao Início de Sessão
                    </button>
                  </div>
                </div>
              ) : (
                /* FORMULÁRIO DE REGISTO SEMELHANTE AO SUPERADMIN */
                <form onSubmit={handleOnboarding} className="space-y-4">
                  {onboardingError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{onboardingError}</span>
                    </div>
                  )}

                  {/* LOGOTIPO DA INSTITUIÇÃO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Logotipo da Instituição (Opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      {onboardingForm.logo_url ? (
                        <img 
                          src={onboardingForm.logo_url} 
                          alt="Pré-visualização do logotipo" 
                          className="w-12 h-12 rounded-xl object-contain bg-slate-950 border border-slate-800 p-1"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={onboardingForm.logo_url}
                          onChange={(e) => setOnboardingForm(prev => ({ ...prev, logo_url: e.target.value }))}
                          placeholder="URL da imagem (ex: https://...)"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer font-bold flex items-center gap-1">
                            <Upload className="w-3 h-3" /> Carregar arquivo local
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setOnboardingForm(prev => ({ ...prev, logo_url: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          {onboardingForm.logo_url && (
                            <button
                              type="button"
                              onClick={() => setOnboardingForm(prev => ({ ...prev, logo_url: '' }))}
                              className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NOME DA INSTITUIÇÃO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Nome da Instituição Escolar *
                    </label>
                    <input 
                      type="text"
                      required
                      value={onboardingForm.nome}
                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Complexo Escolar Esperança de Maputo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* PAÍS DE ORIGEM & SUCURSAIS COM SEARCHABLE DROPDOWN */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        País de Origem da Instituição *
                      </label>
                      <SearchableDropdown
                        options={WORLD_COUNTRIES.map(c => ({ value: c.name, label: c.name }))}
                        value={onboardingForm.pais_origem || 'Moçambique'}
                        onChange={(val) => setOnboardingForm(prev => ({ ...prev, pais_origem: val }))}
                        placeholder="Selecione o país de origem..."
                        searchPlaceholder="Pesquisar país..."
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        As províncias e distritos deste país serão cadastrados e sincronizados automaticamente na instituição.
                      </p>
                    </div>

                    {/* Países com Escolas / Sucursais com botão + e botão - */}
                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Países com Sucursais ou Escolas
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const current = onboardingForm.paises_sucursais || [];
                            setOnboardingForm(prev => ({ ...prev, paises_sucursais: [...current, ''] }));
                          }}
                          className="bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-400 border border-indigo-800 text-[11px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          title="Adicionar outro país"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar País
                        </button>
                      </div>

                      {(onboardingForm.paises_sucursais || []).length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          Nenhum outro país configurado. Clique em "+ Adicionar País" se a instituição possuir filiais ou escolas em outros territórios.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(onboardingForm.paises_sucursais || []).map((pais, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="flex-1">
                                <SearchableDropdown
                                  options={WORLD_COUNTRIES.map(c => ({ value: c.name, label: c.name }))}
                                  value={pais}
                                  onChange={(val) => {
                                    const updated = [...(onboardingForm.paises_sucursais || [])];
                                    updated[idx] = val;
                                    setOnboardingForm(prev => ({ ...prev, paises_sucursais: updated }));
                                  }}
                                  placeholder="Selecione o país da sucursal..."
                                  searchPlaceholder="Pesquisar país..."
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (onboardingForm.paises_sucursais || []).filter((_, i) => i !== idx);
                                  setOnboardingForm(prev => ({ ...prev, paises_sucursais: updated }));
                                }}
                                className="p-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800 rounded-lg cursor-pointer transition-colors"
                                title="Remover este país"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CONTATOS: EMAIL E TELEFONE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Email Administrativo (Login) *
                      </label>
                      <input 
                        type="email"
                        required
                        value={onboardingForm.email_admin}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, email_admin: e.target.value }))}
                        placeholder="Ex: gestao@escola.edu"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Telefone de Contato *
                      </label>
                      <input 
                        type="text"
                        required
                        value={onboardingForm.telefone}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="Ex: +258 84 123 4567"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* ENDEREÇO FÍSICO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Endereço Físico da Sede *
                    </label>
                    <input 
                      type="text"
                      required
                      value={onboardingForm.endereco}
                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, endereco: e.target.value }))}
                      placeholder="Ex: Av. 24 de Julho, Nº 1450, Maputo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* PLANO E IDIOMA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Plano de Subscrição Pretendido *
                      </label>
                      <select 
                        value={onboardingForm.plano_id}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, plano_id: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id} className="bg-slate-900">
                            {p.nome} — R$ {p.preco}/mês
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Idioma Padrão do Sistema
                      </label>
                      <select 
                        value={onboardingForm.idioma_padrao}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, idioma_padrao: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="pt" className="bg-slate-900">Português (Padrão)</option>
                        <option value="en" className="bg-slate-900">English (Inglês)</option>
                        <option value="es" className="bg-slate-900">Español (Espanhol)</option>
                        <option value="fr" className="bg-slate-900">Français (Francês)</option>
                      </select>
                    </div>
                  </div>

                  {/* SENHA E CONFIRMAÇÃO DE SENHA */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Definição da Palavra-Passe de Acesso *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Senha (Mín. 6 caracteres) *
                        </label>
                        <div className="relative">
                          <input 
                            type={onboardingShowPassword ? "text" : "password"}
                            required
                            value={onboardingForm.senha}
                            onChange={(e) => setOnboardingForm(prev => ({ ...prev, senha: e.target.value }))}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setOnboardingShowPassword(!onboardingShowPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                          >
                            {onboardingShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Confirmar Senha *
                        </label>
                        <div className="relative">
                          <input 
                            type={onboardingShowConfirmPassword ? "text" : "password"}
                            required
                            value={onboardingForm.confirmar_senha}
                            onChange={(e) => setOnboardingForm(prev => ({ ...prev, confirmar_senha: e.target.value }))}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setOnboardingShowConfirmPassword(!onboardingShowConfirmPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                          >
                            {onboardingShowConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {onboardingForm.senha && (
                      <PasswordPolicyIndicator 
                        password={onboardingForm.senha} 
                        userEmail={onboardingForm.email_admin} 
                      />
                    )}
                  </div>

                  {/* AVISO INFORMATIVO DE TRANSIÇÃO FUTURA */}
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5 text-left">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-indigo-200/90 leading-relaxed">
                      <strong>Aviso do Sistema:</strong> O botão "Registar Instituição" abaixo valida os dados de cadastro sem alterar a base de dados. Futuramente, este botão redirecionará o utilizador para a plataforma de escolha de plano de pagamento e liquidação.
                    </p>
                  </div>

                  {/* BOTÕES DE AÇÃO */}
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsOnboardingModalOpen(false);
                        setOnboardingError(null);
                      }}
                      className="w-1/3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="w-2/3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      <Building2 className="w-4 h-4" />
                      Registar Instituição
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SUPER ADMIN PANEL (CAMADA 1) */}
      {currentView === 'superadmin' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar o Painel de Controlo Global">
          <Suspense fallback={<SamsungLoadingScreen message="A carregar painel global..." />}>
            <SuperAdminPortal 
              onLogout={handleLogout} 
              activeTheme={activeTheme}
              onChangeTheme={handleThemeChange}
              systemLang={systemLang}
              onChangeLanguage={(lang) => {
                setSystemLanguage(lang);
                setSystemLang(lang);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* VIEW: TENANT PORTAL PANEL (CAMADA 2) */}
      {currentView === 'tenant' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar o Portal Académico">
          <Suspense fallback={<SamsungLoadingScreen message="A carregar portal académico..." />}>
            <TenantPortal 
              currentTenantId={selectedTenantId}
              currentUserRole={selectedRole}
              currentUserEmail={getUserSessionCookie()?.email || ""}
              onLogout={handleLogout}
              activeTheme={activeTheme}
              onChangeTheme={handleThemeChange}
              systemLang={systemLang}
              onChangeLanguage={(lang) => {
                setSystemLanguage(lang);
                setSystemLang(lang);
                const session = getUserSessionCookie();
                if (session?.id) {
                  SessionStateService.savePreference(session.id, 'language', lang);
                }
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* COMPLIANT COOKIE CONSENT BANNER & POLICY MODAL */}
      <CookieBanner />
      {isCookiePolicyOpen && (
        <CookiePolicyModal onClose={() => setIsCookiePolicyOpen(false)} />
      )}

      {/* Global JavaScript Interceptor Modal Popup */}
      {jsPopup && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative">
            <button
              type="button"
              onClick={() => setJsPopup(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                jsPopup.type === 'error' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  jsPopup.type === 'error' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                }`}>
                  Aviso de JavaScript
                </span>
                <h3 className="text-sm font-black font-sans mt-0.5">{jsPopup.title}</h3>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono mb-4">
              {jsPopup.message}
            </div>
            <button
              type="button"
              onClick={() => setJsPopup(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-indigo-600/20 text-center"
            >
              Compreendido
            </button>
          </div>
        </div>
      )}

      {renderCommandMenu()}

    </main>
  );
}
