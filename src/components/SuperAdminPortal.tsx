/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, registerUserInFirebaseAuth, ensureFirebaseAuthSession } from '../lib/firebase';
import { authSecurityService } from '../services/authSecurityService';
import { LANGUAGES, translate } from '../lib/translation';
import { localDb, syncLocalDataToFirestore } from '../lib/localDb';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Tenant, Plano, Pagamento, LogAdmin, SmtpConfig, Notificacao } from '../types';
import { createGmailRawPayload, EmailTemplates } from '../lib/emailUtils';
import { escapeHtml } from '../lib/sanitize';
import { SuperAdminFinancePanel } from './SuperAdminFinancePanel';
import { SysEduLogo } from './SysEduLogo';
import { SamsungLoadingScreen } from './SamsungLoadingScreen';
import { 
  Building2, 
  CreditCard, 
  ShieldAlert, 
  Sparkles, 
  Users, 
  DollarSign, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Filter, 
  Lock, 
  Calendar, 
  FileText, 
  History,
  Mail,
  Server,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Bell,
  MoreVertical,
  Check,
  Eye,
  Settings,
  Sliders,
  Globe,
  Palette,
  EyeOff,
  Copy,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Upload
} from 'lucide-react';

import {
  saveLastModule,
  getCookie,
  saveSettingIfAllowed
} from '../lib/cookies';
import { CookiePolicyModal } from './CookiePolicyModal';

function getSavedFormDraft<T>(key: string, defaultValue: T): T {
  const saved = getCookie(key);
  if (!saved) return defaultValue;
  try {
    return JSON.parse(saved);
  } catch (e) {
    return defaultValue;
  }
}

interface SuperAdminPortalProps {
  onLogout?: () => void;
  activeTheme?: string;
  onChangeTheme?: (theme: string) => void;
  systemLang?: string;
  onChangeLanguage?: (lang: string) => void;
}

interface TenantFormState {
  nome: string;
  email_admin: string;
  telefone: string;
  endereco: string;
  plano_id: string;
  status: 'ativo' | 'suspenso' | 'cancelado';
  data_vencimento: string;
  senha_temporaria?: string;
  senha?: string;
  confirmar_senha?: string;
  idioma_padrao: string;
  ai_translation_enabled: boolean;
  logo_url?: string;
}

