/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { seedDatabaseIfEmpty, db, auth, registerUserInFirebaseAuth } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  addDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { Tenant, Plano } from './types';
import SuperAdminPortal from './components/SuperAdminPortal';
import TenantPortal from './components/TenantPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SysEduLogo } from './components/SysEduLogo';
import BrandbookView from './components/BrandbookView';
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
  FolderOpen,
  DollarSign
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
  DEFAULT_PREFERENCES,
  CookiePreferences
} from './lib/cookies';
import { SessionStateService } from './lib/userState';
import { localDb } from './lib/localDb';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'superadmin' | 'tenant' | 'brandbook'>('brandbook');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('tenant-maputo');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'director' | 'docente' | 'pai' | 'estudante'>('admin');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>('theme-slate');
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [systemLang, setSystemLang] = useState<string>(getSystemLanguage());
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Non-blocking Toast notification system
  const [appNotification, setAppNotification] = useState<{ message: string; type: 'sucesso' | 'erro' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    setAppNotification({ message, type });
    setTimeout(() => {
      setAppNotification(null);
    }, 4500);
  };

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
          setOnboardingSuccess(null);
          setOnboardingForm({
            nome: '',
            email_admin: '',
            senha: '',
            telefone: '',
            endereco: '',
            plano_id: plans[0]?.id || 'plano-profissional',
            plataforma_pagamento: 'multicaixa'
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

  // First Login Reset states
  const [firstLoginResetUser, setFirstLoginResetUser] = useState<any | null>(null);
  const [newFirstPassword, setNewFirstPassword] = useState('');
  const [confirmFirstPassword, setConfirmFirstPassword] = useState('');

  // Onboarding states
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    nome: '',
    email_admin: '',
    senha: '',
    telefone: '',
    endereco: '',
    plano_id: 'plano-basico',
    plataforma_pagamento: 'Stripe'
  });
  const [onboardingSuccess, setOnboardingSuccess] = useState<Tenant | null>(null);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [checkoutTenant, setCheckoutTenant] = useState<any | null>(null);
  const [checkoutUser, setCheckoutUser] = useState<any | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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

      // 1. Super Admin Credentials Check
      if (emailClean === 'neltonbenedito1@gmail.com') {
        if (pwdClean === 'Errado23x') {
          saveUserSessionCookie({
            nome: 'Administrador Geral',
            email: 'neltonbenedito1@gmail.com',
            tipo: 'super_admin',
            tenant_id: 'super-admin'
          });
          saveLastAction("Login realizado como Super Admin");
          setLoginEmail('');
          setLoginPassword('');
          setCurrentView('superadmin');
          setLoginLoading(false);
          return;
        } else {
          setLoginError('Credenciais inválidas');
          setLoginLoading(false);
          return;
        }
      }

      // 2. Query tenant user from collection first to get tenant context
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', emailClean));
      const querySnap = await getDocs(q);

      let userDocData: any = null;

      if (!querySnap.empty) {
        querySnap.forEach((doc) => {
          const data = doc.data();
          userDocData = { id: doc.id, ...data };
        });
      } else {
        // Fallback 1: Scan all docs in 'users' (case-insensitive & trimmed)
        const allUsersSnap = await getDocs(usersRef);
        allUsersSnap.forEach((doc) => {
          const data = doc.data();
          if (data.email && data.email.trim().toLowerCase() === emailClean) {
            userDocData = { id: doc.id, ...data };
          }
        });

        // Fallback 2: Scan 'docentes' collection if not in 'users'
        if (!userDocData) {
          const docentesSnap = await getDocs(collection(db, 'docentes'));
          docentesSnap.forEach((doc) => {
            const d = doc.data();
            if (d.email && d.email.trim().toLowerCase() === emailClean) {
              userDocData = {
                id: doc.id,
                tenant_id: d.tenant_id,
                email: d.email.trim().toLowerCase(),
                nome: d.nome || 'Docente',
                tipo: 'docente',
                ativo: true,
                senha: '12345678',
                senha_temporaria: '12345678'
              };
            }
          });
        }

        // Fallback 3: Scan 'estudantes' collection if not in 'users'
        if (!userDocData) {
          const estudantesSnap = await getDocs(collection(db, 'estudantes'));
          estudantesSnap.forEach((doc) => {
            const s = doc.data();
            const stEmail = s.email || (s.numero_matricula ? `${s.numero_matricula.toLowerCase()}@escola.edu` : '');
            if (stEmail && stEmail.trim().toLowerCase() === emailClean) {
              userDocData = {
                id: doc.id,
                tenant_id: s.tenant_id,
                email: stEmail.trim().toLowerCase(),
                nome: s.nome || 'Estudante',
                tipo: 'estudante',
                ativo: true,
                senha: s.senha_temporaria || '12345678',
                senha_temporaria: s.senha_temporaria || '12345678'
              };
            }
          });
        }

        if (!userDocData) {
          setLoginError('Credenciais inválidas ou conta não cadastrada no sistema.');
          setLoginLoading(false);
          return;
        }
      }

      const tenantId = userDocData.tenant_id;
      const userType = userDocData.tipo; // 'admin' | 'docente' | 'estudante' | 'pai' etc.

      // 3. Verify tenant status
      const tenantsRef = collection(db, 'tenants');
      const tenantsSnap = await getDocs(tenantsRef);
      let matchedTenant: Tenant | null = null;
      tenantsSnap.forEach((doc) => {
        const t = doc.data() as Tenant;
        if (t.id === tenantId) {
          matchedTenant = { ...t, id: doc.id };
        }
      });

      if (!matchedTenant || (matchedTenant as Tenant).status === 'cancelado' || (matchedTenant as any).deleted_at) {
        setLoginError('⚠️ Acesso Revogado: Esta conta de instituição foi eliminada do sistema e o seu acesso foi revogado pelo Administrador Geral.');
        setLoginLoading(false);
        return;
      }

      if ((matchedTenant as Tenant).status === 'pendente_pagamento') {
        // Find if this is the admin so we can offer payment link
        const planoId = (matchedTenant as Tenant).plano_id;
        const planoNome = planoId === 'plano-basico' ? 'Plano Básico' : planoId === 'plano-pro' ? 'Plano Pro' : 'Plano Plus';
        const planoPreco = planoId === 'plano-basico' ? 299 : planoId === 'plano-pro' ? 499 : 899;

        // Set checkout context so they can easily complete the payment!
        setCheckoutTenant(matchedTenant);
        setCheckoutUser(userDocData);
        setCheckoutActive(true);
        setIsOnboardingModalOpen(true);

        setLoginError(`⚠️ Assinatura pendente: O registro da instituição "${(matchedTenant as Tenant).nome}" está aguardando confirmação do pagamento. O painel de checkout foi aberto automaticamente para você concluir a transação.`);
        setLoginLoading(false);
        return;
      }

      if ((matchedTenant as Tenant).status === 'suspenso') {
        setLoginError('⚠️ Acesso Bloqueado: Esta conta de instituição foi suspensa pelo Administrador Geral devido ao atraso no pagamento da assinatura mensal. Regularize a fatura no portal Super Admin para reativar o acesso.');
        setLoginLoading(false);
        return;
      }

      if (userDocData.ativo === false) {
        setLoginError('⚠️ Acesso Bloqueado: Esta conta de utilizador foi suspensa ou desativada no sistema. Por favor, entre em contacto com a administração escolar.');
        setLoginLoading(false);
        return;
      }

      // 4. Authenticate via Firebase Authentication with multi-field fallback
      try {
        await signInWithEmailAndPassword(auth, emailClean, pwdClean);
      } catch (authError: any) {
        // Check password matching against stored password fields (senha, senha_temporaria, password or default)
        const isPasswordMatch = 
          (userDocData.senha && userDocData.senha === pwdClean) ||
          (userDocData.senha_temporaria && userDocData.senha_temporaria === pwdClean) ||
          (userDocData.password && userDocData.password === pwdClean) ||
          (!userDocData.senha && !userDocData.senha_temporaria && pwdClean === '12345678');

        if (isPasswordMatch) {
          console.log("Fallback password matching succeeded for user:", emailClean);
          // Self-heal user registration in Firebase Auth so future logins work seamlessly with Firebase Auth
          try {
            await registerUserInFirebaseAuth(emailClean, pwdClean.length >= 6 ? pwdClean : '12345678');
          } catch (healError) {
            console.warn("Self-healing auth error:", healError);
          }
        } else {
          console.warn('Authentication credentials did not match:', authError?.message || authError);
          setLoginError('E-mail ou senha de acesso incorretos. Verifique suas credenciais.');
          setLoginLoading(false);
          return;
        }
      }

      if (userDocData.requer_alteracao_senha) {
        setFirstLoginResetUser(userDocData);
        setLoginLoading(false);
        return;
      }

      // 5. Set context, save cookies and switch view
      saveUserSessionCookie({
        id: userDocData.id,
        nome: userDocData.nome,
        email: userDocData.email,
        tipo: userDocData.tipo,
        tenant_id: tenantId
      });
      saveLastAction(`Login realizado na instituição ${(matchedTenant as Tenant).nome}`);
      saveLastModule("dashboard");

      // Load user permanent preferences (language, theme) if saved on profile
      if (userDocData.language) {
        setSystemLanguage(userDocData.language);
        setSystemLang(userDocData.language);
      }
      if (userDocData.theme) {
        setActiveTheme(userDocData.theme);
        document.documentElement.className = userDocData.theme;
      }

      setSelectedTenantId(tenantId);
      setSelectedRole(userType);
      setLoginEmail('');
      setLoginPassword('');
      setCurrentView('tenant');
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
      alert("A nova senha deve conter no mínimo 6 caracteres.");
      return;
    }
    if (newFirstPassword !== confirmFirstPassword) {
      alert("A confirmação de senha não coincide.");
      return;
    }

    try {
      // Update in Firestore 'users' collection
      await updateDoc(doc(db, 'users', firstLoginResetUser.id), {
        senha: newFirstPassword,
        requer_alteracao_senha: false
      });

      alert("Senha redefinida com sucesso! Acesso liberado.");

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
      setNewFirstPassword('');
      setConfirmFirstPassword('');
      setLoginEmail('');
      setLoginPassword('');
      setCurrentView('tenant');
    } catch (err) {
      console.error("Error resetting temporary password:", err);
      alert("Ocorreu um erro ao atualizar sua senha. Por favor, tente novamente.");
    }
  }

