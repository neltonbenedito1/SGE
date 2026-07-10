/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { seedDatabaseIfEmpty, db } from './lib/firebase';
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

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'superadmin' | 'tenant'>('landing');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('tenant-maputo');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'director' | 'docente' | 'pai' | 'estudante'>('admin');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>('theme-slate');
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [systemLang, setSystemLang] = useState<string>(getSystemLanguage());
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Command Menu states
  const [isCmdMenuOpen, setIsCmdMenuOpen] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(0);

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
            window.dispatchEvent(new CustomEvent('sge-navigate-tenant', { detail: { tab: t.id } }));
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
            window.dispatchEvent(new CustomEvent('sge-navigate-superadmin', { detail: { tab: t.id } }));
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
            telefone: '',
            endereco: '',
            plano_id: plans[0]?.id || 'plano-profissional'
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
          window.dispatchEvent(new CustomEvent('sge-open-ai-chat'));
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
    telefone: '',
    endereco: '',
    plano_id: 'plano-profissional'
  });
  const [onboardingSuccess, setOnboardingSuccess] = useState<Tenant | null>(null);

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

      // 2. Query tenant user from collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', emailClean));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setLoginError('Credenciais inválidas');
        setLoginLoading(false);
        return;
      }

      let userDocData: any = null;
      querySnap.forEach((doc) => {
        const data = doc.data();
        userDocData = { id: doc.id, ...data };
      });

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

      if (!matchedTenant) {
        setLoginError('Credenciais inválidas');
        setLoginLoading(false);
        return;
      }

      if ((matchedTenant as Tenant).status === 'suspenso') {
        setLoginError('⚠️ Acesso Bloqueado: Esta conta de instituição foi suspensa pelo Administrador Geral devido ao atraso no pagamento da assinatura mensal. Regularize a fatura no portal Super Admin para reativar o acesso.');
        setLoginLoading(false);
        return;
      }

      // 3.5. Password matching and First Login checks
      if (userDocData.senha && userDocData.senha !== pwdClean) {
        setLoginError('Credenciais inválidas');
        setLoginLoading(false);
        return;
      }

      if (userDocData.requer_alteracao_senha) {
        setFirstLoginResetUser(userDocData);
        setLoginLoading(false);
        return;
      }

      // 4. Set context, save cookies and switch view
      saveUserSessionCookie({
        nome: userDocData.nome,
        email: userDocData.email,
        tipo: userDocData.tipo,
        tenant_id: tenantId
      });
      saveLastAction(`Login realizado na instituição ${(matchedTenant as Tenant).nome}`);
      saveLastModule("dashboard");

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

  // Initialize and Seed Database
  async function initApp() {
    setLoading(true);
    try {
      await seedDatabaseIfEmpty();
      
      // Load current Tenants for selector
      const tenantsSnap = await getDocs(collection(db, 'tenants'));
      const tenantsList: Tenant[] = [];
      tenantsSnap.forEach((d) => {
        const t = d.data() as Tenant;
        if (!t.deleted_at && t.status !== 'cancelado') {
          tenantsList.push({ ...t, id: d.id });
        }
      });
      setTenants(tenantsList);

      // Load Plans
      const plansSnap = await getDocs(collection(db, 'planos'));
      const plansList: Plano[] = [];
      plansSnap.forEach((d) => {
        plansList.push({ ...d.data() as Plano, id: d.id });
      });
      setPlans(plansList);

      // Restore session from cookie if available
      const session = getUserSessionCookie();
      if (session) {
        if (session.tipo === 'super_admin') {
          setCurrentView('superadmin');
        } else {
          setSelectedTenantId(session.tenant_id);
          setSelectedRole(session.tipo as any);
          setCurrentView('tenant');
        }
      }
    } catch (err) {
      console.error("Error initializing app:", err);
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

  // Handle Onboarding Flow
  async function handleOnboarding(e: React.FormEvent) {
    e.preventDefault();
    try {
      const generatedId = "tenant-" + Math.random().toString(36).substr(2, 9);
      
      // Simple slugifier
      const slug = onboardingForm.nome
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const newTenant: Tenant = {
        id: generatedId,
        nome: onboardingForm.nome,
        slug,
        plano_id: onboardingForm.plano_id,
        status: 'ativo',
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_renovacao: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        email_admin: onboardingForm.email_admin,
        telefone: onboardingForm.telefone,
        endereco: onboardingForm.endereco
      };

      await setDoc(doc(db, 'tenants', generatedId), newTenant);

      // Create an Admin inside the new tenant workspace
      const userAdmin = {
        id: "user-admin-" + generatedId,
        tenant_id: generatedId,
        email: onboardingForm.email_admin,
        nome: `Administrador de ${onboardingForm.nome}`,
        tipo: 'admin' as const,
        permissoes: ["R", "W", "D"],
        ativo: true,
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

      // Add a single default province inside the new tenant
      const defaultProvince = {
        tenant_id: generatedId,
        nome: "Distrito Sede",
        codigo: "DSD"
      };
      await addDoc(collection(db, 'provincias'), defaultProvince);

      // Trigger audit log for creation
      await addDoc(collection(db, 'log_admins'), {
        admin_id: "superadmin-1",
        admin_nome: "Onboarding Automático",
        acao: "Criar Conta",
        entidade: "Tenant",
        entidade_id: generatedId,
        timestamp: new Date().toISOString(),
        detalhes: `Nova instituição "${onboardingForm.nome}" cadastrada via fluxo público de Onboarding`
      });

      setOnboardingSuccess(newTenant);
      
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
    } catch (err) {
      console.error("Error onboarding institution:", err);
    }
  }

  function handleThemeChange(theme: string) {
    setActiveTheme(theme);
    saveThemePreference(theme);
    document.documentElement.className = theme;
    saveLastAction(`Alterou o tema para ${theme.replace('theme-', '')}`);
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
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-transparent">
        {/* Left Side: Language Selector Dropdown */}
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
      <div className="bg-slate-900 min-h-screen text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-2xl font-bold font-sans">Inicializando Sistema SaaS Educacional</h2>
        <p className="text-slate-400 text-sm mt-1 max-w-sm">
          Estabelecendo canais seguros, montando esquemas de isolamento de tenants e carregando dados iniciais no Firestore...
        </p>
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
      {currentView === 'landing' && renderLoginHeader()}
      
      {/* VIEW: LANDING/LOGIN PORTAL SWITCHER */}
      {currentView === 'landing' && (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg pt-20 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl w-full bg-theme-card rounded-3xl border border-theme-border shadow-xl p-6 md:p-10 space-y-6 text-theme-text transition-all duration-300">
            
            {/* Header with Title and Sign-up Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">SaaS MVP</span>
                  <span className="text-theme-text-muted text-xs font-mono">v1.0.0</span>
                </div>
                <h1 className="text-2xl font-extrabold text-theme-text tracking-tight font-sans">
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
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-profissional'
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

            {/* Quick Testing Credentials Table */}
            <div className="bg-theme-accent/10 p-4 rounded-xl border border-theme-accent/20 space-y-2.5">
              <h4 className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                🔑 Credenciais Rápidas para Testes:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <div className="bg-theme-card p-2 rounded border border-theme-border">
                  <p className="font-bold text-theme-text">Camada 1 (Super Admin):</p>
                  <p className="text-theme-text-muted font-mono">Email: neltonbenedito1@gmail.com</p>
                  <p className="text-theme-text-muted font-mono">Senha: Errado23x</p>
                </div>
                <div className="bg-theme-card p-2 rounded border border-theme-border">
                  <p className="font-bold text-theme-text">Camada 2 (Escola Admin):</p>
                  <p className="text-theme-text-muted font-mono">Email: admin@maputocentral.edu</p>
                  <p className="text-theme-text-muted">Senha: (Qualquer uma)</p>
                </div>
                <div className="bg-theme-card p-2 rounded border border-theme-border">
                  <p className="font-bold text-theme-text">Camada 2 (Docente):</p>
                  <p className="text-theme-text-muted font-mono">Email: pedro.santos@maputocentral.edu</p>
                  <p className="text-theme-text-muted">Senha: (Qualquer uma)</p>
                </div>
                <div className="bg-theme-card p-2 rounded border border-theme-border">
                  <p className="font-bold text-theme-text">Camada 2 (Estudante):</p>
                  <p className="text-theme-text-muted font-mono">Email: mateus@colegio.edu</p>
                  <p className="text-theme-text-muted">Senha: (Qualquer uma)</p>
                </div>
              </div>
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
                    telefone: '',
                    endereco: '',
                    plano_id: plans[0]?.id || 'plano-profissional'
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="space-y-1">
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold py-0.5 px-2.5 rounded-full uppercase tracking-wider">
                  SaaS Auto-Onboarding
                </span>
                <h3 className="text-lg font-bold text-white font-sans mt-1">Registre Sua Escola Agora</h3>
              </div>
              <button 
                onClick={() => setIsOnboardingModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {onboardingSuccess ? (
                <div className="p-4 rounded-xl bg-slate-850 border border-emerald-500/30 text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h4 className="text-lg font-bold text-white">Escola Registrada!</h4>
                  <p className="text-xs text-slate-300">
                    O slug gerado para sua instituição é <strong className="text-indigo-400">/{onboardingSuccess.slug}</strong>. Seu portal isolado foi provisionado e já criamos uma conta de Administrador.
                  </p>
                  
                  <div className="flex gap-2.5">
                    <button 
                      onClick={() => {
                        setSelectedTenantId(onboardingSuccess.id);
                        setSelectedRole('admin');
                        setIsOnboardingModalOpen(false);
                        setCurrentView('tenant');
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Acessar Meu Portal Criado
                    </button>
                    <button 
                      onClick={() => setOnboardingSuccess(null)}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Registrar Outra
                    </button>
                  </div>
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email do Gestor</label>
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

                  <div className="pt-2">
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow-md cursor-pointer"
                    >
                      Confirmar e Provisionar Minha Escola <Plus className="w-4 h-4" />
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
      )}

      {/* VIEW: TENANT PORTAL PANEL (CAMADA 2) */}
      {currentView === 'tenant' && (
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
          }}
        />
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