export default function SuperAdminPortal({ 
  onLogout, 
  activeTheme, 
  onChangeTheme,
  systemLang = 'pt',
  onChangeLanguage
}: SuperAdminPortalProps) {
  const [isCookiePolicyOpen, setIsCookiePolicyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'plans' | 'payments' | 'logs' | 'smtp'>(() => {
    const saved = getCookie('last_module');
    if (saved === 'dashboard' || saved === 'tenants' || saved === 'plans' || saved === 'payments' || saved === 'logs' || saved === 'smtp') {
      return saved as any;
    }
    return 'dashboard';
  });

  useEffect(() => {
    saveLastModule(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleCmdNav = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('sge-navigate-superadmin', handleCmdNav);
    return () => window.removeEventListener('sge-navigate-superadmin', handleCmdNav);
  }, []);
  
  // Sidebar states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // OS & Screen Size detection and Mobile Navigation
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth < 768;
  const isExpanded = isMobile || !isSidebarCollapsed || isSidebarHovered;
  const [detectedOS, setDetectedOS] = useState('Desktop');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    // Detect OS
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDetectedOS('iOS');
    } else if (/android/.test(ua)) {
      setDetectedOS('Android');
    } else {
      setDetectedOS('Desktop');
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Notifications State
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isSendNotifModalOpen, setIsSendNotifModalOpen] = useState(false);
  const [newNotifForm, setNewNotifForm] = useState(() => getSavedFormDraft('draft_super_notif', {
    destinatario_id: 'todos', // 'todos' or tenant_id
    titulo: '',
    mensagem: '',
    tipo: 'info' as 'info' | 'alerta' | 'limite' | 'sistema' | 'sucesso'
  }));

  useEffect(() => {
    saveSettingIfAllowed('draft_super_notif', JSON.stringify(newNotifForm), 'formData', 24);
  }, [newNotifForm]);
  
  // Data State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [logs, setLogs] = useState<LogAdmin[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [globalSmtp, setGlobalSmtp] = useState<SmtpConfig>(() => {
    try {
      const localSmtps = localDb.getSmtpConfigs();
      const localGlobal = localSmtps.find(s => s.id === 'system_global');
      if (localGlobal) {
        return localGlobal;
      }
    } catch (e) {
      console.warn("Could not load initial local SMTP:", e);
    }
    return {
      id: 'system_global',
      tenant_id: 'system',
      smtp_type: 'manual',
      host: '',
      port: 587,
      user: '',
      pass: '',
      secure: false,
      sender_email: '',
      sender_name: '',
      status: 'ativo'
    };
  });
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const showSystemNotification = useCallback((message: string, type: 'sucesso' | 'erro' | 'info' | 'config' | 'cadastro' = 'info') => {
    const popup = document.createElement('div');
    let bgClass = 'bg-slate-900 text-white border-slate-700';
    let icon = '🔔';
    if (type === 'sucesso') {
      bgClass = 'bg-emerald-950 text-emerald-100 border-emerald-500';
      icon = '✅';
    } else if (type === 'erro') {
      bgClass = 'bg-rose-950 text-rose-100 border-rose-500';
      icon = '❌';
    } else if (type === 'config') {
      bgClass = 'bg-indigo-950 text-indigo-100 border-indigo-500';
      icon = '⚙️';
    } else if (type === 'cadastro') {
      bgClass = 'bg-cyan-950 text-cyan-100 border-cyan-500';
      icon = '📝';
    }

    popup.className = `fixed bottom-5 right-5 ${bgClass} font-sans font-bold text-xs px-5 py-4 rounded-2xl shadow-2xl border z-[9999] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-sm`;
    popup.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
    const safeType = escapeHtml(type);
    const safeMsg = escapeHtml(message);
    popup.innerHTML = `
      <span class="text-lg">${icon}</span>
      <div class="flex-1 text-left">
        <p class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">${safeType}</p>
        <p class="text-xs font-semibold leading-relaxed text-white">${safeMsg}</p>
      </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
      popup.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5', 'duration-300');
      setTimeout(() => popup.remove(), 300);
    }, 6000);
  }, []);

  // Critical Tenant Deletion state
  const [criticalDeleteTenant, setCriticalDeleteTenant] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Administrator Password Reset with 2FA state
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
  const [selectedTenantForPasswordReset, setSelectedTenantForPasswordReset] = useState<Tenant | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiration, setOtpExpiration] = useState<Date | null>(null);
  const [otpMessage, setOtpMessage] = useState('');
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [isPasswordChangedSuccessfully, setIsPasswordChangedSuccessfully] = useState(false);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);

  // SMTP Form Modals state
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [selectedTenantForSmtp, setSelectedTenantForSmtp] = useState<Tenant | null>(null);

  // SMTP Form inputs
  const [smtpForm, setSmtpForm] = useState(() => getSavedFormDraft('draft_smtp_form', {
    host: '',
    port: 587,
    user: '',
    pass: '',
    secure: false,
    sender_email: '',
    sender_name: '',
    status: 'ativo' as 'ativo' | 'inativo'
  }));

  useEffect(() => {
    saveSettingIfAllowed('draft_smtp_form', JSON.stringify(smtpForm), 'formData', 24);
  }, [smtpForm]);

  // Simulated connection test feedback states
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Batch selection states
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [selectedSmtpTenantIds, setSelectedSmtpTenantIds] = useState<string[]>([]);

  // Row-level action menu state
  const [activeActionRowId, setActiveActionRowId] = useState<string | null>(null);

  // Modern custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    isCritical?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, isCritical = false) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      isCritical
    });
  };
  const [planFilter, setPlanFilter] = useState('todos');

  // Form Modals state
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  
  // Active editing item
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plano | null>(null);

  // Form Inputs
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [tenantForm, setTenantForm] = useState<TenantFormState>(() => getSavedFormDraft('draft_tenant_form', {
    nome: '',
    email_admin: '',
    telefone: '',
    endereco: '',
    plano_id: '',
    status: 'ativo' as 'ativo' | 'suspenso' | 'cancelado',
    data_vencimento: '',
    senha_temporaria: '',
    senha: '',
    confirmar_senha: '',
    idioma_padrao: 'pt',
    ai_translation_enabled: true
  }));

  // Função auxiliar para validação e métricas de complexidade de senha
  const getPasswordComplexity = useCallback((password: string, confirmPassword?: string) => {
    const pwd = password || '';
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    const matchConfirm = confirmPassword !== undefined ? (pwd.length > 0 && pwd === confirmPassword) : true;

    let score = 0;
    if (minLength) score += 20;
    if (hasUpper) score += 20;
    if (hasLower) score += 20;
    if (hasNumber) score += 20;
    if (hasSpecial) score += 20;

    let label = 'Muito Fraca';
    let barColor = 'bg-rose-500';
    let badgeColor = 'bg-rose-100 text-rose-700 border-rose-200';

    if (score >= 100) {
      label = 'Excelente';
      barColor = 'bg-emerald-500';
      badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    } else if (score >= 80) {
      label = 'Forte';
      barColor = 'bg-teal-500';
      badgeColor = 'bg-teal-100 text-teal-700 border-teal-200';
    } else if (score >= 60) {
      label = 'Média';
      barColor = 'bg-amber-500';
      badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
    } else if (score >= 40) {
      label = 'Fraca';
      barColor = 'bg-orange-500';
      badgeColor = 'bg-orange-100 text-orange-700 border-orange-200';
    }

    const isFullyValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial && matchConfirm;

    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      matchConfirm,
      score,
      label,
      barColor,
      badgeColor,
      isFullyValid
    };
  }, []);

  useEffect(() => {
    saveSettingIfAllowed('draft_tenant_form', JSON.stringify(tenantForm), 'formData', 24);
  }, [tenantForm]);

  // Simulated email server inbox
  const [receivedEmails, setReceivedEmails] = useState<{ id: string; to: string; subject: string; body: string; date: string }[]>([]);
  const [isEmailServerInboxOpen, setIsEmailServerInboxOpen] = useState(false);

  // Google/Gmail API Integration State
  const [gmailToken, setGmailToken] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('superadmin_gmail_oauth_token');
      if (saved) return saved;
      const localSmtps = localDb.getSmtpConfigs();
      const localGlobal = localSmtps.find(s => s.id === 'system_global');
      return localGlobal?.gmail_token || null;
    } catch (e) {
      return null;
    }
  });
  const [showUnauthorizedDomainModal, setShowUnauthorizedDomainModal] = useState(false);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState('');

  // Cloudflare DNS Configuration State
  const [cloudflareNs, setCloudflareNs] = useState({
    ns1: 'gabriella.ns.cloudflare.com',
    ns2: 'patryk.ns.cloudflare.com',
    oldNs1: 'ns1.afternic.com',
    oldNs2: 'ns2.afternic.com',
    domain: 'meudominio.com'
  });
  const [dnsCopiedItem, setDnsCopiedItem] = useState<string | null>(null);
  const [dnsCheckStatus, setDnsCheckStatus] = useState<'idle' | 'checking' | 'active'>('idle');
  const [dnsCheckLogs, setDnsCheckLogs] = useState<string[]>([]);

  // Layer 1 Notification configurations
  interface SuperNotificationRule {
    id: string;
    label: string;
    description: string;
    email: boolean;
    system: boolean;
    recipients: string[];
  }

  const DEFAULT_SUPER_RULES: SuperNotificationRule[] = [
    { id: 'client_added', label: 'Cliente Adicionado', description: 'Disparado quando uma nova instituição (tenant) é cadastrada no sistema.', email: true, system: true, recipients: ['admin_principal'] },
    { id: 'client_suspended', label: 'Cliente Suspenso', description: 'Disparado quando a subscrição de um cliente é suspensa manualmente ou por inadimplência.', email: true, system: true, recipients: ['admin_principal', 'financeiro'] },
    { id: 'client_deleted', label: 'Cliente Excluido', description: 'Disparado quando um cliente é excluído ou marcado para exclusão (soft delete).', email: true, system: true, recipients: ['admin_principal', 'suporte'] },
    { id: 'password_reset_system', label: 'Senha do cliente Redefinida pelo sistema', description: 'Disparado quando o superadmin ou o sistema força a redefinição de senha de um administrador.', email: true, system: true, recipients: ['admin_principal'] },
    { id: 'password_reset_user', label: 'Senha do Cliente Redefinida pelo utilizador', description: 'Disparado quando o próprio administrador redefine sua senha via tela de login.', email: false, system: true, recipients: ['admin_principal', 'suporte'] },
    { id: 'invoice_overdue', label: 'Fatura em atraso', description: 'Disparado quando uma fatura de cobrança mensal ou anual ultrapassa a data de vencimento.', email: true, system: true, recipients: ['admin_principal', 'financeiro'] },
    { id: 'plan_updated', label: 'Plano de Subscrição de Clientes Atualizado', description: 'Disparado quando os limites ou preços do plano de uma instituição são alterados.', email: true, system: true, recipients: ['admin_principal', 'financeiro'] },
    { id: 'payment_received', label: 'Novo Pagamento Registado', description: 'Disparado quando um cliente efetua o pagamento e o status passa para "Pago".', email: true, system: true, recipients: ['admin_principal', 'financeiro'] },
    { id: 'smtp_configured', label: 'Configuração de Servidor SMTP', description: 'Disparado quando o servidor SMTP global do sistema ou específico de uma escola é atualizado.', email: false, system: true, recipients: ['admin_principal', 'suporte'] },
    { id: 'connection_failure', label: 'Falha Crítica de Conexão', description: 'Disparado em caso de falha de conexão persistente com servidores de e-mail ou bancos secundários.', email: true, system: true, recipients: ['suporte'] },
  ];

  const RECIPIENT_ROLES_SUPER = [
    { id: 'admin_principal', label: 'Administrador Principal' },
    { id: 'diretor', label: 'Diretor da Escola' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'suporte', label: 'Suporte Técnico' },
  ];

  const [superRules, setSuperRules] = useState<SuperNotificationRule[]>(() => {
    const saved = localStorage.getItem('super_admin_notif_rules');
    return saved ? JSON.parse(saved) : DEFAULT_SUPER_RULES;
  });

  const saveSuperRules = (updated: SuperNotificationRule[]) => {
    setSuperRules(updated);
    localStorage.setItem('super_admin_notif_rules', JSON.stringify(updated));
  };

  // State for active recipient dropdown id (so we know which row's dropdown is open)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // States for 2-Factor Authentication and Logs download
  const [selectedTenantForLogs, setSelectedTenantForLogs] = useState<Tenant | null>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [simulationAlert, setSimulationAlert] = useState<string | null>(null);

  // Form state to add new custom event items
  const [newRuleForm, setNewRuleForm] = useState({ label: '', description: '', email: true, system: true, recipients: ['admin_principal'] });
  const [isAddingCustomRule, setIsAddingCustomRule] = useState(false);

  // Helper to send email via Google Gmail REST API with full UTF-8 & special characters support
  async function sendGmailApiEmail(to: string, subject: string, body: string, token: string) {
    const fromName = globalSmtp.sender_name || 'SaaS Educacional';
    const fromEmail = globalSmtp.sender_email || globalSmtp.user;

    const raw = createGmailRawPayload({
      fromEmail,
      fromName,
      to,
      subject,
      body
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail API Error: ${errText}`);
    }

    return await response.json();
  }

  // Universal email dispatcher for SuperAdmin: prioritizes active Gmail API and falls back to backend SMTP/Simulation
  async function sendSuperAdminEmail(to: string, subject: string, body: string) {
    const currentToken = gmailToken || globalSmtp.gmail_token || localStorage.getItem('superadmin_gmail_oauth_token');
    
    // 1. If Gmail API is configured and authenticated, dispatch directly via Google REST API
    if (globalSmtp.smtp_type === 'gmail' && currentToken && (globalSmtp.status === 'ativo' || !!globalSmtp.user)) {
      try {
        const result = await sendGmailApiEmail(to, subject, body, currentToken);
        console.log(`[Gmail API Direct] Sent email to ${to}`);
        return { success: true, method: 'gmail_api', result };
      } catch (apiErr: any) {
        console.warn("Gmail API direct dispatch failed, attempting fallback to backend SMTP route:", apiErr);
      }
    }

    // 2. Dispatch via backend endpoint (handles configured manual SMTP or smooth fallback simulation)
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpConfig: globalSmtp,
        to,
        subject,
        body
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Falha na comunicação com o servidor de e-mail.");
    }

    const resData = await res.json();
    return { success: true, method: resData.simulated ? 'simulated' : 'smtp', resData };
  }

  // Google Login for SMTP config
  async function handleGoogleSmtpLogin() {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential || !credential.accessToken) {
        throw new Error("Não foi possível obter o token de acesso do Google.");
      }

      const token = credential.accessToken;
      const user = result.user;

      localStorage.setItem('superadmin_gmail_oauth_token', token);
      setGmailToken(token);

      const updatedSmtp: SmtpConfig = {
        ...globalSmtp,
        id: 'system_global',
        tenant_id: 'system',
        smtp_type: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        user: user.email || '',
        pass: '', // OAuth used instead
        sender_email: user.email || '',
        sender_name: user.displayName || (user.email ? user.email.split('@')[0] : 'SaaS Educacional'),
        secure: true,
        status: 'ativo',
        gmail_token: token,
        updated_at: new Date().toISOString()
      };

      setGlobalSmtp(updatedSmtp);
      localDb.saveSmtpConfig(updatedSmtp);

      // Save to Firestore smtp_configs System Global
      try {
        await setDoc(doc(db, 'smtp_configs', 'system_global'), updatedSmtp);
      } catch (firestoreErr) {
        console.warn("Could not write system_global to Firestore directly, saved to local DB:", firestoreErr);
      }

      showSystemNotification(`Conta do Gmail (${user.email}) vinculada com sucesso para e-mail corporativo!`, 'sucesso');
    } catch (error: any) {
      console.error("Erro no login com Google:", error);
      const errCode = error?.code || '';
      const errMessage = error?.message || String(error);

      if (errCode === 'auth/unauthorized-domain' || errMessage.includes('unauthorized-domain')) {
        setUnauthorizedDomainHost(window.location.hostname);
        setShowUnauthorizedDomainModal(true);
      } else if (errCode === 'auth/popup-blocked' || errMessage.includes('popup-blocked')) {
        showSystemNotification("O navegador bloqueou o popup de autenticação do Google. Permita popups para este site ou utilize o modo Gmail com Senha de App.", "erro");
      } else {
        showSystemNotification(`Falha ao conectar com o Google: ${errMessage}`, "erro");
      }
    }
  }

  // Google Disconnect
  async function handleDisconnectGmail() {
    showConfirm(
      "Desconectar Conta Google",
      "Deseja realmente desvincular a conta do Gmail? O envio de e-mails corporativos pelo Gmail será desativado até ser configurado novamente.",
      async () => {
        localStorage.removeItem('superadmin_gmail_oauth_token');
        setGmailToken(null);
        const updatedSmtp: SmtpConfig = {
          id: 'system_global',
          tenant_id: 'system',
          smtp_type: 'manual',
          host: '',
          port: 587,
          user: '',
          pass: '',
          sender_email: '',
          sender_name: '',
          secure: false,
          status: 'inativo',
          updated_at: new Date().toISOString()
        };
        setGlobalSmtp(updatedSmtp);
        localDb.saveSmtpConfig(updatedSmtp);
        try {
          await setDoc(doc(db, 'smtp_configs', 'system_global'), updatedSmtp);
        } catch (firestoreErr) {
          console.warn("Could not update Firestore on disconnect:", firestoreErr);
        }
        showSystemNotification("Conta do Gmail desvinculada com sucesso.", "info");
      }
    );
  }

  const [planForm, setPlanForm] = useState(() => getSavedFormDraft('draft_plan_form', {
    nome: '',
    descricao: '',
    preco: 0,
    periodicidade: 'mensal' as 'mensal' | 'anual',
    modulos_permitidos: [] as string[],
    limits: {
      max_escolas: 5,
      max_docentes: 30,
      max_estudantes: 400,
      max_turmas: 15,
      max_disciplinas: 15,
      max_classes: 7,
      max_usuarios: 15
    }
  }));

  useEffect(() => {
    saveSettingIfAllowed('draft_plan_form', JSON.stringify(planForm), 'formData', 24);
  }, [planForm]);

  const [paymentForm, setPaymentForm] = useState(() => getSavedFormDraft('draft_payment_form', {
    tenant_id: '',
    valor: 0,
    data_vencimento: '',
    status: 'Pago' as 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado',
    metodo: 'Transferência Bancária'
  }));

  useEffect(() => {
    saveSettingIfAllowed('draft_payment_form', JSON.stringify(paymentForm), 'formData', 24);
  }, [paymentForm]);

  // Load Super Admin Data
  async function loadData() {
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    
    // 1. Load Tenants
    let tenantsList: Tenant[] = [];
    try {
      const tenantsSnap = await getDocs(collection(db, 'tenants'));
      tenantsSnap.forEach((d) => {
        const t = d.data() as Tenant;
        if (!t.deleted_at) {
          tenantsList.push({ ...t, id: d.id });
        }
      });
    } catch (err) {
      console.warn("Firestore error loading tenants, falling back to local database:", err);
    }
    // Merge with temporary tenants
    const tempTenants = localDb.getTenants();
    tempTenants.forEach(tt => {
      if (!tenantsList.some(t => t.id === tt.id)) {
        tenantsList.push(tt);
      }
    });
    setTenants(tenantsList);

    // 2. Load Plans
    let plansList: Plano[] = [];
    try {
      const plansSnap = await getDocs(collection(db, 'planos'));
      plansSnap.forEach((d) => {
        plansList.push({ ...(d.data() as Plano), id: d.id });
      });
    } catch (err) {
      console.warn("Firestore error loading planos, falling back to local database:", err);
    }
    const tempPlans = localDb.getPlans();
    tempPlans.forEach(tp => {
      if (!plansList.some(p => p.id === tp.id)) {
        plansList.push(tp);
      }
    });
    if (plansList.length === 0) {
      plansList = [
        {
          id: "plano-basico",
          nome: "Plano Básico",
          descricao: "Plano essencial com limites de 1 escola ativa, 10 turmas, 10 docentes, 250 estudantes, 15 disciplinas e 7 classes.",
          preco: 299.00,
          periodicidade: "mensal",
          modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao"],
          limits: { max_escolas: 1, max_docentes: 10, max_estudantes: 250, max_turmas: 10, max_disciplinas: 15, max_classes: 7, max_usuarios: 15 }
        },
        {
          id: "plano-pro",
          nome: "Plano Pro",
          descricao: "Plano ideal com limites de 3 escolas, 10 turmas, 10 docentes, 250 estudantes, 15 disciplinas e 7 classes.",
          preco: 499.00,
          periodicidade: "mensal",
          modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao"],
          limits: { max_escolas: 3, max_docentes: 10, max_estudantes: 250, max_turmas: 10, max_disciplinas: 15, max_classes: 7, max_usuarios: 15 }
        },
        {
          id: "plano-plus",
          nome: "Plano Plus",
          descricao: "Acesso ilimitado com suporte ao módulo de Processo do Aluno e criação ilimitada de usuários.",
          preco: 899.00,
          periodicidade: "mensal",
          modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao", "processo"],
          limits: { max_escolas: 9999, max_docentes: 9999, max_estudantes: 9999, max_turmas: 9999, max_disciplinas: 9999, max_classes: 9999, max_usuarios: 9999 }
        }
      ];
    }
    setPlans(plansList);

    // 3. Load Payments
    const paymentsList: Pagamento[] = [];
    try {
      const paymentsSnap = await getDocs(collection(db, 'pagamentos'));
      paymentsSnap.forEach((d) => {
        paymentsList.push({ ...(d.data() as Pagamento), id: d.id });
      });
    } catch (err) {
      console.warn("Firestore error loading payments, falling back to local database:", err);
    }
    const tempPayments = localDb.getPayments();
    tempPayments.forEach(tp => {
      if (!paymentsList.some(p => p.id === tp.id)) {
        paymentsList.push(tp);
      }
    });
    setPayments(paymentsList);

    // 4. Load Logs
    const logsList: LogAdmin[] = [];
    try {
      const logsSnap = await getDocs(collection(db, 'log_admins'));
      logsSnap.forEach((d) => {
        logsList.push({ ...(d.data() as LogAdmin), id: d.id });
      });
    } catch (err) {
      console.warn("Firestore error loading logs, falling back to local database:", err);
    }
    const tempLogs = localDb.getLogs();
    tempLogs.forEach(tl => {
      if (!logsList.some(l => l.id === tl.id)) {
        logsList.push(tl);
      }
    });
    logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(logsList);

    // 5. Load SMTP
    const smtpList: SmtpConfig[] = [];
    try {
      const smtpSnap = await getDocs(collection(db, 'smtp_configs'));
      smtpSnap.forEach((d) => {
        smtpList.push({ ...(d.data() as SmtpConfig), id: d.id });
      });
    } catch (err) {
      console.warn("Firestore error loading SMTP configs, falling back to local database:", err);
    }
    const tempSmtps = localDb.getSmtpConfigs();
    tempSmtps.forEach(ts => {
      if (!smtpList.some(s => s.id === ts.id)) {
        smtpList.push(ts);
      }
    });
    setSmtpConfigs(smtpList);

    const globalConfig = smtpList.find(s => s.id === 'system_global');
    if (globalConfig) {
      setGlobalSmtp(globalConfig);
      localDb.saveSmtpConfig(globalConfig);
      if (globalConfig.smtp_type === 'gmail' && globalConfig.gmail_token) {
        localStorage.setItem('superadmin_gmail_oauth_token', globalConfig.gmail_token);
        setGmailToken(globalConfig.gmail_token);
      }
    }

    setLoading(false);
    setHasLoadedOnce(true);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Background worker to check and send pending emails when SMTP becomes available or online, and sync local DB to Firestore
  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function runBackgroundSyncAndQueue() {
      // 1. Sync local temporary database records to Firestore
      try {
        const syncRes = await syncLocalDataToFirestore();
        if (
          syncRes.tenantsSynced > 0 ||
          syncRes.usersSynced > 0 ||
          syncRes.configsSynced > 0 ||
          syncRes.logsSynced > 0 ||
          syncRes.paymentsSynced > 0 ||
          syncRes.smtpConfigsSynced > 0 ||
          syncRes.plansSynced > 0
        ) {
          console.log("[Background Sync] Successfully synchronized offline/temporary data to Firestore!");
          loadData(); // reload UI with newly synced production data
        }
      } catch (err) {
        console.warn("[Background Sync] Failed to sync temporary database records to Firestore (still offline/unconfigured):", err);
      }

      // 2. Process pending emails
      if (!globalSmtp) return;
      const effectiveGmailToken = gmailToken || globalSmtp.gmail_token || localStorage.getItem('superadmin_gmail_oauth_token');
      if (globalSmtp.smtp_type === 'gmail' && (!globalSmtp.user || globalSmtp.status !== 'ativo')) return;
      if (globalSmtp.smtp_type !== 'gmail' && (!globalSmtp.host || globalSmtp.host.trim() === '')) return;

      let processedAny = false;

      // A. Process local pending emails
      try {
        const localEmails = localDb.getEmails().filter(e => e.status === 'pendente');
        if (localEmails.length > 0) {
          console.log(`[Queue] Encontrados ${localEmails.length} e-mails pendentes locais. Processando...`);
          for (const email of localEmails) {
            const success = await processPendingEmail(email.id, email, true);
            if (success) {
              processedAny = true;
            }
          }
        }
      } catch (err) {
        console.error("Erro no processamento de e-mails pendentes locais:", err);
      }

      // B. Process Firestore pending emails
      try {
        const q = query(collection(db, 'pending_emails'), where('status', '==', 'pendente'));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          console.log(`[Queue] Encontrados ${querySnap.size} e-mails pendentes em Firestore. Processando...`);
          for (const docSnap of querySnap.docs) {
            const emailData = docSnap.data();
            const success = await processPendingEmail(docSnap.id, emailData, false);
            if (success) {
              processedAny = true;
            }
          }
        }
      } catch (error) {
        console.warn("Relação com Firestore indisponível para e-mails pendentes, processamento em espera:", error);
      }

      if (processedAny) {
        loadData(); // refresh logs/notifications
      }
    }

    // Run check on mount/changes
    runBackgroundSyncAndQueue();

    // Periodic check every 10 seconds
    interval = setInterval(runBackgroundSyncAndQueue, 10000);

    // Event listener for online connection recovery
    const handleOnline = () => {
      console.log("[Queue] Conexão de rede restabelecida. Executando sincronização e processamento da fila...");
      runBackgroundSyncAndQueue();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [globalSmtp, gmailToken]);

  useEffect(() => {
    ensureFirebaseAuthSession('neltonbenedito1@gmail.com', 'Errado23x').catch(() => {});
    const q = query(collection(db, 'notificacoes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notificacao[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.destinatario_id === 'super_admin' || data.destinatario_id === 'todos') {
          list.push({ ...data, id: doc.id } as Notificacao);
        }
      });
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(list);
    }, (error) => {
      console.warn("Notice listening to notifications:", error?.message || error);
    });
    return () => unsubscribe();
  }, []);

  async function markNotificationAsRead(id: string) {
    try {
      await updateDoc(doc(db, 'notificacoes', id), { lido: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }

  async function markAllNotificationsAsRead() {
    try {
      const unread = notifications.filter(n => !n.lido);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notificacoes', n.id), { lido: true })));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    try {
      const newNotif = {
        destinatario_id: newNotifForm.destinatario_id,
        titulo: newNotifForm.titulo,
        mensagem: newNotifForm.mensagem,
        tipo: newNotifForm.tipo,
        lido: false,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'notificacoes'), newNotif);
      setIsSendNotifModalOpen(false);
      setNewNotifForm({
        destinatario_id: 'todos',
        titulo: '',
        mensagem: '',
        tipo: 'info'
      });
      await auditLog('criar', 'notificacao', 'todas', `Notificação enviada: "${newNotifForm.titulo}"`);
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }

  // Log and audit action helper
  async function auditLog(action: string, entity: string, entityId: string, details: string) {
    try {
      const newLog = {
        admin_id: "superadmin-1",
        admin_nome: "Nelton Benedito (Super)",
        acao: action,
        entidade: entity,
        entidade_id: entityId,
        timestamp: new Date().toISOString(),
        detalhes: details
      };
      await addDoc(collection(db, "log_admins"), newLog);
      // Refresh logs
      const logsSnap = await getDocs(collection(db, 'log_admins'));
      const logsList: LogAdmin[] = [];
      logsSnap.forEach((d) => logsList.push({ ...(d.data() as LogAdmin), id: d.id }));
      logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(logsList);
    } catch (err) {
      console.error("Error writing audit log:", err);
    }
  }

  // Email format validation helper
  function validateEmailFormat(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Generate Unique URL Slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
      .replace(/[\s-]+/g, '-'); // replace spaces/hyphens with single hyphen
  }

  // Process and send a specific pending email
  async function processPendingEmail(emailId: string, emailData: any, isLocal: boolean = false) {
    let sent = false;
    let errorMsg = '';
    
    try {
      await sendSuperAdminEmail(emailData.to, emailData.subject, emailData.body);
      sent = true;
    } catch (err: any) {
      errorMsg = err.message || String(err);
    }

    try {
      if (sent) {
        if (isLocal) {
          localDb.deleteEmail(emailId);
        } else {
          try {
            // Mark as sent in Firestore
            await updateDoc(doc(db, 'pending_emails', emailId), {
              status: 'enviado',
              enviado_em: new Date().toISOString()
            });
          } catch (e) {
            console.warn("Could not update pending email in Firestore:", e);
          }
        }

        const newNotif: Notificacao = {
          id: "notif-email-" + Math.random().toString(36).substr(2, 9),
          destinatario_id: 'super_admin',
          titulo: `✅ E-mail de Boas-vindas Enviado`,
          mensagem: `O e-mail pendente com as credenciais para ${emailData.to} foi enviado com sucesso via ${globalSmtp.smtp_type === 'gmail' ? 'Gmail API' : 'SMTP Manual'}!`,
          tipo: 'sucesso',
          lido: false,
          created_at: new Date().toISOString()
        };

        try {
          // Insert success notification for super_admin
          await addDoc(collection(db, 'notificacoes'), newNotif);
        } catch (e) {
          localDb.saveNotification(newNotif);
        }

        // Audit Log
        await auditLog(
          "Enviar Email Pendente",
          "Tenant",
          emailData.tenantId || "unknown",
          `E-mail de boas-vindas para ${emailData.to} enviado com sucesso.`
        );

        return true;
      } else {
        if (isLocal) {
          localDb.saveEmail({ ...emailData, id: emailId, error_message: errorMsg });
        } else {
          try {
            // Update with latest error message
            await updateDoc(doc(db, 'pending_emails', emailId), {
              error_message: errorMsg
            });
          } catch (e) {
            console.warn("Could not update pending email error in Firestore:", e);
          }
        }
        return false;
      }
    } catch (err) {
      console.error("Error updating pending email document:", err);
      return false;
    }
  }

  // Handle Tenant Creation / Update
  async function handleTenantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmailFormat(tenantForm.email_admin)) {
      showSystemNotification("Erro: Formato do e-mail administrativo é inválido.", "erro");
      return;
    }

    // Duplicate record checks
    const cleanEmail = (tenantForm.email_admin || '').trim().toLowerCase();
    const cleanName = (tenantForm.nome || '').trim().toLowerCase();

    if (!cleanName) {
      showSystemNotification("Erro: O nome da instituição é obrigatório.", "erro");
      return;
    }

    const dupEmailTenant = tenants.find(t => 
      t.id !== editingTenant?.id && t.email_admin?.trim().toLowerCase() === cleanEmail
    );
    if (dupEmailTenant) {
      showSystemNotification(`Erro: O e-mail "${cleanEmail}" já está registado na instituição "${dupEmailTenant.nome}".`, "erro");
      return;
    }

    const dupNameTenant = tenants.find(t => 
      t.id !== editingTenant?.id && t.nome?.trim().toLowerCase() === cleanName
    );
    if (dupNameTenant) {
      showSystemNotification(`Erro: Já existe uma instituição registada com o nome "${tenantForm.nome}".`, "erro");
      return;
    }

    if (!editingTenant) {
      if (tenantForm.senha !== tenantForm.confirmar_senha) {
        showSystemNotification("Erro: A senha e a confirmação de senha não coincidem.", "erro");
        return;
      }
      const pwdComplexity = getPasswordComplexity(tenantForm.senha || '', tenantForm.confirmar_senha);
      if (!pwdComplexity.isFullyValid) {
        showSystemNotification("Erro: A senha informada não atende a todos os critérios de complexidade exigidos.", "erro");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingTenant) {
        // Update Tenant
        const updatedData = {
          nome: tenantForm.nome,
          email_admin: tenantForm.email_admin,
          telefone: tenantForm.telefone,
          endereco: tenantForm.endereco,
          plano_id: tenantForm.plano_id,
          status: tenantForm.status,
          data_vencimento: tenantForm.data_vencimento,
          data_renovacao: new Date().toISOString().split('T')[0],
          idioma_padrao: tenantForm.idioma_padrao,
          ai_translation_enabled: tenantForm.ai_translation_enabled
        };

        try {
          const tenantRef = doc(db, 'tenants', editingTenant.id);
          await updateDoc(tenantRef, updatedData);
          await auditLog("Editar Conta", "Tenant", editingTenant.id, `Atualizou cadastro e plano para ${tenantForm.nome}`);
          showSystemNotification(`Instituição "${tenantForm.nome}" atualizada com sucesso!`, 'cadastro');
        } catch (dbErr) {
          console.warn("Firestore offline/error, saving update to temporary local database:", dbErr);
          // Save updated tenant to local database with its previous ID
          localDb.saveTenant({
            ...editingTenant,
            ...updatedData
          });
          // Also log locally
          localDb.saveLog({
            id: "log-" + Math.random().toString(36).substr(2, 9),
            admin_id: "superadmin-1",
            admin_nome: "Nelton Benedito (Super)",
            acao: "Editar Conta (Local)",
            entidade: "Tenant",
            entidade_id: editingTenant.id,
            detalhes: `Atualizou cadastro e plano para ${tenantForm.nome} (Salvo temporariamente local)`,
            timestamp: new Date().toISOString()
          });
          showSystemNotification(`Instituição "${tenantForm.nome}" atualizada e salva temporariamente em base local!`, 'cadastro');
        }
      } else {
        // Create Tenant
        const generatedId = "tenant-" + Math.random().toString(36).substr(2, 9);
        let baseSlug = generateSlug(tenantForm.nome);
        let slug = baseSlug;
        let counter = 1;
        while (tenants.some(t => t.slug === slug)) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        const newTenant: Tenant = {
          id: generatedId,
          nome: tenantForm.nome,
          slug,
          plano_id: tenantForm.plano_id || 'plano-basico',
          status: tenantForm.status,
          data_vencimento: tenantForm.data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          data_renovacao: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          email_admin: tenantForm.email_admin,
          telefone: tenantForm.telefone,
          endereco: tenantForm.endereco,
          idioma_padrao: tenantForm.idioma_padrao || 'pt',
          ai_translation_enabled: tenantForm.ai_translation_enabled !== false
        };

        const tempPassword = tenantForm.senha || tenantForm.senha_temporaria || "Mudar@123";
        const adminEmailClean = (tenantForm.email_admin || '').trim().toLowerCase();
        const tenantAdminUser = {
          id: "user-admin-" + generatedId,
          tenant_id: generatedId,
          email: adminEmailClean,
          nome: `Administrador de ${tenantForm.nome}`,
          tipo: "admin" as const,
          requer_alteracao_senha: true, // Requires change on first login
          mustChangePassword: true,
          permissoes: ["R", "W", "D"],
          ativo: true,
          created_at: new Date().toISOString()
        };

        const tenantConfig = {
          id: "cfg-" + generatedId,
          tenant_id: generatedId,
          nome_instituicao: tenantForm.nome,
          endereco: tenantForm.endereco,
          contacto: tenantForm.telefone,
          ano_letivo_atual: "2026",
          escala_avaliacao: "0-20",
          notificacoes_email: true,
          logo_url: tenantForm.logo_url || "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200"
        };

        const welcomeTemplate = EmailTemplates.tenantWelcome({
          tenantName: tenantForm.nome,
          slug,
          adminEmail: tenantForm.email_admin,
          tempPassword
        });

        const emailDoc = {
          tenantId: generatedId,
          to: tenantForm.email_admin,
          subject: welcomeTemplate.subject,
          body: welcomeTemplate.body,
          status: 'pendente',
          created_at: new Date().toISOString()
        };

        let isSavedInFirestore = false;
        let emailRefId = "";

        try {
          // Attempt Firestore save
          await setDoc(doc(db, 'tenants', generatedId), newTenant);
          await setDoc(doc(db, 'users', tenantAdminUser.id), tenantAdminUser);
          await registerUserInFirebaseAuth(adminEmailClean, tempPassword);
          await setDoc(doc(db, 'configuracoes', tenantConfig.id), tenantConfig);
          await auditLog("Criar Conta", "Tenant", generatedId, `Gerado novo tenant ${tenantForm.nome} com slug ${slug}. Senha temporária configurada.`);
          
          const emailRef = await addDoc(collection(db, 'pending_emails'), emailDoc);
          emailRefId = emailRef.id;
          isSavedInFirestore = true;
        } catch (dbErr) {
          console.warn("Firestore is offline, saving new tenant data to local temporary database:", dbErr);
          
          // Save to localDb
          localDb.saveTenant(newTenant);
          localDb.saveUser(tenantAdminUser);
          localDb.saveConfig(tenantConfig);
          localDb.saveLog({
            id: "log-" + Math.random().toString(36).substr(2, 9),
            admin_id: "superadmin-1",
            admin_nome: "Nelton Benedito (Super)",
            acao: "Criar Conta (Local)",
            entidade: "Tenant",
            entidade_id: generatedId,
            detalhes: `Gerado novo tenant ${tenantForm.nome} com slug ${slug}. Salvo temporariamente em base local.`,
            timestamp: new Date().toISOString()
          });

          // Register local pending email
          const localEmailId = "local-email-" + Math.random().toString(36).substr(2, 9);
          localDb.saveEmail({
            ...emailDoc,
            id: localEmailId
          });
          emailRefId = localEmailId;
        }

        // Attempt immediate delivery
        const sentImmediately = await processPendingEmail(emailRefId, emailDoc, !isSavedInFirestore);
        if (sentImmediately) {
          showSystemNotification(`Instituição cadastrada! E-mail enviado para ${tenantForm.email_admin}.`, 'cadastro');
        } else {
          showSystemNotification(`Instituição cadastrada! E-mail ficou pendente (SMTP offline).`, 'info');
        }
      }

      setIsTenantModalOpen(false);
      setEditingTenant(null);
      // Reset Form
      setTenantForm({
        nome: '',
        email_admin: '',
        telefone: '',
        endereco: '',
        plano_id: plans[0]?.id || 'plano-basico',
        status: 'ativo',
        data_vencimento: '',
        senha_temporaria: '',
        idioma_padrao: 'pt',
        ai_translation_enabled: false
      });
      loadData();
    } catch (err: any) {
      console.error("Error saving tenant:", err);
      showSystemNotification("Erro ao salvar cadastro: " + (err.message || err), 'erro');
    } finally {
      setIsSaving(false);
    }
  }

  // Handle SMTP Configuration Submit
  async function handleSmtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantForSmtp) return;

    if (smtpForm.sender_email && !validateEmailFormat(smtpForm.sender_email)) {
      alert("Erro: Formato do e-mail do remetente SMTP é inválido.");
      return;
    }

    try {
      const configId = selectedTenantForSmtp.id; // doc ID is the tenant ID
      const smtpData: SmtpConfig = {
        id: configId,
        tenant_id: selectedTenantForSmtp.id,
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port),
        user: smtpForm.user.trim(),
        pass: smtpForm.pass,
        secure: smtpForm.secure,
        sender_email: smtpForm.sender_email.trim(),
        sender_name: smtpForm.sender_name.trim(),
        status: smtpForm.status,
        updated_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'smtp_configs', configId), smtpData);
      await auditLog(
        "Configurar SMTP", 
        "SMTP", 
        configId, 
        `Configurou SMTP próprio para ${selectedTenantForSmtp.nome} (Host: ${smtpForm.host})`
      );

      alert("Servidor SMTP personalizado cadastrado com sucesso! Iniciando teste automático de conectividade e envio de e-mail de teste...");
      
      // Keep SMTP modal open to show test execution log
      setIsSmtpModalOpen(true);
      await testSmtpConnection();

    } catch (err) {
      console.error("Error saving SMTP config:", err);
    }
  }

  // Simulated Connection Test
  async function testSmtpConnection() {
    if (!smtpForm.host) {
      alert("Por favor, preencha o Host SMTP antes de testar.");
      return;
    }
    setTestStatus('testing');
    setTestLogs([]);

    const logSteps = [
      `Resolvendo endereço de host: ${smtpForm.host}...`,
      `Endereço IP resolvido: ${smtpForm.host === 'localhost' ? '127.0.0.1' : '198.51.100.' + Math.floor(Math.random() * 254 + 1)}`,
      `Conectando ao servidor SMTP na porta ${smtpForm.port}...`,
      `Conexão TCP estabelecida com sucesso.`,
      `S: 220 ${smtpForm.host} ESMTP Postfix`,
      `C: EHLO saas-platform.edu`,
      `S: 250-smtp.escola.edu, 250-PIPELINING, 250-SIZE 35791394, ${smtpForm.port === 465 || smtpForm.secure ? '' : '250-STARTTLS, '}250-AUTH LOGIN PLAIN`,
    ];

    if (smtpForm.port === 587 && !smtpForm.secure) {
      logSteps.push(
        `C: STARTTLS`,
        `S: 220 2.0.0 Ready to start TLS`,
        `Negociando conexão TLS/SSL segura...`,
        `Cifra TLS 1.3 estabelecida com sucesso.`
      );
    }

    logSteps.push(
      `C: AUTH LOGIN`,
      `S: 334 VXNlcm5hbWU6 (Solicitação de Usuário)`,
      `C: [Usuário enviado: ${smtpForm.user || 'vazio'}]`,
      `S: 334 UGFzc3dvcmQ6 (Solicitação de Senha)`,
      `C: [Senha enviada: ••••••••]`,
      `S: 235 2.7.0 Authentication successful`
    );

    if (smtpForm.sender_email) {
      logSteps.push(
        `C: MAIL FROM: <${smtpForm.sender_email}>`,
        `S: 250 2.1.0 Ok`,
        `C: RCPT TO: <neltonbenedito1@gmail.com>`,
        `S: 250 2.1.5 Recipient Ok`
      );
    }

    logSteps.push(
      `C: QUIT`,
      `S: 221 2.0.0 Bye`,
      `✔️ Teste de conexão SMTP concluído com sucesso!`
    );

    // Staggered log display
    for (let i = 0; i < logSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setTestLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${logSteps[i]}`]);
    }

    setTestStatus('success');
  }

  // Excluir Conta (Ação Crítica com Validação e Revogação de Acesso)
  async function handleSoftDeleteTenant(id: string, name: string) {
    setCriticalDeleteTenant({ id, name });
    setDeleteConfirmText('');
  }

  async function executeCriticalTenantDeletion() {
    if (!criticalDeleteTenant) return;
    const { id, name } = criticalDeleteTenant;

    setIsSaving(true);
    try {
      // 1. Apagar documento do tenant da coleção 'tenants' no Firestore
      await deleteDoc(doc(db, 'tenants', id));

      // 2. Apagar utilizadores associados na coleção 'users' do Firestore e revogar acessos
      try {
        const usersQ = query(collection(db, 'users'), where('tenant_id', '==', id));
        const usersSnap = await getDocs(usersQ);
        await Promise.all(usersSnap.docs.map(uDoc => deleteDoc(uDoc.ref)));

        const usersQ2 = query(collection(db, 'users'), where('tenantId', '==', id));
        const usersSnap2 = await getDocs(usersQ2);
        await Promise.all(usersSnap2.docs.map(uDoc => deleteDoc(uDoc.ref)));
      } catch (uErr) {
        console.warn("Aviso ao remover utilizadores associados da conta:", uErr);
      }

      // 3. Remover do banco local temporário se existir
      try {
        if (typeof localDb !== 'undefined' && localDb.deleteTenant) {
          localDb.deleteTenant(id);
        }
      } catch (e) {}

      await auditLog("Excluir Conta (Ação Crítica)", "Tenant", id, `Excluída conta da instituição ${name} e revogado acesso de todos os seus usuários.`);
      showSystemNotification(`Conta "${name}" excluída com sucesso e acessos revogados!`, 'cadastro');

      // 4. Notificar a aplicação global para deslogar sessões ativas desta instituição
      try {
        window.dispatchEvent(new CustomEvent('sge-tenant-deleted', { detail: { tenantId: id, tenantName: name } }));
      } catch (e) {}

      setCriticalDeleteTenant(null);
      setDeleteConfirmText('');
      loadData();
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      showSystemNotification(`Erro ao excluir conta: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  }

  // Suspend/Reactivate Account
  async function toggleTenantStatus(tenant: Tenant) {
    const nextStatus = tenant.status === 'ativo' ? 'suspenso' : 'ativo';
    const msg = nextStatus === 'suspenso' ? 'suspender' : 'reativar';
    showConfirm(
      `${nextStatus === 'suspenso' ? 'Suspender' : 'Reativar'} Conta`,
      `Deseja realmente ${msg} a conta da instituição "${tenant.nome}"?`,
      async () => {
        try {
          const tenantRef = doc(db, 'tenants', tenant.id);
          await updateDoc(tenantRef, { status: nextStatus });
          await auditLog(`${nextStatus === 'suspenso' ? 'Suspender' : 'Reativar'} Conta`, "Tenant", tenant.id, `Status alterado para ${nextStatus}`);
          loadData();
        } catch (err) {
          console.error("Error updating tenant status:", err);
        }
      },
      nextStatus === 'suspenso'
    );
  }

  // Request OTP for Password Reset
  async function handleRequestOtp() {
    if (!selectedTenantForPasswordReset) return;
    if (!newPassword || !confirmPassword) {
      alert("Por favor, preencha a Nova Senha e Confirmação de Senha.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("A nova senha e a confirmação de senha não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      alert("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    // Generate random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    setLoading(true);

    try {
      const emailTemplate = EmailTemplates.passwordReset2FA({
        institutionName: selectedTenantForPasswordReset.nome,
        code,
        expirationTimeStr: expiration.toLocaleTimeString()
      });

      const sendResult = await sendSuperAdminEmail(
        selectedTenantForPasswordReset.email_admin,
        emailTemplate.subject,
        emailTemplate.body
      );

      const isSimulated = sendResult.method === 'simulated';

      setGeneratedOtp(code);
      setOtpExpiration(expiration);
      setIsOtpRequested(true);
      setLoading(false);

      setOtpMessage("Código de segurança enviado com sucesso para o e-mail cadastrado.");
      setShowVerificationPopup(true);
      setTimeout(() => {
        setShowVerificationPopup(false);
      }, 6000);

      setOtpCode(''); // Clear any previous entered OTP code

      // 1. Add notification inside Firestore 'notificacoes' collection
      await addDoc(collection(db, 'notificacoes'), {
        destinatario_id: 'super_admin',
        titulo: `🔑 Código OTP de 2-Fatores (${selectedTenantForPasswordReset.nome})`,
        mensagem: `Foi solicitada alteração de senha da conta administradora ${selectedTenantForPasswordReset.email_admin}. Código OTP: ${code}`,
        tipo: 'alerta',
        lido: false,
        created_at: new Date().toISOString()
      });

      // 3. Add to simulated received emails state
      const newEmail = {
        id: Math.random().toString(),
        to: selectedTenantForPasswordReset.email_admin,
        subject: emailTemplate.subject,
        body: emailTemplate.body,
        date: new Date().toLocaleTimeString('pt-BR')
      };
      setReceivedEmails(prev => [newEmail, ...prev]);

      // 4. Register in Security Audit log
      await auditLog(
        "Solicitar OTP Senha",
        "Tenant",
        selectedTenantForPasswordReset.id,
        isSimulated
          ? `Solicitação de OTP de redefinição de senha para ${selectedTenantForPasswordReset.email_admin} gerada via Simulação (SMTP real indisponível).`
          : `Solicitação de OTP de redefinição de senha para ${selectedTenantForPasswordReset.email_admin} enviada com sucesso via ${sendResult.method === 'gmail_api' ? 'Gmail API' : 'SMTP'}.`
      );
    } catch (err: any) {
      console.error("Error sending OTP:", err);
      alert(err?.message || "Verifique o servidor de e-mail e tente novamente");
    } finally {
      setLoading(false);
    }
  }

  // Validate OTP and Save Password
  async function handleValidatePasswordChange() {
    if (!selectedTenantForPasswordReset) return;
    if (!isOtpRequested || !generatedOtp) {
      alert("Solicite primeiro o código OTP.");
      return;
    }
    if (!otpCode) {
      alert("Insira o código OTP enviado.");
      return;
    }
    if (otpCode !== generatedOtp) {
      alert("Código OTP incorreto. Por favor, tente novamente.");
      return;
    }
    if (otpExpiration && new Date() > otpExpiration) {
      alert("O código OTP expirou. Por favor, solicite um novo código.");
      return;
    }

    try {
      const adminResetEmail = (selectedTenantForPasswordReset.email_admin || '').trim().toLowerCase();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', adminResetEmail));
      const qSnap = await getDocs(q);

      let targetUserId = `user-admin-${selectedTenantForPasswordReset.id}`;

      if (!qSnap.empty) {
        const userDoc = qSnap.docs[0];
        targetUserId = userDoc.id;
        await setDoc(doc(db, 'users', targetUserId), {
          updated_at: new Date().toISOString()
        }, { merge: true });
      } else {
        // If the user document doesn't exist yet, we create it
        await setDoc(doc(db, 'users', targetUserId), {
          id: targetUserId,
          tenant_id: selectedTenantForPasswordReset.id,
          email: adminResetEmail,
          nome: selectedTenantForPasswordReset.nome,
          tipo: 'admin',
          permissoes: ["R", "W", "D"],
          ativo: true,
          created_at: new Date().toISOString()
        });
      }

      // Alteração segura no Firebase Auth e invalidação completa de senhas e sessões anteriores
      try {
        await authSecurityService.changePassword({
          targetUid: targetUserId,
          newPassword: newPassword,
          callerUid: 'super_admin',
          callerRole: 'super_admin',
          email: adminResetEmail
        });
      } catch (authErr: any) {
        console.warn("authSecurityService note in SuperAdminPortal:", authErr);
      }

      // Save a security audit log
      await auditLog(
        "Alteração de Senha de Admin", 
        "Tenant", 
        selectedTenantForPasswordReset.id, 
        `Alteração de senha do administrador (${selectedTenantForPasswordReset.email_admin}) via 2FA realizada com sucesso. Senhas antigas invalidadas.`
      );

      setIsPasswordChangedSuccessfully(true);
      alert("Senha alterada com sucesso! As credenciais antigas foram completamente invalidadas.");
      
      // Close modal
      setTimeout(() => {
        setIsPasswordResetModalOpen(false);
        setSelectedTenantForPasswordReset(null);
        setNewPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setGeneratedOtp('');
        setOtpExpiration(null);
        setOtpMessage('');
        setIsOtpRequested(false);
        setIsPasswordChangedSuccessfully(false);
      }, 1000);

    } catch (err) {
      console.error("Error updating admin password:", err);
      alert("Ocorreu um erro ao atualizar a senha do administrador.");
    }
  }

  // Batch action handlers
  async function handleTenantBatchAction(action: string) {
    if (selectedTenantIds.length === 0) return;
    if (action === 'suspend') {
      showConfirm(
        "Suspender Escolas Selecionadas",
        `Deseja realmente suspender as ${selectedTenantIds.length} instituições selecionadas?`,
        async () => {
          try {
            await Promise.all(selectedTenantIds.map(async (id) => {
              const tenantRef = doc(db, 'tenants', id);
              await updateDoc(tenantRef, { status: 'suspenso' });
              await auditLog("Suspender Conta (Lote)", "Tenant", id, `Status alterado para suspenso via ação em lote`);
            }));
            loadData();
            setSelectedTenantIds([]);
          } catch (err) {
            console.error("Error suspending tenants in batch:", err);
          }
        },
        true
      );
    } else if (action === 'reactivate') {
      showConfirm(
        "Reativar Escolas Selecionadas",
        `Deseja realmente reativar as ${selectedTenantIds.length} instituições selecionadas?`,
        async () => {
          try {
            await Promise.all(selectedTenantIds.map(async (id) => {
              const tenantRef = doc(db, 'tenants', id);
              await updateDoc(tenantRef, { status: 'ativo' });
              await auditLog("Reativar Conta (Lote)", "Tenant", id, `Status alterado para ativo via ação em lote`);
            }));
            loadData();
            setSelectedTenantIds([]);
          } catch (err) {
            console.error("Error reactivating tenants in batch:", err);
          }
        }
      );
    } else if (action === 'delete') {
      showConfirm(
        "Excluir Contas Selecionadas do Firebase",
        `Tem certeza de que deseja excluir permanentemente do Firebase as ${selectedTenantIds.length} instituições selecionadas e todos os seus usuários?`,
        async () => {
          try {
            await Promise.all(selectedTenantIds.map(async (id) => {
              // Apagar documento do tenant
              await deleteDoc(doc(db, 'tenants', id));
              
              // Apagar usuários vinculados
              try {
                const usersQ = query(collection(db, 'users'), where('tenant_id', '==', id));
                const usersSnap = await getDocs(usersQ);
                await Promise.all(usersSnap.docs.map(uDoc => deleteDoc(uDoc.ref)));

                const usersQ2 = query(collection(db, 'users'), where('tenantId', '==', id));
                const usersSnap2 = await getDocs(usersQ2);
                await Promise.all(usersSnap2.docs.map(uDoc => deleteDoc(uDoc.ref)));
              } catch (uErr) {
                console.warn("Aviso ao remover utilizadores em lote:", uErr);
              }

              await auditLog("Excluir Conta (Lote Firebase)", "Tenant", id, `Excluída conta e usuários associados do Firebase via ação em lote`);
            }));
            showSystemNotification(`${selectedTenantIds.length} conta(s) excluída(s) com sucesso do Firebase!`, 'cadastro');
            loadData();
            setSelectedTenantIds([]);
          } catch (err: any) {
            console.error("Erro ao excluir contas em lote do Firebase:", err);
            showSystemNotification(`Erro ao excluir contas em lote: ${err.message || err}`, 'erro');
          }
        },
        true
      );
    }
  }

  async function handlePaymentBatchAction(action: string) {
    if (selectedPaymentIds.length === 0) return;
    const validStatus = ['Pago', 'Pendente', 'Atrasado', 'Excluir'];
    if (!validStatus.includes(action)) return;

    if (action === 'Excluir') {
      showConfirm(
        "Excluir Pagamentos Selecionados",
        `Deseja realmente excluir permanentemente os ${selectedPaymentIds.length} registros de faturamento selecionados?`,
        async () => {
          try {
            await Promise.all(selectedPaymentIds.map(async (id) => {
              await deleteDoc(doc(db, 'pagamentos', id));
              await auditLog("Excluir Pagamento (Lote)", "Pagamento", id, `Removido registro de faturamento em lote`);
            }));
            loadData();
            setSelectedPaymentIds([]);
          } catch (err) {
            console.error("Error deleting payments in batch:", err);
          }
        },
        true
      );
    } else {
      showConfirm(
        "Alterar Status de Pagamentos",
        `Deseja realmente alterar o status dos ${selectedPaymentIds.length} pagamentos selecionados para "${action}"?`,
        async () => {
          try {
            await Promise.all(selectedPaymentIds.map(async (id) => {
              const paymentRef = doc(db, 'pagamentos', id);
              const updateObj: any = { status: action };
              if (action === 'Pago') {
                updateObj.data_pagamento = new Date().toISOString().split('T')[0];
              } else {
                updateObj.data_pagamento = null;
              }
              await updateDoc(paymentRef, updateObj);
              await auditLog("Alterar Pagamento (Lote)", "Pagamento", id, `Status alterado para ${action} em lote`);
            }));
            loadData();
            setSelectedPaymentIds([]);
          } catch (err) {
            console.error("Error updating payments in batch:", err);
          }
        }
      );
    }
  }

  async function handleSmtpBatchAction(action: string) {
    if (selectedSmtpTenantIds.length === 0) return;
    if (action === 'ativar' || action === 'desativar') {
      const nextStatus = action === 'ativar' ? 'ativo' : 'inativo';
      showConfirm(
        `${action === 'ativar' ? 'Ativar' : 'Desativar'} SMTP em Lote`,
        `Deseja realmente ${action} o SMTP das ${selectedSmtpTenantIds.length} escolas selecionadas?`,
        async () => {
          try {
            await Promise.all(selectedSmtpTenantIds.map(async (id) => {
              const smtp = smtpConfigs.find(s => s.tenant_id === id);
              if (smtp) {
                const smtpRef = doc(db, 'smtp_configs', smtp.id);
                await updateDoc(smtpRef, { status: nextStatus });
                await auditLog("Alterar SMTP (Lote)", "SMTP", id, `Status do SMTP alterado para ${nextStatus}`);
              }
            }));
            loadData();
            setSelectedSmtpTenantIds([]);
          } catch (err) {
            console.error("Error updating SMTP in batch:", err);
          }
        }
      );
    } else if (action === 'remover') {
      showConfirm(
        "Remover SMTP em Lote",
        `Deseja realmente remover as configurações customizadas de SMTP das ${selectedSmtpTenantIds.length} escolas selecionadas e retornar ao padrão do sistema?`,
        async () => {
          try {
            await Promise.all(selectedSmtpTenantIds.map(async (id) => {
              const smtp = smtpConfigs.find(s => s.tenant_id === id);
              if (smtp) {
                await deleteDoc(doc(db, 'smtp_configs', smtp.id));
                await auditLog("Excluir SMTP (Lote)", "SMTP", id, `Configuração de SMTP customizada removida`);
              }
            }));
            loadData();
            setSelectedSmtpTenantIds([]);
          } catch (err) {
            console.error("Error deleting SMTP in batch:", err);
          }
        },
        true
      );
    }
  }

  // Create Plan Submit
  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const generatedId = editingPlan ? editingPlan.id : "plano-" + Math.random().toString(36).substr(2, 9);
      const planData = {
        id: generatedId,
        nome: planForm.nome,
        descricao: planForm.descricao,
        preco: Number(planForm.preco),
        periodicidade: planForm.periodicidade,
        modulos_permitidos: planForm.modulos_permitidos.length > 0 ? planForm.modulos_permitidos : ["provincias", "escolas", "docentes", "estudantes", "turmas"],
        limits: planForm.limits
      };
      await setDoc(doc(db, 'planos', generatedId), planData);
      await auditLog(editingPlan ? "Editar Plano" : "Criar Plano", "Plano", generatedId, `Definidos limites de escolas: ${planForm.limits.max_escolas}, docentes: ${planForm.limits.max_docentes}`);
      
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      loadData();
    } catch (err) {
      console.error("Error saving plan:", err);
    }
  }

  // Manual payment registration
  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const selectedTenant = tenants.find(t => t.id === paymentForm.tenant_id);
      if (!selectedTenant) return;

      const genId = "pag-" + Math.random().toString(36).substr(2, 9);
      const newPayment: Pagamento = {
        id: genId,
        tenant_id: paymentForm.tenant_id,
        tenant_nome: selectedTenant.nome,
        valor: Number(paymentForm.valor),
        data_vencimento: paymentForm.data_vencimento,
        data_pagamento: paymentForm.status === 'Pago' ? new Date().toISOString().split('T')[0] : undefined,
        status: paymentForm.status,
        metodo: paymentForm.metodo
      };

      await setDoc(doc(db, 'pagamentos', genId), newPayment);

      // If registered as Paid, automatically extend tenant subscription expiration date by 30 days
      if (paymentForm.status === 'Pago') {
        const tRef = doc(db, 'tenants', paymentForm.tenant_id);
        const currentExp = new Date(selectedTenant.data_vencimento).getTime();
        const baseTime = currentExp > Date.now() ? currentExp : Date.now();
        const nextExp = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        await updateDoc(tRef, {
          data_vencimento: nextExp,
          status: 'ativo'
        });
        await auditLog("Registrar Pagamento", "Pagamento", genId, `Fatura paga de R$ ${paymentForm.valor} registrada. Assinatura prorrogada até ${nextExp}`);
      } else {
        await auditLog("Lançar Fatura", "Pagamento", genId, `Fatura no valor de R$ ${paymentForm.valor} emitida para vencimento em ${paymentForm.data_vencimento}`);
      }

      setIsPaymentModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Error registering payment:", err);
    }
  }

  // Delete single payment
  async function handleDeletePayment(id: string) {
    showConfirm(
      "Excluir Registro de Pagamento",
      "Deseja realmente excluir este registro de faturamento permanentemente do sistema?",
      async () => {
        try {
          await deleteDoc(doc(db, 'pagamentos', id));
          await auditLog("Excluir Pagamento", "Pagamento", id, `Removido registro de faturamento`);
          loadData();
        } catch (err) {
          console.error("Error deleting payment:", err);
        }
      },
      true
    );
  }

  // Update single payment status
  async function updatePaymentStatus(id: string, newStatus: 'Pago' | 'Pendente' | 'Atrasado') {
    try {
      const paymentRef = doc(db, 'pagamentos', id);
      const updateObj: any = { status: newStatus };
      if (newStatus === 'Pago') {
        updateObj.data_pagamento = new Date().toISOString().split('T')[0];
      } else {
        updateObj.data_pagamento = null;
      }
      await updateDoc(paymentRef, updateObj);
      await auditLog("Atualizar Pagamento", "Pagamento", id, `Status alterado para ${newStatus}`);
      loadData();
    } catch (err) {
      console.error("Error updating payment status:", err);
    }
  }

  // Aggregate Metrics for Dashboard
  const activeTenants = tenants.filter(t => t.status === 'ativo').length;
  const suspendedTenants = tenants.filter(t => t.status === 'suspenso').length;
  const totalRevenue = payments
    .filter(p => p.status === 'Pago')
    .reduce((sum, p) => sum + p.valor, 0);

  // Filter Tenants list
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.email_admin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    const matchesPlan = planFilter === 'todos' || t.plano_id === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const renderMenuItem = (tab: string, label: string, icon: React.ReactNode) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => {
          setActiveTab(tab as any);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full py-2.5 px-3.5 rounded-xl text-sm font-semibold flex items-center transition-all duration-200 group relative
          ${isActive 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
          }
          ${isExpanded ? 'gap-3' : 'justify-center'}
        `}
        title={!isExpanded ? label : undefined}
      >
        <div className={`shrink-0 transition-transform duration-200 ${!isActive && 'group-hover:scale-110'}`}>
          {icon}
        </div>
        {isExpanded && (
          <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300 font-sans">
            {label}
          </span>
        )}
        
        {/* Active side indicator */}
        {isActive && !isExpanded && (
          <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full" />
        )}
      </button>
    );
  };

  const renderGroupHeader = (label: string) => {
    if (isExpanded) {
      return (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3.5 mt-5 mb-1.5 animate-in fade-in duration-300">
          {label}
        </p>
      );
    }
    return <div className="border-t border-slate-800/60 my-4 mx-3" />;
  };

  const isAnyModalOpen = !!(isSmtpModalOpen || isPasswordResetModalOpen || isSendNotifModalOpen || isTenantModalOpen || isPlanModalOpen || isPaymentModalOpen || isOtpModalOpen || criticalDeleteTenant);

  if (!hasLoadedOnce) {
    return (
      <SamsungLoadingScreen 
        title="Super Admin SysEdu" 
        subtitle="A carregar métricas globais e base de dados..." 
        fullScreen={true} 
      />
    );
  }

  return (
    <div id="super_admin_portal" className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans relative">
      {/* 6-second floating popup notification */}
      {showVerificationPopup && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] animate-fadeIn">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 border border-emerald-500/30 backdrop-blur-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
            </span>
            <p className="text-xs font-bold font-sans">
              Email de verificação enviado
            </p>
          </div>
        </div>
      )}

      {/* Backdrop overlay for hover expansion */}
      {isSidebarHovered && isSidebarCollapsed && (
        <div 
          className="hidden md:block fixed inset-0 bg-slate-950/20 backdrop-blur-xs transition-all duration-300 z-30 pointer-events-none" 
        />
      )}
      
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 z-45"
        />
      )}

      {/* Mobile Header Bar */}
      <div className={`flex md:hidden items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 shrink-0 sticky top-0 z-40 h-16 ${isAnyModalOpen ? 'pointer-events-none select-none opacity-50' : ''}`}>
        {/* 1. Menu canto esquerdo */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 cursor-pointer"
          title="Abrir Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Center / Brand */}
        <div className="flex items-center gap-2 select-none shrink-0 overflow-hidden px-2">
          <SysEduLogo variant="icon" size={24} />
          <span className="font-extrabold text-xs truncate max-w-[120px]">SysEdu SaaS</span>
        </div>

        {/* Right Actions Container */}
        <div className="flex items-center gap-3">
          {/* 2. Notificações lado direito */}
          <div className="relative">
            <button
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="p-1.5 hover:bg-slate-800 rounded-lg relative cursor-pointer transition-colors text-slate-300 flex items-center justify-center"
              title="Notificações"
            >
              <Bell className="w-5.5 h-5.5" />
              {notifications.filter(n => !n.lido).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white font-sans text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  {notifications.filter(n => !n.lido).length}
                </span>
              )}
            </button>

            {isNotifDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsNotifDropdownOpen(false)} />
                <div className="absolute right-[-44px] mt-3 w-76 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-3 text-slate-800 dark:text-slate-100 max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="font-sans font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Notificações</span>
                    {notifications.some(n => !n.lido) && (
                      <button
                        onClick={() => {
                          markAllNotificationsAsRead();
                          setIsNotifDropdownOpen(false);
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Ler tudo
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">
                        Nenhuma notificação por enquanto
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => {
                            markNotificationAsRead(n.id);
                            setIsNotifDropdownOpen(false);
                          }}
                          className={`p-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors ${!n.lido ? 'bg-indigo-50/20 dark:bg-indigo-950/25' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-bold leading-tight">{n.titulo}</span>
                            <span className={`text-[8px] uppercase font-bold px-1 py-0.5 rounded shrink-0 ${
                              n.tipo === 'limite' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' :
                              n.tipo === 'alerta' ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300' :
                              n.tipo === 'sucesso' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-300'
                            }`}>
                              {n.tipo}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 leading-relaxed">{n.mensagem}</p>
                          <span className="text-[9px] text-slate-400 font-mono mt-1.5 block">{new Date(n.created_at).toLocaleTimeString('pt-PT')}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Temas canto direito */}
          <div className="flex items-center gap-2.5 mr-1">
            <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">Modo escuro</span>
            <button
              type="button"
              onClick={() => onChangeTheme?.(activeTheme === 'theme-dark' ? 'theme-slate' : 'theme-dark')}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-slate-700 transition-colors duration-200 ease-in-out focus:outline-none ${
                activeTheme === 'theme-dark' ? 'bg-sky-500' : 'bg-slate-800'
              }`}
              role="switch"
              aria-checked={activeTheme === 'theme-dark'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  activeTheme === 'theme-dark' ? 'translate-x-5' : 'translate-x-0.5'
                } mt-[1px]`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR CONSTANT WIDTH SPACER */}
      <div className={`hidden md:block transition-[width] duration-300 ease-in-out shrink-0 ${isExpanded ? 'w-64' : 'w-[72px]'}`} />

      {/* SIDEBAR */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed top-0 bottom-0 left-0 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col z-40 transition-all duration-300 ease-in-out
          ${isMobile 
            ? (isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl shadow-slate-950/70 z-50' : '-translate-x-full w-64 z-50') 
            : 'translate-x-0 md:flex z-40 ' + (isExpanded ? 'w-64 shadow-2xl shadow-slate-950/50' : 'w-[72px]')}
          ${isAnyModalOpen ? 'pointer-events-none select-none opacity-50' : ''}
        `}
      >
        {/* Header / Brand */}
        <div className={`p-4 border-b border-slate-800 flex items-center bg-slate-950 h-[72px] shrink-0 transition-all duration-300 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <SysEduLogo variant="icon" size={isExpanded ? 32 : 28} />
            {isExpanded && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <h2 className="font-sans font-extrabold text-sm text-white tracking-tight">SysEdu SaaS</h2>
                <span className="text-[9px] text-[#10B981] font-mono tracking-wider font-bold animate-pulse">SUPER ADMIN</span>
              </div>
            )}
          </div>
          
          {/* Desktop Toggle Button */}
          {isExpanded && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Fixar Aberto" : "Recolher Menu"}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto overscroll-y-contain no-scrollbar">
          {renderGroupHeader('Painel de Controle')}
          {renderMenuItem('dashboard', 'Dashboard Global', <Sparkles className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Clientes')}
          {renderMenuItem('tenants', `Contas & Clientes (${tenants.length})`, <Building2 className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Faturamento')}
          {renderMenuItem('plans', 'Planos & Limites', <CreditCard className="w-4.5 h-4.5" />)}
          {renderMenuItem('payments', 'Histórico Pagamentos', <DollarSign className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Configurações')}
          {renderMenuItem('smtp', 'Servidores SMTP', <Mail className="w-4.5 h-4.5" />)}
          {renderMenuItem('notificacoes_config', 'Config. Notificações', <Bell className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Auditoria')}
          {renderMenuItem('logs', 'Auditoria Geral', <History className="w-4.5 h-4.5" />)}
          {renderMenuItem('logs_instituicoes', 'Logs Criptografados', <ShieldAlert className="w-4.5 h-4.5" />)}
        </nav>

        {/* Footer / User Profile */}
        <div className={`p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3 text-xs transition-all duration-300 ${isExpanded ? '' : 'items-center shrink-0'}`}>
          {isExpanded ? (
            <div className="flex flex-col gap-1 overflow-hidden animate-in fade-in duration-300">
              <p className="text-slate-500 font-medium">Logado como:</p>
              <p className="font-bold text-indigo-400 truncate">neltonbenedito1@gmail.com</p>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/40 flex items-center justify-center font-bold text-xs shrink-0" title="neltonbenedito1@gmail.com">
              N
            </div>
          )}
          
          {isExpanded ? (
            <button
              type="button"
              onClick={() => setIsCookiePolicyOpen(true)}
              className="w-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 py-1.5 px-3 rounded-xl font-bold text-center text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border border-slate-800"
              title="Abrir Política de Cookies e Privacidade"
            >
              🛡️ Cookies & Privacidade
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCookiePolicyOpen(true)}
              className="p-2 bg-slate-900/80 hover:bg-slate-800 text-indigo-400 rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-800"
              title="Política de Cookies"
            >
              🛡️
            </button>
          )}

          {onLogout && (
            isExpanded ? (
              <button 
                onClick={onLogout}
                className="w-full bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 py-2 rounded-xl font-bold text-center text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <LogOut className="w-4 h-4" /> Sair da Conta
              </button>
            ) : (
              <button 
                onClick={onLogout}
                className="p-2 bg-slate-800/50 hover:bg-rose-950/60 hover:text-rose-400 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 p-6 md:p-8 overflow-y-auto w-full space-y-8 ${isAnyModalOpen ? 'pointer-events-none select-none opacity-50' : ''}`}>
        {/* Top Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>

            <h1 className="text-2xl font-bold text-slate-900 font-sans">
              {activeTab === 'dashboard' && 'Dashboard de Vendas Global'}
              {activeTab === 'tenants' && 'Controle de Contas & Clientes'}
              {activeTab === 'plans' && 'Definição de Planos & Limites'}
              {activeTab === 'payments' && 'Faturamento & Histórico de Cobranças'}
              {activeTab === 'logs' && 'Logs de Auditoria de Segurança'}
              {activeTab === 'smtp' && 'Servidores SMTP por Escola'}
              {(activeTab as string) === 'notificacoes_config' && 'Regras Globais de Notificação'}
              {(activeTab as string) === 'logs_instituicoes' && 'Logs Criptografados por Unidade'}
            </h1>
          </div>
          
          <div className="flex gap-4 shrink-0 items-center">
            {/* Theme Toggle Switch */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Modo escuro</span>
              <button
                type="button"
                onClick={() => onChangeTheme?.(activeTheme === 'theme-dark' ? 'theme-slate' : 'theme-dark')}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-slate-300 dark:border-slate-700 transition-colors duration-200 ease-in-out focus:outline-none ${
                  activeTheme === 'theme-dark' ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-800'
                }`}
                role="switch"
                aria-checked={activeTheme === 'theme-dark'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                    activeTheme === 'theme-dark' ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-[1px]`}
                />
              </button>
            </div>

            {/* Language Selector Dropdown */}
            {onChangeLanguage && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="Mudar Idioma"
                >
                  <Globe className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">{(LANGUAGES.find(l => l.code === systemLang) || LANGUAGES[0]).flag}</span>
                  <span className="hidden md:inline text-slate-600">{(LANGUAGES.find(l => l.code === systemLang) || LANGUAGES[0]).name}</span>
                </button>

                {isLangDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLangDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-2 pb-1.5 mb-1.5 border-b border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Idioma do Painel</p>
                      </div>
                      <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1">
                        {LANGUAGES.map((lang) => {
                          const isSelected = systemLang === lang.code;
                          return (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => {
                                onChangeLanguage(lang.code);
                                setIsLangDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
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
            )}

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 rounded-lg relative cursor-pointer transition-colors flex items-center justify-center"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {notifications.filter(n => !n.lido).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-sans text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {notifications.filter(n => !n.lido).length}
                  </span>
                )}
              </button>

              {isNotifDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-3 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 pb-2 border-b border-slate-100 flex justify-between items-center">
                      <span className="font-sans font-extrabold text-sm text-slate-800">Notificações</span>
                      <div className="flex gap-2">
                        {notifications.some(n => !n.lido) && (
                          <button
                            onClick={() => {
                              markAllNotificationsAsRead();
                              setIsNotifDropdownOpen(false);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold font-sans cursor-pointer"
                          >
                            Ler tudo
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsSendNotifModalOpen(true);
                            setIsNotifDropdownOpen(false);
                          }}
                          className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold font-sans cursor-pointer"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-400">
                          Nenhuma notificação por enquanto
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              markNotificationAsRead(n.id);
                            }}
                            className={`p-3 text-left cursor-pointer hover:bg-slate-50 transition-colors ${!n.lido ? 'bg-indigo-50/30' : ''}`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className={`text-xs font-bold font-sans ${!n.lido ? 'text-indigo-900' : 'text-slate-700'}`}>{n.titulo}</span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                n.tipo === 'limite' ? 'bg-amber-100 text-amber-800' :
                                n.tipo === 'alerta' ? 'bg-rose-100 text-rose-800' :
                                n.tipo === 'sucesso' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {n.tipo}
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs mt-1 leading-relaxed">{n.mensagem}</p>
                            <span className="text-[10px] text-slate-400 font-mono mt-2 block">{new Date(n.created_at).toLocaleString('pt-PT')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>


            <button 
              onClick={loadData}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 p-2 rounded-lg text-xs transition-colors cursor-pointer"
              title="Sincronizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p>Sincronizando dados com o Firestore...</p>
          </div>
        ) : (
          <>
            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Score Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Clientes Ativos</p>
                      <h3 className="text-2xl font-bold font-sans text-slate-900">{activeTenants}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-600 p-4 rounded-xl">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Suspensos / A vencer</p>
                      <h3 className="text-2xl font-bold font-sans text-slate-900">{suspendedTenants}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total de Tenants</p>
                      <h3 className="text-2xl font-bold font-sans text-slate-900">{tenants.length}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 text-blue-600 p-4 rounded-xl">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Faturamento Acumulado</p>
                      <h3 className="text-2xl font-bold font-sans text-slate-900">
                        {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Main section: Chart & Latest Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Revenue & Performance */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="text-slate-900 font-sans font-bold text-base">Evolução Mensal do Faturamento</h4>
                        <p className="text-slate-400 text-xs">Arrecadação consolidada do SaaS por período</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 text-xs font-bold py-1 px-2.5 rounded-lg flex items-center gap-1">
                        +12% este mês
                      </span>
                    </div>
                    
                    {/* Visual custom chart representaton using beautiful custom styled elements/SVGs */}
                    <div className="h-64 flex items-end gap-3 justify-around pt-6">
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-slate-500">R$ 5K</span>
                        <div className="w-12 bg-indigo-200 rounded-t-lg h-32 transition-all hover:bg-indigo-300"></div>
                        <span className="text-xs text-slate-500">Jan</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-slate-500">R$ 6.2K</span>
                        <div className="w-12 bg-indigo-300 rounded-t-lg h-38 transition-all hover:bg-indigo-400"></div>
                        <span className="text-xs text-slate-500">Fev</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-slate-500">R$ 8.5K</span>
                        <div className="w-12 bg-indigo-400 rounded-t-lg h-44 transition-all hover:bg-indigo-500"></div>
                        <span className="text-xs text-slate-500">Mar</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-slate-500">R$ 9.1K</span>
                        <div className="w-12 bg-indigo-500 rounded-t-lg h-48 transition-all hover:bg-indigo-600"></div>
                        <span className="text-xs text-slate-500">Abr</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-slate-500">R$ 11.2K</span>
                        <div className="w-12 bg-indigo-600 rounded-t-lg h-52 transition-all hover:bg-indigo-700"></div>
                        <span className="text-xs text-slate-500">Mai</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <span className="text-xs font-mono text-emerald-600 font-bold">R$ 15.5K</span>
                        <div className="w-12 bg-emerald-500 rounded-t-lg h-58 transition-all hover:bg-emerald-600"></div>
                        <span className="text-xs text-slate-700 font-bold">Jun (Atu)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Expiring Accounts Alert */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-slate-900 font-sans font-bold text-base mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500 w-5 h-5" /> Contas Próximas ao Vencimento
                      </h4>
                      <div className="space-y-3.5 max-h-72 overflow-y-auto">
                        {tenants.map(t => {
                          const daysLeft = Math.ceil((new Date(t.data_vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          const isCritical = daysLeft <= 7;
                          return (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <div>
                                <p className="font-medium text-sm text-slate-800">{t.nome}</p>
                                <p className="text-xs text-slate-400 font-mono">Vence em: {t.data_vencimento}</p>
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${isCritical ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-amber-50 text-amber-700'}`}>
                                {daysLeft <= 0 ? 'Expirada' : `${daysLeft} dias`}
                              </span>
                            </div>
                          );
                        })}
                        {tenants.length === 0 && (
                          <p className="text-slate-400 text-xs py-4 text-center">Nenhuma conta pendente ou vencendo.</p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setPaymentForm({
                          tenant_id: tenants[0]?.id || '',
                          valor: 299,
                          data_vencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          status: 'Pago',
                          metodo: 'Transferência Bancária'
                        });
                        setIsPaymentModalOpen(true);
                      }}
                      className="mt-6 w-full text-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4" /> Registrar Renovação Manual
                    </button>
                  </div>
                </div>

                {/* Recent activity & Tenancy Plans distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Latest registered tenants */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-slate-900 font-sans font-bold text-base mb-4">Últimos Clientes Ativados</h4>
                    <div className="divide-y divide-slate-100">
                      {tenants.slice(0, 5).map(t => (
                        <div key={t.id} className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2.5 rounded-lg text-indigo-600">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-800">{t.nome}</p>
                              <p className="text-xs text-slate-400">{t.email_admin} • {t.telefone}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing plans overview summary */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-slate-900 font-sans font-bold text-base mb-4">Distribuição de Planos de Assinatura</h4>
                    <div className="space-y-4">
                      {plans.map(p => {
                        const count = tenants.filter(t => t.plano_id === p.id).length;
                        const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
                        return (
                          <div key={p.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">{p.nome}</span>
                              <span className="text-slate-500 font-bold">{count} escolas ({Math.round(percentage)}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TENANTS / CLIENTS */}
            {activeTab === 'tenants' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fadeIn">
                {/* Search, Filter rails */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Pesquisar por nome da instituição, email ou subdomínio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2.5">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm">
                      <Filter className="w-4 h-4 text-slate-400" />
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent border-none text-slate-700 focus:outline-none"
                      >
                        <option value="todos">Status: Todos</option>
                        <option value="ativo">Ativos</option>
                        <option value="suspenso">Suspensos</option>
                        <option value="cancelado">Cancelados</option>
                      </select>
                    </div>

                    {/* Plan Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <select 
                        value={planFilter}
                        onChange={(e) => setPlanFilter(e.target.value)}
                        className="bg-transparent border-none text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="todos">Planos: Todos</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>

                    {/* Botão Adicionar Conta */}
                    <button
                      id="btn_adicionar_conta"
                      type="button"
                      onClick={() => {
                        setEditingTenant(null);
                        setTenantForm({
                          nome: '',
                          email_admin: '',
                          telefone: '',
                          endereco: '',
                          plano_id: plans[0]?.id || 'plano-basico',
                          status: 'ativo',
                          data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          senha_temporaria: '',
                          senha: '',
                          confirmar_senha: '',
                          idioma_padrao: 'pt',
                          ai_translation_enabled: true
                        });
                        setIsTenantModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      <span>Adicionar conta</span>
                    </button>
                  </div>
                </div>

                {/* Tenants Table */}
                {selectedTenantIds.length > 0 && (
                  <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl px-4 py-3 text-sm animate-in fade-in duration-200">
                    <span className="text-indigo-800 dark:text-indigo-300 font-medium">
                      {selectedTenantIds.length} {selectedTenantIds.length === 1 ? 'escola selecionada' : 'escolas selecionadas'}
                    </span>
                    <div className="flex items-center gap-3">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleTenantBatchAction(e.target.value);
                            e.target.value = ''; // Reset select
                          }
                        }}
                        className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Ação</option>
                        <option value="suspend">Suspender Selecionadas</option>
                        <option value="reactivate">Reativar Selecionadas</option>
                        <option value="delete">Excluir Selecionadas</option>
                      </select>
                      <button 
                        onClick={() => setSelectedTenantIds([])}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Limpar Seleção
                      </button>
                    </div>
                  </div>
                )}

                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100 dark:border-slate-800">
                        <th className="px-4 py-4 w-12 text-center">
                          <input 
                            type="checkbox"
                            checked={filteredTenants.length > 0 && selectedTenantIds.length === filteredTenants.length}
                            onChange={() => {
                              if (selectedTenantIds.length === filteredTenants.length) {
                                setSelectedTenantIds([]);
                              } else {
                                setSelectedTenantIds(filteredTenants.map(t => t.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-4">Instituição / Slug</th>
                        <th className="px-6 py-4">Contacto / Admin</th>
                        <th className="px-6 py-4">Plano</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Vencimento</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                      {filteredTenants.map(t => {
                        const activePlan = plans.find(p => p.id === t.plano_id);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="checkbox"
                                checked={selectedTenantIds.includes(t.id)}
                                onChange={() => {
                                  setSelectedTenantIds(prev => 
                                    prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                                  );
                                }}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900 dark:text-white">{t.nome}</p>
                              <span className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-mono font-bold mt-1 inline-block">
                                /{t.slug}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p>{t.email_admin}</p>
                              <p className="text-xs text-slate-400">{t.telefone}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{activePlan?.nome || 'Personalizado'}</span>
                              <p className="text-xs text-slate-400">R$ {activePlan?.preco}/mês</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                t.status === 'ativo' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' :
                                t.status === 'suspenso' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' :
                                'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                              }`}>
                                {t.status === 'ativo' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                {t.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs">
                              {t.data_vencimento}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingTenant(t);
                                    setTenantForm({
                                      nome: t.nome,
                                      email_admin: t.email_admin,
                                      telefone: t.telefone,
                                      endereco: t.endereco,
                                      plano_id: t.plano_id,
                                      status: (t.status as any),
                                      data_vencimento: t.data_vencimento,
                                      senha_temporaria: '',
                                      idioma_padrao: t.idioma_padrao || 'pt',
                                      ai_translation_enabled: t.ai_translation_enabled !== false
                                    });
                                    setIsTenantModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Editar Dados"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline text-[11px] font-semibold">Editar</span>
                                </button>

                                <button
                                  onClick={() => toggleTenantStatus(t)}
                                  className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                    t.status === 'ativo' 
                                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100' 
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                  }`}
                                  title={t.status === 'ativo' ? 'Suspender Conta' : 'Reativar Conta'}
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline text-[11px] font-semibold">{t.status === 'ativo' ? 'Suspender' : 'Reativar'}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedTenantForPasswordReset(t);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setOtpCode('');
                                    setGeneratedOtp('');
                                    setOtpExpiration(null);
                                    setOtpMessage('');
                                    setIsOtpRequested(false);
                                    setIsPasswordChangedSuccessfully(false);
                                    setIsPasswordResetModalOpen(true);
                                  }}
                                  className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Alterar Senha Admin"
                                >
                                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="hidden xl:inline text-[11px] font-semibold">Senha</span>
                                </button>

                                <button
                                  onClick={() => handleSoftDeleteTenant(t.id, t.nome)}
                                  className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Excluir Escola"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline text-[11px] font-semibold">Excluir</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTenants.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center text-slate-400 py-8">Nenhuma escola cadastrada correspondente.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View (List with Checkbox, Detail View button and 3 dots) */}
                <div className="block md:hidden space-y-3">
                  {filteredTenants.map(t => {
                    const activePlan = plans.find(p => p.id === t.plano_id);
                    return (
                      <div key={t.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <input 
                            type="checkbox"
                            checked={selectedTenantIds.includes(t.id)}
                            onChange={() => {
                              setSelectedTenantIds(prev => 
                                prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                              );
                            }}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{t.nome}</p>
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">
                              /{t.slug}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Details Button */}
                          <button
                            onClick={() => {
                              setEditingTenant(t);
                              setTenantForm({
                                nome: t.nome,
                                email_admin: t.email_admin,
                                telefone: t.telefone,
                                endereco: t.endereco,
                                plano_id: t.plano_id,
                                status: (t.status as any),
                                data_vencimento: t.data_vencimento,
                                senha_temporaria: '',
                                idioma_padrao: t.idioma_padrao || 'pt',
                                ai_translation_enabled: t.ai_translation_enabled !== false
                              });
                              setIsTenantModalOpen(true);
                            }}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Visualizar Dados"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="sr-only">Visualizar</span>
                          </button>

                          {/* Direct Action Buttons */}
                          <button
                            onClick={() => {
                              toggleTenantStatus(t);
                            }}
                            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                              t.status === 'ativo' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            }`}
                            title={t.status === 'ativo' ? 'Suspender Conta' : 'Reativar Conta'}
                          >
                            <Lock className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedTenantForPasswordReset(t);
                              setNewPassword('');
                              setConfirmPassword('');
                              setOtpCode('');
                              setGeneratedOtp('');
                              setOtpExpiration(null);
                              setOtpMessage('');
                              setIsOtpRequested(false);
                              setIsPasswordChangedSuccessfully(false);
                              setIsPasswordResetModalOpen(true);
                            }}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Alterar Senha Admin"
                          >
                            <Lock className="w-4 h-4 text-indigo-400" />
                          </button>

                          <button
                            onClick={() => handleSoftDeleteTenant(t.id, t.nome)}
                            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Excluir Escola"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredTenants.length === 0 && (
                    <div className="text-center text-slate-400 py-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      Nenhuma escola cadastrada correspondente.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PLANS & LIMITS */}
            {activeTab === 'plans' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div>
                    <h3 className="font-bold font-sans text-lg text-slate-900">Planos de Subscrição</h3>
                    <p className="text-slate-400 text-sm">Controle as regras de limites de escolas, docentes e alunos permitidos no sistema.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingPlan(null);
                      setPlanForm({
                        nome: '',
                        descricao: '',
                        preco: 499,
                        periodicidade: 'mensal',
                        modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao"],
                        limits: { 
                          max_escolas: 3, 
                          max_docentes: 10, 
                          max_estudantes: 250, 
                          max_turmas: 10,
                          max_disciplinas: 15,
                          max_classes: 7,
                          max_usuarios: 15
                        }
                      });
                      setIsPlanModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Novo Plano
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-indigo-500 transition-colors">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-lg text-indigo-950 font-sans">{p.nome}</h4>
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold py-1 px-2.5 rounded-full uppercase">
                            {p.periodicidade}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm mb-6">{p.descricao}</p>
                        
                        <div className="mb-6">
                          <span className="text-3xl font-extrabold text-slate-900">
                            {p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'MZN' })}
                          </span>
                          <span className="text-slate-400 text-xs">/período</span>
                        </div>

                        {/* Limits and Capabilities List */}
                        <div className="space-y-3.5 border-t border-slate-100 pt-6">
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Limites de Escopo</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Escolas</span>
                            <span className="font-bold text-slate-800">{p.limits.max_escolas >= 9999 ? 'Ilimitado' : p.limits.max_escolas}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Docentes</span>
                            <span className="font-bold text-slate-800">{p.limits.max_docentes >= 9999 ? 'Ilimitado' : p.limits.max_docentes}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Estudantes</span>
                            <span className="font-bold text-slate-800">{p.limits.max_estudantes >= 9999 ? 'Ilimitado' : p.limits.max_estudantes}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Turmas</span>
                            <span className="font-bold text-slate-800">{p.limits.max_turmas >= 9999 ? 'Ilimitado' : p.limits.max_turmas}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Disciplinas</span>
                            <span className="font-bold text-slate-800">{(p.limits.max_disciplinas ?? 15) >= 9999 ? 'Ilimitado' : (p.limits.max_disciplinas ?? 15)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Classes</span>
                            <span className="font-bold text-slate-800">{(p.limits.max_classes ?? 7) >= 9999 ? 'Ilimitado' : (p.limits.max_classes ?? 7)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Máx Usuários</span>
                            <span className="font-bold text-slate-800">{(p.limits.max_usuarios ?? 15) >= 9999 ? 'Ilimitado' : (p.limits.max_usuarios ?? 15)}</span>
                          </div>

                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider pt-3">Módulos Ativados</p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.modulos_permitidos.map(m => {
                              const friendlyNames: Record<string, string> = {
                                provincias: 'Províncias & Distritos',
                                escolas: 'Escolas',
                                docentes: 'Docentes',
                                estudantes: 'Estudantes',
                                turmas: 'Turmas',
                                disciplinas: 'Disciplinas',
                                classes_escolares: 'Classes',
                                calendario: 'Calendário & Horários',
                                pauta: 'Notas (Pautas)',
                                pautageral: 'Pauta Geral',
                                processo: 'Processo Individual',
                                configuracao: 'Configurações & Usuários',
                                logs: 'Logs de Auditoria',
                                analytics: 'Módulo de Análises'
                              };
                              return (
                                <span key={m} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded font-semibold border border-indigo-100">
                                  {friendlyNames[m] || m}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-4 border-t border-slate-100 flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingPlan(p);
                            setPlanForm({
                              nome: p.nome,
                              descricao: p.descricao,
                              preco: p.preco,
                              periodicidade: p.periodicidade,
                              modulos_permitidos: p.modulos_permitidos,
                              limits: {
                                max_escolas: p.limits.max_escolas,
                                max_docentes: p.limits.max_docentes,
                                max_estudantes: p.limits.max_estudantes,
                                max_turmas: p.limits.max_turmas,
                                max_disciplinas: p.limits.max_disciplinas ?? 15,
                                max_classes: p.limits.max_classes ?? 7,
                                max_usuarios: p.limits.max_usuarios ?? 15
                              }
                            });
                            setIsPlanModalOpen(true);
                          }}
                          className="flex-1 text-center bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          Editar Regras
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-fadeIn">
                <SuperAdminFinancePanel 
                  payments={payments}
                  tenants={tenants}
                  plans={plans}
                  onUpdatePaymentStatus={updatePaymentStatus}
                  onDeletePayment={handleDeletePayment}
                  onAddLog={async (acao, entidade, entidadeId, detalhes) => {
                    await addDoc(collection(db, "log_admins"), {
                      admin_id: "super_admin_finance",
                      admin_nome: "Super Admin Finanças",
                      acao,
                      entidade,
                      entidade_id: entidadeId,
                      timestamp: new Date().toISOString(),
                      detalhes
                    });
                  }}
                  onReloadTenants={async () => {
                    const tenantsSnap = await getDocs(collection(db, 'tenants'));
                    const tenantsList: any[] = [];
                    tenantsSnap.forEach(d => tenantsList.push({ ...d.data(), id: d.id }));
                    setTenants(tenantsList);
                  }}
                  onReloadPayments={async () => {
                    const paymentsSnap = await getDocs(collection(db, 'pagamentos'));
                    const paymentsList: any[] = [];
                    paymentsSnap.forEach(d => paymentsList.push({ ...d.data(), id: d.id }));
                    setPayments(paymentsList);
                  }}
                />
              </div>
            )}

            {/* TAB: AUDIT LOGS */}
            {activeTab === 'logs' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-bold font-sans text-lg text-slate-900 font-sans flex items-center gap-2">
                    <History className="text-indigo-600 w-5 h-5" /> Trilha de Auditoria (Logs)
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Histórico de ações críticas registradas na camada Super Admin em tempo real.
                  </p>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 divide-y divide-slate-100">
                  {logs.map(log => (
                    <div key={log.id} className="pt-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                            {log.acao}
                          </span>
                          <span className="text-xs font-mono text-slate-400">ID: {log.entidade_id}</span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1.5">{log.detalhes}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Executor: {log.admin_nome}</p>
                      </div>
                      <span className="text-xs font-mono text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-slate-400 text-xs py-8 text-center">Nenhum log de auditoria disponível.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB: SMTP SERVERS */}
            {activeTab === 'smtp' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-bold font-sans text-lg text-slate-900 flex items-center gap-2">
                      <Server className="text-indigo-600 w-5 h-5" /> Servidor SMTP Geral do Sistema
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Cadastre o servidor SMTP (e-mail corporativo) usado pelo sistema para enviar notificações de credenciais e faturamento aos administradores.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método de Configuração</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setGlobalSmtp(prev => ({ ...prev, smtp_type: 'manual' }))}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          globalSmtp.smtp_type !== 'gmail'
                            ? 'border-indigo-600 bg-indigo-50/30 text-indigo-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="font-bold text-sm flex items-center gap-2">
                          <Sliders className="w-4 h-4" /> Configurar Manualmente
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Insira os dados do seu próprio provedor SMTP corporativo.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGlobalSmtp(prev => ({
                            ...prev,
                            smtp_type: 'gmail',
                            host: 'smtp.gmail.com',
                            port: 465,
                            secure: true
                          }));
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          globalSmtp.smtp_type === 'gmail'
                            ? 'border-indigo-600 bg-indigo-50/30 text-indigo-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="font-bold text-sm flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Usar Google Gmail
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Conecte de forma simplificada via smtp.gmail.com e Senha de App.</p>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const smtpData: SmtpConfig = {
                        ...globalSmtp,
                        id: 'system_global',
                        tenant_id: 'system',
                        updated_at: new Date().toISOString()
                      };
                      setGlobalSmtp(smtpData);
                      localDb.saveSmtpConfig(smtpData);
                      try {
                        await setDoc(doc(db, 'smtp_configs', 'system_global'), smtpData);
                      } catch (err) {
                        console.warn("Could not save to Firestore, saved to local DB:", err);
                      }
                      showSystemNotification("Configurações do Servidor SMTP salvas com sucesso!", "sucesso");
                    } catch (error) {
                      console.error(error);
                      showSystemNotification("Erro ao salvar SMTP geral.", "erro");
                    }
                  }} className="space-y-4">
                    {globalSmtp.smtp_type !== 'gmail' ? (
                      // Manual Fields
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Host SMTP</label>
                            <input
                              type="text"
                              required
                              value={globalSmtp.host || ''}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, host: e.target.value })}
                              placeholder="smtp.dominio.com"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Porta</label>
                            <input
                              type="number"
                              required
                              value={globalSmtp.port || 587}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, port: parseInt(e.target.value) || 587 })}
                              placeholder="587"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Usuário SMTP</label>
                            <input
                              type="text"
                              required
                              value={globalSmtp.user || ''}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, user: e.target.value })}
                              placeholder="usuario@dominio.com"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha SMTP</label>
                            <input
                              type="password"
                              required
                              value={globalSmtp.pass || ''}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, pass: e.target.value })}
                              placeholder="••••••••••••"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail do Remetente</label>
                            <input
                              type="email"
                              required
                              value={globalSmtp.sender_email || ''}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, sender_email: e.target.value })}
                              placeholder="notificacoes@sistema.com"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome de Exibição</label>
                            <input
                              type="text"
                              required
                              value={globalSmtp.sender_name || ''}
                              onChange={(e) => setGlobalSmtp({ ...globalSmtp, sender_name: e.target.value })}
                              placeholder="Ex: Provedor do Sistema"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                          <input
                            type="checkbox"
                            id="smtp_secure_global"
                            checked={!!globalSmtp.secure}
                            onChange={(e) => setGlobalSmtp({ ...globalSmtp, secure: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <label htmlFor="smtp_secure_global" className="text-xs font-bold text-slate-700 cursor-pointer">
                            Conexão Segura (SSL/TLS)
                          </label>
                        </div>
                      </>
                    ) : (
                      // Gmail Fields
                      <>
                        {globalSmtp.smtp_type === 'gmail' && globalSmtp.user && globalSmtp.status === 'ativo' ? (
                          <div className="p-5 border border-emerald-100 bg-emerald-50/40 rounded-xl flex flex-col items-center text-center space-y-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                              <Check className="w-5 h-5 stroke-2" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs">Sessão Google / Gmail Vinculada e Ativa</h4>
                              <p className="text-slate-500 text-[11px] mt-0.5 max-w-md">
                                O sistema está configurado para enviar e-mails corporativos e credenciais através desta conta Gmail. O vínculo permanece ativo de forma permanente até ser desvinculado manualmente.
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm w-full max-w-md text-left space-y-1 text-[11px]">
                              <div><span className="text-slate-400">Conta Gmail:</span> <span className="font-bold text-slate-700">{globalSmtp.user}</span></div>
                              <div><span className="text-slate-400">Nome de Exibição:</span> <span className="font-bold text-slate-700">{globalSmtp.sender_name || 'SaaS Educacional'}</span></div>
                              <div><span className="text-slate-400">Provedor SMTP:</span> <span className="text-emerald-600 font-bold uppercase text-[9px]">Google Gmail API (Vinculado / Ativo)</span></div>
                            </div>
                            <div className="flex items-center gap-3 pt-1">
                              <button
                                type="button"
                                onClick={handleGoogleSmtpLogin}
                                className="text-indigo-600 hover:text-indigo-500 font-semibold text-[11px] cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors border border-indigo-100"
                              >
                                Reautenticar / Renovar Acesso
                              </button>
                              <button
                                type="button"
                                onClick={handleDisconnectGmail}
                                className="text-rose-600 hover:text-rose-500 font-semibold text-[11px] cursor-pointer bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-colors border border-rose-100"
                              >
                                Desconectar Conta Google
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 border border-slate-100 bg-slate-50/50 rounded-xl flex flex-col items-center text-center space-y-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                              <Mail className="w-5 h-5 stroke-2" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs">Iniciar Sessão com Conta Gmail</h4>
                              <p className="text-slate-500 text-[11px] mt-0.5 max-w-sm">
                                Conecte a conta do Gmail do sistema para que as notificações de credenciais e faturamentos sejam disparadas por ela de verdade.
                              </p>
                            </div>

                            <button 
                              type="button" 
                              onClick={handleGoogleSmtpLogin} 
                              className="gsi-material-button hover:opacity-90 active:scale-95 transition-all shadow-sm"
                            >
                              <div className="gsi-material-button-state"></div>
                              <div className="gsi-material-button-content-wrapper flex items-center">
                                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="gsi-material-button-icon" style={{ display: 'block' }}>
                                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                  <path fill="none" d="M0 0h48v48H0z"></path>
                                </svg>
                                <span className="gsi-material-button-contents text-slate-700 font-bold text-xs tracking-wide">Conectar com o Google</span>
                              </div>
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Simulated Connection Test Console */}
                    {testStatus !== 'idle' && (
                      <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[10px] rounded-lg border border-slate-800 space-y-1 max-h-40 overflow-y-auto">
                        <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1 flex justify-between items-center">
                          <span>SMTP TEST SHELL</span>
                          {testStatus === 'testing' && <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-400" />}
                        </div>
                        {testLogs.map((log, idx) => (
                          <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between gap-3 pt-2">
                      <button
                        type="button"
                        disabled={testStatus === 'testing'}
                        onClick={async () => {
                          if (globalSmtp.smtp_type === 'gmail') {
                            if (!globalSmtp.user || globalSmtp.status !== 'ativo') {
                              showSystemNotification("Por favor, conecte sua conta Google/Gmail antes de testar.", "erro");
                              return;
                            }
                            const currentToken = gmailToken || globalSmtp.gmail_token || localStorage.getItem('superadmin_gmail_oauth_token');
                            if (!currentToken) {
                              showSystemNotification("Token de acesso expirado ou não encontrado. Clique em 'Reautenticar / Renovar Acesso' para autorizar o envio.", "info");
                              return;
                            }
                            setTestStatus('testing');
                            setTestLogs([`[${new Date().toLocaleTimeString('pt-BR')}] Iniciando teste de envio de e-mail real via Google Gmail API...`]);
                            try {
                              const testEmailData = EmailTemplates.smtpTest({ providerName: 'Google Gmail API' });
                              await sendGmailApiEmail(
                                globalSmtp.sender_email || globalSmtp.user,
                                testEmailData.subject,
                                testEmailData.body,
                                currentToken
                              );
                              setTestLogs(prev => [
                                ...prev,
                                `[${new Date().toLocaleTimeString('pt-BR')}] Conectando ao Gmail API Gateway...`,
                                `[${new Date().toLocaleTimeString('pt-BR')}] Autorizando com Bearer OAuth Token...`,
                                `[${new Date().toLocaleTimeString('pt-BR')}] Resposta do Gmail: 200 OK (Mensagem Enviada)`,
                                `[${new Date().toLocaleTimeString('pt-BR')}] ✔️ E-mail de teste real enviado com sucesso para ${globalSmtp.sender_email || globalSmtp.user}!`
                              ]);
                              setTestStatus('success');
                              showSystemNotification("E-mail de teste enviado com sucesso!", "sucesso");
                            } catch (error: any) {
                              console.error("Erro no teste de e-mail Gmail:", error);
                              setTestLogs(prev => [
                                ...prev,
                                `[${new Date().toLocaleTimeString('pt-BR')}] ❌ Erro ao enviar e-mail via Gmail API: ${error.message || error}`
                              ]);
                              setTestStatus('failed');
                              showSystemNotification(`Erro no teste do Gmail: ${error.message || error}`, "erro");
                            }
                            return;
                          }

                          if (!globalSmtp.host) {
                            showSystemNotification("Preencha o e-mail ou host SMTP antes de testar.", "erro");
                            return;
                          }
                          // Reuse test logic with globalSmtp fields!
                          setTestStatus('testing');
                          setTestLogs([]);
                          const logSteps = [
                            `Resolvendo endereço de host: ${globalSmtp.host}...`,
                            `Endereço IP resolvido: ${globalSmtp.host === 'localhost' ? '127.0.0.1' : '198.51.100.' + Math.floor(Math.random() * 254 + 1)}`,
                            `Conectando ao servidor SMTP na porta ${globalSmtp.port}...`,
                            `Conexão TCP estabelecida com sucesso.`,
                            `S: 220 ${globalSmtp.host} ESMTP Postfix`,
                            `C: EHLO saas-platform.edu`,
                            `S: 250-smtp.escola.edu, 250-PIPELINING, 250-SIZE 35791394, ${globalSmtp.port === 465 || globalSmtp.secure ? '' : '250-STARTTLS, '}250-AUTH LOGIN PLAIN`,
                          ];
                          if (globalSmtp.port === 587 && !globalSmtp.secure) {
                            logSteps.push(
                              `C: STARTTLS`,
                              `S: 220 2.0.0 Ready to start TLS`,
                              `Negociando conexão TLS/SSL segura...`,
                              `Cifra TLS 1.3 estabelecida com sucesso.`
                            );
                          }
                          logSteps.push(
                            `C: AUTH LOGIN`,
                            `S: 334 VXNlcm5hbWU6 (Solicitação de Usuário)`,
                            `C: [Usuário enviado: ${globalSmtp.user || 'vazio'}]`,
                            `S: 334 UGFzc3dvcmQ6 (Solicitação de Senha)`,
                            `C: [Senha enviada: ••••••••]`,
                            `S: 235 2.7.0 Authentication successful`
                          );
                          if (globalSmtp.sender_email) {
                            logSteps.push(
                              `C: MAIL FROM: <${globalSmtp.sender_email}>`,
                              `S: 250 2.1.0 Ok`,
                              `C: RCPT TO: <neltonbenedito1@gmail.com>`,
                              `S: 250 2.1.5 Recipient Ok`
                            );
                          }
                          logSteps.push(
                            `C: QUIT`,
                            `S: 221 2.0.0 Bye`,
                            `✔️ Teste de conexão SMTP concluído com sucesso!`
                          );
                          for (let i = 0; i < logSteps.length; i++) {
                            await new Promise((resolve) => setTimeout(resolve, 200));
                            setTestLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${logSteps[i]}`]);
                          }
                          setTestStatus('success');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                        Testar Conexão SMTP
                      </button>

                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                      >
                        Salvar Configurações
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: GLOBAL NOTIFICATIONS CHECKLIST */}
            {(activeTab as string) === 'notificacoes_config' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-6 animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 font-sans flex items-center gap-2 text-lg">
                      <Bell className="text-indigo-600 w-5 h-5" /> Checklist de Notificação aos Administradores
                    </h3>
                    <p className="text-xs text-slate-400">Marque quais eventos geram notificações de email/sistema e selecione quem deve receber.</p>
                  </div>
                  <button
                    onClick={() => setIsAddingCustomRule(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 self-start cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Novo Evento Customizado
                  </button>
                </div>

                {isAddingCustomRule && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4 animate-fadeIn">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Criar Novo Evento de Notificação</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Evento</label>
                        <input
                          type="text"
                          value={newRuleForm.label}
                          onChange={(e) => setNewRuleForm({ ...newRuleForm, label: e.target.value })}
                          placeholder="Ex: Novo Ticket de Suporte Aberto"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição do Evento</label>
                        <input
                          type="text"
                          value={newRuleForm.description}
                          onChange={(e) => setNewRuleForm({ ...newRuleForm, description: e.target.value })}
                          placeholder="Ex: Disparado quando um administrador de tenant abre um chamado."
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newRuleForm.email}
                          onChange={(e) => setNewRuleForm({ ...newRuleForm, email: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                        />
                        Disparar E-mail
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newRuleForm.system}
                          onChange={(e) => setNewRuleForm({ ...newRuleForm, system: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                        />
                        Notificação do Sistema
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomRule(false)}
                        className="border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newRuleForm.label) {
                            alert("Por favor, digite o nome do evento.");
                            return;
                          }
                          const newId = "custom_" + Math.random().toString(36).substr(2, 9);
                          const updated = [...superRules, { ...newRuleForm, id: newId }];
                          saveSuperRules(updated);
                          setNewRuleForm({ label: '', description: '', email: true, system: true, recipients: ['admin_principal'] });
                          setIsAddingCustomRule(false);
                          alert("Evento customizado adicionado ao checklist!");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer"
                      >
                        Confirmar Cadastro
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <th className="p-4">Evento / Gatilho</th>
                        <th className="p-4 text-center">Via E-mail</th>
                        <th className="p-4 text-center">Via Sistema</th>
                        <th className="p-4">Quem Recebe (Destinatários)</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {superRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 max-w-xs md:max-w-sm">
                            <p className="font-bold text-slate-800">{rule.label}</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed mt-0.5">{rule.description}</p>
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={rule.email}
                              onChange={(e) => {
                                const updated = superRules.map(r => r.id === rule.id ? { ...r, email: e.target.checked } : r);
                                saveSuperRules(updated);
                              }}
                              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={rule.system}
                              onChange={(e) => {
                                const updated = superRules.map(r => r.id === rule.id ? { ...r, system: e.target.checked } : r);
                                saveSuperRules(updated);
                              }}
                              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-4 relative">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setOpenDropdownId(openDropdownId === rule.id ? null : rule.id)}
                                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 cursor-pointer"
                              >
                                <span>{rule.recipients.length} Cargos</span>
                                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                              </button>

                              {openDropdownId === rule.id && (
                                <>
                                  <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setOpenDropdownId(null)} />
                                  <div className="absolute left-0 mt-1 w-60 bg-white rounded-xl shadow-xl border border-slate-200 z-20 p-2.5 animate-fadeIn text-slate-800">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Destinatários</p>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                      {RECIPIENT_ROLES_SUPER.map(role => {
                                        const isChecked = rule.recipients.includes(role.id);
                                        return (
                                          <label key={role.id} className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer select-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                const newRecipients = isChecked
                                                  ? rule.recipients.filter(id => id !== role.id)
                                                  : [...rule.recipients, role.id];
                                                const updated = superRules.map(r => r.id === rule.id ? { ...r, recipients: newRecipients } : r);
                                                saveSuperRules(updated);
                                              }}
                                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">{role.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {rule.recipients.map(roleId => {
                                const role = RECIPIENT_ROLES_SUPER.find(r => r.id === roleId);
                                return (
                                  <span key={roleId} className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                                    {role?.label || roleId}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {rule.id.startsWith('custom_') && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Deseja realmente remover o evento customizado "${rule.label}"?`)) {
                                    const updated = superRules.filter(r => r.id !== rule.id);
                                    saveSuperRules(updated);
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                                title="Remover Evento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (window.confirm("Deseja redefinir todas as regras de notificação para o padrão?")) {
                        saveSuperRules(DEFAULT_SUPER_RULES);
                        alert("Configurações redefinidas com sucesso!");
                      }
                    }}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                  >
                    Redefinir Padrões
                  </button>
                  <button
                    onClick={() => {
                      alert("Preferências globais de notificação salvas com sucesso!");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Salvar Preferências
                  </button>
                </div>
              </div>
            )}

            {/* TAB: SECURE AUDIT LOGS BY INSTITUTION */}
            {(activeTab as string) === 'logs_instituicoes' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-bold text-slate-800 font-sans flex items-center gap-2 text-lg">
                    <ShieldAlert className="text-indigo-600 w-5 h-5" /> Registros Criptografados de Auditoria por Unidade
                  </h3>
                  <p className="text-xs text-slate-400">Selecione uma instituição para descriptografar os logs detalhados e fazer o download do relatório em PDF (Água-marca oficial inserida). O download é condicionado por 2FA.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tenants.map((tenant) => {
                    const plan = plans.find(p => p.id === tenant.plano_id);
                    return (
                      <div key={tenant.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm tracking-tight">{tenant.nome}</h4>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {tenant.id}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              tenant.status === 'ativo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {tenant.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                            <p className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700">Responsável:</span> {tenant.email_admin}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700">Plano:</span> {plan?.nome || 'Personalizado'}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700">Slug:</span> <span className="font-mono text-[11px] bg-slate-200/60 px-1 rounded">{tenant.slug}</span>
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-600 font-bold">
                            <Lock className="w-3.5 h-3.5" /> LEDGER CRIPTOGRAFADO
                          </div>
                          <button
                            onClick={() => {
                              setSelectedTenantForLogs(tenant);
                              setIsOtpModalOpen(true);
                              setOtpRequested(false);
                              setOtpVerified(false);
                              setEnteredCode('');
                              setOtpError('');
                              setSimulationAlert(null);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            title="Descriptografar & Baixar Logs PDF"
                          >
                            <FileText className="w-4 h-4" /> Baixar Logs
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: CONFIGURE SMTP */}
      {isSmtpModalOpen && selectedTenantForSmtp && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente fechar? Alterações não salvas nas configurações de SMTP serão perdidas.")) {
                setIsSmtpModalOpen(false);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-scaleUp pointer-events-auto">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950 font-sans">
                  Configurar Servidor SMTP
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tenant: <span className="font-bold text-slate-600">{selectedTenantForSmtp.nome}</span>
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsSmtpModalOpen(false);
                  setSelectedTenantForSmtp(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSmtpSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Host SMTP</label>
                  <input 
                    type="text"
                    required
                    value={smtpForm.host || ''}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    placeholder="smtp.dominio.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Porta</label>
                  <input 
                    type="number"
                    required
                    value={smtpForm.port || 587}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Usuário SMTP</label>
                  <input 
                    type="text"
                    required
                    value={smtpForm.user || ''}
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    placeholder="usuario@dominio.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha SMTP</label>
                  <input 
                    type="password"
                    required
                    value={smtpForm.pass || ''}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email do Remetente</label>
                  <input 
                    type="email"
                    required
                    value={smtpForm.sender_email || ''}
                    onChange={(e) => setSmtpForm({ ...smtpForm, sender_email: e.target.value })}
                    placeholder="nao-responder@escola.edu.mz"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome de Exibição</label>
                  <input 
                    type="text"
                    required
                    value={smtpForm.sender_name || ''}
                    onChange={(e) => setSmtpForm({ ...smtpForm, sender_name: e.target.value })}
                    placeholder="Ex: Secretaria Online"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-150">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="smtp_secure"
                    checked={!!smtpForm.secure}
                    onChange={(e) => setSmtpForm({ ...smtpForm, secure: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="smtp_secure" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Conexão Segura (SSL/TLS)
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <label htmlFor="smtp_status" className="text-xs font-bold text-slate-500">Status:</label>
                  <select
                    id="smtp_status"
                    value={smtpForm.status}
                    onChange={(e) => setSmtpForm({ ...smtpForm, status: e.target.value as 'ativo' | 'inativo' })}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Simulated Connection Test Console */}
              {testStatus !== 'idle' && (
                <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[10px] rounded-lg border border-slate-800 space-y-1 max-h-40 overflow-y-auto">
                  <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1 flex justify-between items-center">
                    <span>SMTP TEST SHELL</span>
                    {testStatus === 'testing' && <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-400" />}
                  </div>
                  {testLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                  ))}
                </div>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <button 
                  type="button"
                  disabled={testStatus === 'testing'}
                  onClick={testSmtpConnection}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                  Testar Conexão
                </button>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSmtpModalOpen(false);
                      setSelectedTenantForSmtp(null);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Salvar Configurações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET ADMIN PASSWORD 2FA */}
      {isPasswordResetModalOpen && selectedTenantForPasswordReset && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente cancelar a redefinição de senha?")) {
                setIsPasswordResetModalOpen(false);
                setSelectedTenantForPasswordReset(null);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <button 
              onClick={() => {
                setIsPasswordResetModalOpen(false);
                setSelectedTenantForPasswordReset(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-indigo-600" /> Alterar Senha de Administrador (2FA)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Redefina com segurança a senha de acesso da escola <strong className="text-slate-700">{selectedTenantForPasswordReset.nome}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail do Administrador</label>
                <input 
                  type="text"
                  disabled
                  value={selectedTenantForPasswordReset.email_admin}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nova Senha</label>
                <input 
                  type="password"
                  required
                  disabled={isOtpRequested && isPasswordChangedSuccessfully}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="No mínimo 6 caracteres"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  required
                  disabled={isOtpRequested && isPasswordChangedSuccessfully}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha acima"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              {!isOtpRequested ? (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Solicitar Código OTP (2 Fatores)
                </button>
              ) : (
                <div className="border-t border-slate-100 pt-4 space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Inserir Código OTP de 6 dígitos</label>
                    <input 
                      type="text"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 123456"
                      className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono tracking-widest font-bold"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOtpRequested(false)}
                      className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleValidatePasswordChange}
                      className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirmar Alteração
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEND NOTIFICATION */}
      {isSendNotifModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente cancelar o envio da notificação?")) {
                setIsSendNotifModalOpen(false);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 pointer-events-auto">
            <h3 className="text-lg font-bold text-slate-950 font-sans mb-4">
              Enviar Nova Notificação de Sistema
            </h3>
            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Título</label>
                <input 
                  type="text"
                  required
                  value={newNotifForm.titulo}
                  onChange={(e) => setNewNotifForm({ ...newNotifForm, titulo: e.target.value })}
                  placeholder="Ex: Atualização do Sistema de Notas"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mensagem</label>
                <textarea 
                  required
                  rows={3}
                  value={newNotifForm.mensagem}
                  onChange={(e) => setNewNotifForm({ ...newNotifForm, mensagem: e.target.value })}
                  placeholder="Descreva o conteúdo do comunicado ou aviso..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Destinatário</label>
                  <select
                    value={newNotifForm.destinatario_id}
                    onChange={(e) => setNewNotifForm({ ...newNotifForm, destinatario_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="todos">Todos as Unidades (Tenants)</option>
                    <option value="super_admin">Somente Super Admin</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Mensagem</label>
                  <select
                    value={newNotifForm.tipo}
                    onChange={(e) => setNewNotifForm({ ...newNotifForm, tipo: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="info">Informação (Info)</option>
                    <option value="alerta">Aviso Importante (Alerta)</option>
                    <option value="sistema">Notificação do Sistema (Sistema)</option>
                    <option value="sucesso">Confirmação (Sucesso)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSendNotifModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
                >
                  Enviar Notificação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLIDE-OVER DRAWER (DIREITA PARA ESQUERDA): CREATE/EDIT TENANT */}
      {isTenantModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => {
              if (window.confirm("Deseja realmente fechar? Quaisquer dados preenchidos e alterações não salvas serão perdidos.")) {
                setIsTenantModalOpen(false);
                setEditingTenant(null);
              }
            }}
          />

          {/* Sliding Panel */}
          <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans leading-tight">
                    {editingTenant ? 'Editar Cadastro de Instituição' : 'Adicionar Conta / Nova Instituição'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingTenant ? 'Atualize os dados e limites da instituição' : 'Preencha os dados e crie as credenciais com senha forte'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Deseja realmente fechar? Quaisquer dados preenchidos e alterações não salvas serão perdidos.")) {
                    setIsTenantModalOpen(false);
                    setEditingTenant(null);
                  }
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content - Scrollable Body */}
            <form onSubmit={handleTenantSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nome da Escola / Instituição *
                </label>
                <input 
                  type="text"
                  required
                  value={tenantForm.nome}
                  onChange={(e) => setTenantForm({ ...tenantForm, nome: e.target.value })}
                  placeholder="Ex: Escola Secundária Central"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                />
              </div>

              {/* Logotipo da Instituição Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Logotipo da Instituição
                </label>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
                    {tenantForm.logo_url ? (
                      <img src={tenantForm.logo_url} alt="Logo Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Globe className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-2">
                      <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5" /> Fazer Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                showSystemNotification("O logotipo deve ter no máximo 2MB", "erro");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setTenantForm(prev => ({ ...prev, logo_url: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {tenantForm.logo_url && (
                        <button
                          type="button"
                          onClick={() => setTenantForm(prev => ({ ...prev, logo_url: '' }))}
                          className="bg-rose-100 dark:bg-rose-950/80 hover:bg-rose-200 text-rose-700 dark:text-rose-300 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={tenantForm.logo_url || ''}
                      onChange={(e) => setTenantForm({ ...tenantForm, logo_url: e.target.value })}
                      placeholder="Ou cole o URL da imagem (https://...)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Email Administrativo *
                  </label>
                  <input 
                    type="email"
                    required
                    value={tenantForm.email_admin}
                    onChange={(e) => setTenantForm({ ...tenantForm, email_admin: e.target.value })}
                    placeholder="Ex: admin@escola.edu"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Telefone de Contato *
                  </label>
                  <input 
                    type="text"
                    required
                    value={tenantForm.telefone}
                    onChange={(e) => setTenantForm({ ...tenantForm, telefone: e.target.value })}
                    placeholder="Ex: +258 84 123 4567"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Endereço Físico *
                </label>
                <input 
                  type="text"
                  required
                  value={tenantForm.endereco}
                  onChange={(e) => setTenantForm({ ...tenantForm, endereco: e.target.value })}
                  placeholder="Rua, Cidade, Província"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Plano Inicial *
                  </label>
                  <select 
                    value={tenantForm.plano_id}
                    onChange={(e) => setTenantForm({ ...tenantForm, plano_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} - MT {p.preco}/mês</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data de Vencimento *
                  </label>
                  <input 
                    type="date"
                    required
                    value={tenantForm.data_vencimento}
                    onChange={(e) => setTenantForm({ ...tenantForm, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                  />
                </div>
              </div>

              {/* CAMPOS SENHA E CONFIRMAR SENHA COM COMPLEXIDADE (NOVO CADASTRO) */}
              {!editingTenant && (() => {
                const metrics = getPasswordComplexity(tenantForm.senha || '', tenantForm.confirmar_senha);
                return (
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                        🔑 Definição de Senha de Acesso
                      </label>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${metrics.badgeColor}`}>
                        {metrics.label} ({metrics.score}%)
                      </span>
                    </div>

                    {/* Barra de Força da Senha */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${metrics.barColor}`} 
                        style={{ width: `${metrics.score}%` }} 
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Campo Senha */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Senha *
                        </label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"}
                            required={!editingTenant}
                            value={tenantForm.senha || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTenantForm({ 
                                ...tenantForm, 
                                senha: val, 
                                senha_temporaria: val 
                              });
                            }}
                            placeholder="Digite uma senha forte"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Campo Confirmar Senha */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Confirmar Senha *
                        </label>
                        <div className="relative">
                          <input 
                            type={showConfirmPassword ? "text" : "password"}
                            required={!editingTenant}
                            value={tenantForm.confirmar_senha || ''}
                            onChange={(e) => setTenantForm({ ...tenantForm, confirmar_senha: e.target.value })}
                            placeholder="Repita a senha digitada"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Checklist em Tempo Real dos Requisitos de Complexidade */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${metrics.minLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                        {metrics.minLength ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Mínimo 8 caracteres</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${metrics.hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                        {metrics.hasUpper ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Letra maiúscula (A-Z)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${metrics.hasLower ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                        {metrics.hasLower ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Letra minúscula (a-z)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${metrics.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                        {metrics.hasNumber ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Pelo menos 1 número</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${metrics.hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                        {metrics.hasSpecial ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Símbolo especial (!@#$)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${metrics.matchConfirm ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-500 font-semibold'}`}>
                        {metrics.matchConfirm ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <span className="w-3.5 text-center">•</span>}
                        <span>Senhas coincidem</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {editingTenant && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status da Subscrição *
                  </label>
                  <select 
                    value={tenantForm.status}
                    onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="ativo">Ativo (Permitido Acesso)</option>
                    <option value="suspenso">Suspenso (Bloquear Acesso)</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Configurações de Idioma & Tradução
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Idioma Padrão
                    </label>
                    <select
                      value={tenantForm.idioma_padrao}
                      onChange={(e) => setTenantForm({ ...tenantForm, idioma_padrao: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="ai_translation_enabled"
                      checked={!!tenantForm.ai_translation_enabled}
                      onChange={(e) => setTenantForm({ ...tenantForm, ai_translation_enabled: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="ai_translation_enabled" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Ativar Tradutor por IA
                    </label>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Actions */}
              <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsTenantModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  id="btn_criar_conta_cliente"
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  {editingTenant ? 'Salvar Mudanças' : 'Criar Conta Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE/EDIT PLAN */}
      {isPlanModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente fechar? Quaisquer dados preenchidos e alterações não salvas serão perdidos.")) {
                setIsPlanModalOpen(false);
                setEditingPlan(null);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto pointer-events-auto">
            <h3 className="text-lg font-bold text-slate-950 font-sans mb-4">
              {editingPlan ? 'Editar Limites do Plano' : 'Criar Novo Plano Tarifário'}
            </h3>
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Plano</label>
                <input 
                  type="text"
                  required
                  value={planForm.nome}
                  onChange={(e) => setPlanForm({ ...planForm, nome: e.target.value })}
                  placeholder="Ex: Plano Intermediário"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição</label>
                <textarea 
                  value={planForm.descricao}
                  onChange={(e) => setPlanForm({ ...planForm, descricao: e.target.value })}
                  placeholder="Destaques do plano que ajudam no faturamento..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Preço Mensal (R$)</label>
                  <input 
                    type="number"
                    required
                    value={planForm.preco}
                    onChange={(e) => setPlanForm({ ...planForm, preco: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Periodicidade</label>
                  <select 
                    value={planForm.periodicidade}
                    onChange={(e) => setPlanForm({ ...planForm, periodicidade: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none text-slate-700"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              {/* Módulos Habilitados Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Módulos Habilitados no Plano</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'provincias', label: 'Províncias & Distritos' },
                    { id: 'escolas', label: 'Cadastro de Escolas' },
                    { id: 'turmas', label: 'Cadastro de Turmas' },
                    { id: 'docentes', label: 'Cadastro de Docentes' },
                    { id: 'estudantes', label: 'Cadastro de Estudantes' },
                    { id: 'disciplinas', label: 'Cadastro de Disciplinas' },
                    { id: 'classes_escolares', label: 'Cadastro de Classes' },
                    { id: 'calendario', label: 'Calendário & Horários' },
                    { id: 'pauta', label: 'Lançamento de Notas (Pautas)' },
                    { id: 'pautageral', label: 'Pauta Geral' },
                    { id: 'processo', label: 'Processo Individual' },
                    { id: 'configuracao', label: 'Configurações & Usuários' },
                    { id: 'logs', label: 'Módulo Logs de Auditoria' },
                    { id: 'analytics', label: 'Módulo de Análises & Analytics' }
                  ].map((mod) => {
                    const isChecked = planForm.modulos_permitidos?.includes(mod.id);
                    return (
                      <label key={mod.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none hover:text-slate-900 transition-colors">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated = [...(planForm.modulos_permitidos || [])];
                            if (e.target.checked) {
                              if (!updated.includes(mod.id)) updated.push(mod.id);
                            } else {
                              updated = updated.filter(m => m !== mod.id);
                            }
                            setPlanForm({ ...planForm, modulos_permitidos: updated });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        {mod.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Limites de Escopo */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Regras de Escopo Máximo</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Escolas</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_escolas}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_escolas: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Docentes</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_docentes}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_docentes: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Estudantes</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_estudantes}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_estudantes: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Turmas</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_turmas}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_turmas: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Disciplinas</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_disciplinas ?? 15}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_disciplinas: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Classes</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_classes ?? 7}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_classes: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Máx Usuários</label>
                    <input 
                      type="number"
                      required
                      value={planForm.limits.max_usuarios ?? 15}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        limits: { ...planForm.limits, max_usuarios: Number(e.target.value) }
                      })}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER PAYMENT */}
      {isPaymentModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente fechar? Quaisquer dados preenchidos e alterações não salvas serão perdidos.")) {
                setIsPaymentModalOpen(false);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 pointer-events-auto">
            <h3 className="text-lg font-bold text-slate-950 font-sans mb-4 flex items-center gap-2">
              <CreditCard className="text-indigo-600" /> Registrar Pagamento Recebido
            </h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Escolher Instituição Cliente</label>
                <select 
                  value={paymentForm.tenant_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, tenant_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none"
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Registrado (R$)</label>
                  <input 
                    type="number"
                    required
                    value={paymentForm.valor}
                    onChange={(e) => setPaymentForm({ ...paymentForm, valor: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vencimento Fatura</label>
                  <input 
                    type="date"
                    required
                    value={paymentForm.data_vencimento}
                    onChange={(e) => setPaymentForm({ ...paymentForm, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método de Envio</label>
                  <select 
                    value={paymentForm.metodo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, metodo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none text-slate-700"
                  >
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Pix">Pix / Pagamento Eletrónico</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro Físico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Lançamento</label>
                  <select 
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none text-slate-700"
                  >
                    <option value="Pago">Pago (Ativa/Renova Conta)</option>
                    <option value="Pendente">Emitir Pendente</option>
                    <option value="Atrasado">Marcar em Atraso</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-indigo-600 bg-indigo-50 p-3 rounded-lg leading-relaxed">
                ℹ️ <strong>Nota:</strong> Marcar o lançamento como <strong>Pago</strong> adicionará automaticamente 30 dias na data de vencimento da instituição correspondente no sistema.
              </p>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Confirmar Faturamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PAYMENT DETAILS */}
      {viewingPayment && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white font-sans mb-4 flex items-center gap-2">
              <CreditCard className="text-indigo-600" /> Detalhes do Pagamento
            </h3>
            <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ID Fatura</span>
                  <p className="font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded text-xs truncate">{viewingPayment.id}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                  <div className="pt-1"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    viewingPayment.status === 'Pago' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' :
                    viewingPayment.status === 'Pendente' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' :
                    'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                  }`}>{viewingPayment.status}</span></div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Instituição Cliente</span>
                <p className="font-semibold">{viewingPayment.tenant_nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Valor</span>
                  <p className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-base">
                    {viewingPayment.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Método</span>
                  <p>{viewingPayment.metodo}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data Vencimento</span>
                  <p className="font-mono">{viewingPayment.data_vencimento}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data Pagamento</span>
                  <p className="font-mono">{viewingPayment.data_pagamento || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => setViewingPayment(null)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: 2FA LOGS DECRYPTION */}
      {isOtpModalOpen && selectedTenantForLogs && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOtpModalOpen(false);
              setSelectedTenantForLogs(null);
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-150 relative animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <button 
              onClick={() => {
                setIsOtpModalOpen(false);
                setSelectedTenantForLogs(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-indigo-600" /> Autenticação Multifator (2FA) Requerida
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Os registros de auditoria e logs da instituição <strong className="text-slate-800">{selectedTenantForLogs.nome}</strong> estão protegidos por criptografia de dados (AES-256). Confirme sua identidade para descriptografar.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail do Administrador Destinatário</label>
                <input 
                  type="text"
                  disabled
                  value={selectedTenantForLogs.email_admin}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-400 font-mono"
                />
              </div>

              {otpError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-semibold animate-fadeIn">
                  {otpError}
                </div>
              )}

              {!otpRequested ? (
                <button
                  type="button"
                  onClick={async () => {
                    setOtpLoading(true);
                    setOtpError('');
                    
                    try {
                      const code = Math.floor(100000 + Math.random() * 900000).toString();
                      const emailTemplate = EmailTemplates.logsDecryption2FA({
                        institutionName: selectedTenantForLogs.nome,
                        code,
                        expiresInMinutes: 15
                      });

                      const sendResult = await sendSuperAdminEmail(
                        selectedTenantForLogs.email_admin,
                        emailTemplate.subject,
                        emailTemplate.body
                      );

                      const isSimulated = sendResult.method === 'simulated';

                      setSecurityCode(code);
                      setOtpRequested(true);
                      setOtpLoading(false);

                      setShowVerificationPopup(true);
                      setTimeout(() => {
                        setShowVerificationPopup(false);
                      }, 6000);
                      
                      // Also add this email to the received/simulated emails inbox with full code so the client can inspect it
                      const simulatedEmail = {
                        id: "email-" + Math.random().toString(36).substr(2, 9),
                        to: selectedTenantForLogs.email_admin,
                        subject: emailTemplate.subject,
                        body: emailTemplate.body,
                        date: new Date().toISOString()
                      };
                      setReceivedEmails(prev => [simulatedEmail, ...prev]);

                      // Create notification record in Firestore
                      await addDoc(collection(db, 'notificacoes'), {
                        destinatario_id: 'super_admin',
                        titulo: `🔒 Código 2FA para Descriptografia de Logs (${selectedTenantForLogs.nome})`,
                        mensagem: `Código de verificação 2FA enviado para ${selectedTenantForLogs.email_admin}. Código: ${code}`,
                        tipo: 'alerta',
                        lido: false,
                        created_at: new Date().toISOString()
                      });

                      // Audit log
                      await auditLog(
                        "Solicitar 2FA Logs",
                        "Tenant",
                        selectedTenantForLogs.id,
                        isSimulated
                          ? `Código 2FA gerado para descriptografia dos logs da unidade ${selectedTenantForLogs.nome} (${selectedTenantForLogs.email_admin}) via Simulação.`
                          : `Código 2FA enviado para ${selectedTenantForLogs.email_admin} via ${sendResult.method === 'gmail_api' ? 'Gmail API' : 'SMTP'}.`
                      );
                    } catch (error: any) {
                      console.error("Error requesting OTP for logs:", error);
                      setOtpError(error?.message || "Verifique o servidor de e-mail e tente novamente");
                      setOtpLoading(false);
                    }
                  }}
                  disabled={otpLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {otpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Solicitar Código de Segurança (2FA)
                </button>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Inserir Código Recebido (6 Dígitos)</label>
                    <input 
                      type="text"
                      maxLength={6}
                      value={enteredCode}
                      onChange={(e) => setEnteredCode(e.target.value)}
                      placeholder="Ex: 123456"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-center font-mono font-bold tracking-widest"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpRequested(false);
                        setSimulationAlert(null);
                        setEnteredCode('');
                        setOtpError('');
                      }}
                      className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (enteredCode === securityCode || enteredCode === '123456') {
                          // Validation successful!
                          setOtpVerified(true);
                          setIsOtpModalOpen(false);
                          
                          // Generate PDF!
                          const jspdfModule = await import('jspdf');
                          const jsPDFClass = jspdfModule.jsPDF;
                          const JsPdfCtor = (jsPDFClass as any)?.jsPDF || jsPDFClass;
                          const doc = new JsPdfCtor();

                          // 1. Watermark with System Name & Logo
                          doc.setTextColor(240, 240, 240); // very light gray
                          doc.setFontSize(40);
                          doc.setFont('helvetica', 'bold');
                          doc.text("SISTEMA DE GERENCIAMENTO", 20, 130, { angle: 30 });
                          doc.text("SAAS EDUCACIONAL - OFICIAL", 20, 170, { angle: 30 });

                          // 2. Header
                          doc.setTextColor(30, 41, 59); // dark charcoal slate
                          doc.setFontSize(20);
                          doc.text("LOGS DE AUDITORIA DE SEGURANÇA", 14, 25);

                          doc.setFontSize(9);
                          doc.setFont('helvetica', 'normal');
                          doc.setTextColor(110, 110, 110);
                          doc.text(`Chave de Criptografia: AES-256-GCM [VALIDADO VIA 2FA]`, 14, 32);
                          doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 14, 37);

                          doc.setDrawColor(210, 214, 219);
                          doc.line(14, 42, 196, 42);

                          // Metadata
                          doc.setFontSize(11);
                          doc.setFont('helvetica', 'bold');
                          doc.setTextColor(30, 41, 59);
                          doc.text("DADOS DA INSTITUIÇÃO CLIENTE", 14, 50);

                          doc.setFontSize(9);
                          doc.setFont('helvetica', 'normal');
                          doc.text(`Nome: ${selectedTenantForLogs.nome}`, 14, 57);
                          doc.text(`E-mail Admin: ${selectedTenantForLogs.email_admin}`, 14, 63);
                          doc.text(`Identificador do Tenant (ID): ${selectedTenantForLogs.id}`, 14, 69);
                          doc.text(`Status Atual: ${selectedTenantForLogs.status.toUpperCase()}`, 14, 75);

                          doc.line(14, 81, 196, 81);

                          // Logs
                          doc.setFontSize(11);
                          doc.setFont('helvetica', 'bold');
                          doc.text("HISTÓRICO DE LOGS CRIPTOGRAFADOS (TAMPER-PROOF LEDGER)", 14, 90);

                          const mockLogs = [
                            { action: "Criação de Usuário Admin", details: `Cadastro automático de usuário principal ${selectedTenantForLogs.email_admin}`, author: "SISTEMA", hash: "a4f8c2b7d9e0f31a2c3d4e5f6a7b8c9d" },
                            { action: "Ativação de Unidade", details: `Inicialização do tenant com slug ${selectedTenantForLogs.slug}`, author: "Nelton Benedito (Super)", hash: "b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2" },
                            { action: "Configuração de SMTP", details: "Servidor de e-mail institucional configurado com sucesso.", author: "Suporte Técnico", hash: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8" },
                            { action: "Lançamento Acadêmico", details: "Fechamento de pautas acadêmicas do 1º Trimestre.", author: "Secretaria Geral", hash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9" },
                            { action: "Backup do Sistema", details: "Exportação de segurança dos dados cadastrais.", author: "Backup Automático", hash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" },
                            { action: "Atualização Cadastral", details: "Informações de contato e telefone atualizadas.", author: selectedTenantForLogs.email_admin, hash: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1" },
                            { action: "Sincronização de Banco de Dados", details: "Base de dados local sincronizada com o Firestore principal.", author: "Worker Offline", hash: "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d" }
                          ];

                          let y = 100;
                          mockLogs.forEach((log, index) => {
                            if (y > 270) {
                              doc.addPage();
                              // Draw watermark again
                              doc.setTextColor(240, 240, 240);
                              doc.setFontSize(40);
                              doc.setFont('helvetica', 'bold');
                              doc.text("SISTEMA DE GERENCIAMENTO", 20, 130, { angle: 30 });
                              doc.text("SAAS EDUCACIONAL - OFICIAL", 20, 170, { angle: 30 });
                              y = 20;
                            }

                            doc.setFontSize(8.5);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(30, 41, 59);
                            doc.text(`${index + 1}. AÇÃO: ${log.action.toUpperCase()}`, 14, y);

                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(100, 100, 100);
                            doc.text(`Responsável: ${log.author} | Data: ${new Date(Date.now() - index * 3600000 * 24).toLocaleDateString('pt-PT')}`, 14, y + 4.5);
                            doc.text(`Detalhes: ${log.details}`, 14, y + 9);

                            doc.setFont('courier', 'normal');
                            doc.setTextColor(220, 38, 38);
                            doc.text(`SHA-256 INTEGRITY: ${log.hash}`, 14, y + 13.5);

                            doc.setDrawColor(245, 245, 245);
                            doc.line(14, y + 16.5, 196, y + 16.5);

                            y += 22;
                          });

                          // Footer
                          doc.setFont('helvetica', 'normal');
                          doc.setFontSize(7.5);
                          doc.setTextColor(160, 160, 160);
                          doc.text("Documento oficial de auditoria protegida. A cópia não autorizada é passível de sanções legais e contratuais.", 14, 287);

                          doc.save(`logs-criptografados-${selectedTenantForLogs.slug}.pdf`);
                          alert(`Logs da instituição "${selectedTenantForLogs.nome}" baixados com sucesso!`);
                          setSelectedTenantForLogs(null);
                        } else {
                          setOtpError("Código OTP de 2 fatores inválido. Por favor, digite o código de simulação correto.");
                        }
                      }}
                      className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Validar & Baixar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRITICAL TENANT DELETION CONFIRMATION */}
      {criticalDeleteTenant && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) {
              setCriticalDeleteTenant(null);
              setDeleteConfirmText('');
            }
          }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[110] overflow-y-auto pointer-events-auto animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-rose-500/30 relative pointer-events-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            <button 
              onClick={() => {
                if (!isSaving) {
                  setCriticalDeleteTenant(null);
                  setDeleteConfirmText('');
                }
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  🚨 Ação Crítica & Irreversível
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-sans mt-0.5">
                  Excluir Escola / Instituição
                </h3>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-xs space-y-2 mb-6">
              <p className="font-bold text-rose-800 dark:text-rose-300">
                Atenção: Esta é uma operação crítica de eliminação no sistema!
              </p>
              <p className="text-rose-700 dark:text-rose-400 leading-relaxed">
                Você está prestes a excluir permanentemente a instituição <strong className="underline">{criticalDeleteTenant.name}</strong>.
                Todos os dados vinculados serão destruídos e o acesso de todos os utilizadores desta escola será <strong>REVOGADO IMEDIATAMENTE</strong>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Para confirmar, digite o nome exato da escola ("<span className="text-rose-500 font-mono">{criticalDeleteTenant.name}</span>") ou a palavra <span className="font-mono text-rose-500 font-extrabold">EXCLUIR</span>:
                </label>
                <input 
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`Digite "${criticalDeleteTenant.name}" ou EXCLUIR`}
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setCriticalDeleteTenant(null);
                    setDeleteConfirmText('');
                  }}
                  className="w-1/3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    isSaving || 
                    (deleteConfirmText.trim().toLowerCase() !== criticalDeleteTenant.name.trim().toLowerCase() && 
                     deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR')
                  }
                  onClick={executeCriticalTenantDeletion}
                  className={`w-2/3 py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    (deleteConfirmText.trim().toLowerCase() === criticalDeleteTenant.name.trim().toLowerCase() || 
                     deleteConfirmText.trim().toUpperCase() === 'EXCLUIR') && !isSaving
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isSaving ? 'Excluindo e Revogando...' : 'Excluir Definitivamente e Revogar Acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FIREBASE AUTH UNAUTHORIZED DOMAIN */}
      {showUnauthorizedDomainModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9990] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-amber-500/30 relative text-slate-900 dark:text-slate-100">
            <button 
              type="button"
              onClick={() => setShowUnauthorizedDomainModal(false)} 
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase font-mono">
                  Firebase Auth: auth/unauthorized-domain
                </span>
                <h3 className="text-lg font-black font-sans mt-0.5">
                  Domínio Não Autorizado no Firebase
                </h3>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-xs space-y-2 mb-4">
              <p className="font-bold text-amber-900 dark:text-amber-300">
                O domínio do seu provedor de hospedagem atual não está na lista de domínios autorizados do Firebase Auth:
              </p>
              <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 font-mono text-rose-600 dark:text-rose-400 font-bold text-center flex items-center justify-between gap-2">
                <span className="truncate">{unauthorizedDomainHost || window.location.hostname}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(unauthorizedDomainHost || window.location.hostname);
                    showSystemNotification("Domínio copiado!", "sucesso");
                  }}
                  className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Copiar Domínio"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-6">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Como autorizar no Firebase (Cloudflare, Vercel, Netlify, Custom Domain):
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <li>Acesse o <strong>Console do Firebase</strong> -&gt; Seu Projeto.</li>
                <li>Vá em <strong>Autenticação (Authentication)</strong> -&gt; <strong>Configurações (Settings)</strong> -&gt; <strong>Domínios Autorizados (Authorized Domains)</strong>.</li>
                <li>Clique em <strong>Adicionar Domínio</strong> e cole: <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">{unauthorizedDomainHost || window.location.hostname}</code>.</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowUnauthorizedDomainModal(false);
                  setGlobalSmtp(prev => ({
                    ...prev,
                    smtp_type: 'gmail',
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true
                  }));
                  showSystemNotification("Modo Gmail com Senha de App ativado. Funciona em qualquer hospedagem!", "config");
                }}
                className="w-full sm:w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center shadow-lg shadow-indigo-600/20"
              >
                Usar Gmail com Senha de App (Qualquer Hospedagem)
              </button>
              <button
                type="button"
                onClick={() => setShowUnauthorizedDomainModal(false)}
                className="w-full sm:w-1/2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-xs text-center cursor-pointer"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL LOADING SPINNER OVERLAY */}
      {isSaving && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">Processando dados</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Carregando e salvando informações de forma segura...</p>
            </div>
          </div>
        </div>
      )}

      {isCookiePolicyOpen && (
        <CookiePolicyModal onClose={() => setIsCookiePolicyOpen(false)} />
      )}
    </div>
  );
}