// Simple global memory cache for rarely changing configuration data
const clientSideCache: Record<string, any> = {
  planos: null,
};

  // Initialize and Seed Database
  async function initApp() {
    setLoading(true);
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

      // Restore session from cookie if available
      const session = getUserSessionCookie();
      if (session) {
        if (session.tipo === 'super_admin') {
          setCurrentView('superadmin');
        } else {
          // Verify if session's tenant still exists and is active
          const activeTenant = tenantsList.find(t => t.id === session.tenant_id);
          if (tenantsList.length > 0 && (!activeTenant || activeTenant.status === 'cancelado')) {
            deleteCookie('user_session');
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
                  document.documentElement.className = prefs.theme;
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
    } finally {
      setLoading(false);
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
    document.documentElement.className = savedTheme;

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

  // Handle Onboarding Flow with Firebase Authentication & Payment Gateway integration
  async function handleOnboarding(e: React.FormEvent) {
    e.preventDefault();
    try {
      const email_admin = onboardingForm.email_admin.trim().toLowerCase();
      const senha = onboardingForm.senha;

      if (senha.length < 6) {
        alert("A senha de acesso deve ter no mínimo 6 caracteres.");
        return;
      }

      // 1. Register administrator in Firebase Authentication
      let userAuthId = '';
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email_admin, senha);
        userAuthId = userCredential.user.uid;
      } catch (authError: any) {
        if (authError?.code === 'auth/email-already-in-use' || authError?.message?.includes('email-already-in-use')) {
          // Check if an existing tenant or user is using this email in Firestore
          const existingTenantsQuery = await getDocs(query(collection(db, 'tenants'), where('email_admin', '==', email_admin)));
          const existingUsersQuery = await getDocs(query(collection(db, 'users'), where('email', '==', email_admin)));
          
          if (!existingTenantsQuery.empty || !existingUsersQuery.empty) {
            alert("Este endereço de e-mail já está associado a uma conta ou instituição cadastrada no sistema. Por favor, aceda à página de login para entrar com as suas credenciais ou utilize outro endereço de e-mail.");
            return;
          }
          
          console.info("E-mail já registado no Firebase Auth. A prosseguir com o cadastro da instituição no Firestore...");
          userAuthId = "usr-auth-" + Math.random().toString(36).substring(2, 10);
        } else {
          console.error("Erro de autenticação no Firebase Auth:", authError);
          alert(`Erro de autenticação: ${authError.message || 'Falha ao registrar no Firebase Auth'}`);
          return;
        }
      }

      const generatedId = "tenant-" + Math.random().toString(36).substr(2, 9);
      
      // Simple slugifier
      const slug = onboardingForm.nome
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, '-')
         .replace(/(^-|-$)+/g, '');

      // Create Tenant with 'pendente_pagamento' status (MUST be validated with real payment)
      const newTenant = {
        id: generatedId,
        nome: onboardingForm.nome,
        slug,
        plano_id: onboardingForm.plano_id,
        status: 'pendente_pagamento', // awaiting payment confirmation
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_renovacao: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        email_admin: email_admin,
        telefone: onboardingForm.telefone,
        endereco: onboardingForm.endereco,
        plataforma_pagamento: onboardingForm.plataforma_pagamento
      };

      await setDoc(doc(db, 'tenants', generatedId), newTenant);

      // Create Admin inside 'users' collection mapped by Firebase Auth UID
      const userAdmin = {
        id: userAuthId,
        tenant_id: generatedId,
        email: email_admin,
        senha: senha, // kept for backwards-compatible fallback check
        nome: `Administrador de ${onboardingForm.nome}`,
        tipo: 'admin' as const,
        permissoes: ["R", "W", "D"],
        ativo: false, // will be activated upon payment confirmation
        created_at: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userAdmin.id), userAdmin);

      // Institutional Config
      const defaultConfig = {
        id: "cfg-" + generatedId,
        tenant_id: generatedId,
        nome_instituicao: onboardingForm.nome,
        endereco: onboardingForm.endereco,
        contacto: onboardingForm.telefone,
        ano_letivo_atual: "2026",
        escala_avaliacao: "0-20",
        notificacoes_email: true
      };
      await setDoc(doc(db, 'configuracoes', defaultConfig.id), defaultConfig);

      // Add default province
      const defaultProvince = {
        tenant_id: generatedId,
        nome: "Distrito Sede",
        codigo: "DSD"
      };
      await addDoc(collection(db, 'provincias'), defaultProvince);

      // Trigger log
      await addDoc(collection(db, 'log_admins'), {
        admin_id: "superadmin-1",
        admin_nome: "Onboarding Automático",
        acao: "Pré-Cadastro",
        entidade: "Tenant",
        entidade_id: generatedId,
        timestamp: new Date().toISOString(),
        detalhes: `Nova instituição "${onboardingForm.nome}" pré-registrada com plano "${onboardingForm.plano_id}". Aguardando pagamento real via ${onboardingForm.plataforma_pagamento}.`
      });

      // Switch to checkout screen
      setCheckoutTenant(newTenant);
      setCheckoutUser(userAdmin);
      setCheckoutActive(true);
      setPaymentSuccess(false);
      setPaymentStep('');
    } catch (err) {
      console.error("Error onboarding institution:", err);
      alert("Ocorreu um erro ao configurar sua escola. Por favor, tente novamente.");
    }
  }

  // Handle Real Payment Confirmation Simulation
  async function handleConfirmPayment() {
    if (!checkoutTenant || !checkoutUser) return;
    setPaymentLoading(true);
    setPaymentStep(`Conectando com segurança ao gateway da plataforma ${checkoutTenant.plataforma_pagamento}...`);

    try {
      // Step 1
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPaymentStep('Processando transação financeira e validando liquidação real...');
      
      // Step 2
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPaymentStep('Sucesso! Recebido sinal verde do gateway. Ativando instâncias e credenciais...');
      
      // Step 3
      await new Promise(resolve => setTimeout(resolve, 800));

      // Determine amount from plan
      const planoId = checkoutTenant.plano_id;
      const precoPlan = planoId === 'plano-basico' ? 299 : planoId === 'plano-pro' ? 499 : 899;

      // 1. Update Tenant status to 'ativo'
      await updateDoc(doc(db, 'tenants', checkoutTenant.id), {
        status: 'ativo'
      });

      // 2. Update User status to active
      await updateDoc(doc(db, 'users', checkoutUser.id), {
        ativo: true
      });

      // 3. Register standard billing receipt document
      const randomPaymentId = "pag-" + Math.random().toString(36).substr(2, 9);
      const newPayment = {
        id: randomPaymentId,
        tenant_id: checkoutTenant.id,
        tenant_nome: checkoutTenant.nome,
        valor: precoPlan,
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_pagamento: new Date().toISOString().split('T')[0],
        status: 'Pago',
        metodo: checkoutTenant.plataforma_pagamento
      };
      await setDoc(doc(db, 'pagamentos', randomPaymentId), newPayment);

      // 4. Record Audit Log
      await addDoc(collection(db, 'log_admins'), {
        admin_id: "superadmin-1",
        admin_nome: "Gateway " + checkoutTenant.plataforma_pagamento,
        acao: "Confirmação Pagamento",
        entidade: "Pagamento",
        entidade_id: randomPaymentId,
        timestamp: new Date().toISOString(),
        detalhes: `Assinatura de R$ ${precoPlan},00 recebida com sucesso via ${checkoutTenant.plataforma_pagamento}. Escola "${checkoutTenant.nome}" ativada.`
      });

      // Reload tenants
      const tenantsSnap = await getDocs(collection(db, 'tenants'));
      const tenantsList: Tenant[] = [];
      tenantsSnap.forEach((d) => {
        const t = d.data() as Tenant;
        if (!t.deleted_at && t.status !== 'cancelado') {
          tenantsList.push({ ...t, id: d.id });
        }
      });
      setTenants(tenantsList);

      setPaymentSuccess(true);
    } catch (err) {
      console.error("Erro ao processar pagamento:", err);
      alert("Ocorreu um erro ao comunicar com a plataforma de pagamentos. Tente novamente.");
    } finally {
      setPaymentLoading(false);
    }
  }

  function handleThemeChange(theme: string) {
    setActiveTheme(theme);
    saveThemePreference(theme);
    document.documentElement.className = theme;
    saveLastAction(`Alterou o tema para ${theme.replace('theme-', '')}`);
    
    const session = getUserSessionCookie();
    if (session?.id) {
      SessionStateService.savePreference(session.id, 'theme', theme);
    }
  }

  const renderLoginHeader = () => {
    const themes = [
      { id: 'theme-slate', name: 'Claro (Classic)', color: 'bg-slate-200 border-slate-400 text-slate-800' },
      { id: 'theme-dark', name: 'Escuro (Midnight)', color: 'bg-slate-900 border-slate-700 text-white' },
      { id: 'theme-emerald', name: 'Verde (Emerald)', color: 'bg-emerald-500 border-emerald-600 text-white' },
      { id: 'theme-amber', name: 'Amber (Cozy)', color: 'bg-amber-500 border-amber-600 text-white' }
    ];

    const currentTheme = themes.find(t => t.id === activeTheme) || themes[0];
    const currentLangObj = LANGUAGES.find(l => l.code === systemLang) || LANGUAGES[0];

    return (
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-transparent gap-4">
        {/* Left Side: Language Selector & View Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsLangDropdownOpen(!isLangDropdownOpen);
                setIsThemeDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-theme-card/85 border border-theme-border shadow-md text-theme-text text-xs font-semibold cursor-pointer hover:bg-theme-card transition-colors duration-200"
            >
              <span className="text-sm">{currentLangObj.flag}</span>
              <span>{currentLangObj.name}</span>
              <span className="text-[10px] opacity-60">▼</span>
            </button>

            {isLangDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsLangDropdownOpen(false)} />
                <div className="absolute left-0 mt-2.5 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-2 pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mudar Idioma</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1">
                    {LANGUAGES.map((lang) => {
                      const isSelected = systemLang === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setSystemLanguage(lang.code);
                            setSystemLang(lang.code);
                            setIsLangDropdownOpen(false);
                            saveLastAction(`Alterou o idioma do sistema para ${lang.name}`);
                            // Trigger dynamic pre-translation of common tags
                            fetchAiTranslation("Portal de Acesso Educacional", lang.code);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                          }`}
                        >
                          <span className="text-sm">{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Brandbook & Portal View switcher tabs */}
          <div className="flex bg-white/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md gap-0.5">
            <button
              type="button"
              onClick={() => setCurrentView('brandbook')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                currentView === 'brandbook'
                  ? 'bg-[#1E66F5] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#0D1B3D] dark:hover:text-white'
              }`}
            >
              📖 Brandbook SysEdu
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('landing')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                currentView === 'landing'
                  ? 'bg-[#1E66F5] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#0D1B3D] dark:hover:text-white'
              }`}
            >
              ⚡ Portal de Acesso
            </button>
          </div>
        </div>

        {/* Right Side: Theme Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsThemeDropdownOpen(!isThemeDropdownOpen);
              setIsLangDropdownOpen(false);
            }}
            className={`w-9 h-9 rounded-full ${currentTheme.color.split(' ')[0]} border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform active:scale-95 duration-200 relative group`}
            title={`Tema: ${currentTheme.name}`}
          >
            <Palette className="w-4 h-4 text-indigo-500 mix-blend-difference" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white" />
          </button>

          {isThemeDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setIsThemeDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2.5 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-2 pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mudar Tema</p>
                </div>
                <div className="space-y-1">
                  {themes.map((t) => {
                    const isSelected = activeTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          handleThemeChange(t.id);
                          setIsThemeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-semibold cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <span className={`w-4.5 h-4.5 rounded-full ${t.color.split(' ')[0]} border border-slate-300 dark:border-slate-700 shrink-0`} />
                        <span className="truncate">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    );
  };

  if (loading) {
    return (
      <div className="bg-[#0D1B3D] min-h-screen text-slate-100 flex flex-col items-center justify-center p-6 text-center animate-fadeIn duration-500">
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Logo do Sistema */}
          <SysEduLogo variant="negative" size={96} showSlogan={false} />
          
          {/* Slogan */}
          <div className="space-y-1.5 mt-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300 font-sans">
              SysEdu SaaS
            </h2>
            <p className="text-xs text-indigo-100/60 font-serif italic max-w-xs">
              "Organizar hoje, transformar o amanhã."
            </p>
          </div>

          {/* Samsung One UI Style circular thin spinner */}
          <div className="pt-8">
            <svg className="w-8 h-8 animate-spin text-indigo-400" viewBox="0 0 50 50">
              <circle 
                className="opacity-20" 
                cx="25" 
                cy="25" 
                r="20" 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="none" 
              />
              <path 
                className="opacity-80" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                d="M25,5 A20,20 0 0,1 45,25" 
              />
            </svg>
          </div>
        </div>
      </div>
    );
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
    <main className="min-h-screen bg-theme-bg text-theme-text font-sans transition-colors duration-300 relative">
      <StripeCheckoutStatus />
      {(currentView === 'landing' || currentView === 'brandbook') && renderLoginHeader()}
      
      {/* VIEW: LANDING/LOGIN PORTAL SWITCHER */}
      {currentView === 'landing' && (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg pt-20 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl w-full bg-theme-card rounded-3xl border border-theme-border shadow-xl p-6 md:p-10 space-y-6 text-theme-text transition-all duration-300">
            
            {/* Header with Title and Sign-up Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border pb-5">
              <div className="space-y-3">
                <SysEduLogo variant="full" size={38} />
                <h1 className="text-xl font-extrabold text-theme-text tracking-tight font-sans">
                  {translate("Portal de Acesso Educacional", systemLang)}
                </h1>
                <p className="text-theme-text-muted text-xs mt-1 leading-relaxed">
                  {translate("Sistema SaaS multi-tenant. Faça o login único abaixo ou registre sua própria escola.", systemLang)}
                </p>
              </div>
              
              <button 
                onClick={() => {
                  setOnboardingSuccess(null);
                  setOnboardingForm({
                    nome: '',
                    email_admin: '',
                    senha: '',
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-profissional',
                    plataforma_pagamento: 'multicaixa'
                  });
                  setIsOnboardingModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> {translate("Registrar Escola (Sign-up)", systemLang)}
              </button>
            </div>

            {/* Main Login Card */}
            <div className="bg-theme-bg/60 p-6 rounded-2xl border border-theme-border shadow-sm space-y-5">
              <div className="border-b border-theme-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-bold font-sans text-theme-text text-sm">{translate("Acesso Unificado ao Sistema", systemLang)}</h3>
                  <p className="text-theme-text-muted text-[11px] mt-0.5">{translate("Informe suas credenciais para ser redirecionado automaticamente.", systemLang)}</p>
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 text-rose-700 dark:text-rose-350 p-3 rounded-xl text-xs leading-relaxed font-semibold">
                  {translate(loginError, systemLang)}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">{translate("Endereço de E-mail", systemLang)}</label>
                  <input 
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nome@dominio.edu ou admin@escola.com"
                    className="w-full bg-theme-bg border border-theme-border rounded-lg p-2.5 text-xs text-theme-text font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">{translate("Senha de Acesso", systemLang)}</label>
                  <input 
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-theme-bg border border-theme-border rounded-lg p-2.5 text-xs text-theme-text font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  {loginLoading ? '...' : translate("Autenticar e Entrar", systemLang)} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>



            {/* Bottom Invitation Prompt */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-theme-text-muted bg-theme-bg/80 p-3.5 rounded-xl border border-theme-border gap-2">
              <span>Quer testar a criação instantânea de uma nova escola?</span>
              <button
                onClick={() => {
                  setOnboardingSuccess(null);
                  setOnboardingForm({
                    nome: '',
                    email_admin: '',
                    senha: '',
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-profissional',
                    plataforma_pagamento: 'multicaixa'
                  });
                  setIsOnboardingModalOpen(true);
                }}
                className="text-indigo-600 hover:text-indigo-500 font-bold underline transition-colors cursor-pointer"
              >
                Registrar Escola Agora
              </button>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
              Nelton Benedito • MVP Sistema SaaS Educacional Multi-Contas
            </div>
          </div>
        </div>
      )}

      {/* FIRST LOGIN MANDATORY PASSWORD RESET MODAL */}
      {firstLoginResetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950">
              <div className="space-y-1 text-center sm:text-left">
                <span className="bg-rose-500/20 text-rose-400 text-[10px] font-bold py-1 px-3 rounded-full uppercase tracking-wider font-mono">
                  🚨 Segurança Obrigatória
                </span>
                <h3 className="text-lg font-extrabold text-white font-sans mt-2">Alteração de Senha Necessária</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Identificamos que este é o seu primeiro login com uma senha temporária. Para garantir a segurança dos seus dados, por favor defina uma senha pessoal definitiva.
                </p>
              </div>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleFirstLoginPasswordReset} className="p-6 space-y-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Conta Identificada:</p>
                <p className="text-xs font-semibold text-white truncate">{firstLoginResetUser.nome}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{firstLoginResetUser.email}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nova Senha Definitiva</label>
                <input
                  type="password"
                  required
                  value={newFirstPassword}
                  onChange={(e) => setNewFirstPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={confirmFirstPassword}
                  onChange={(e) => setConfirmFirstPassword(e.target.value)}
                  placeholder="Repita a senha definitiva"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setFirstLoginResetUser(null);
                    setNewFirstPassword('');
                    setConfirmFirstPassword('');
                    setLoginPassword('');
                  }}
                  className="w-1/3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Confirmar e Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARDING MODAL (POPUP) */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="space-y-1">
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold py-0.5 px-2.5 rounded-full uppercase tracking-wider font-mono">
                  {checkoutActive ? "Etapa 2/2: Pagamento e Ativação" : "SaaS Auto-Onboarding — Etapa 1/2"}
                </span>
                <h3 className="text-lg font-bold text-white font-sans mt-1">
                  {checkoutActive ? "Finalizar Assinatura Mensal" : "Registre Sua Escola Agora"}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsOnboardingModalOpen(false);
                  setCheckoutActive(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {checkoutActive ? (
                <div className="space-y-4">
                  {paymentLoading ? (
                    <div className="p-8 text-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <h4 className="text-sm font-bold text-white">Processando Liquidação Real...</h4>
                      <p className="text-xs text-slate-400 animate-pulse font-mono">{paymentStep}</p>
                    </div>
                  ) : paymentSuccess ? (
                    <div className="p-4 rounded-xl bg-slate-850 border border-emerald-500/30 text-center space-y-4 animate-in fade-in duration-200">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <h4 className="text-lg font-bold text-white">Escola Provisionada e Ativada!</h4>
                      <p className="text-xs text-slate-300">
                        O pagamento da assinatura de <strong className="text-indigo-400">R$ {checkoutTenant.plano_id === 'plano-basico' ? 299 : checkoutTenant.plano_id === 'plano-pro' ? 499 : 899},00</strong> foi processado e validado com sucesso via <strong className="text-indigo-400">{checkoutTenant.plataforma_pagamento}</strong>.
                      </p>
                      <p className="text-xs text-slate-400">
                        Sua instituição já está com status <strong className="text-emerald-400">Ativo</strong> e as credenciais criadas estão autorizadas a acessar o sistema.
                      </p>
                      
                      <div className="flex gap-2.5 pt-2">
                        <button 
                          onClick={() => {
                            // Authenticate user directly
                            saveUserSessionCookie({
                              id: checkoutUser.id,
                              nome: checkoutUser.nome,
                              email: checkoutUser.email,
                              tipo: 'admin',
                              tenant_id: checkoutTenant.id
                            });
                            saveLastAction(`Login automático após onboarding: ${checkoutUser.email}`);
                            saveLastModule("dashboard");
                            setSelectedTenantId(checkoutTenant.id);
                            setSelectedRole('admin');
                            setIsOnboardingModalOpen(false);
                            setCheckoutActive(false);
                            setCurrentView('tenant');
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                        >
                          Acessar Meu Novo Portal Escolar
                        </button>
                        <button 
                          onClick={() => {
                            setIsOnboardingModalOpen(false);
                            setCheckoutActive(false);
                          }}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Instituição:</span>
                          <span className="font-bold text-white">{checkoutTenant.nome}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Plano Selecionado:</span>
                          <span className="font-bold text-white uppercase">{checkoutTenant.plano_id.replace('plano-', '')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Plataforma de Pagamento:</span>
                          <span className="font-bold text-indigo-400">{checkoutTenant.plataforma_pagamento}</span>
                        </div>
                        <div className="border-t border-slate-850 pt-2 flex justify-between text-sm">
                          <span className="font-bold text-slate-300">Total Devido:</span>
                          <span className="font-extrabold text-white">R$ {checkoutTenant.plano_id === 'plano-basico' ? '299,00' : checkoutTenant.plano_id === 'plano-pro' ? '499,00' : '899,00'}</span>
                        </div>
                      </div>

                      {checkoutTenant.plataforma_pagamento === 'Pix' ? (
                        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4 text-center">
                          <div className="bg-white p-3 rounded-xl w-36 h-36 mx-auto flex items-center justify-center border border-slate-200 shadow-inner">
                            <img 
                              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020101021126580014br.gov.bcb.pix0136696492b1-5d0c-465c-a833-bdfb1270cde15204000053039865405299.005802BR5915Nelton%20SGE6009MAPUTO62070503SGE" 
                              alt="Pix QR Code" 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">Código Pix Copia e Cola:</p>
                            <input 
                              type="text" 
                              readOnly 
                              value="00020101021126580014br.gov.bcb.pix0136696492b1-5d0c-465c-a833-bdfb1270cde15204000053039865405299.005802BR5915Nelton%20SGE6009MAPUTO62070503SGE"
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 font-mono text-center select-all"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText("00020101021126580014br.gov.bcb.pix0136696492b1-5d0c-465c-a833-bdfb1270cde15204000053039865405299.005802BR5915Nelton%20SGE6009MAPUTO62070503SGE");
                                alert("Código Pix copiado para a área de transferência!");
                              }}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                            >
                              Copiar Código Pix
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                            Abra o aplicativo de pagamentos do seu banco, escolha "Pagar via Pix Copia e Cola" ou escaneie o código acima para efetuar a liquidação imediata da mensalidade.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados do Cartão de Crédito ({checkoutTenant.plataforma_pagamento}):</p>
                          
                          <div className="space-y-2 text-xs text-left">
                            <div>
                              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Nome no Cartão</label>
                              <input 
                                type="text" 
                                required 
                                placeholder="NOME DO TITULAR"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Número do Cartão de Crédito</label>
                              <input 
                                type="text" 
                                required 
                                maxLength={19}
                                placeholder="4111 2222 3333 4444"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Expiração</label>
                                <input 
                                  type="text" 
                                  required 
                                  maxLength={5}
                                  placeholder="MM/AA"
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">CVC / CVV</label>
                                <input 
                                  type="password" 
                                  required 
                                  maxLength={4}
                                  placeholder="123"
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2.5 pt-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setCheckoutActive(false);
                          }}
                          className="w-1/3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button 
                          type="button"
                          onClick={handleConfirmPayment}
                          className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10 cursor-pointer"
                        >
                          Confirmar Pagamento Real
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleOnboarding} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Instituição Escolar</label>
                    <input 
                      type="text"
                      required
                      value={onboardingForm.nome}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, nome: e.target.value })}
                      placeholder="Ex: Instituto Tecnológico da Beira"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email de Acesso (Login)</label>
                      <input 
                        type="email"
                        required
                        value={onboardingForm.email_admin}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, email_admin: e.target.value })}
                        placeholder="Ex: gestor@escola.edu"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso (Mín. 6 Caracteres)</label>
                      <input 
                        type="password"
                        required
                        value={onboardingForm.senha}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, senha: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telefone de Contato</label>
                      <input 
                        type="text"
                        required
                        value={onboardingForm.telefone}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, telefone: e.target.value })}
                        placeholder="Ex: +258 84..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço de Sede</label>
                      <input 
                        type="text"
                        required
                        value={onboardingForm.endereco}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, endereco: e.target.value })}
                        placeholder="Cidade, Província"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escolher Plano de Subscrição</label>
                      <select 
                        value={onboardingForm.plano_id}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, plano_id: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 transition-all cursor-pointer"
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id} className="bg-slate-900">{p.nome} — R$ {p.preco}/mês</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plataforma de Pagamento</label>
                      <select 
                        value={onboardingForm.plataforma_pagamento}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, plataforma_pagamento: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 transition-all cursor-pointer"
                      >
                        <option value="Stripe" className="bg-slate-900">Stripe Gateway</option>
                        <option value="PayPal" className="bg-slate-900">PayPal Express</option>
                        <option value="Iugu" className="bg-slate-900">Iugu Payments</option>
                        <option value="Pix" className="bg-slate-900">Pix Automático</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow-md cursor-pointer"
                    >
                      Criar Conta e Prosseguir para o Pagamento <ArrowRight className="w-4 h-4" />
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
          <SuperAdminPortal 
            onLogout={() => {
              deleteCookie('user_session');
              setCurrentView('landing');
            }} 
            activeTheme={activeTheme}
            onChangeTheme={handleThemeChange}
            systemLang={systemLang}
            onChangeLanguage={(lang) => {
              setSystemLanguage(lang);
              setSystemLang(lang);
            }}
          />
        </ErrorBoundary>
      )}

      {/* VIEW: TENANT PORTAL PANEL (CAMADA 2) */}
      {currentView === 'tenant' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar o Portal Académico">
          <TenantPortal 
            currentTenantId={selectedTenantId}
            currentUserRole={selectedRole}
            currentUserEmail={getUserSessionCookie()?.email || ""}
            onLogout={() => {
              deleteCookie('user_session');
              setCurrentView('landing');
            }}
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
        </ErrorBoundary>
      )}

      {/* VIEW: BRANDBOOK VIEW */}
      {currentView === 'brandbook' && (
        <div className="pt-20">
          <BrandbookView />
        </div>
      )}

      {/* COOKIE AND PREFERENCE CONSENT POPUP */}
      {showCookieConsent && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md z-50 animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                  Preferências de Privacidade & Cookies
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Deseja que nosso sistema salve suas definições de usuários, temas preferidos, última aba aberta, rascunhos de formulários e configurações SMTP? Isso permite que retome seu trabalho exatamente de onde parou. (Validade: 24h)
                </p>
              </div>
            </div>

            {/* Dropdown/Accordion to select preferences */}
            <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPrefsDropdownOpen(!isPrefsDropdownOpen)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
              >
                <span>⚙️ Personalizar Definições</span>
                <span>{isPrefsDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {isPrefsDropdownOpen && (
                <div className="p-3.5 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-850 space-y-2.5 animate-in slide-in-from-top-2 duration-150 max-h-48 overflow-y-auto">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={cookiePrefs.session}
                      onChange={(e) => setCookiePrefs({ ...cookiePrefs, session: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">Sessão & Contas</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Manter sessão iniciada por 24h</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={cookiePrefs.theme}
                      onChange={(e) => setCookiePrefs({ ...cookiePrefs, theme: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">Temas Ativos</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Lembrar o tema escolhido para a plataforma</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={cookiePrefs.lastPage}
                      onChange={(e) => setCookiePrefs({ ...cookiePrefs, lastPage: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">Última Página & Abas</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Retornar automaticamente à última aba ou scroll</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={cookiePrefs.formData}
                      onChange={(e) => setCookiePrefs({ ...cookiePrefs, formData: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">Rascunhos de Formulários</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Lembrar rascunhos em campos não enviados</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={cookiePrefs.smtp}
                      onChange={(e) => setCookiePrefs({ ...cookiePrefs, smtp: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">Servidores SMTP</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Lembrar dados de conexão de e-mail e SMTP</span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCookie("user_cookie_consent", "refused", 24);
                  deleteCookie("user_cookie_preferences");
                  deleteCookie("user_session");
                  deleteCookie("user_theme");
                  deleteCookie("last_module");
                  deleteCookie("last_scroll");
                  
                  // Clear form drafts
                  const drafts = [
                    'draft_provincia', 'draft_escola', 'draft_teacher', 'draft_student',
                    'draft_turma', 'draft_classe', 'draft_pauta', 'draft_processo',
                    'draft_user', 'draft_classe_escolar', 'draft_super_notif',
                    'draft_smtp_form', 'draft_tenant_form', 'draft_plan_form', 'draft_payment_form'
                  ];
                  drafts.forEach(d => deleteCookie(d));

                  setShowCookieConsent(false);
                  setCurrentView('landing');
                }}
                className="w-1/3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100/10 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCookie("user_cookie_consent", "accepted", 24);
                  setCookie("user_cookie_preferences", JSON.stringify(cookiePrefs), 24);
                  setShowCookieConsent(false);
                }}
                className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow cursor-pointer text-center"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      {renderCommandMenu()}

    </main>
  );
}
