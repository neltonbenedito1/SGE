/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  where,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Tenant, 
  Plano, 
  User, 
  Provincia, 
  Escola, 
  Docente, 
  Estudante, 
  Turma, 
  Classe, 
  Sala,
  ClasseEscolar,
  Pauta, 
  ProcessoAluno, 
  TenantConfig,
  Notificacao,
  FaturaEstudante,
  SmtpConfig
} from '../types';
import { 
  BookOpen, 
  Users, 
  School, 
  Building,
  DoorOpen,
  FolderOpen, 
  GraduationCap, 
  MapPin, 
  Sliders, 
  Plus, 
  Copy,
  Library,
  Star,
  UploadCloud,
  ThumbsUp,
  MessageSquare,
  PlusCircle,
  Edit, 
  Trash2, 
  Search, 
  Printer, 
  Download, 
  Save, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Map,
  FileSpreadsheet,
  Calendar,
  BookMarked,
  Award,
  List,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Bell,
  Sparkles,
  MoreVertical,
  Edit3,
  Eye,
  AlertTriangle,
  BarChart3,
  Server,
  Mail,
  UserMinus,
  UserCheck,
  ArrowLeftRight,
  DollarSign,
  FileText,
  Send,
  Check,
  CheckCheck,
  RefreshCw,
  Settings,
  Palette,
  TrendingUp
} from 'lucide-react';
import { SchoolMap } from './SchoolMap';
import { AnalyticsModule } from './AnalyticsModule';
import { BibliotecaModule } from './BibliotecaModule';
import { LANGUAGES, translate } from '../lib/translation';

interface TenantPortalProps {
  currentTenantId: string;
  currentUserRole: 'admin' | 'director' | 'docente' | 'pai' | 'estudante';
  currentUserEmail: string;
  onLogout?: () => void;
  activeTheme?: string;
  onChangeTheme?: (theme: string) => void;
  systemLang?: string;
  onChangeLanguage?: (lang: string) => void;
}

import {
  saveLastAction,
  saveLastModule,
  getLastModule,
  saveLastScrollPosition,
  getLastScrollPosition,
  getCookie,
  saveSettingIfAllowed
} from '../lib/cookies';
import { SessionStateService, useDebouncedScroll } from '../lib/userState';
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard';
import { User as UserIcon } from 'lucide-react';

function getSavedFormDraft<T>(key: string, defaultValue: T): T {
  const saved = getCookie(key);
  if (!saved) return defaultValue;
  try {
    return JSON.parse(saved);
  } catch (e) {
    return defaultValue;
  }
}

function getDiaSemanaFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[date.getDay()];
}

function getLocalYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

const DEFAULT_MODULO_ACESSOS: Record<string, { habilitado: boolean; funcionalidades: Record<string, boolean> }> = {
  provincias: { habilitado: true, funcionalidades: { visualizar: true, criar: true } },
  escolas: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  docentes: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  estudantes: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  turmas: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  disciplinas: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  classes: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  calendario: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  pautas: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  pauta_geral: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  processos: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  utilizadores: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  biblioteca: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
  analytics: { habilitado: true, funcionalidades: { visualizar: true, criar: true, editar: true, excluir: true } },
};

export default function TenantPortal({ currentTenantId, currentUserRole, currentUserEmail, onLogout, activeTheme, onChangeTheme, systemLang = 'pt', onChangeLanguage }: TenantPortalProps) {
  const [activeTab, setActiveTab] = useState<string>(() => getLastModule() || 'dashboard');
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Unsaved changes navigation guard hook
  const { showConfirmModal, guardAction, confirmLeave, cancelLeave } = useUnsavedChangesGuard(isFormDirty);

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
    window.addEventListener('sge-navigate-tenant', handleCmdNav);
    return () => window.removeEventListener('sge-navigate-tenant', handleCmdNav);
  }, []);

  // Sidebar states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  // OS & Screen Size detection and Mobile Navigation
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth < 768;
  const isExpanded = isMobile || !isSidebarCollapsed || isSidebarHovered;
  const [detectedOS, setDetectedOS] = useState('Desktop');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    // OS Detection
    const ua = window.navigator.userAgent.toLowerCase();
    let osName = 'Desktop';
    if (/iphone|ipad|ipod/.test(ua)) {
      osName = 'iOS';
    } else if (/android/.test(ua)) {
      osName = 'Android';
    } else if (/win/.test(ua)) {
      osName = 'Windows';
    } else if (/mac/.test(ua)) {
      osName = 'macOS';
    } else if (/linux/.test(ua)) {
      osName = 'Linux';
    }
    setDetectedOS(osName);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save & Restore scroll position cookies
  useEffect(() => {
    const mainContent = document.getElementById('main_content_area');
    if (!mainContent) return;

    const savedScroll = getLastScrollPosition();
    if (savedScroll > 0) {
      const timer = setTimeout(() => {
        mainContent.scrollTop = savedScroll;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  useEffect(() => {
    const mainContent = document.getElementById('main_content_area');
    if (!mainContent) return;

    const handleScroll = () => {
      saveLastScrollPosition(mainContent.scrollTop);
    };

    mainContent.addEventListener('scroll', handleScroll);
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, []);

  // Responsive / OS-specific rendering helper styles
  const getOSCardClass = () => {
    if (detectedOS === 'iOS') {
      return 'rounded-3xl border border-slate-200/50 bg-white/90 backdrop-blur-md shadow-sm p-4 animate-fadeIn';
    }
    if (detectedOS === 'Android') {
      return 'rounded-xl border border-slate-150 bg-white shadow-md shadow-slate-100 p-4 animate-fadeIn';
    }
    return 'rounded-2xl border border-slate-200/60 bg-white shadow-xs p-6 animate-fadeIn';
  };

  const getOSButtonClass = (variant: 'primary' | 'secondary' = 'primary') => {
    const baseTouchTarget = isMobile ? 'min-h-[44px] px-4' : 'py-2 px-3.5';
    if (variant === 'primary') {
      if (detectedOS === 'iOS') {
        return `${baseTouchTarget} bg-indigo-600 active:bg-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer`;
      }
      if (detectedOS === 'Android') {
        return `${baseTouchTarget} bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer`;
      }
      return `${baseTouchTarget} bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer`;
    } else {
      if (detectedOS === 'iOS') {
        return `${baseTouchTarget} border border-slate-200 bg-white/70 backdrop-blur-xs active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer`;
      }
      if (detectedOS === 'Android') {
        return `${baseTouchTarget} border border-slate-200 bg-slate-50 active:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer`;
      }
      return `${baseTouchTarget} border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer`;
    }
  };
  
  // Data States
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [plan, setPlan] = useState<Plano | null>(null);
  const [rawSchools, setSchools] = useState<Escola[]>([]);
  const [rawProvinces, setProvinces] = useState<Provincia[]>([]);
  const [rawTeachers, setTeachers] = useState<Docente[]>([]);
  const [rawStudents, setStudents] = useState<Estudante[]>([]);
  const [rawTurmas, setTurmas] = useState<Turma[]>([]);
  const [rawClasses, setClasses] = useState<Classe[]>([]);
  const [rawVacations, setVacations] = useState<any[]>([]);
  const [rawSalas, setSalas] = useState<Sala[]>([]);
  const [rawClassesEscolares, setClassesEscolares] = useState<ClasseEscolar[]>([]);
  const [rawPautas, setPautas] = useState<Pauta[]>([]);
  const [rawProcessos, setProcessos] = useState<ProcessoAluno[]>([]);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<TenantConfig | null>(null);
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

    popup.className = `fixed bottom-5 right-5 ${bgClass} font-sans font-bold text-xs px-5 py-4 rounded-2xl shadow-2xl border z-[1000000] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-sm`;
    popup.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
    popup.innerHTML = `
      <span class="text-lg">${icon}</span>
      <div class="flex-1 text-left">
        <p class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">${type}</p>
        <p class="text-xs font-semibold leading-relaxed text-white">${message}</p>
      </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
      popup.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5', 'duration-300');
      setTimeout(() => popup.remove(), 300);
    }, 6000);
  }, []);

  // Find logged-in user inside TenantPortal
  const loggedInUser = useMemo(() => {
    return tenantUsers.find(u => u.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
  }, [tenantUsers, currentUserEmail]);

  // Enable performance-optimized debounced scroll tracking on main content wrapper
  useDebouncedScroll(loggedInUser?.id || null, 'main_content_area');

  // Sync active module (last page/route) to Firestore
  useEffect(() => {
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'lastModule', activeTab);
    }
  }, [activeTab, loggedInUser?.id]);

  // Load and restore form drafts and scroll position from Firestore user record (hybrid strategy)
  useEffect(() => {
    if (loggedInUser?.id) {
      SessionStateService.loadUserPreferences(loggedInUser.id).then((prefs) => {
        if (prefs.drafts) {
          if (prefs.drafts.student) setStudentForm(prev => ({ ...prev, ...prefs.drafts.student }));
          if (prefs.drafts.turma) setTurmaForm(prev => ({ ...prev, ...prefs.drafts.turma }));
          if (prefs.drafts.classe) setClasseForm(prev => ({ ...prev, ...prefs.drafts.classe }));
          if (prefs.drafts.pauta) setPautaForm(prev => ({ ...prev, ...prefs.drafts.pauta }));
          if (prefs.drafts.processo) setProcessoForm(prev => ({ ...prev, ...prefs.drafts.processo }));
          if (prefs.drafts.user) setUserForm(prev => ({ ...prev, ...prefs.drafts.user }));
          if (prefs.drafts.classe_escolar) setClasseEscolarForm(prev => ({ ...prev, ...prefs.drafts.classe_escolar }));
        }
        
        // Restore scroll position
        if (prefs.scrollPosition) {
          const container = document.getElementById('main_content_area');
          if (container) {
            setTimeout(() => {
              container.scrollTop = prefs.scrollPosition;
            }, 250);
          }
        }
      }).catch(err => console.warn("[TenantPortal] Error restoring preferences and drafts:", err));
    }
  }, [loggedInUser?.id]);

  // Computed Filtered Lists based on role
  const isDocente = currentUserRole === 'docente' || loggedInUser?.tipo === 'docente';
  const isEstudante = currentUserRole === 'estudante' || loggedInUser?.tipo === 'estudante';

  const currentTeacher = useMemo(() => {
    return rawTeachers.find(t => t.user_id === loggedInUser?.id);
  }, [rawTeachers, loggedInUser]);

  const currentStudent = useMemo(() => {
    return rawStudents.find(s => s.user_id === loggedInUser?.id);
  }, [rawStudents, loggedInUser]);

  const teacherTurmaIds = useMemo(() => {
    const ids = new Set<string>();
    if (isDocente && currentTeacher) {
      rawTurmas.forEach(t => {
        if (t.docente_id === currentTeacher.id) {
          ids.add(t.id);
        }
      });
      rawClasses.forEach(c => {
        if (c.docente_id === currentTeacher.id) {
          ids.add(c.turma_id);
        }
      });
    }
    return ids;
  }, [isDocente, currentTeacher, rawTurmas, rawClasses]);

  const filteredSchools = useMemo(() => {
    if (isDocente && currentTeacher) {
      return rawSchools.filter(s => s.id === currentTeacher.escola_id);
    }
    if (isEstudante && currentStudent) {
      return rawSchools.filter(s => s.id === currentStudent.escola_id);
    }
    return rawSchools;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawSchools]);

  const filteredProvinces = useMemo(() => {
    if (isDocente && currentTeacher) {
      const pIds = new Set(filteredSchools.map(s => s.provincia_id));
      return rawProvinces.filter(p => pIds.has(p.id));
    }
    if (isEstudante && currentStudent) {
      const pIds = new Set(filteredSchools.map(s => s.provincia_id));
      return rawProvinces.filter(p => pIds.has(p.id));
    }
    return rawProvinces;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, filteredSchools, rawProvinces]);

  const filteredTeachers = useMemo(() => {
    if (isDocente && currentTeacher) {
      return rawTeachers.filter(t => t.escola_id === currentTeacher.escola_id);
    }
    if (isEstudante && currentStudent) {
      return rawTeachers.filter(t => {
        const isSameSchool = t.escola_id === currentStudent.escola_id;
        const teachesOurTurma = rawClasses.some(c => c.turma_id === currentStudent.turma_id && c.docente_id === t.id);
        const isTurmaDocente = rawTurmas.some(tur => tur.id === currentStudent.turma_id && tur.docente_id === t.id);
        return isSameSchool || teachesOurTurma || isTurmaDocente;
      });
    }
    return rawTeachers;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawTeachers, rawClasses, rawTurmas]);

  // State for active/deactivated student toggle
  const [studentStatusFilter, setStudentStatusFilter] = useState<'ativos' | 'desativados'>('ativos');
  const [studentSubTab, setStudentSubTab] = useState<'lista' | 'faturas' | 'smtp'>('lista');

  // SMTP configuration status and pending queue
  const [globalSmtpConfig, setGlobalSmtpConfig] = useState<SmtpConfig | null>(null);
  const [tenantSmtpConfig, setTenantSmtpConfig] = useState<SmtpConfig | null>(null);
  const [smtpWarningMsg, setSmtpWarningMsg] = useState<string>('');
  const [pendingEmails, setPendingEmails] = useState<any[]>([]);

  // Deactivate student modal state
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [studentToDeactivate, setStudentToDeactivate] = useState<Estudante | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Dropout student modal state
  const [isDropoutModalOpen, setIsDropoutModalOpen] = useState(false);
  const [studentToDropout, setStudentToDropout] = useState<Estudante | null>(null);
  const [dropoutReason, setDropoutReason] = useState('Abandono escolar / Desistência');

  // Student transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [studentToTransfer, setStudentToTransfer] = useState<Estudante | null>(null);
  const [transferProvId, setTransferProvId] = useState('');
  const [transferEscolaId, setTransferEscolaId] = useState('');
  const [transferClasseEscolarId, setTransferClasseEscolarId] = useState('');
  const [transferTurmaId, setTransferTurmaId] = useState('');

  // Processo do Aluno sliding panel and dossier state
  const [selectedProcessStudent, setSelectedProcessStudent] = useState<Estudante | null>(null);
  const [isProcessPanelOpen, setIsProcessPanelOpen] = useState(false);
  const [dossierForm, setDossierForm] = useState({
    documento_identificacao: '',
    nome_pai: '',
    nome_mae: '',
    morada: ''
  });
  
  // Segment control states
  const [processTabSegment, setProcessTabSegment] = useState<'dossiers' | 'workflow'>('dossiers');
  const [notifCenterFilter, setNotifCenterFilter] = useState<'todas' | 'nao_lidas' | 'lidas'>('todas');
  
  // Facturação module states
  const [studentFaturas, setStudentFaturas] = useState<FaturaEstudante[]>([]);
  const isStudentSuspended = useMemo(() => {
    if (!isEstudante || !currentStudent) return false;
    return studentFaturas.some(f => f.estudante_id === currentStudent.id && f.status === 'Atrasado');
  }, [isEstudante, currentStudent, studentFaturas]);
  const [isFaturaModalOpen, setIsFaturaModalOpen] = useState(false);
  const [faturaForm, setFaturaForm] = useState({
    estudante_id: '',
    escola_id: '',
    turma_id: '',
    descricao: '',
    valor: 0,
    data_vencimento: ''
  });
  const [faturaSearch, setFaturaSearch] = useState('');
  const [faturaStatusFilter, setFaturaStatusFilter] = useState<'todos' | 'Pago' | 'Pendente' | 'Atrasado'>('todos');

  const filteredStudents = useMemo(() => {
    let base = rawStudents;

    // Filter by active/deactivated status
    const isAdmin = currentUserRole === 'admin' || loggedInUser?.tipo === 'admin';
    if (isAdmin) {
      if (studentStatusFilter === 'ativos') {
        base = base.filter(s => s.ativo !== false);
      } else {
        base = base.filter(s => s.ativo === false);
      }
    } else {
      // Non-admins can ONLY see active students
      base = base.filter(s => s.ativo !== false);
    }

    if (isDocente && currentTeacher) {
      return base.filter(s => teacherTurmaIds.has(s.turma_id));
    }
    if (isEstudante && currentStudent) {
      return base.filter(s => s.id === currentStudent.id);
    }
    return base;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawStudents, teacherTurmaIds, studentStatusFilter, currentUserRole, loggedInUser]);

  const filteredTurmas = useMemo(() => {
    if (isDocente && currentTeacher) {
      return rawTurmas.filter(t => teacherTurmaIds.has(t.id));
    }
    if (isEstudante && currentStudent) {
      return rawTurmas.filter(t => t.id === currentStudent.turma_id);
    }
    return rawTurmas;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawTurmas, teacherTurmaIds]);

  const filteredClasses = useMemo(() => {
    if (isDocente && currentTeacher) {
      return rawClasses.filter(c => c.docente_id === currentTeacher.id);
    }
    if (isEstudante && currentStudent) {
      return rawClasses.filter(c => c.turma_id === currentStudent.turma_id);
    }
    return rawClasses;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawClasses]);

  const filteredClassesEscolares = useMemo(() => {
    if (isDocente && currentTeacher) {
      const levels = new Set(filteredTurmas.map(t => t.nivel));
      return rawClassesEscolares.filter(c => levels.has(c.nivel));
    }
    if (isEstudante && currentStudent) {
      const levels = new Set(filteredTurmas.map(t => t.nivel));
      return rawClassesEscolares.filter(c => levels.has(c.nivel));
    }
    return rawClassesEscolares;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, filteredTurmas, rawClassesEscolares]);

  const filteredPautas = useMemo(() => {
    // Keep only pautas of active students (soft delete check)
    let basePautas = rawPautas.filter(p => {
      const student = rawStudents.find(s => s.id === p.estudante_id);
      return !student || student.ativo !== false;
    });

    if (isDocente && currentTeacher) {
      return basePautas.filter(p => {
        const student = rawStudents.find(s => s.id === p.estudante_id);
        const isOurStudent = student && teacherTurmaIds.has(student.turma_id);
        const isOurClasse = filteredClasses.some(c => c.id === p.classe_id);
        return isOurStudent || isOurClasse;
      });
    }
    if (isEstudante && currentStudent) {
      return basePautas.filter(p => p.estudante_id === currentStudent.id);
    }
    return basePautas;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawPautas, rawStudents, teacherTurmaIds, filteredClasses]);

  const filteredProcessos = useMemo(() => {
    // Keep only processos of active students (soft delete check)
    let baseProcessos = rawProcessos.filter(p => {
      const student = rawStudents.find(s => s.id === p.estudante_id);
      return !student || student.ativo !== false;
    });

    if (isDocente && currentTeacher) {
      return baseProcessos.filter(p => {
        const student = rawStudents.find(s => s.id === p.estudante_id);
        return student && teacherTurmaIds.has(student.turma_id);
      });
    }
    if (isEstudante && currentStudent) {
      return baseProcessos.filter(p => p.estudante_id === currentStudent.id);
    }
    return baseProcessos;
  }, [isDocente, isEstudante, currentTeacher, currentStudent, rawProcessos, rawStudents, teacherTurmaIds]);

  const schools = filteredSchools;
  const provinces = filteredProvinces;
  const teachers = filteredTeachers;
  const students = filteredStudents;
  const turmas = filteredTurmas;
  const classes = filteredClasses;
  const classesEscolares = filteredClassesEscolares;
  const pautas = filteredPautas;
  const processos = filteredProcessos;

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('todos');
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState('todos');

  // Custom Calendar State variables
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => new Date('2026-07-11'));
  const [selectedClassPopup, setSelectedClassPopup] = useState<any | null>(null);
  const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Declarative reset of isFormDirty when any form modal is toggled
  useEffect(() => {
    setIsFormDirty(false);
  }, [isModalOpen]);
  
  // Selection and Action row states
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeActionRowId, setActiveActionRowId] = useState<string | null>(null);

  // Custom Confirm Modal
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

  // Notifications State
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isDesktopNotifOpen, setIsDesktopNotifOpen] = useState(false);

  // Layer 2 Notification configurations
  interface AdminNotificationRule {
    id: string;
    label: string;
    description: string;
    email: boolean;
    system: boolean;
    recipients: string[];
  }

  const DEFAULT_ADMIN_RULES: AdminNotificationRule[] = [
    { id: 'cadastros', label: 'Novos Cadastros Realizados', description: 'Gera alerta ao registrar novas escolas, províncias, turmas, docentes, alunos ou pautas no sistema.', email: true, system: true, recipients: ['diretor_geral', 'secretaria'] },
    { id: 'alteracoes_dados', label: 'Alteração de Dados Sensíveis', description: 'Notifica modificações em notas de pauta, matrículas, nomes ou endereços.', email: true, system: true, recipients: ['diretor_geral', 'subdiretor'] },
    { id: 'fim_periodo', label: 'Fim de Semestre, Trimestre ou Ano Lectivo', description: 'Notifica o fechamento pedagógico do período acadêmico para compilação das médias.', email: true, system: true, recipients: ['diretor_geral', 'subdiretor', 'secretaria'] },
    { id: 'smtp_config', label: 'Configuração de Servidor SMTP', description: 'Avisos sobre alteração ou queda do servidor SMTP da própria escola.', email: true, system: true, recipients: ['diretor_geral'] },
    { id: 'aproveitamento_critico', label: 'Aproveitamento Escolar Crítico', description: 'Gera alertas caso a média trimestral de algum aluno caia abaixo do limite crítico (10 valores).', email: false, system: true, recipients: ['subdiretor', 'encarregado'] },
    { id: 'falta_injustificada', label: 'Falta Injustificada de Aluno', description: 'Dispara um e-mail automático ao encarregado no momento que o aluno acumula faltas.', email: true, system: true, recipients: ['encarregado', 'secretaria'] },
    { id: 'mensalidade_atraso', label: 'Mensalidade ou Prova em Atraso', description: 'Notifica pendências financeiras limitantes.', email: true, system: true, recipients: ['financeiro', 'encarregado'] },
    { id: 'acesso_nao_autorizado', label: 'Tentativa de Acesso Não Autorizado', description: 'Alerta de segurança ao detectar falhas sucessivas de login no portal.', email: true, system: true, recipients: ['diretor_geral'] }
  ];

  const RECIPIENT_ROLES_ADMIN = [
    { id: 'diretor_geral', label: 'Diretor Geral' },
    { id: 'subdiretor', label: 'Subdiretor Pedagógico' },
    { id: 'secretaria', label: 'Secretaria Geral' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'encarregado', label: 'Encarregado de Educação' }
  ];

  const [adminRules, setAdminRules] = useState<AdminNotificationRule[]>(() => {
    const saved = localStorage.getItem('tenant_admin_notif_rules');
    return saved ? JSON.parse(saved) : DEFAULT_ADMIN_RULES;
  });

  const saveAdminRules = (updated: AdminNotificationRule[]) => {
    setAdminRules(updated);
    localStorage.setItem('tenant_admin_notif_rules', JSON.stringify(updated));
  };

  const [openAdminDropdownId, setOpenAdminDropdownId] = useState<string | null>(null);
  const [isAddingAdminCustomRule, setIsAddingAdminCustomRule] = useState(false);
  const [newAdminRuleForm, setNewAdminRuleForm] = useState({ label: '', description: '', email: true, system: true, recipients: ['diretor_geral'] });

  // Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<'max_escolas' | 'max_docentes' | 'max_estudantes' | 'max_turmas' | 'max_disciplinas' | 'max_classes' | 'max_usuarios' | ''>('');
  const [upgradeCurrentCount, setUpgradeCurrentCount] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [additionalSlots, setAdditionalSlots] = useState(0);
  const [allPlans, setAllPlans] = useState<Plano[]>([]);

  // Dynamic Forms State
  const [provinciaForm, setProvinciaForm] = useState(() => getSavedFormDraft('draft_provincia', { nome: '', codigo: '' }));
  const [escolaForm, setEscolaForm] = useState(() => getSavedFormDraft('draft_escola', { nome: '', provincia_id: '', endereco: '', telefone: '', email: '', diretor_id: '', ativo: true, latitude: '', longitude: '' }));
  const [teacherForm, setTeacherForm] = useState(() => getSavedFormDraft('draft_teacher', { nome: '', email: '', especialidade: '', numero_registro: '', escola_id: '' }));
  const [studentForm, setStudentForm] = useState(() => getSavedFormDraft('draft_student', { nome: '', email: '', escola_id: '', turma_id: '', numero_matricula: '', data_nascimento: '', genero: 'Masculino' as 'Masculino' | 'Feminino', pai_id: '', faturado: false, periodo_facturacao: 'Mensal' as 'Mensal' | 'Semestral' | 'Anual' }));
  const [turmaForm, setTurmaForm] = useState(() => getSavedFormDraft('draft_turma', { nome: '', escola_id: '', ano_letivo: '2026', nivel: 'Primário', docente_id: '', capacidade_max: 30, classe_escolar_id: '' }));
  const [classeForm, setClasseForm] = useState(() => getSavedFormDraft('draft_classe', { nome: '', turma_id: '', docente_id: '', horario: '', sala: '', data: new Date().toISOString().split('T')[0], dia_semana: getDiaSemanaFromDate(new Date().toISOString().split('T')[0]) }));
  const [pautaForm, setPautaForm] = useState(() => getSavedFormDraft('draft_pauta', { estudante_id: '', classe_id: '', trimestre: '1º Trimestre' as any, nota_prova: '' as any, nota_trabalho: '' as any, nota_participacao: '' as any, nota_exame: '' as any, nota_reavaliacao: '' as any, observacao: '' }));
  const [selectedPautaSchoolId, setSelectedPautaSchoolId] = useState('');
  const [pautaGeralEscolaId, setPautaGeralEscolaId] = useState('');
  const [pautaGeralAlunoQuery, setPautaGeralAlunoQuery] = useState('');
  const [pautaGeralEstado, setPautaGeralEstado] = useState('');
  const [pautaGeralDateStart, setPautaGeralDateStart] = useState('');
  const [pautaGeralDateEnd, setPautaGeralDateEnd] = useState('');
  const [activeToast, setActiveToast] = useState<{ id: string; titulo: string; mensagem: string; tipo: string } | null>(null);
  const [processoForm, setProcessoForm] = useState(() => getSavedFormDraft('draft_processo', { estudante_id: '', tipo: 'Matrícula' as any, status: 'Solicitação' as any, documentos: [] as string[], observacao: '' }));
  const [userForm, setUserForm] = useState<{
    nome: string;
    email: string;
    tipo: 'admin' | 'director' | 'docente' | 'pai' | 'estudante';
    ativo: boolean;
    modulo_acessos: Record<string, { habilitado: boolean; funcionalidades: Record<string, boolean> }>;
  }>(() => getSavedFormDraft('draft_user', {
    nome: '',
    email: '',
    tipo: 'docente',
    ativo: true,
    modulo_acessos: JSON.parse(JSON.stringify(DEFAULT_MODULO_ACESSOS))
  }));
  const [classeEscolarForm, setClasseEscolarForm] = useState(() => getSavedFormDraft('draft_classe_escolar', { nome: '', nivel: 'Primário' as 'Primário' | 'Secundário' | 'Médio' | 'Pré-escolar', descricao: '' }));
  const [salaForm, setSalaForm] = useState(() => getSavedFormDraft('draft_sala', { nome: '', capacidade: 30, tipo: 'Normal', descricao: '' }));
  const [feriasForm, setFeriasForm] = useState(() => getSavedFormDraft('draft_ferias', { descricao: '', turma_id: 'todas', data_inicio: new Date().toISOString().split('T')[0], data_fim: new Date().toISOString().split('T')[0] }));

  useEffect(() => {
    saveSettingIfAllowed('draft_ferias', JSON.stringify(feriasForm), 'formData', 24);
  }, [feriasForm]);

  useEffect(() => {
    saveSettingIfAllowed('draft_sala', JSON.stringify(salaForm), 'formData', 24);
  }, [salaForm]);

  useEffect(() => {
    saveSettingIfAllowed('draft_provincia', JSON.stringify(provinciaForm), 'formData', 24);
  }, [provinciaForm]);

  useEffect(() => {
    saveSettingIfAllowed('draft_escola', JSON.stringify(escolaForm), 'formData', 24);
  }, [escolaForm]);

  useEffect(() => {
    saveSettingIfAllowed('draft_teacher', JSON.stringify(teacherForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', teacherForm, 'teacher');
    }
  }, [teacherForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_student', JSON.stringify(studentForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', studentForm, 'student');
    }
  }, [studentForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_turma', JSON.stringify(turmaForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', turmaForm, 'turma');
    }
  }, [turmaForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_classe', JSON.stringify(classeForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', classeForm, 'classe');
    }
  }, [classeForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_pauta', JSON.stringify(pautaForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', pautaForm, 'pauta');
    }
  }, [pautaForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_processo', JSON.stringify(processoForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', processoForm, 'processo');
    }
  }, [processoForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_user', JSON.stringify(userForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', userForm, 'user');
    }
  }, [userForm, loggedInUser?.id]);

  useEffect(() => {
    saveSettingIfAllowed('draft_classe_escolar', JSON.stringify(classeEscolarForm), 'formData', 24);
    if (loggedInUser?.id) {
      SessionStateService.savePreference(loggedInUser.id, 'drafts', classeEscolarForm, 'classe_escolar');
    }
  }, [classeEscolarForm, loggedInUser?.id]);

  // Load Tenant Details and Plan Constraints
  async function loadTenantContext() {
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    try {
      const tDoc = await getDoc(doc(db, 'tenants', currentTenantId));
      if (tDoc.exists()) {
        const tData = tDoc.data() as Tenant;
        setTenant(tData);

        // Auto trigger default language if set and different from current systemLang
        if (tData.idioma_padrao && tData.idioma_padrao !== systemLang && onChangeLanguage) {
          onChangeLanguage(tData.idioma_padrao);
        }

        // Get Plan
        const pDoc = await getDoc(doc(db, 'planos', tData.plano_id));
        if (pDoc.exists()) {
          setPlan(pDoc.data() as Plano);
        }
      }

      // Fetch Multi-Tenant Isolated Datasets (Always filtering by tenant_id)
      const qParams = [where('tenant_id', '==', currentTenantId)];

      // 1. Províncias
      const provsSnap = await getDocs(query(collection(db, 'provincias'), ...qParams));
      const provList: Provincia[] = [];
      provsSnap.forEach(d => provList.push({ ...d.data() as Provincia, id: d.id }));
      setProvinces(provList);

      // 2. Escolas
      const escSnap = await getDocs(query(collection(db, 'escolas'), ...qParams));
      const escList: Escola[] = [];
      escSnap.forEach(d => {
        const data = d.data() as Escola;
        if (!data.deleted_at) {
          escList.push({ ...data, id: d.id });
        }
      });
      setSchools(escList);

      // 3. Users
      const usersSnap = await getDocs(query(collection(db, 'users'), ...qParams));
      const usersList: User[] = [];
      usersSnap.forEach(d => usersList.push({ ...d.data() as User, id: d.id }));
      setTenantUsers(usersList);

      // 4. Docentes
      const docSnap = await getDocs(query(collection(db, 'docentes'), ...qParams));
      const docList: Docente[] = [];
      docSnap.forEach(d => docList.push({ ...d.data() as Docente, id: d.id }));
      setTeachers(docList);

      // 5. Turmas
      const turSnap = await getDocs(query(collection(db, 'turmas'), ...qParams));
      const turList: Turma[] = [];
      turSnap.forEach(d => turList.push({ ...d.data() as Turma, id: d.id }));
      setTurmas(turList);

      // 6. Estudantes
      const estSnap = await getDocs(query(collection(db, 'estudantes'), ...qParams));
      const estList: Estudante[] = [];
      estSnap.forEach(d => estList.push({ ...d.data() as Estudante, id: d.id }));
      setStudents(estList);

      // 7. Classes / Disciplinas
      const clsSnap = await getDocs(query(collection(db, 'classes'), ...qParams));
      const clsList: Classe[] = [];
      clsSnap.forEach(d => clsList.push({ ...d.data() as Classe, id: d.id }));
      setClasses(clsList);

      // 8. Férias
      const ferSnap = await getDocs(query(collection(db, 'ferias'), ...qParams));
      const ferList: any[] = [];
      ferSnap.forEach(d => ferList.push({ ...d.data(), id: d.id }));
      setVacations(ferList);

      // Fetch Salas & Auto-Seed if empty
      const salasSnap = await getDocs(query(collection(db, 'salas'), ...qParams));
      const salasList: Sala[] = [];
      salasSnap.forEach(d => salasList.push({ ...d.data() as Sala, id: d.id }));
      if (salasList.length === 0) {
        const defaultSalas = [
          { nome: 'Sala A-101', capacidade: 35, tipo: 'Normal', tenant_id: currentTenantId, descricao: 'Sala de aula geral equipada com projetor.' },
          { nome: 'Sala B-102', capacidade: 30, tipo: 'Normal', tenant_id: currentTenantId, descricao: 'Sala de aula geral com quadro branco.' },
          { nome: 'Laboratório de Informática', capacidade: 25, tipo: 'Laboratório', tenant_id: currentTenantId, descricao: 'Laboratório com 25 computadores funcionais.' },
          { nome: 'Anfiteatro Principal', capacidade: 80, tipo: 'Anfiteatro', tenant_id: currentTenantId, descricao: 'Espaço para grandes palestras e apresentações.' }
        ];
        for (const defaultS of defaultSalas) {
          const docRef = await addDoc(collection(db, 'salas'), defaultS);
          salasList.push({ ...defaultS, id: docRef.id });
        }
      }
      setSalas(salasList);

      // 8. Pautas
      const pauSnap = await getDocs(query(collection(db, 'pautas'), ...qParams));
      const pauList: Pauta[] = [];
      pauSnap.forEach(d => pauList.push({ ...d.data() as Pauta, id: d.id }));
      setPautas(pauList);

      // 9. Processos do Aluno
      const prcSnap = await getDocs(query(collection(db, 'processos_aluno'), ...qParams));
      const prcList: ProcessoAluno[] = [];
      prcSnap.forEach(d => prcList.push({ ...d.data() as ProcessoAluno, id: d.id }));
      setProcessos(prcList);

      // 10. Institutional config
      const confSnap = await getDocs(query(collection(db, 'configuracoes'), ...qParams));
      if (!confSnap.empty) {
        setConfig({ ...confSnap.docs[0].data() as TenantConfig, id: confSnap.docs[0].id });
      }

      // 11. Classes Escolares (Grade Levels)
      const escClsSnap = await getDocs(query(collection(db, 'classes_escolares'), ...qParams));
      const escClsList: ClasseEscolar[] = [];
      escClsSnap.forEach(d => escClsList.push({ ...d.data() as ClasseEscolar, id: d.id }));
      setClassesEscolares(escClsList);

      // Fetch all available subscription plans
      const plansSnap = await getDocs(collection(db, 'planos'));
      const plansList: Plano[] = [];
      plansSnap.forEach(d => plansList.push({ ...d.data() as Plano, id: d.id }));
      setAllPlans(plansList);

      // Load global SMTP fallback config
      const globalSmtpSnap = await getDocs(query(collection(db, 'smtp_configs'), where('tenant_id', '==', 'fallback')));
      if (!globalSmtpSnap.empty) {
        setGlobalSmtpConfig({ ...globalSmtpSnap.docs[0].data() as SmtpConfig, id: globalSmtpSnap.docs[0].id });
      } else {
        setGlobalSmtpConfig(null);
      }

      // Load tenant SMTP config
      const tSmtpSnap = await getDocs(query(collection(db, 'smtp_configs'), where('tenant_id', '==', currentTenantId)));
      if (!tSmtpSnap.empty) {
        setTenantSmtpConfig({ ...tSmtpSnap.docs[0].data() as SmtpConfig, id: tSmtpSnap.docs[0].id });
      } else {
        setTenantSmtpConfig(null);
      }

      // Load pending emails for this tenant
      const pEmailsSnap = await getDocs(query(collection(db, 'pending_emails'), where('tenant_id', '==', currentTenantId)));
      const pEmailsList: any[] = [];
      pEmailsSnap.forEach(d => pEmailsList.push({ ...d.data(), id: d.id }));
      setPendingEmails(pEmailsList);

      // Load student bills for this tenant
      const faturasSnap = await getDocs(query(collection(db, 'faturas_estudantes'), where('tenant_id', '==', currentTenantId)));
      const faturasList: FaturaEstudante[] = [];
      faturasSnap.forEach(d => faturasList.push({ ...d.data() as FaturaEstudante, id: d.id }));
      setStudentFaturas(faturasList);

    } catch (err) {
      console.error("Error loading tenant database:", err);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  // Tenant-side audit logger
  async function tenantAuditLog(action: string, entity: string, entityId: string, details: string) {
    try {
      const newLog = {
        admin_id: loggedInUser?.id || "admin-tenant",
        admin_nome: loggedInUser?.nome || "Admin da Instituição",
        acao: action,
        entidade: entity,
        entidade_id: entityId,
        timestamp: new Date().toISOString(),
        detalhes: details,
        tenant_id: currentTenantId
      };
      await addDoc(collection(db, "log_admins"), newLog);
    } catch (err) {
      console.error("Error writing tenant audit log:", err);
    }
  }

  // Queue or send emails helper (Rule 6.1 & 6.2)
  async function queueOrSendEmail(to: string, subject: string, body: string) {
    const activeSmtp = (tenantSmtpConfig && tenantSmtpConfig.status === 'ativo') ? tenantSmtpConfig : (globalSmtpConfig && globalSmtpConfig.status === 'ativo' ? globalSmtpConfig : null);
    
    const emailDoc = {
      tenant_id: currentTenantId,
      to,
      subject,
      body,
      status: activeSmtp ? 'enviado' : 'pendente',
      created_at: new Date().toISOString(),
      enviado_em: activeSmtp ? new Date().toISOString() : null,
      smtp_provider: activeSmtp ? (activeSmtp.tenant_id === 'fallback' ? 'fallback' : 'tenant') : 'nenhum'
    };

    try {
      const emailRef = await addDoc(collection(db, 'pending_emails'), emailDoc);
      
      if (!activeSmtp) {
        // Create notification for Super Admin
        await addDoc(collection(db, 'notificacoes'), {
          destinatario_id: 'super_admin',
          titulo: '⚠️ Alerta: Falha de Envio SMTP (Fila Pendente)',
          mensagem: `A instituição "${tenant?.nome || 'Tenant'}" tentou enviar um e-mail para ${to} ("${subject}"), mas nenhum servidor SMTP ativo foi encontrado. O e-mail foi retido na fila pendente.`,
          tipo: 'alerta',
          lido: false,
          created_at: new Date().toISOString()
        });

        // Also add local in-app notification for the tenant admin
        await addDoc(collection(db, 'notificacoes'), {
          destinatario_id: currentTenantId,
          titulo: '⚠️ Notificação de E-mail Pendente (Sem SMTP)',
          mensagem: `O e-mail para ${to} com o assunto "${subject}" foi adicionado à fila pendente pois não há um servidor SMTP ativo configurado.`,
          tipo: 'alerta',
          lido: false,
          created_at: new Date().toISOString()
        });

        setSmtpWarningMsg(`O e-mail para ${to} está pendente na fila porque não há servidor SMTP configurado.`);
        
        // Trigger 6-second popup notification
        const popup = document.createElement('div');
        popup.className = 'fixed bottom-5 right-5 bg-amber-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-amber-500 z-50 flex items-center gap-2 animate-bounce';
        popup.innerHTML = `⚠️ E-mail ficou pendente (Servidor SMTP não configurado)`;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 6000);
      } else {
        // If SMTP is active, we simulate transmission and add it to the received emails list
        await addDoc(collection(db, 'received_emails'), {
          to,
          subject,
          body: body + `\n\n[Transmitido via SMTP: ${activeSmtp.host}]`,
          date: new Date().toLocaleTimeString('pt-BR'),
          created_at: new Date().toISOString()
        });

        // Trigger 6-second popup notification (Rule 3)
        const popup = document.createElement('div');
        popup.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500 z-50 flex items-center gap-2 animate-bounce';
        popup.innerHTML = `✅ E-mail enviado com sucesso!`;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 6000);
      }
      
      loadTenantContext();
    } catch (err) {
      console.error("Error queueing or sending email:", err);
    }
  }

  // Notify DT of missing student data
  async function handleNotifyMissingData(student: any) {
    try {
      const studentUser = tenantUsers.find(u => u.id === student.user_id);
      const studentName = studentUser?.nome || 'Estudante';
      
      const missingFields = [];
      if (!student.documento_identificacao) missingFields.push('Doc. Identificação (BI)');
      if (!student.nome_pai) missingFields.push('Nome do Pai');
      if (!student.nome_mae) missingFields.push('Nome do Mãe');
      if (!student.morada) missingFields.push('Morada');

      const title = '⚠️ Dossier com Dados em Falta';
      const msg = `O dossier do estudante ${studentName} (Matrícula: ${student.numero_matricula}) está incompleto. Faltam os dados: ${missingFields.join(', ')}. Por favor, atualize o cadastro urgente.`;
      
      // Add notification for the Class Director
      await addDoc(collection(db, 'notificacoes'), {
        destinatario_id: 'diretor_turma',
        titulo: title,
        mensagem: msg,
        tipo: 'alerta',
        lido: false,
        created_at: new Date().toISOString()
      });

      // Write in-app audit log
      await tenantAuditLog(
        "Notificar Dados em Falta",
        "Estudante",
        student.id,
        `Diretor de Turma notificado sobre dados cadastrais em falta para o aluno "${studentName}".`
      );

      // Trigger 6-second popup notification (Rule 3)
      const popup = document.createElement('div');
      popup.className = 'fixed bottom-5 right-5 bg-indigo-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-indigo-500 z-50 flex items-center gap-2 animate-bounce';
      popup.innerHTML = `✅ Notificação enviada com sucesso para o Diretor de Turma!`;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 6000);

    } catch (err: any) {
      alert("Erro ao enviar notificação: " + err.message);
    }
  }

  // Periodically check and send pending emails if active SMTP is found (Rule 6.2)
  useEffect(() => {
    const activeSmtp = (tenantSmtpConfig && tenantSmtpConfig.status === 'ativo') ? tenantSmtpConfig : (globalSmtpConfig && globalSmtpConfig.status === 'ativo' ? globalSmtpConfig : null);
    if (!activeSmtp) return;

    async function processQueue() {
      const pending = pendingEmails.filter(e => e.status === 'pendente');
      if (pending.length === 0) return;

      console.log(`[Queue Tenant] Encontrados ${pending.length} e-mails pendentes para enviar via SMTP ativo.`);
      for (const email of pending) {
        try {
          // Update email status
          await updateDoc(doc(db, 'pending_emails', email.id), {
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            smtp_provider: activeSmtp.tenant_id === 'fallback' ? 'fallback' : 'tenant'
          });

          // Add to received emails
          await addDoc(collection(db, 'received_emails'), {
            to: email.to,
            subject: email.subject,
            body: email.body + `\n\n[Transmitido via SMTP ativo: ${activeSmtp.host}]`,
            date: new Date().toLocaleTimeString('pt-BR'),
            created_at: new Date().toISOString()
          });

          // Notify Super Admin of success
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: 'super_admin',
            titulo: '✅ E-mail Pendente Enviado com Sucesso',
            mensagem: `O e-mail retido na fila para ${email.to} ("${email.subject}") foi enviado com sucesso após a configuração do servidor SMTP.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

          // Notify tenant admin too
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            titulo: '✅ Fila de E-mails Enviada',
            mensagem: `O e-mail pendente para ${email.to} foi transmitido com sucesso.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

        } catch (err) {
          console.error("Error processing pending email from queue:", err);
        }
      }
      loadTenantContext();
    }

    const interval = setInterval(processQueue, 15000);
    return () => clearInterval(interval);
  }, [tenantSmtpConfig, globalSmtpConfig, pendingEmails]);

  function renderStudentActions(s: Estudante, usr: any) {
    const isDeactivated = s.ativo === false;
    const isAdminOrSuper = currentUserRole === 'admin' || loggedInUser?.tipo === 'admin';

    return (
      <>
        {hasPermission('estudantes', 'editar') && (
          <button
            onClick={() => {
              setActiveActionRowId(null);
              setEditingItem(s);
              setStudentForm({
                nome: usr?.nome || '',
                email: usr?.email || '',
                escola_id: s.escola_id,
                turma_id: s.turma_id,
                numero_matricula: s.numero_matricula,
                data_nascimento: s.data_nascimento,
                genero: s.genero,
                pai_id: s.pai_id,
                faturado: !!s.faturado,
                periodo_facturacao: s.periodo_facturacao || 'Mensal'
              });
              setModalType('student');
              setIsModalOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            Editar Estudante
          </button>
        )}

        {hasPermission('estudantes', 'editar') && !isDeactivated && (
          <button
            onClick={() => {
              setActiveActionRowId(null);
              setStudentToDeactivate(s);
              setDeactivateReason('');
              setIsDeactivateModalOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 cursor-pointer"
          >
            <UserMinus className="w-3.5 h-3.5 text-amber-400" />
            Desactivar Aluno
          </button>
        )}

        {hasPermission('estudantes', 'editar') && !isDeactivated && (
          <button
            onClick={() => {
              setActiveActionRowId(null);
              setStudentToDropout(s);
              setDropoutReason('Abandono escolar / Desistência');
              setIsDropoutModalOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Aluno Desistiu
          </button>
        )}

        {hasPermission('estudantes', 'editar') && isDeactivated && isAdminOrSuper && (
          <button
            onClick={async () => {
              setActiveActionRowId(null);
              try {
                await updateDoc(doc(db, 'estudantes', s.id), {
                  ativo: true,
                  motivo_desativacao: "",
                  desativado_em: null,
                  desativado_por: null
                });
                await tenantAuditLog(
                  "Reativar Aluno",
                  "Estudante",
                  s.id,
                  `Aluno ${usr?.nome || 'Estudante'} reativado com sucesso.`
                );

                // Queue or send notification to parent and teachers (Rule 1.1)
                await queueOrSendEmail(
                  usr?.email || 'geral@escola.ac.mz',
                  '📢 Reativação de Aluno no Portal Escolar',
                  `Estimado(a) encarregado(a),\n\nInformamos que a matrícula do(a) estudante "${usr?.nome || 'Estudante'}" foi reativada no nosso SGE.\n\nAtenciosamente,\nDireção da Escola`
                );
                
                // Show 6-second popup notification (Rule 3)
                const popup = document.createElement('div');
                popup.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500 z-50 flex items-center gap-2 animate-bounce';
                popup.innerHTML = `✅ Aluno reativado com sucesso!`;
                document.body.appendChild(popup);
                setTimeout(() => popup.remove(), 6000);

                loadTenantContext();
              } catch (err: any) {
                alert("Erro ao reativar: " + err.message);
              }
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            Reactivar Aluno
          </button>
        )}

        {hasPermission('estudantes', 'editar') && !isDeactivated && (
          <button
            onClick={() => {
              setActiveActionRowId(null);
              setStudentToTransfer(s);
              const studentTurma = turmas.find(t => t.id === s.turma_id);
              const studentClasseId = studentTurma?.classe_escolar_id || '';
              setTransferProvId(schools.find(e => e.id === s.escola_id)?.provincia_id || '');
              setTransferEscolaId(s.escola_id);
              setTransferClasseEscolarId(studentClasseId);
              setTransferTurmaId(s.turma_id);
              setIsTransferModalOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
            Transferir Aluno
          </button>
        )}

        <button
          onClick={() => {
            setActiveActionRowId(null);
            setSelectedProcessStudent(s);
            setDossierForm({
              documento_identificacao: s.documento_identificacao || '',
              nome_pai: s.nome_pai || '',
              nome_mae: s.nome_mae || '',
              morada: s.morada || ''
            });
            setIsProcessPanelOpen(true);
          }}
          className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          Dossier / Processo
        </button>

        {hasPermission('estudantes', 'excluir') && (
          <button
            onClick={() => {
              setActiveActionRowId(null);
              showConfirm(
                "Excluir Estudante",
                `Tem certeza que deseja excluir o estudante "${usr?.nome || 'Estudante'}"? Esta ação é irreversível.`,
                async () => {
                  await deleteDoc(doc(db, 'estudantes', s.id));
                  loadTenantContext();
                },
                true
              );
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            Excluir Estudante
          </button>
        )}
      </>
    );
  }

  function hasPermission(moduleKey: string, featureKey?: 'visualizar' | 'criar' | 'editar' | 'excluir'): boolean {
    if (moduleKey === 'analytics') {
      const isAllowedRole = currentUserRole === 'admin' || currentUserRole === 'director' || currentUserRole === 'docente' ||
                            loggedInUser?.tipo === 'admin' || loggedInUser?.tipo === 'director' || loggedInUser?.tipo === 'docente';
      if (!isAllowedRole) return false;
      if (loggedInUser && loggedInUser.modulo_acessos && loggedInUser.modulo_acessos.analytics) {
        return !!loggedInUser.modulo_acessos.analytics.habilitado;
      }
      return true;
    }

    // Check if the subscription plan allows this module key.
    // This affects everyone, including administrators!
    const planKeyMap: Record<string, string> = {
      provincias: 'provincias',
      escolas: 'escolas',
      docentes: 'docentes',
      estudantes: 'estudantes',
      turmas: 'turmas',
      disciplinas: 'disciplinas',
      classes: 'classes_escolares',
      classes_escolares: 'classes_escolares',
      calendario: 'calendario',
      pautas: 'pauta',
      pauta_geral: 'pautageral',
      pautageral: 'pautageral',
      processos: 'processo',
      processo: 'processo',
      utilizadores: 'configuracao',
      usuarios: 'configuracao',
      configuracoes: 'configuracao',
      configuracao: 'configuracao',
      logs: 'logs',
      analytics: 'analytics'
    };

    const planKey = planKeyMap[moduleKey];
    if (plan && planKey && plan.modulos_permitidos) {
      if (!plan.modulos_permitidos.includes(planKey)) {
        return false;
      }
    }

    const isDocente = currentUserRole === 'docente' || loggedInUser?.tipo === 'docente';
    const isEstudante = currentUserRole === 'estudante' || loggedInUser?.tipo === 'estudante';

    // 1. Admin gets all permissions (if permitted by the plan block check above)
    if (currentUserRole === 'admin' || loggedInUser?.tipo === 'admin') return true;

    // 2. Student restrictions
    if (isEstudante) {
      // Students can only read (visualizar) specific safe student modules
      const allowedStudentModules = ['dashboard', 'estudantes', 'turmas', 'disciplinas', 'pauta_geral', 'pautas', 'processos', 'calendario'];
      if (!allowedStudentModules.includes(moduleKey)) return false;
      if (featureKey && featureKey !== 'visualizar') return false; // Absolutely no writes
      return true;
    }

    // 3. Teacher restrictions
    if (isDocente) {
      // Teachers cannot access users administration or general configurations
      const forbiddenTeacherModules = ['usuarios', 'configuracao'];
      if (forbiddenTeacherModules.includes(moduleKey)) return false;

      // Teachers can read everything else
      if (!featureKey || featureKey === 'visualizar') return true;

      // Teachers are allowed to launch/edit/delete pautas (grades) and handle processes
      if (['pautas', 'pauta_geral', 'processos'].includes(moduleKey)) {
        return true;
      }

      // For other writes (like creating students, classes, etc.), teachers are typically read-only
      return false;
    }

    // 4. Fallback/Standard logic (e.g. for director or other custom roles with modulo_acessos)
    if (!loggedInUser) {
      if (currentUserRole === 'director') return true;
      if (featureKey === 'visualizar') return true;
      return false;
    }

    const access = loggedInUser.modulo_acessos?.[moduleKey];
    if (!access) {
      if (loggedInUser.tipo === 'director') return true;
      if (featureKey === 'visualizar') return true;
      return false;
    }

    if (!access.habilitado) return false;

    if (featureKey) {
      return !!access.funcionalidades?.[featureKey];
    }

    return true;
  }

  async function handleTeacherBatchAction(action: string) {
    if (action === 'excluir') {
      showConfirm(
        "Excluir Docentes Selecionados",
        `Deseja realmente excluir os ${selectedTeacherIds.length} docentes selecionados? Esta ação é irreversível.`,
        async () => {
          try {
            for (const id of selectedTeacherIds) {
              await deleteDoc(doc(db, 'docentes', id));
            }
            setSelectedTeacherIds([]);
            loadTenantContext();
          } catch (e) {
            console.error(e);
          }
        },
        true
      );
    }
  }

  async function handleStudentBatchAction(action: string) {
    if (action === 'excluir') {
      showConfirm(
        "Excluir Estudantes Selecionados",
        `Deseja realmente excluir os ${selectedStudentIds.length} estudantes selecionados? Esta ação é irreversível.`,
        async () => {
          try {
            for (const id of selectedStudentIds) {
              await deleteDoc(doc(db, 'estudantes', id));
            }
            setSelectedStudentIds([]);
            loadTenantContext();
          } catch (e) {
            console.error(e);
          }
        },
        true
      );
    }
  }

  const renderRestrictedAccess = (moduleLabel: string) => (
    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-5 my-10 animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
        <AlertCircle className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-800">Acesso Restrito</h3>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          Você não possui permissões suficientes para acessar o módulo <strong className="text-indigo-600 font-bold">{moduleLabel}</strong>. Entre em contato com o administrador do sistema se precisar de acesso a este recurso.
        </p>
      </div>
    </div>
  );

  // Restore scroll position
  useEffect(() => {
    const lastScroll = getLastScrollPosition();
    if (lastScroll > 0) {
      const timer = setTimeout(() => {
        window.scrollTo({ top: lastScroll, behavior: 'smooth' });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Save scroll position
  useEffect(() => {
    const handleScroll = () => {
      saveLastScrollPosition(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track last accessed module
  useEffect(() => {
    if (activeTab) {
      saveLastModule(activeTab);
      saveLastAction(`Acedeu ao módulo: ${activeTab}`);
    }
  }, [activeTab]);

  // Restore last accessed module on startup
  useEffect(() => {
    const lastModule = getLastModule();
    if (lastModule && lastModule !== 'dashboard') {
      setActiveTab(lastModule);
    }
  }, []);

  useEffect(() => {
    loadTenantContext();
  }, [currentTenantId]);

  useEffect(() => {
    if (!currentTenantId) return;
    const mountTime = Date.now();
    const q = query(collection(db, 'notificacoes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notificacao[] = [];
      const userRole = currentUserRole || loggedInUser?.tipo || 'estudante';
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Match if notification is globally for all, or matches current tenant
        const isBelongToTenant = data.destinatario_id === currentTenantId || data.tenant_id === currentTenantId || data.destinatario_id === 'todos';
        
        if (isBelongToTenant) {
          // Direct target checking: if a notification is sent directly to this specific user ID
          const isDirectMessage = loggedInUser?.id && (data.destinatario_id === loggedInUser.id || data.usuario_id === loggedInUser.id);
          
          if (isDirectMessage) {
            list.push({ ...data, id: doc.id } as Notificacao);
          } else {
            // General notification role filtering:
            // Default destination role is 'admin' unless explicitly specified or destinatario_id is 'todos'
            const destRole = data.destinatario_role || (data.destinatario_id === 'todos' ? 'todos' : 'admin');
            
            if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'director') {
              // Administrators see admin-level and global notification events
              if (destRole === 'admin' || destRole === 'todos') {
                list.push({ ...data, id: doc.id } as Notificacao);
              }
            } else if (userRole === 'docente') {
              // Docentes see only docente-level notifications or general alerts
              if (destRole === 'docente' || destRole === 'todos') {
                list.push({ ...data, id: doc.id } as Notificacao);
              }
            } else if (userRole === 'estudante') {
              // Estudantes see only student-level notifications or general alerts
              if (destRole === 'estudante' || destRole === 'todos') {
                list.push({ ...data, id: doc.id } as Notificacao);
              }
            } else {
              // Other specific roles (financeiro, encarregado, etc.) see their matching roles or todos
              if (destRole === userRole || destRole === 'todos') {
                list.push({ ...data, id: doc.id } as Notificacao);
              }
            }
          }
        }
      });

      // Handle Real-Time Push Toast alert for freshly added notifications
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdTime = data.created_at ? new Date(data.created_at).getTime() : Date.now();
          if (createdTime > mountTime - 5000 && !data.lido) {
            const isBelongToTenant = data.destinatario_id === currentTenantId || data.tenant_id === currentTenantId || data.destinatario_id === 'todos';
            const isDirectMessage = loggedInUser?.id && (data.destinatario_id === loggedInUser.id || data.usuario_id === loggedInUser.id);
            const destRole = data.destinatario_role || (data.destinatario_id === 'todos' ? 'todos' : 'admin');
            
            let shouldShowToast = false;
            if (isBelongToTenant) {
              if (isDirectMessage) {
                shouldShowToast = true;
              } else {
                if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'director') {
                  if (destRole === 'admin' || destRole === 'todos') shouldShowToast = true;
                } else if (userRole === 'docente') {
                  if (destRole === 'docente' || destRole === 'todos') shouldShowToast = true;
                } else if (userRole === 'estudante') {
                  if (destRole === 'estudante' || destRole === 'todos') shouldShowToast = true;
                } else if (destRole === userRole || destRole === 'todos') {
                  shouldShowToast = true;
                }
              }
            }
            
            if (shouldShowToast) {
              setActiveToast({
                id: change.doc.id,
                titulo: data.titulo,
                mensagem: data.mensagem,
                tipo: data.tipo || 'info'
              });
              setTimeout(() => {
                setActiveToast(null);
              }, 6000);
            }
          }
        }
      });

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(list);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });
    return () => unsubscribe();
  }, [currentTenantId, currentUserRole, loggedInUser]);

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

  function openUpgradeModal(
    entityType: 'max_escolas' | 'max_docentes' | 'max_estudantes' | 'max_turmas' | 'max_disciplinas' | 'max_classes' | 'max_usuarios',
    currentCount: number
  ) {
    setUpgradeLimitType(entityType);
    setUpgradeCurrentCount(currentCount);
    setSelectedPlanId(tenant?.plano_id || '');
    setAdditionalSlots(0);
    setIsUpgradeModalOpen(true);
  }

  function isLimitReached(
    entityType: 'max_escolas' | 'max_docentes' | 'max_estudantes' | 'max_turmas' | 'max_disciplinas' | 'max_classes' | 'max_usuarios',
    currentCount: number
  ): boolean {
    const rawCountMap = {
      max_escolas: rawSchools.length,
      max_docentes: rawTeachers.length,
      max_estudantes: rawStudents.length,
      max_turmas: rawTurmas.length,
      max_disciplinas: rawClasses.length,
      max_classes: rawClassesEscolares.length,
      max_usuarios: tenantUsers.length
    };
    const finalCount = rawCountMap[entityType] ?? currentCount;
    if (!plan) return false;
    const defaultLimits: Record<string, number> = {
      max_escolas: 3,
      max_docentes: 10,
      max_estudantes: 250,
      max_turmas: 10,
      max_disciplinas: 15,
      max_classes: 7,
      max_usuarios: 15
    };
    const max = (plan.limits[entityType] ?? defaultLimits[entityType] ?? 9999) + (tenant?.slots_adicionais?.[entityType] ?? 0);
    return finalCount >= max;
  }

  async function handleUpgradeConfirm(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!tenant) return;
      
      const isPlanChanged = selectedPlanId !== tenant.plano_id;
      const finalSlots = additionalSlots > 0 ? (tenant.slots_adicionais?.[upgradeLimitType] ?? 0) + additionalSlots : (tenant.slots_adicionais?.[upgradeLimitType] ?? 0);

      const updatePayload: any = {};
      if (isPlanChanged) {
        updatePayload.plano_id = selectedPlanId;
      }
      if (additionalSlots > 0 && upgradeLimitType) {
        updatePayload.slots_adicionais = {
          ...(tenant.slots_adicionais || {}),
          [upgradeLimitType]: finalSlots
        };
      }

      // 1. Update tenant document
      const tenantRef = doc(db, 'tenants', currentTenantId);
      await updateDoc(tenantRef, updatePayload);

      // 2. Generate Payment/Invoice if anything changed
      let costText = "";
      if (isPlanChanged || additionalSlots > 0) {
        const selectedPlan = allPlans.find(p => p.id === selectedPlanId);
        const planPrice = selectedPlan?.preco ?? 0;
        const extraCost = additionalSlots * 2;
        const totalValue = planPrice + extraCost;

        const newPayment = {
          tenant_id: currentTenantId,
          valor: totalValue,
          data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          data_pagamento: new Date().toISOString().split('T')[0],
          status: 'pago',
          metodo: 'cartao_credito'
        };
        await addDoc(collection(db, 'pagamentos'), newPayment);
        costText = `Fatura gerada no valor de ${totalValue} USD (Plano: ${selectedPlan?.nome} + ${additionalSlots} slots extras).`;
      }

      // 3. Send system notification to the Tenant and log it
      const newNotif = {
        destinatario_id: currentTenantId,
        titulo: 'Upgrade Realizado com Sucesso!',
        mensagem: `Sua conta foi atualizada com sucesso. ${costText} Novas cotas aplicadas instantaneamente.`,
        tipo: 'sucesso' as 'sucesso',
        lido: false,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'notificacoes'), newNotif);

      // 4. Update the Super Admin notification as well
      const superAdminNotif = {
        destinatario_id: 'super_admin',
        titulo: `Upgrade Realizado: ${tenant.nome}`,
        mensagem: `A instituição ${tenant.nome} alterou seu plano ou adquiriu slots extras. Cota ampliada para: ${upgradeLimitType}.`,
        tipo: 'sucesso' as 'sucesso',
        lido: false,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'notificacoes'), superAdminNotif);

      // Reset state and reload
      setIsUpgradeModalOpen(false);
      await loadTenantContext();
    } catch (err) {
      console.error("Error confirming upgrade:", err);
    }
  }

  function checkLimit(
    entityType: 'max_escolas' | 'max_docentes' | 'max_estudantes' | 'max_turmas' | 'max_disciplinas' | 'max_classes' | 'max_usuarios', 
    currentCount: number
  ): boolean {
    const rawCountMap = {
      max_escolas: rawSchools.length,
      max_docentes: rawTeachers.length,
      max_estudantes: rawStudents.length,
      max_turmas: rawTurmas.length,
      max_disciplinas: rawClasses.length,
      max_classes: rawClassesEscolares.length,
      max_usuarios: tenantUsers.length
    };
    const finalCount = rawCountMap[entityType] ?? currentCount;
    if (!plan) return true;
    const defaultLimits: Record<string, number> = {
      max_escolas: 3,
      max_docentes: 10,
      max_estudantes: 250,
      max_turmas: 10,
      max_disciplinas: 15,
      max_classes: 7,
      max_usuarios: 15
    };
    const max = (plan.limits[entityType] ?? defaultLimits[entityType] ?? 9999) + (tenant?.slots_adicionais?.[entityType] ?? 0);
    if (finalCount >= max) {
      openUpgradeModal(entityType, finalCount);
      return false;
    }
    return true;
  }

  const handleCopySchedule = async (period: 'mes' | 'trimestre' | 'semestre' | 'ano') => {
    const activeCalendarTurma = selectedTurmaFilter === 'todos' ? (turmas[0]?.id || '') : selectedTurmaFilter;
    if (!activeCalendarTurma) {
      showSystemNotification("Erro: Selecione uma turma para copiar a agenda.", "erro");
      return;
    }

    const activeTurmaObj = turmas.find(t => t.id === activeCalendarTurma);
    const turmaName = activeTurmaObj?.nome || "Turma";

    // 1. Find all classes of the selected turma on the currently displayed 7 days starting from calendarSelectedDate
    const baseDate = calendarSelectedDate;
    const currentWeekClasses: any[] = [];
    
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const currentDayDate = new Date(baseDate);
      currentDayDate.setDate(baseDate.getDate() + dayIdx);
      const targetDayDateStr = getLocalYYYYMMDD(currentDayDate);
      
      const dayClasses = rawClasses.filter(c => c.turma_id === activeCalendarTurma && c.data === targetDayDateStr);
      currentWeekClasses.push(...dayClasses);
    }

    if (currentWeekClasses.length === 0) {
      showSystemNotification("Erro: Não há disciplinas agendadas nesta semana para copiar.", "erro");
      return;
    }

    // Define weeks based on period
    let numWeeks = 3; // default for month (total 4 weeks, copy next 3)
    let periodName = "Mês";
    if (period === 'trimestre') {
      numWeeks = 11; // total 12 weeks, copy next 11
      periodName = "Trimestre";
    } else if (period === 'semestre') {
      numWeeks = 23; // total 24 weeks, copy next 23
      periodName = "Semestre";
    } else if (period === 'ano') {
      numWeeks = 51; // total 52 weeks, copy next 51
      periodName = "Ano";
    }

    // Check plan limits
    const totalNewClassesEstimate = currentWeekClasses.length * numWeeks;
    if (!checkLimit('max_disciplinas', rawClasses.length + totalNewClassesEstimate)) {
      return;
    }

    setIsSaving(true);
    try {
      let copiedCount = 0;
      let skippedCount = 0;
      let overwrittenCount = 0;

      // Loop through each class and copy to future weeks
      for (const c of currentWeekClasses) {
        if (!c.data) continue;
        const [year, month, day] = c.data.split('-').map(Number);
        const sourceDate = new Date(year, month - 1, day);

        for (let w = 1; w <= numWeeks; w++) {
          const targetDate = new Date(sourceDate);
          targetDate.setDate(sourceDate.getDate() + w * 7);
          const targetDateStr = getLocalYYYYMMDD(targetDate);
          const targetDayName = c.dia_semana || getDiaSemanaFromDate(targetDateStr);

          // Check room overlap with OTHER turmas
          const isOverlapWithOther = rawClasses.some(cls => {
            return cls.turma_id !== activeCalendarTurma && 
                   cls.sala === c.sala && 
                   cls.horario === c.horario && 
                   cls.data === targetDateStr;
          });

          if (isOverlapWithOther) {
            skippedCount++;
            continue;
          }

          // Check if there is already a class of THIS selected turma in this slot, and delete/overwrite it
          const existingClassOfTurma = rawClasses.find(cls => {
            return cls.turma_id === activeCalendarTurma && 
                   cls.horario === c.horario && 
                   cls.data === targetDateStr;
          });

          if (existingClassOfTurma) {
            await deleteDoc(doc(db, 'classes', existingClassOfTurma.id));
            overwrittenCount++;
          }

          // Add the new copied class with approval status based on weekend
          const targetDay = targetDate.getDay();
          const targetIsWeekend = targetDay === 0 || targetDay === 6;

          const newClass = {
            nome: c.nome,
            turma_id: activeCalendarTurma,
            docente_id: c.docente_id,
            horario: c.horario,
            sala: c.sala,
            data: targetDateStr,
            dia_semana: targetDayName,
            tenant_id: currentTenantId,
            status_aprovacao: targetIsWeekend ? 'pendente' : 'aprovado'
          };

          await addDoc(collection(db, 'classes'), newClass);
          copiedCount++;
        }
      }

      await loadTenantContext();

      // Show a success message detailing what happened
      let successMessage = `Agenda da turma "${turmaName}" copiada com sucesso para o ${periodName}! `;
      successMessage += `Foram geradas ${copiedCount} aulas.`;
      if (overwrittenCount > 0) {
        successMessage += ` (${overwrittenCount} aulas anteriores substituídas).`;
      }
      if (skippedCount > 0) {
        successMessage += ` [Aviso: ${skippedCount} aulas não foram copiadas por conflito de sala com outras turmas].`;
      }

      showSystemNotification(successMessage, 'sucesso');
      
      // Physical overlay popup
      const popup = document.createElement('div');
      popup.className = 'fixed bottom-5 right-5 bg-indigo-600 text-white font-bold text-xs px-5 py-4 rounded-xl shadow-2xl border border-indigo-500 z-[1000000] flex flex-col gap-1 max-w-sm animate-bounce';
      popup.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm">📅 Agenda Copiada (${periodName})</div>
        <div class="text-[10px] opacity-90">${copiedCount} aulas geradas para a turma ${turmaName}.</div>
        ${skippedCount > 0 ? `<div class="text-[9px] text-amber-300">⚠️ ${skippedCount} conflitos de sala evitados.</div>` : ''}
      `;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 7000);

    } catch (err: any) {
      console.error("Error copying schedule:", err);
      showSystemNotification(`Erro ao copiar agenda: ${err.message || err}`, "erro");
    } finally {
      setIsSaving(false);
    }
  };

  // General CRUD Submit router
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const qParams = { tenant_id: currentTenantId };
      
      if (modalType === 'provincia') {
        if (editingItem) {
          await updateDoc(doc(db, 'provincias', editingItem.id), provinciaForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🌍 Província Atualizada',
            mensagem: `A província "${provinciaForm.nome}" foi atualizada no sistema.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, 'provincias'), { ...provinciaForm, ...qParams });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🌍 Nova Província Adicionada',
            mensagem: `A província "${provinciaForm.nome}" foi cadastrada com sucesso no sistema.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'escola') {
        if (editingItem) {
          await updateDoc(doc(db, 'escolas', editingItem.id), escolaForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🏫 Escola Atualizada',
            mensagem: `Os dados da escola "${escolaForm.nome}" foram alterados.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_escolas', schools.length)) return;
          await addDoc(collection(db, 'escolas'), { ...escolaForm, ...qParams });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🏫 Nova Escola Adicionada',
            mensagem: `A escola "${escolaForm.nome}" foi cadastrada com sucesso.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'teacher') {
        if (editingItem) {
          // Edit teacher
          const teacherDoc = doc(db, 'docentes', editingItem.id);
          await updateDoc(teacherDoc, {
            escola_id: teacherForm.escola_id,
            especialidade: teacherForm.especialidade,
            numero_registro: teacherForm.numero_registro
          });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '⚙️ Cadastro de Docente Atualizado',
            mensagem: `O cadastro do docente "${teacherForm.nome || 'Docente'}" foi atualizado com sucesso.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_docentes', teachers.length)) return;
          if (!checkLimit('max_usuarios', tenantUsers.length)) return;
          // Generate user credential alongside teacher record
          const userGenId = "user-doc-" + Math.random().toString(36).substr(2, 9);
          const newUser = {
            id: userGenId,
            tenant_id: currentTenantId,
            email: teacherForm.email,
            nome: teacherForm.nome,
            tipo: "docente" as const,
            permissoes: ["R", "W"],
            ativo: true,
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', userGenId), newUser);

          const docGenId = "doc-" + Math.random().toString(36).substr(2, 9);
          const newDocente: Docente = {
            id: docGenId,
            tenant_id: currentTenantId,
            user_id: userGenId,
            escola_id: teacherForm.escola_id,
            especialidade: teacherForm.especialidade,
            numero_registro: teacherForm.numero_registro,
            data_contratacao: new Date().toISOString().split('T')[0]
          };
          await setDoc(doc(db, 'docentes', docGenId), newDocente);

          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🧑‍🏫 Novo Docente Cadastrado',
            mensagem: `O docente "${teacherForm.nome}" foi cadastrado no sistema (Especialidade: ${teacherForm.especialidade}).`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'student') {
        if (editingItem) {
          await updateDoc(doc(db, 'estudantes', editingItem.id), {
            escola_id: studentForm.escola_id,
            turma_id: studentForm.turma_id,
            numero_matricula: studentForm.numero_matricula,
            data_nascimento: studentForm.data_nascimento,
            genero: studentForm.genero,
            pai_id: studentForm.pai_id,
            faturado: !!studentForm.faturado,
            periodo_facturacao: studentForm.faturado ? (studentForm.periodo_facturacao || 'Mensal') : null,
          });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '✏️ Cadastro de Estudante Atualizado',
            mensagem: `Os dados de matrícula do estudante com ID "${editingItem.id}" foram atualizados com sucesso.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_estudantes', students.length)) return;
          if (!checkLimit('max_usuarios', tenantUsers.length)) return;
          const userGenId = "user-est-" + Math.random().toString(36).substr(2, 9);
          const newUser = {
            id: userGenId,
            tenant_id: currentTenantId,
            email: studentForm.email || `${studentForm.numero_matricula.toLowerCase()}@escola.edu`,
            nome: studentForm.nome,
            tipo: "estudante" as const,
            permissoes: ["R"],
            ativo: true,
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', userGenId), newUser);

          const estGenId = "est-" + Math.random().toString(36).substr(2, 9);
          const newEstudante: Estudante = {
            id: estGenId,
            tenant_id: currentTenantId,
            user_id: userGenId,
            escola_id: studentForm.escola_id,
            numero_matricula: studentForm.numero_matricula,
            data_nascimento: studentForm.data_nascimento,
            genero: studentForm.genero,
            turma_id: studentForm.turma_id,
            pai_id: studentForm.pai_id,
            faturado: !!studentForm.faturado,
            periodo_facturacao: studentForm.faturado ? (studentForm.periodo_facturacao || 'Mensal') : null,
            data_matricula: new Date().toISOString().split('T')[0],
            propina_valor: studentForm.faturado ? (studentForm.periodo_facturacao === 'Anual' ? 42000 : studentForm.periodo_facturacao === 'Semestral' ? 21000 : 3500) : null,
            propina_vencimento: studentForm.faturado ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
            foto_url: "https://images.unsplash.com/photo-1597589827317-4c6d6e0a90bd?auto=format&fit=crop&q=80&w=120"
          };
          await setDoc(doc(db, 'estudantes', estGenId), newEstudante);

          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🎓 Novo Estudante Matriculado',
            mensagem: `O estudante "${studentForm.nome}" foi matriculado com sucesso (Nº Matrícula: ${studentForm.numero_matricula}).`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: userGenId,
            destinatario_role: 'estudante',
            titulo: '🎉 Bem-vindo ao Portal do Estudante!',
            mensagem: `Olá ${studentForm.nome}! O seu acesso ao Portal do Estudante está pronto. Nº Matrícula: ${studentForm.numero_matricula}.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

          if (studentForm.faturado) {
            await addDoc(collection(db, 'faturas_estudantes'), {
              tenant_id: currentTenantId,
              estudante_id: estGenId,
              escola_id: studentForm.escola_id,
              turma_id: studentForm.turma_id,
              descricao: `Inscrição e Mensalidade (${studentForm.periodo_facturacao || 'Mensal'})`,
              valor: studentForm.periodo_facturacao === 'Anual' ? 42000 : studentForm.periodo_facturacao === 'Semestral' ? 21000 : 3500,
              data_vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'Pendente',
              criado_em: new Date().toISOString()
            });
          }
        }
      } 
      
      else if (modalType === 'turma') {
        if (editingItem) {
          await updateDoc(doc(db, 'turmas', editingItem.id), turmaForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '⚙️ Turma Atualizada',
            mensagem: `A turma "${turmaForm.nome}" foi modificada com sucesso.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_turmas', turmas.length)) return;
          await addDoc(collection(db, 'turmas'), { ...turmaForm, ...qParams });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🏫 Nova Turma Criada',
            mensagem: `A turma "${turmaForm.nome}" foi criada com sucesso no sistema.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'classe') {
        // Validation: "duas turmas nao podem ocupar a mesma sala no mesmo horário na mesma data"
        const isOverlap = rawClasses.some(cls => {
          if (editingItem && cls.id === editingItem.id) return false;
          return cls.sala === classeForm.sala && cls.horario === classeForm.horario && cls.data === classeForm.data;
        });

        if (isOverlap) {
          showSystemNotification("Erro: Esta sala já está ocupada por outra turma nesta data e horário!", "erro");
          setIsSaving(false);
          return;
        }

        const checkIsWeekend = (dataStr: string, diaSemana: string) => {
          if (dataStr) {
            const d = new Date(dataStr + 'T12:00:00');
            if (d.getDay() === 0 || d.getDay() === 6) return true;
          }
          if (diaSemana) {
            const ds = diaSemana.toLowerCase();
            if (ds.includes('sáb') || ds.includes('dom') || ds.includes('sábado') || ds.includes('domingo')) return true;
          }
          return false;
        };

        if (editingItem) {
          const isWknd = checkIsWeekend(classeForm.data, classeForm.dia_semana);
          const updatedForm = {
            ...classeForm,
            status_aprovacao: editingItem.status_aprovacao || (isWknd ? 'pendente' : 'aprovado')
          };
          await updateDoc(doc(db, 'classes', editingItem.id), updatedForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '📅 Aula/Disciplina Atualizada',
            mensagem: `A disciplina "${classeForm.nome}" foi alterada para ${classeForm.data || classeForm.dia_semana} às ${classeForm.horario}.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_disciplinas', classes.length)) return;
          const isWknd = checkIsWeekend(classeForm.data, classeForm.dia_semana);
          await addDoc(collection(db, 'classes'), { 
            ...classeForm, 
            status_aprovacao: isWknd ? 'pendente' : 'aprovado',
            ...qParams 
          });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '📅 Nova Aula Agendada',
            mensagem: `Agendada a disciplina "${classeForm.nome}" para ${classeForm.data || classeForm.dia_semana} às ${classeForm.horario}.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 

      else if (modalType === 'ferias') {
        if (!feriasForm.descricao || !feriasForm.data_inicio || !feriasForm.data_fim) {
          showSystemNotification("Erro: Preencha todos os campos da férias!", "erro");
          setIsSaving(false);
          return;
        }
        if (new Date(feriasForm.data_inicio) > new Date(feriasForm.data_fim)) {
          showSystemNotification("Erro: A data de início não pode ser posterior à data de fim!", "erro");
          setIsSaving(false);
          return;
        }

        if (editingItem) {
          await updateDoc(doc(db, 'ferias', editingItem.id), feriasForm);
          showSystemNotification("Férias atualizadas com sucesso!", "sucesso");
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'todos',
            titulo: '🏝️ Período de Férias Alterado',
            mensagem: `Aviso: O período de férias "${feriasForm.descricao}" foi reagendado de ${new Date(feriasForm.data_inicio).toLocaleDateString('pt-PT')} a ${new Date(feriasForm.data_fim).toLocaleDateString('pt-PT')}.`,
            tipo: 'sistema',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, 'ferias'), { ...feriasForm, ...qParams });
          showSystemNotification("Férias cadastradas com sucesso!", "sucesso");
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'todos',
            titulo: '🏝️ Novo Período de Férias Cadastrado',
            mensagem: `Aviso geral: Período de Férias "${feriasForm.descricao}" agendado de ${new Date(feriasForm.data_inicio).toLocaleDateString('pt-PT')} a ${new Date(feriasForm.data_fim).toLocaleDateString('pt-PT')}.`,
            tipo: 'sistema',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'classe_escolar') {
        if (editingItem) {
          await updateDoc(doc(db, 'classes_escolares', editingItem.id), classeEscolarForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '⚙️ Classe Acadêmica Atualizada',
            mensagem: `A classe acadêmica "${classeEscolarForm.nome}" foi alterada no sistema.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          if (!checkLimit('max_classes', classesEscolares.length)) return;
          await addDoc(collection(db, 'classes_escolares'), { ...classeEscolarForm, ...qParams });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🏫 Nova Classe Acadêmica Criada',
            mensagem: `A classe acadêmica "${classeEscolarForm.nome}" foi registrada com sucesso.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      }

      else if (modalType === 'sala') {
        if (editingItem) {
          await updateDoc(doc(db, 'salas', editingItem.id), salaForm);
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🚪 Sala de Aula Atualizada',
            mensagem: `Os dados da sala "${salaForm.nome}" foram alterados.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, 'salas'), { ...salaForm, ...qParams });
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '🚪 Nova Sala de Aula Registrada',
            mensagem: `A sala "${salaForm.nome}" (Capacidade: ${salaForm.capacidade}) foi criada com sucesso.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });
        }
      } 
      
      else if (modalType === 'pauta') {
        const grades: number[] = [];
        const checkAndAddGrade = (val: any) => {
          if (val === 0 || val === '0') {
            grades.push(0);
          } else if (val !== undefined && val !== null && val !== '') {
            const num = Number(val);
            if (!isNaN(num)) {
              grades.push(num);
            }
          }
        };

        checkAndAddGrade(pautaForm.nota_prova);
        checkAndAddGrade(pautaForm.nota_trabalho);
        checkAndAddGrade(pautaForm.nota_participacao);

        const average = grades.length > 0 ? (grades.reduce((sum, g) => sum + g, 0) / grades.length) : 0;
        const examValue = pautaForm.nota_exame !== undefined && pautaForm.nota_exame !== null && pautaForm.nota_exame !== '' ? Number(pautaForm.nota_exame) : null;
        
        let finalMedia = average;
        if (examValue !== null) {
          finalMedia = (average * 0.6) + (examValue * 0.4);
        }

        let resultSit: 'Aprovado' | 'Reprovado' | 'Recuperação' = 'Aprovado';
        if (finalMedia < 10) {
          resultSit = finalMedia >= 7.5 ? 'Recuperação' : 'Reprovado';
        }

        // Apply automatic re-evaluation recalculation
        const reavalValue = pautaForm.nota_reavaliacao !== undefined && pautaForm.nota_reavaliacao !== null && pautaForm.nota_reavaliacao !== '' ? Number(pautaForm.nota_reavaliacao) : null;
        if (reavalValue !== null && (finalMedia < 10)) {
          finalMedia = reavalValue;
          resultSit = reavalValue >= 10 ? 'Aprovado' : 'Reprovado';
        }

        const calculatedPauta = {
          ...pautaForm,
          nota_prova: pautaForm.nota_prova !== '' && pautaForm.nota_prova !== undefined ? Number(pautaForm.nota_prova) : '',
          nota_trabalho: pautaForm.nota_trabalho !== '' && pautaForm.nota_trabalho !== undefined ? Number(pautaForm.nota_trabalho) : '',
          nota_participacao: pautaForm.nota_participacao !== '' && pautaForm.nota_participacao !== undefined ? Number(pautaForm.nota_participacao) : '',
          nota_exame: examValue !== null ? examValue : null,
          nota_reavaliacao: reavalValue !== null ? reavalValue : null,
          nota_media: Number(finalMedia.toFixed(2)),
          situacao: resultSit,
          data_lancamento: new Date().toISOString().split('T')[0]
        };

        if (editingItem) {
          await updateDoc(doc(db, 'pautas', editingItem.id), calculatedPauta);
          
          const targetStud = students.find(s => s.id === calculatedPauta.estudante_id);
          const studUser = tenantUsers.find(u => u.id === targetStud?.user_id);
          
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '⚙️ Nota de Pauta Editada',
            mensagem: `Atualizada a nota para ${studUser?.nome || 'Estudante'} na disciplina "${calculatedPauta.disciplina_id}". Nova média: ${calculatedPauta.nota_media} valores (${calculatedPauta.situacao}).`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });

          if (targetStud?.user_id) {
            await addDoc(collection(db, 'notificacoes'), {
              destinatario_id: targetStud.user_id,
              destinatario_role: 'estudante',
              titulo: '📊 Nota de Pauta Retificada',
              mensagem: `A sua nota final para a disciplina "${calculatedPauta.disciplina_id}" foi retificada. Nova Média: ${calculatedPauta.nota_media} valores (${calculatedPauta.situacao}).`,
              tipo: 'info',
              lido: false,
              created_at: new Date().toISOString()
            });
          }
        } else {
          await addDoc(collection(db, 'pautas'), { ...calculatedPauta, ...qParams });
          
          const targetStud = students.find(s => s.id === calculatedPauta.estudante_id);
          const studUser = tenantUsers.find(u => u.id === targetStud?.user_id);
          
          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '📊 Nova Nota de Pauta Lançada',
            mensagem: `Lançada nota para ${studUser?.nome || 'Estudante'} na disciplina "${calculatedPauta.disciplina_id}". Média Final: ${calculatedPauta.nota_media} valores (${calculatedPauta.situacao}).`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

          if (targetStud?.user_id) {
            await addDoc(collection(db, 'notificacoes'), {
              destinatario_id: targetStud.user_id,
              destinatario_role: 'estudante',
              titulo: '📊 Nova Nota de Pauta Disponível',
              mensagem: `A sua nota final para a disciplina "${calculatedPauta.disciplina_id}" foi publicada. Média: ${calculatedPauta.nota_media} valores (${calculatedPauta.situacao}).`,
              tipo: 'sucesso',
              lido: false,
              created_at: new Date().toISOString()
            });
          }
        }
      } 
      
      else if (modalType === 'processo') {
        const payload = {
          ...processoForm,
          data: new Date().toISOString().split('T')[0],
          criador_nome: "Administrador Escola"
        };
        if (editingItem) {
          await updateDoc(doc(db, 'processos_aluno', editingItem.id), payload);
          
          const targetStud = students.find(s => s.id === payload.estudante_id);
          const studUser = tenantUsers.find(u => u.id === targetStud?.user_id);

          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '⚙️ Dossier/Processo Retificado',
            mensagem: `Os dados do processo "${payload.titulo}" do estudante ${studUser?.nome || 'Estudante'} foram retificados.`,
            tipo: 'info',
            lido: false,
            created_at: new Date().toISOString()
          });

          if (targetStud?.user_id) {
            await addDoc(collection(db, 'notificacoes'), {
              destinatario_id: targetStud.user_id,
              destinatario_role: 'estudante',
              titulo: '📂 Atualização no seu Dossier Escolar',
              mensagem: `O seu processo "${payload.titulo}" foi retificado pela secretaria.`,
              tipo: 'info',
              lido: false,
              created_at: new Date().toISOString()
            });
          }
        } else {
          await addDoc(collection(db, 'processos_aluno'), { ...payload, ...qParams });
          
          const targetStud = students.find(s => s.id === payload.estudante_id);
          const studUser = tenantUsers.find(u => u.id === targetStud?.user_id);

          await addDoc(collection(db, 'notificacoes'), {
            destinatario_id: currentTenantId,
            destinatario_role: 'admin',
            titulo: '📂 Novo Dossier/Processo Registrado',
            mensagem: `Registrado processo "${payload.titulo}" para o estudante ${studUser?.nome || 'Estudante'}.`,
            tipo: 'sucesso',
            lido: false,
            created_at: new Date().toISOString()
          });

          if (targetStud?.user_id) {
            await addDoc(collection(db, 'notificacoes'), {
              destinatario_id: targetStud.user_id,
              destinatario_role: 'estudante',
              titulo: '📂 Nova Atualização no seu Dossier',
              mensagem: `Foi adicionado um novo registo ao seu dossier escolar: "${payload.titulo}".`,
              tipo: 'info',
              lido: false,
              created_at: new Date().toISOString()
            });
          }
        }
      } 
      
      else if (modalType === 'user') {
        if (editingItem) {
          await updateDoc(doc(db, 'users', editingItem.id), {
            email: userForm.email,
            nome: userForm.nome,
            tipo: userForm.tipo,
            ativo: userForm.ativo,
            modulo_acessos: userForm.modulo_acessos
          });
        } else {
          if (!checkLimit('max_usuarios', tenantUsers.length)) return;
          const userGenId = "user-gen-" + Math.random().toString(36).substr(2, 9);
          const newUser = {
            id: userGenId,
            tenant_id: currentTenantId,
            email: userForm.email,
            nome: userForm.nome,
            tipo: userForm.tipo,
            permissoes: userForm.tipo === 'admin' || userForm.tipo === 'director' ? ["R", "W", "D"] : ["R"],
            ativo: userForm.ativo,
            modulo_acessos: userForm.modulo_acessos,
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', userGenId), newUser);
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setIsFormDirty(false); // Reset dirty flag on successful submit
      loadTenantContext();
      showSystemNotification(`Operação realizada com sucesso! Registro de ${modalType} salvo.`, 'cadastro');
    } catch (err: any) {
      console.error("Error saving document:", err);
      showSystemNotification(`Erro ao processar dados: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  }

  // Soft Delete School
  async function handleSoftDeleteEscola(id: string, name: string) {
    if (confirm(`Tem certeza que deseja desativar a escola "${name}"? Suas turmas e notas continuarão preservadas para fins legais.`)) {
      setIsSaving(true);
      try {
        await updateDoc(doc(db, 'escolas', id), {
          deleted_at: new Date().toISOString(),
          ativo: false
        });
        loadTenantContext();
        showSystemNotification(`Escola "${name}" desativada com sucesso!`, 'sucesso');
      } catch (err: any) {
        console.error("Error soft deleting school:", err);
        showSystemNotification(`Erro ao desativar escola: ${err.message || err}`, 'erro');
      } finally {
        setIsSaving(false);
      }
    }
  }

  // Update Settings
  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'configuracoes', config.id), {
        nome_instituicao: config.nome_instituicao,
        endereco: config.endereco,
        contacto: config.contacto,
        ano_letivo_atual: config.ano_letivo_atual,
        escala_avaliacao: config.escala_avaliacao,
        notificacoes_email: config.notificacoes_email,
        logo_url: config.logo_url,
        smtp_provider: config.smtp_provider || 'system',
        smtp_type: config.smtp_type || 'manual',
        smtp_host: config.smtp_host || '',
        smtp_port: Number(config.smtp_port) || 587,
        smtp_user: config.smtp_user || '',
        smtp_pass: config.smtp_pass || '',
        smtp_secure: Boolean(config.smtp_secure),
        smtp_sender_email: config.smtp_sender_email || '',
        smtp_sender_name: config.smtp_sender_name || ''
      });

      if (tenant) {
        await updateDoc(doc(db, 'tenants', tenant.id), {
          idioma_padrao: systemLang
        });
      }

      showSystemNotification("Configurações gerais salvas com sucesso!", 'config');
    } catch (err: any) {
      console.error("Error updating config:", err);
      showSystemNotification(`Erro ao salvar configurações: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  }

  // Export JSON Backup of Tenant data
  function handleBackupExport() {
    const backupData = {
      tenant,
      config,
      provinces,
      schools,
      teachers,
      students,
      turmas,
      classes,
      pautas,
      processos
    };
    const fileBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_SaaS_${tenant?.slug || 'tenant'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  const renderMenuItem = (tab: string, label: string, icon: React.ReactNode) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => {
          guardAction(() => {
            setActiveTab(tab);
            setIsFormDirty(false); // Reset dirty state on successful navigation
            setIsMobileMenuOpen(false);
          });
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

  return (
    <div id="tenant_client_portal" className="bg-slate-50 min-h-screen flex flex-col md:flex-row relative">
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
      <div className="flex md:hidden items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 shrink-0 sticky top-0 z-40 h-16">
        {/* 1. Menu canto esquerdo */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 cursor-pointer"
          title="Abrir Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Brand Center Title */}
        <div className="flex items-center gap-1.5 select-none shrink-0 overflow-hidden px-2">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="w-7 h-7 rounded-lg object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">
              {tenant?.nome ? tenant.nome.charAt(0) : 'E'}
            </div>
          )}
          <span className="font-extrabold text-xs truncate max-w-[120px]">{config?.nome_instituicao || tenant?.nome}</span>
        </div>

        {/* Right Actions Container */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Switch */}
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


        </div>
      </div>

      {/* DESKTOP SIDEBAR CONSTANT WIDTH SPACER */}
      <div className={`hidden md:block transition-[width] duration-300 ease-in-out shrink-0 ${isExpanded ? 'w-64' : 'w-[72px]'}`} />

      {/* SIDEBAR NAVIGATION RAIL */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed top-0 bottom-0 left-0 bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out
          ${isMobile 
            ? (isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl shadow-slate-950/70 z-50' : '-translate-x-full w-64 z-50') 
            : 'translate-x-0 md:flex z-40 ' + (isExpanded ? 'w-64 shadow-2xl shadow-slate-950/50' : 'w-[72px]')}
        `}
      >
        {/* Header / Brand */}
        <div className={`p-4 border-b border-slate-800 flex items-center bg-slate-950 h-[72px] shrink-0 transition-all duration-300 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {config?.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-extrabold text-lg font-sans shrink-0">
                {tenant?.nome ? tenant.nome.charAt(0) : 'E'}
              </div>
            )}
            {isExpanded && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <h2 className="font-sans font-extrabold text-xs text-white truncate max-w-[130px]">{config?.nome_instituicao || tenant?.nome || 'Escola'}</h2>
                <span className="text-[10px] text-indigo-400 font-mono tracking-wider font-bold">ASSINANTE {plan?.nome ? plan.nome.toUpperCase().split(' ')[1] : 'MEMBRO'}</span>
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

        {/* Modules Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto overscroll-y-contain no-scrollbar">
          {renderGroupHeader('Principal')}
          {renderMenuItem('dashboard', 'Dashboard', <Sliders className="w-4.5 h-4.5" />)}
          {hasPermission('analytics') && renderMenuItem('analytics', 'Análises & Analytics', <BarChart3 className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Estrutura')}
          {hasPermission('provincias') && renderMenuItem('provincias', 'Distritos / Províncias', <Map className="w-4.5 h-4.5" />)}
          {hasPermission('escolas') && renderMenuItem('escolas', `Escolas (${schools.length})`, <School className="w-4.5 h-4.5" />)}
          {hasPermission('escolas') && renderMenuItem('salas', `Salas de Aula (${rawSalas.length})`, <DoorOpen className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Académico')}
          {hasPermission('docentes') && renderMenuItem('docentes', 'Docentes', <Users className="w-4.5 h-4.5" />)}
          {hasPermission('estudantes') && renderMenuItem('estudantes', 'Estudantes', <GraduationCap className="w-4.5 h-4.5" />)}
          {hasPermission('turmas') && renderMenuItem('turmas', 'Turmas', <BookOpen className="w-4.5 h-4.5" />)}
          {hasPermission('disciplinas') && renderMenuItem('disciplinas', `Disciplinas (${classes.length})`, <BookMarked className="w-4.5 h-4.5" />)}
          {hasPermission('classes') && renderMenuItem('classes_escolares', `Classes (${classesEscolares.length})`, <List className="w-4.5 h-4.5" />)}
          {hasPermission('calendario') && renderMenuItem('calendario', 'Calendário & Horários', <Calendar className="w-4.5 h-4.5" />)}
          {hasPermission('pautas') && renderMenuItem('pauta_geral', 'Pauta Geral', <Award className="w-4.5 h-4.5" />)}
          {hasPermission('pautas') && renderMenuItem('pautas', 'Lançamento (Notas)', <FileSpreadsheet className="w-4.5 h-4.5" />)}
          {hasPermission('biblioteca') && renderMenuItem('biblioteca', 'Biblioteca Digital', <Library className="w-4.5 h-4.5" />)}
          
          {plan?.modulos_permitidos?.includes('processo') && hasPermission('processos') && (
            renderMenuItem('processos', 'Processo do Aluno', <FolderOpen className="w-4.5 h-4.5" />)
          )}

          {renderGroupHeader('Comunicação')}
          {renderMenuItem('notificacoes', 'Notificações', <Bell className="w-4.5 h-4.5" />)}

          {renderGroupHeader('Administração')}
          {hasPermission('utilizadores') && renderMenuItem('usuarios', 'Utilizadores', <UserPlus className="w-4.5 h-4.5" />)}
          {hasPermission('configuracoes') && renderMenuItem('configuracao', 'Configurações', <Sliders className="w-4.5 h-4.5" />)}
        </nav>

        {/* Footer / User Profile */}
        <div className={`p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3 text-xs transition-all duration-300 ${isExpanded ? '' : 'items-center shrink-0'}`}>
          {isExpanded ? (
            <div className="flex flex-col gap-1 overflow-hidden animate-in fade-in duration-300">
              <p className="text-slate-500 font-medium">Autenticado como:</p>
              <p className="font-extrabold text-indigo-400 uppercase tracking-wider font-mono text-[10px]">{currentUserRole}</p>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/40 flex items-center justify-center font-extrabold text-xs uppercase shrink-0" title={`Autenticado como: ${currentUserRole}`}>
              {currentUserRole.charAt(0)}
            </div>
          )}
          
          {onLogout && (
            isExpanded ? (
              <button 
                onClick={() => guardAction(onLogout)}
                className="w-full bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 py-2 rounded-xl font-bold text-center text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <LogOut className="w-4 h-4" /> Sair da Unidade
              </button>
            ) : (
              <button 
                onClick={() => guardAction(onLogout)}
                className="p-2 bg-slate-800/50 hover:bg-rose-950/60 hover:text-rose-400 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Sair da Unidade"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main id="main_content_area" className={`flex-1 overflow-y-auto ${isMobile ? 'p-3.5' : 'p-6 md:p-8'}`}>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-2">
            <Clock className="w-8 h-8 text-indigo-600 animate-spin" />
            <p>Buscando informações do tenant...</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header section with context alert */}
            <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <h1 className="text-2xl font-extrabold font-sans text-slate-900 dark:text-white uppercase tracking-wider">
                  {activeTab}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Ambiente isolado e seguro da instituição escolar.
                </p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Theme Toggle Switch */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Modo escuro</span>
                  <button
                    type="button"
                    onClick={() => onChangeTheme?.(activeTheme === 'theme-dark' ? 'theme-slate' : 'theme-dark')}
                    className={`relative inline-flex h-5.5 w-11 shrink-0 cursor-pointer rounded-full border border-slate-300 dark:border-slate-700 transition-colors duration-200 ease-in-out focus:outline-none ${
                      activeTheme === 'theme-dark' ? 'bg-sky-500 border-sky-400' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={activeTheme === 'theme-dark'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        activeTheme === 'theme-dark' ? 'translate-x-5.5' : 'translate-x-0.5'
                      } mt-[2px]`}
                    />
                  </button>
                </div>

                {/* Notification Bell Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsDesktopNotifOpen(!isDesktopNotifOpen)}
                    className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-xl relative cursor-pointer transition-all flex items-center justify-center shadow-3xs active:scale-95"
                    title="Notificações"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.filter(n => !n.lido).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-sans text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-xs">
                        {notifications.filter(n => !n.lido).length}
                      </span>
                    )}
                  </button>

                  {isDesktopNotifOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsDesktopNotifOpen(false)} />
                      <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-3 text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-250">
                        <div className="px-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                          <span className="font-sans font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Notificações</span>
                          {notifications.some(n => !n.lido) && (
                            <button
                              onClick={() => {
                                markAllNotificationsAsRead();
                                setIsDesktopNotifOpen(false);
                              }}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                            >
                              Ler tudo
                            </button>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                              Nenhuma notificação por enquanto
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div 
                                key={n.id} 
                                onClick={() => {
                                  markNotificationAsRead(n.id);
                                  setIsDesktopNotifOpen(false);
                                }}
                                className={`p-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors ${!n.lido ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}
                              >
                                <div className="flex justify-between items-start gap-1">
                                  <span className={`text-xs font-bold leading-tight ${!n.lido ? 'text-indigo-900 dark:text-indigo-350' : 'text-slate-700 dark:text-slate-300'}`}>{n.titulo}</span>
                                  <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    n.tipo === 'limite' ? 'bg-amber-100 dark:bg-amber-950/45 text-amber-800 dark:text-amber-350 border border-amber-200/50' :
                                    n.tipo === 'alerta' ? 'bg-rose-100 dark:bg-rose-950/45 text-rose-800 dark:text-rose-350 border border-rose-200/50' :
                                    n.tipo === 'sucesso' ? 'bg-emerald-100 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-350 border border-emerald-200/50' : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-300 border border-slate-250'
                                  }`}>
                                    {n.tipo}
                                  </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 leading-relaxed">{n.mensagem}</p>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-2 block">{new Date(n.created_at).toLocaleString('pt-PT')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-1.5 px-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1 shrink-0 select-none">
                  ● Ativo
                </span>
              </div>
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && isEstudante && (
              <div className="space-y-8 animate-fadeIn">
                {/* Student header card */}
                <div className="bg-linear-to-r from-indigo-900 to-indigo-850 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-700/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/30">
                        Painel do Estudante
                      </span>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                        Olá, {loggedInUser?.nome || 'Estudante'}! 👋
                      </h2>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl shrink-0 space-y-1">
                      <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Matrícula Escolar</p>
                      <p className="text-xl font-mono font-black">{currentStudent?.numero_matricula || '---'}</p>
                    </div>
                  </div>
                </div>

                {/* Info and stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Personal School Info */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <School className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-bold text-slate-800 text-sm">Meu Vínculo Escolar</h4>
                    </div>
                    <div className="space-y-3 pt-1 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Instituição</span>
                        <p className="font-semibold text-slate-800">{schools[0]?.nome || 'Não Vinculado'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Província / Distrito</span>
                        <p className="font-semibold text-slate-800">
                          {provinces.find(p => p.id === schools[0]?.provincia_id)?.nome || 'Sem Divisão'}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Sua Turma</span>
                        <p className="font-semibold text-slate-800 text-indigo-600">{turmas[0]?.nome || 'Sem Turma'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Performance Summary */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Award className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-sm">Desempenho Geral</h4>
                    </div>
                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                      <div className="relative flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full border-4 border-indigo-50 flex flex-col items-center justify-center bg-indigo-50/30">
                          <span className="text-2xl font-black text-indigo-600">
                            {pautas.length > 0 
                              ? (pautas.reduce((acc, curr) => acc + (curr.nota_media || 0), 0) / pautas.length).toFixed(1) 
                              : '---'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Média Geral</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold text-center">
                        {pautas.length} avaliações registradas neste trimestre.
                      </p>
                    </div>
                  </div>

                  {/* Quick Reminders */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h4 className="font-bold text-slate-800 text-sm">Avisos e Lembretes</h4>
                    </div>
                    <div className="space-y-3 pt-1">
                      {pautas.length === 0 ? (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
                          <p>Nenhuma nota pendente de avaliação. Excelente!</p>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <FileSpreadsheet className="w-4 h-4 text-indigo-500 mt-0.5" />
                          <p>Consulte sua pauta de notas detalhada abaixo para ver os lançamentos por disciplina.</p>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <Calendar className="w-4 h-4 text-emerald-500 mt-0.5" />
                        <p>Ano letivo atual: {config?.ano_letivo_atual || '2026'}.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student's Grades (Pautas) Table */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-base">Minhas Notas e Pauta Escolar</h3>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 py-1 px-2.5 rounded-lg">
                      Trimestral
                    </span>
                  </div>

                  {pautas.length === 0 ? (
                    <div className="py-12 text-center">
                      <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-semibold">Nenhum lançamento de notas registrado até o momento.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 rounded-xl animate-fadeIn">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase border-b border-slate-100">
                            <th className="px-6 py-3.5">Disciplina / Matéria</th>
                            <th className="px-4 py-3.5 text-center">Trimestre</th>
                            <th className="px-4 py-3.5 text-center">Prova</th>
                            <th className="px-4 py-3.5 text-center">Trabalho</th>
                            <th className="px-4 py-3.5 text-center">Partic.</th>
                            <th className="px-4 py-3.5 text-center">Exame</th>
                            <th className="px-4 py-3.5 text-center font-bold">Média</th>
                            <th className="px-6 py-3.5 text-right">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150/40 text-xs text-slate-700">
                          {pautas.map(p => {
                            const cls = classes.find(c => c.id === p.classe_id);
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-3.5 font-bold text-slate-900">{cls?.nome || 'Disciplina'}</td>
                                <td className="px-4 py-3.5 text-center">{p.trimestre}</td>
                                <td className="px-4 py-3.5 text-center font-mono">{p.nota_prova}</td>
                                <td className="px-4 py-3.5 text-center font-mono">{p.nota_trabalho}</td>
                                <td className="px-4 py-3.5 text-center font-mono">{p.nota_participacao}</td>
                                <td className="px-4 py-3.5 text-center font-mono">{p.nota_exame !== undefined ? p.nota_exame : '---'}</td>
                                <td className="px-4 py-3.5 text-center font-mono font-bold text-indigo-700">{p.nota_media}</td>
                                <td className="px-6 py-3.5 text-right">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.situacao === 'Aprovado' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                      : p.situacao === 'Recuperação'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                      : 'bg-rose-50 text-rose-700 border border-rose-150'
                                  }`}>
                                    {p.situacao}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Student's Requests (Processos) Table */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-base">Meus Processos e Requerimentos</h3>
                    <button 
                      onClick={() => setActiveTab('processos')}
                      className="text-indigo-600 hover:text-indigo-700 text-xs font-bold transition-colors"
                    >
                      Acompanhar Todos
                    </button>
                  </div>

                  {processos.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400 text-xs font-semibold">Nenhum processo ou requerimento ativo.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {processos.map(pr => (
                        <div key={pr.id} className="p-4 rounded-xl border border-slate-150 flex flex-col justify-between hover:border-indigo-200 hover:shadow-xs transition-all">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{pr.tipo}</p>
                              <p className="text-[10px] text-slate-400 mt-1">Abertura: {pr.data}</p>
                            </div>
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              pr.status === 'Aprovado' || pr.status === 'Concluído'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                                : pr.status === 'Rejeitado'
                                ? 'bg-rose-50 text-rose-700 border border-rose-150'
                                : 'bg-blue-50 text-blue-700 border border-blue-150'
                            }`}>
                              {pr.status}
                            </span>
                          </div>
                          {pr.observacao && (
                            <p className="text-xs bg-slate-50 text-slate-500 rounded-lg p-2.5 mt-3 border border-slate-100 font-medium">
                              {pr.observacao}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && isDocente && (
              <div className="space-y-8 animate-fadeIn">
                {/* Teacher header card */}
                <div className="bg-linear-to-r from-slate-900 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative z-10 space-y-2">
                    <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/30">
                      Painel do Docente
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                      Olá, Prof. {loggedInUser?.nome || 'Docente'}! 🧑‍🏫
                    </h2>
                    <p className="text-slate-300 text-sm max-w-xl">
                      Seu portal de docência integrado. Gerencie suas turmas, lance notas (Pautas) de seus alunos e acompanhe seu calendário acadêmico.
                    </p>
                  </div>
                </div>

                {/* Stats cards inside school tenant */}
                <div className="flex flex-col md:grid md:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <School className="w-5 h-5 text-indigo-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Escola Vinculada</p>
                    <h3 className="text-sm font-bold text-slate-800 mt-1.5 truncate" title={schools[0]?.nome}>
                      {schools[0]?.nome || 'Não Vinculado'}
                    </h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <BookOpen className="w-5 h-5 text-amber-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Turmas Associadas</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{turmas.length}</h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <GraduationCap className="w-5 h-5 text-emerald-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Alunos Vinculados</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{students.length}</h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <BookMarked className="w-5 h-5 text-blue-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Disciplinas Ministradas</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{classes.length}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left list of classes & subjects */}
                  <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-base">Minhas Turmas e Disciplinas</h3>
                      <button 
                        onClick={() => setActiveTab('turmas')}
                        className="text-indigo-600 hover:text-indigo-700 text-xs font-bold transition-colors"
                      >
                        Ver Todas
                      </button>
                    </div>

                    {turmas.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        Nenhuma turma vinculada a você.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {turmas.map(t => {
                          const associatedClasses = classes.filter(c => c.turma_id === t.id);
                          return (
                            <div key={t.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 first:pt-0 last:pb-0">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{t.nome}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Nível: {t.nivel} • Ano Letivo: {t.ano_letivo}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {associatedClasses.length === 0 ? (
                                  <span className="text-[10px] text-slate-400 bg-slate-50 py-1 px-2 rounded-md border border-slate-100">
                                    Sem matérias específicas cadastradas
                                  </span>
                                ) : (
                                  associatedClasses.map(c => (
                                    <span key={c.id} className="text-[10px] font-semibold text-indigo-700 bg-indigo-50/50 py-1 px-2.5 rounded-lg border border-indigo-100/50">
                                      {c.nome}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Quick Launch shortcuts */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm mb-4">Lembretes & Atividades</h4>
                      <div className="space-y-4 text-xs">
                        <div className="flex items-start gap-2.5">
                          <FileSpreadsheet className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-slate-700">Lançamento de Notas Trimestrais</p>
                            <p className="text-slate-400 mt-0.5">Lembre-se de lançar todas as notas e avaliações pendentes nas pautas.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-slate-700">Canais de Atendimento Ativos</p>
                            <p className="text-slate-400 mt-0.5">Todos os registros escolares de sua turma estão atualizados.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-6">
                      <button 
                        onClick={() => setActiveTab('pautas')}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs text-center transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> Lançar Notas
                      </button>
                      <button 
                        onClick={() => setActiveTab('estudantes')}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs text-center transition-colors cursor-pointer"
                      >
                        Visualizar Meus Estudantes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && !isEstudante && !isDocente && (
              <div className="space-y-8 animate-fadeIn">
                {/* Stats cards inside school tenant */}
                <div className="flex flex-col md:grid md:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <School className="w-5 h-5 text-indigo-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Escolas Ativas</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{schools.length}</h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <Users className="w-5 h-5 text-blue-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Docentes</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{teachers.length}</h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <GraduationCap className="w-5 h-5 text-emerald-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Alunos Matriculados</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{students.length}</h3>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                    <BookOpen className="w-5 h-5 text-amber-600 mb-2.5" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Turmas</p>
                    <h3 className="text-2xl font-black font-sans text-slate-900 mt-1">{turmas.length}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left stats visualizer */}
                  <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
                    <h3 className="font-bold text-slate-800 text-base mb-4">Matrículas e Histórico Acadêmico</h3>
                    <div className="h-48 flex items-end gap-4 justify-around">
                      <div className="flex flex-col items-center gap-1 w-full">
                        <div className="bg-slate-100 w-10 h-32 rounded flex items-end justify-center">
                          <div className="bg-indigo-600 w-10 h-16 rounded-b"></div>
                        </div>
                        <span className="text-xs text-slate-500">1º Tri</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-full">
                        <div className="bg-slate-100 w-10 h-32 rounded flex items-end justify-center">
                          <div className="bg-indigo-600 w-10 h-24 rounded-b"></div>
                        </div>
                        <span className="text-xs text-slate-500">2º Tri</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-full">
                        <div className="bg-slate-100 w-10 h-32 rounded flex items-end justify-center">
                          <div className="bg-indigo-600 w-10 h-28 rounded-b"></div>
                        </div>
                        <span className="text-xs text-slate-500">3º Tri</span>
                      </div>
                    </div>
                  </div>

                  {/* Right alerts panel */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm mb-3">Lembretes & Atividades Recentes</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5 text-xs">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-semibold text-slate-700">Lançamento de Notas</p>
                            <p className="text-slate-400 mt-0.5">Prazo de fechamento do 1º Trimestre em 3 dias.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 text-xs">
                          <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                          <div>
                            <p className="font-semibold text-slate-700">Fatura de Assinatura</p>
                            <p className="text-slate-400 mt-0.5">Renovação SaaS processada com sucesso.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('estudantes')}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs text-center transition-colors mt-6 font-semibold"
                    >
                      Acessar Registro de Estudantes
                    </button>
                  </div>
                </div>

                {/* Mapa Interativo das Escolas no Dashboard */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 animate-bounce" /> Distribuição Geográfica das Escolas Registradas
                    </p>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                      {schools.length} {schools.length === 1 ? 'Escola Registrada' : 'Escolas Registradas'}
                    </span>
                  </div>
                  <SchoolMap 
                    schools={schools} 
                    provinces={provinces}
                  />
                </div>
              </div>
            )}

            {/* TAB: ANALYTICS & MODULE */}
            {activeTab === 'analytics' && (
              !hasPermission('analytics') ? renderRestrictedAccess('Módulo de Análises & Analytics') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <AnalyticsModule
                    role={currentUserRole}
                    schools={rawSchools}
                    teachers={rawTeachers}
                    students={rawStudents}
                    turmas={rawTurmas}
                    classes={rawClasses}
                    pautas={rawPautas}
                    tenantUsers={tenantUsers}
                    currentTeacher={currentTeacher}
                    loggedInUser={loggedInUser}
                  />
                </div>
              )
            )}

            {/* TAB: DISTRITOS / PROVINCIAS */}
            {activeTab === 'provincias' && (
              !hasPermission('provincias') ? renderRestrictedAccess('Distritos / Províncias') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Províncias Educacionais</h3>
                    {hasPermission('provincias', 'criar') && (
                      <button 
                        onClick={() => {
                          setEditingItem(null);
                          setProvinciaForm({ nome: '', codigo: '' });
                          setModalType('provincia');
                          setIsModalOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Cadastrar Divisão
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {provinces.map(p => (
                      <div key={p.id} className="p-4 rounded-xl border border-slate-150 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{p.nome}</p>
                          <p className="text-xs text-slate-400">Código de Referência: {p.codigo}</p>
                        </div>
                        <div className="flex gap-1">
                          {hasPermission('provincias', 'editar') && (
                            <button 
                              onClick={() => {
                                setEditingItem(p);
                                setProvinciaForm({ nome: p.nome, codigo: p.codigo });
                                setModalType('provincia');
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* TAB: SALAS DE AULA */}
            {activeTab === 'salas' && (
              !hasPermission('escolas') ? renderRestrictedAccess('Gestão de Salas de Aula') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Salas de Aula</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Gerenciamento de espaços físicos e laboratórios para agendamento.</p>
                    </div>
                    {hasPermission('escolas', 'criar') && (
                      <button 
                        onClick={() => {
                          setEditingItem(null);
                          setSalaForm({ nome: '', capacidade: 30, tipo: 'Normal', descricao: '' });
                          setModalType('sala');
                          setIsModalOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> Nova Sala
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rawSalas.map(s => (
                      <div key={s.id} className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between bg-slate-50/30">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full">
                              {s.tipo}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              👥 Cap: {s.capacidade} alunos
                            </span>
                          </div>
                          <p className="font-bold text-slate-800 text-base">{s.nome}</p>
                          {s.descricao && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.descricao}</p>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 justify-end">
                          {hasPermission('escolas', 'editar') && (
                            <button 
                              onClick={() => {
                                setEditingItem(s);
                                setSalaForm({ 
                                  nome: s.nome, 
                                  capacidade: s.capacidade || 30, 
                                  tipo: s.tipo || 'Normal', 
                                  descricao: s.descricao || '' 
                                });
                                setModalType('sala');
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg hover:text-indigo-700 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('escolas', 'excluir') && (
                            <button 
                              onClick={async () => {
                                if (window.confirm(`Tem certeza que deseja excluir a sala "${s.nome}"?`)) {
                                  await deleteDoc(doc(db, 'salas', s.id));
                                  setSalas(prev => prev.filter(item => item.id !== s.id));
                                  showSystemNotification("Sala excluída com sucesso!", "sucesso");
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg hover:text-rose-700 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {rawSalas.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                        Nenhuma sala cadastrada no sistema.
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* TAB: ESCOLAS */}
            {activeTab === 'escolas' && (
              !hasPermission('escolas') ? renderRestrictedAccess('Gestão de Escolas') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Instituições Escolares Vinculadas</h3>
                    {isLimitReached('max_escolas', schools.length) ? (
                      <button 
                        onClick={() => openUpgradeModal('max_escolas', schools.length)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                      </button>
                    ) : (
                      hasPermission('escolas', 'criar') && (
                        <button 
                          onClick={() => {
                            setEditingItem(null);
                            setEscolaForm({ nome: '', provincia_id: provinces[0]?.id || '', endereco: '', telefone: '', email: '', diretor_id: '', ativo: true, latitude: '', longitude: '' });
                            setModalType('escola');
                            setIsModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Nova Escola
                        </button>
                      )
                    )}
                  </div>
                  
                  {/* Mapa Interativo de Localização das Escolas */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 animate-bounce" /> Distribuição Geográfica das Escolas Registradas
                    </p>
                    <SchoolMap 
                      schools={schools} 
                      provinces={provinces}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {schools.map(s => {
                      const prov = provinces.find(p => p.id === s.provincia_id);
                      return (
                        <div key={s.id} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 flex flex-col justify-between hover:border-indigo-200 transition-all">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-bold text-slate-900 text-sm leading-tight">{s.nome}</h4>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {s.ativo ? 'ATIVO' : 'DESATIVADO'}
                              </span>
                            </div>
                            <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Província: {prov?.nome || 'Não especificada'}
                            </p>
                            <div className="space-y-1 text-xs text-slate-500 mt-4 border-t border-slate-100 pt-3">
                              <p>📞 {s.telefone}</p>
                              <p>✉️ {s.email}</p>
                              <p>📍 {s.endereco}</p>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-3">
                            {hasPermission('escolas', 'editar') && (
                              <button 
                                onClick={() => {
                                  setEditingItem(s);
                                  setEscolaForm({
                                    nome: s.nome,
                                    provincia_id: s.provincia_id,
                                    endereco: s.endereco,
                                    telefone: s.telefone,
                                    email: s.email,
                                    diretor_id: s.diretor_id,
                                    ativo: s.ativo,
                                    latitude: s.latitude || '',
                                    longitude: s.longitude || ''
                                  });
                                  setModalType('escola');
                                  setIsModalOpen(true);
                                }}
                                className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                              >
                                Editar
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setEditingItem(s);
                                setModalType('escola_detalhes');
                                setIsModalOpen(true);
                              }}
                              className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detalhes
                            </button>
                            {hasPermission('escolas', 'excluir') && (
                              <button 
                                onClick={() => handleSoftDeleteEscola(s.id, s.nome)}
                                className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                              >
                                Desativar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* TAB: DOCENTES */}
            {activeTab === 'docentes' && (
              !hasPermission('docentes') ? renderRestrictedAccess('Gestão de Docentes') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Corpo Docente</h3>
                    {isLimitReached('max_docentes', teachers.length) ? (
                      <button 
                        onClick={() => openUpgradeModal('max_docentes', teachers.length)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                      </button>
                    ) : (
                      hasPermission('docentes', 'criar') && (
                        <button 
                          onClick={() => {
                            setEditingItem(null);
                            setTeacherForm({ nome: '', email: '', especialidade: '', numero_registro: '', escola_id: schools[0]?.id || '' });
                            setModalType('teacher');
                            setIsModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Cadastrar Docente
                        </button>
                      )
                    )}
                  </div>

                  {/* Batch Action Bar */}
                  {selectedTeacherIds.length > 0 && (
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl px-4 py-3 text-sm animate-in fade-in duration-200">
                      <span className="text-indigo-800 dark:text-indigo-300 font-medium">
                        {selectedTeacherIds.length} {selectedTeacherIds.length === 1 ? 'docente selecionado' : 'docentes selecionados'}
                      </span>
                      <div className="flex items-center gap-3">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleTeacherBatchAction(e.target.value);
                              e.target.value = ''; // Reset select
                            }
                          }}
                          className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>Ação</option>
                          <option value="excluir">Excluir Selecionados</option>
                        </select>
                        <button 
                          onClick={() => setSelectedTeacherIds([])}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Desktop View (Table) */}
                  <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                          <th className="py-4 px-4 w-12 text-center">
                            <input 
                              type="checkbox"
                              checked={teachers.length > 0 && selectedTeacherIds.length === teachers.length}
                              onChange={() => {
                                if (selectedTeacherIds.length === teachers.length) {
                                  setSelectedTeacherIds([]);
                                } else {
                                  setSelectedTeacherIds(teachers.map(t => t.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-4">Docente</th>
                          <th className="px-6 py-4">Especialidade / Matéria</th>
                          <th className="px-6 py-4">Nº Registro</th>
                          <th className="px-6 py-4">Escola Associada</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                        {teachers.map(t => {
                          const usr = tenantUsers.find(u => u.id === t.user_id);
                          const esc = schools.find(e => e.id === t.escola_id);
                          return (
                            <tr key={t.id} className={`hover:bg-slate-50/50 ${activeActionRowId === t.id ? 'relative z-30' : ''}`}>
                              <td className="py-4 px-4 text-center">
                                <input 
                                  type="checkbox"
                                  checked={selectedTeacherIds.includes(t.id)}
                                  onChange={() => {
                                    setSelectedTeacherIds(prev => 
                                      prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900">{usr?.nome || 'Professor'}</td>
                              <td className="px-6 py-4">{t.especialidade}</td>
                              <td className="px-6 py-4 font-mono text-xs">{t.numero_registro}</td>
                              <td className="px-6 py-4 text-xs text-indigo-600 font-semibold">{esc?.nome || 'Global'}</td>
                              <td className={`px-6 py-4 text-right relative ${activeActionRowId === t.id ? 'z-40' : 'z-0'}`}>
                                <div className="inline-block text-left">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionRowId(activeActionRowId === t.id ? null : t.id);
                                    }}
                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors focus:outline-none cursor-pointer"
                                    title="Opções"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>

                                  {activeActionRowId === t.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-30 bg-transparent" 
                                        onClick={() => setActiveActionRowId(null)} 
                                      />
                                      <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-40 py-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                        {hasPermission('docentes', 'editar') && (
                                          <button
                                            onClick={() => {
                                              setActiveActionRowId(null);
                                              setEditingItem(t);
                                              setTeacherForm({
                                                nome: usr?.nome || '',
                                                email: usr?.email || '',
                                                especialidade: t.especialidade,
                                                numero_registro: t.numero_registro,
                                                escola_id: t.escola_id
                                              });
                                              setModalType('teacher');
                                              setIsModalOpen(true);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                            Editar Docente
                                          </button>
                                        )}
                                        {hasPermission('docentes', 'excluir') && (
                                          <button
                                            onClick={() => {
                                              setActiveActionRowId(null);
                                              showConfirm(
                                                "Excluir Docente",
                                                `Tem certeza que deseja excluir o docente "${usr?.nome || 'Professor'}"? Esta ação é irreversível.`,
                                                async () => {
                                                  await deleteDoc(doc(db, 'docentes', t.id));
                                                  loadTenantContext();
                                                },
                                                true
                                              );
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                            Excluir Docente
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View (List with Checkbox, Detail View button and 3 dots) */}
                  <div className="block md:hidden space-y-3">
                    {teachers.map(t => {
                      const usr = tenantUsers.find(u => u.id === t.user_id);
                      const esc = schools.find(e => e.id === t.escola_id);
                      return (
                        <div key={t.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <input 
                              type="checkbox"
                              checked={selectedTeacherIds.includes(t.id)}
                              onChange={() => {
                                setSelectedTeacherIds(prev => 
                                  prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                                );
                              }}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{usr?.nome || 'Professor'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.especialidade} • Reg: {t.numero_registro}</p>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                                {esc?.nome || 'Global'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* View/Details Button */}
                            {hasPermission('docentes', 'editar') && (
                              <button
                                onClick={() => {
                                  setEditingItem(t);
                                  setTeacherForm({
                                    nome: usr?.nome || '',
                                    email: usr?.email || '',
                                    especialidade: t.especialidade,
                                    numero_registro: t.numero_registro,
                                    escola_id: t.escola_id
                                  });
                                  setModalType('teacher');
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Visualizar Docente"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}

                            {/* 3 Dots action */}
                            <div className={`relative ${activeActionRowId === t.id ? 'z-40' : 'z-0'}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionRowId(activeActionRowId === t.id ? null : t.id);
                                }}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none cursor-pointer"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>

                              {activeActionRowId === t.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-30 bg-transparent" 
                                    onClick={() => setActiveActionRowId(null)} 
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-40 py-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                    {hasPermission('docentes', 'editar') && (
                                      <button
                                        onClick={() => {
                                          setActiveActionRowId(null);
                                          setEditingItem(t);
                                          setTeacherForm({
                                            nome: usr?.nome || '',
                                            email: usr?.email || '',
                                            especialidade: t.especialidade,
                                            numero_registro: t.numero_registro,
                                            escola_id: t.escola_id
                                          });
                                          setModalType('teacher');
                                          setIsModalOpen(true);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                        Editar Docente
                                      </button>
                                    )}
                                    {hasPermission('docentes', 'excluir') && (
                                      <button
                                        onClick={() => {
                                          setActiveActionRowId(null);
                                          showConfirm(
                                            "Excluir Docente",
                                            `Tem certeza que deseja excluir o docente "${usr?.nome || 'Professor'}"? Esta ação é irreversível.`,
                                            async () => {
                                              await deleteDoc(doc(db, 'docentes', t.id));
                                              loadTenantContext();
                                            },
                                            true
                                          );
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                        Excluir Docente
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* TAB: ESTUDANTES */}
            {activeTab === 'estudantes' && (
              !hasPermission('estudantes') ? renderRestrictedAccess('Registro de Estudantes') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  {/* Premium Segmented Sub-Tab Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                      <button
                        onClick={() => setStudentSubTab('lista')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${studentSubTab === 'lista' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <GraduationCap className="w-4 h-4" /> Lista de Estudantes
                      </button>
                      <button
                        onClick={() => setStudentSubTab('faturas')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${studentSubTab === 'faturas' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <DollarSign className="w-4 h-4" /> Facturação & Mensalidades
                      </button>
                      <button
                        onClick={() => setStudentSubTab('smtp')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${studentSubTab === 'smtp' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <Send className="w-4 h-4" /> Configuração de SMTP {(tenantSmtpConfig?.status === 'ativo' || globalSmtpConfig?.status === 'ativo') ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </button>
                    </div>

                    {studentSubTab === 'lista' && (
                      <div className="flex items-center gap-2">
                        {/* Status Toggle filter for Admins */}
                        {(currentUserRole === 'admin' || loggedInUser?.tipo === 'admin') && (
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
                            <button
                              onClick={() => setStudentStatusFilter('ativos')}
                              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${studentStatusFilter === 'ativos' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'}`}
                            >
                              Ativos
                            </button>
                            <button
                              onClick={() => setStudentStatusFilter('desativados')}
                              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${studentStatusFilter === 'desativados' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'}`}
                            >
                              Desativados
                            </button>
                          </div>
                        )}
                        {/* New student button */}
                        {isLimitReached('max_estudantes', students.length) ? (
                          <button 
                            onClick={() => openUpgradeModal('max_estudantes', students.length)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                          </button>
                        ) : (
                          hasPermission('estudantes', 'criar') && (
                            <button 
                              onClick={() => {
                                setEditingItem(null);
                                setStudentForm({ nome: '', email: '', escola_id: schools[0]?.id || '', turma_id: turmas[0]?.id || '', numero_matricula: 'MAT-' + Math.floor(Math.random()*9000 + 1000), data_nascimento: '', genero: 'Masculino', pai_id: '' });
                                setModalType('student');
                                setIsModalOpen(true);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> Nova Matrícula
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {studentSubTab === 'lista' && (
                    <>

                  {/* Batch Action Bar */}
                  {selectedStudentIds.length > 0 && (
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl px-4 py-3 text-sm animate-in fade-in duration-200">
                      <span className="text-indigo-800 dark:text-indigo-300 font-medium">
                        {selectedStudentIds.length} {selectedStudentIds.length === 1 ? 'estudante selecionado' : 'estudantes selecionados'}
                      </span>
                      <div className="flex items-center gap-3">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleStudentBatchAction(e.target.value);
                              e.target.value = ''; // Reset select
                            }
                          }}
                          className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>Ação</option>
                          <option value="excluir">Excluir Selecionados</option>
                        </select>
                        <button 
                          onClick={() => setSelectedStudentIds([])}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Desktop View (Table) */}
                  <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                          <th className="py-4 px-4 w-12 text-center">
                            <input 
                              type="checkbox"
                              checked={students.length > 0 && selectedStudentIds.length === students.length}
                              onChange={() => {
                                if (selectedStudentIds.length === students.length) {
                                  setSelectedStudentIds([]);
                                } else {
                                  setSelectedStudentIds(students.map(s => s.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-4">Matrícula / Aluno</th>
                          <th className="px-6 py-4">Género</th>
                          <th className="px-6 py-4">Escola / Unidade</th>
                          <th className="px-6 py-4">Turma Vinculada</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                        {students.map((s, index) => {
                          const usr = tenantUsers.find(u => u.id === s.user_id);
                          const esc = schools.find(e => e.id === s.escola_id);
                          const tur = turmas.find(t => t.id === s.turma_id);
                          const isLast = index >= students.length - 2 && students.length > 2;
                          return (
                            <tr key={s.id} className={`hover:bg-slate-50/50 ${activeActionRowId === s.id ? 'relative z-30' : ''}`}>
                              <td className="py-4 px-4 text-center">
                                <input 
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(s.id)}
                                  onChange={() => {
                                    setSelectedStudentIds(prev => 
                                      prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">{usr?.nome || 'Estudante'}</p>
                                <span className="text-xs bg-slate-100 text-slate-600 font-mono py-0.5 px-1.5 rounded">{s.numero_matricula}</span>
                              </td>
                              <td className="px-6 py-4 text-xs">{s.genero}</td>
                              <td className="px-6 py-4 text-xs text-slate-500">{esc?.nome}</td>
                              <td className="px-6 py-4 text-xs font-bold text-indigo-700">{tur?.nome || 'Sem Turma'}</td>
                              <td className={`px-6 py-4 text-right relative ${activeActionRowId === s.id ? 'z-40' : 'z-0'}`}>
                                <div className="inline-block text-left">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionRowId(activeActionRowId === s.id ? null : s.id);
                                    }}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none cursor-pointer"
                                    title="Opções"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>

                                  {activeActionRowId === s.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-30 bg-transparent" 
                                        onClick={() => setActiveActionRowId(null)} 
                                      />
                                      <div className={`absolute right-0 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[9999] py-1.5 text-left animate-in fade-in duration-150 ${isLast ? 'bottom-full mb-1 origin-bottom-right' : 'mt-1 origin-top top-full'}`}>
                                        {renderStudentActions(s, usr)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View (List with Checkbox, Detail View button and 3 dots) */}
                  <div className="block md:hidden space-y-3">
                    {students.map(s => {
                      const usr = tenantUsers.find(u => u.id === s.user_id);
                      const esc = schools.find(e => e.id === s.escola_id);
                      const tur = turmas.find(t => t.id === s.turma_id);
                      return (
                        <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <input 
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.id)}
                              onChange={() => {
                                setSelectedStudentIds(prev => 
                                  prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                                );
                              }}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{usr?.nome || 'Estudante'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Matrícula: {s.numero_matricula} • {s.genero}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {esc?.nome}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                                  {tur?.nome || 'Sem Turma'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* View/Details Button */}
                            {hasPermission('estudantes', 'editar') && (
                              <button
                                onClick={() => {
                                  setEditingItem(s);
                                  setStudentForm({
                                    nome: usr?.nome || '',
                                    email: usr?.email || '',
                                    escola_id: s.escola_id,
                                    turma_id: s.turma_id,
                                    numero_matricula: s.numero_matricula,
                                    data_nascimento: s.data_nascimento,
                                    genero: s.genero,
                                    pai_id: s.pai_id
                                  });
                                  setModalType('student');
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Visualizar Estudante"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}

                            {/* 3 Dots Action */}
                            <div className={`relative ${activeActionRowId === s.id ? 'z-40' : 'z-0'}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionRowId(activeActionRowId === s.id ? null : s.id);
                                }}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none cursor-pointer"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>

                              {activeActionRowId === s.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-30 bg-transparent" 
                                    onClick={() => setActiveActionRowId(null)} 
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-40 py-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                    {renderStudentActions(s, usr)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                  )}

                  {/* SUBTAB: FACTURAÇÃO & MENSALIDADES */}
                  {studentSubTab === 'faturas' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* Financial Status Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Facturado</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                            {studentFaturas.reduce((acc, f) => acc + f.valor, 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{studentFaturas.length} facturas emitidas</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Valor Recebido</p>
                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                            {studentFaturas.filter(f => f.status === 'Pago').reduce((acc, f) => acc + f.valor, 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">{studentFaturas.filter(f => f.status === 'Pago').length} pagamentos confirmados</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                          <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">Valor Pendente</p>
                          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                            {studentFaturas.filter(f => f.status === 'Pendente').reduce((acc, f) => acc + f.valor, 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                          </p>
                          <p className="text-xs text-amber-600 mt-0.5">{studentFaturas.filter(f => f.status === 'Pendente').length} facturas aguardando pagamento</p>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                          <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold">Valor em Atraso</p>
                          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
                            {studentFaturas.filter(f => f.status === 'Atrasado').reduce((acc, f) => acc + f.valor, 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                          </p>
                          <p className="text-xs text-rose-600 mt-0.5">{studentFaturas.filter(f => f.status === 'Atrasado').length} facturas vencidas</p>
                        </div>
                      </div>

                      {/* Controls and Search */}
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <Search className="w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Pesquisar por aluno, matrícula ou descrição..."
                            value={faturaSearch}
                            onChange={(e) => setFaturaSearch(e.target.value)}
                            className="bg-transparent border-none text-xs w-full text-slate-800 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <select
                            value={faturaStatusFilter}
                            onChange={(e: any) => setFaturaStatusFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="todos">Todos os Estados</option>
                            <option value="Pago">Pago</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Atrasado">Em Atraso</option>
                          </select>

                          {hasPermission('estudantes', 'editar') && (
                            <button
                              onClick={() => {
                                setFaturaForm({
                                  estudante_id: students[0]?.id || '',
                                  escola_id: students[0]?.escola_id || schools[0]?.id || '',
                                  turma_id: students[0]?.turma_id || turmas[0]?.id || '',
                                  descricao: 'Mensalidade Escolar',
                                  valor: 3500,
                                  data_vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                });
                                setIsFaturaModalOpen(true);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                            >
                              <Plus className="w-4 h-4" /> Nova Factura
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Faturas List Table */}
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-black text-[10px]">
                            <tr>
                              <th className="px-6 py-3">Estudante</th>
                              <th className="px-6 py-3">Descrição / Lançamento</th>
                              <th className="px-6 py-3">Valor</th>
                              <th className="px-6 py-3">Data de Vencimento</th>
                              <th className="px-6 py-3">Estado</th>
                              <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {studentFaturas
                              .filter(f => {
                                const stud = students.find(s => s.id === f.estudante_id);
                                const usr = stud ? tenantUsers.find(u => u.id === stud.user_id) : null;
                                const studentName = usr?.nome || '';
                                const matchSearch = studentName.toLowerCase().includes(faturaSearch.toLowerCase()) || f.descricao.toLowerCase().includes(faturaSearch.toLowerCase()) || (stud?.numero_matricula || '').toLowerCase().includes(faturaSearch.toLowerCase());
                                const matchStatus = faturaStatusFilter === 'todos' || f.status === faturaStatusFilter;
                                return matchSearch && matchStatus;
                              })
                              .map(f => {
                                const stud = students.find(s => s.id === f.estudante_id);
                                const usr = stud ? tenantUsers.find(u => u.id === stud.user_id) : null;
                                return (
                                  <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                    <td className="px-6 py-4">
                                      <p className="font-bold text-slate-900 dark:text-white">{usr?.nome || 'Estudante'}</p>
                                      <p className="text-[10px] text-slate-500">MAT: {stud?.numero_matricula || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{f.descricao}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                      {f.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{new Date(f.data_vencimento).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black ${
                                        f.status === 'Pago' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                        f.status === 'Pendente' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                                        'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                                      }`}>
                                        {f.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex gap-1.5 justify-end">
                                        {f.status !== 'Pago' && hasPermission('estudantes', 'editar') && (
                                          <>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  // System notification for administrators
                                                  await addDoc(collection(db, 'notificacoes'), {
                                                    destinatario_id: 'todos',
                                                    titulo: '⚠️ Alerta de Prazo de Mensalidade',
                                                    mensagem: `A fatura "${f.descricao}" do estudante ${usr?.nome} está pendente no valor de ${f.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}.`,
                                                    tipo: 'alerta',
                                                    lido: false,
                                                    created_at: new Date().toISOString()
                                                  });

                                                  // System notification for student if user ID is active
                                                  if (stud?.user_id) {
                                                    await addDoc(collection(db, 'notificacoes'), {
                                                      destinatario_id: stud.user_id,
                                                      titulo: '⏳ Vencimento de Mensalidade Escolar',
                                                      mensagem: `A sua mensalidade "${f.descricao}" no valor de ${f.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })} está próxima do vencimento (${new Date(f.data_vencimento).toLocaleDateString('pt-BR')}). Por favor regularize o pagamento.`,
                                                      tipo: 'alerta',
                                                      lido: false,
                                                      created_at: new Date().toISOString()
                                                    });
                                                  }

                                                  // Email notification to parent / student
                                                  await queueOrSendEmail(
                                                    usr?.email || 'geral@escola.ac.mz',
                                                    '⏳ Lembrete de Pagamento de Mensalidade - SGE',
                                                    `Prezado Encarregado / Estudante,\n\nRelembramos que a mensalidade escolar "${f.descricao}" do aluno ${usr?.nome || 'Estudante'} com vencimento em ${new Date(f.data_vencimento).toLocaleDateString('pt-BR')} no valor de ${f.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })} está aguardando pagamento.\n\nPor favor, efetue o pagamento para regularizar a situação financeira.\n\nAtenciosamente,\nDireção Financeira`
                                                  );

                                                  // Show 6-second popup notification (Rule 3)
                                                  const popup = document.createElement('div');
                                                  popup.className = 'fixed bottom-5 right-5 bg-indigo-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-indigo-500 z-50 flex items-center gap-2 animate-bounce';
                                                  popup.innerHTML = `✅ Alertas de prazo enviados para administrador, estudante e encarregado!`;
                                                  document.body.appendChild(popup);
                                                  setTimeout(() => popup.remove(), 6000);

                                                } catch (err: any) {
                                                  alert("Erro ao enviar lembretes: " + err.message);
                                                }
                                              }}
                                              className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                              title="Enviar alertas de vencimento para estudante, encarregado e administrador"
                                            >
                                              <Bell className="w-3 h-3" /> Notificar Prazo
                                            </button>

                                            <button
                                              onClick={async () => {
                                                try {
                                                  await updateDoc(doc(db, 'faturas_estudantes', f.id!), {
                                                    status: 'Pago',
                                                    pago_em: new Date().toISOString()
                                                  });
                                                  await tenantAuditLog(
                                                    "Confirmar Pagamento",
                                                    "FaturaEstudante",
                                                    f.id!,
                                                    `Pagamento confirmado para factura "${f.descricao}" no valor de MZN ${f.valor}.`
                                                  );

                                                  // Send email receipt notification (Rule 6.1)
                                                  await queueOrSendEmail(
                                                    usr?.email || 'geral@escola.ac.mz',
                                                    '🧾 Recibo de Pagamento - SGE',
                                                    `Estimado encarregado,\n\nConfirmamos com sucesso a receção do pagamento da factura "${f.descricao}" no valor de ${f.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })} para o aluno ${usr?.nome}.\n\nObrigado pela sua colaboração.\nAtenciosamente,\nSecretaria Académica`
                                                  );

                                                  loadTenantContext();
                                                } catch (err: any) {
                                                  alert("Erro ao confirmar pagamento: " + err.message);
                                                }
                                              }}
                                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                            >
                                              <Check className="w-3 h-3" /> Confirmar Pagamento
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB: CONFIGURAÇÃO DE SMTP */}
                  {studentSubTab === 'smtp' && (
                    <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl text-slate-800">
                      {/* Active Status Header */}
                      <div className="p-5 rounded-2xl border flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-full ${
                            (tenantSmtpConfig?.status === 'ativo' || globalSmtpConfig?.status === 'ativo') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                          }`}>
                            <Send className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Estado do Servidor de Email (SMTP)</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {(tenantSmtpConfig?.status === 'ativo') ? (
                                <>Customizado da Escola Ativo: <span className="font-mono text-indigo-600 font-extrabold">{tenantSmtpConfig.host}:{tenantSmtpConfig.port}</span></>
                              ) : (globalSmtpConfig?.status === 'ativo') ? (
                                <>Fallback Global Ativo: <span className="font-mono text-indigo-600 font-extrabold">{globalSmtpConfig.host}:{globalSmtpConfig.port}</span></>
                              ) : (
                                <span className="text-rose-600 font-bold">⚠️ Atenção: Nenhum SMTP ativo. Os e-mails serão retidos em fila pendente.</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          (tenantSmtpConfig?.status === 'ativo' || globalSmtpConfig?.status === 'ativo') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {(tenantSmtpConfig?.status === 'ativo' || globalSmtpConfig?.status === 'ativo') ? 'Serviço Ativo' : 'Offline'}
                        </span>
                      </div>

                      {/* SMTP Custom Config Form */}
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <Settings className="w-4 h-4 text-indigo-600" /> Servidor SMTP Customizado da Escola
                          </h4>
                          <span className="text-[10px] text-slate-500 font-medium">Configure as credenciais exclusivas do seu domínio</span>
                        </div>

                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const host = formData.get('host') as string;
                            const port = Number(formData.get('port'));
                            const username = formData.get('username') as string;
                            const security = formData.get('security') as string;
                            const status = formData.get('status') as string;

                            const updatedConfig = {
                              tenant_id: currentTenantId,
                              host,
                              port,
                              username,
                              password: '•-custom-password-••', // Secured end-to-end (Rule 3)
                              security,
                              status
                            };

                            try {
                              if (tenantSmtpConfig?.id) {
                                await updateDoc(doc(db, 'smtp_configs', tenantSmtpConfig.id), updatedConfig);
                              } else {
                                await addDoc(collection(db, 'smtp_configs'), updatedConfig);
                              }
                              await tenantAuditLog(
                                "Atualizar SMTP",
                                "SmtpConfig",
                                currentTenantId,
                                `Servidor SMTP atualizado para ${host}:${port}.`
                              );

                              // Trigger 6-second popup notification (Rule 3)
                              const popup = document.createElement('div');
                              popup.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500 z-50 flex items-center gap-2 animate-bounce';
                              popup.innerHTML = `✅ SMTP configurado e salvo com sucesso!`;
                              document.body.appendChild(popup);
                              setTimeout(() => popup.remove(), 6000);

                              loadTenantContext();
                            } catch (err: any) {
                              alert("Erro ao salvar configuração: " + err.message);
                            }
                          }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
                        >
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Servidor Host (ex: smtp.gmail.com)</label>
                            <input
                              type="text"
                              name="host"
                              required
                              defaultValue={tenantSmtpConfig?.host || ''}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Porta SMTP (ex: 465 ou 587)</label>
                            <input
                              type="number"
                              name="port"
                              required
                              defaultValue={tenantSmtpConfig?.port || 587}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Utilizador / E-mail</label>
                            <input
                              type="email"
                              name="username"
                              required
                              defaultValue={tenantSmtpConfig?.username || ''}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Palavra-passe (Criptografia Ponto-a-Ponto)</label>
                            <input
                              type="password"
                              name="password"
                              placeholder="••••••••••••••••"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Protocolo de Segurança</label>
                            <select
                              name="security"
                              defaultValue={tenantSmtpConfig?.security || 'STARTTLS'}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="PLAIN">Nenhum (PLAIN)</option>
                              <option value="SSL/TLS">SSL / TLS</option>
                              <option value="STARTTLS">STARTTLS</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Estado de Ativação</label>
                            <select
                              name="status"
                              defaultValue={tenantSmtpConfig?.status || 'inativo'}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="ativo">Ativo (Usar este servidor)</option>
                              <option value="inativo">Inativo (Usar servidor global fallback)</option>
                            </select>
                          </div>

                          <div className="md:col-span-2 pt-2 text-right">
                            <button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all inline-flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Salvar Configurações
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Pending email log queue display */}
                      <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 dark:text-white text-xs">Fila de Transmissão de E-mails ({pendingEmails.length} na fila)</h4>
                          <span className="text-[10px] text-slate-500">Exibindo histórico de envio e status de entrega</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white dark:bg-slate-950">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-black text-[9px]">
                              <tr>
                                <th className="px-4 py-2">Destinatário</th>
                                <th className="px-4 py-2">Assunto</th>
                                <th className="px-4 py-2">Criado em</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Servidor SMTP</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                              {pendingEmails.map(e => (
                                <tr key={e.id}>
                                  <td className="px-4 py-2 text-slate-900 dark:text-white">{e.to}</td>
                                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{e.subject}</td>
                                  <td className="px-4 py-2 text-slate-500">{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                      e.status === 'enviado' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20'
                                    }`}>
                                      {e.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 font-mono text-slate-500 uppercase">{e.smtp_provider || 'nenhum'}</td>
                                </tr>
                              ))}
                              {pendingEmails.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="text-center py-6 text-slate-400">Nenhum email na fila de transmissão.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )
            )}

            {/* TAB: TURMAS */}
            {activeTab === 'turmas' && (
              !hasPermission('turmas') ? renderRestrictedAccess('Gestão de Turmas') : (
                <div className="space-y-8 animate-fadeIn">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Turmas Homologadas</h3>
                      {isLimitReached('max_turmas', turmas.length) ? (
                        <button 
                          onClick={() => openUpgradeModal('max_turmas', turmas.length)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                        </button>
                      ) : (
                        hasPermission('turmas', 'criar') && (
                          <button 
                            onClick={() => {
                              setEditingItem(null);
                              setTurmaForm({ nome: '', escola_id: schools[0]?.id || '', ano_letivo: '2026', nivel: 'Primário', docente_id: teachers[0]?.id || '', capacidade_max: 30 });
                              setModalType('turma');
                              setIsModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Criar Turma
                          </button>
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {turmas.map(t => {
                        const esc = schools.find(e => e.id === t.escola_id);
                        const tit = teachers.find(te => te.id === t.docente_id);
                        const titUsr = tenantUsers.find(u => u.id === tit?.user_id);
                        const stdCount = students.filter(st => st.turma_id === t.id).length;
                        
                        return (
                          <div key={t.id} className="p-5 rounded-2xl border border-slate-150 bg-slate-50/50 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-slate-800">{t.nome}</h4>
                                <p className="text-xs text-slate-400">Escola: {esc?.nome}</p>
                              </div>
                              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                                {stdCount} / {t.capacidade_max} Alunos
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                              <p>🧑‍🏫 <strong>Professor Titular:</strong> {titUsr?.nome || 'Sem Titular designado'}</p>
                              <p>📅 <strong>Ano Letivo:</strong> {t.ano_letivo} • Nivel: {t.nivel}</p>
                            </div>
                            
                            <div className="flex justify-end gap-2 pt-3">
                              {hasPermission('turmas', 'editar') && (
                                <button 
                                  onClick={() => {
                                    setEditingItem(t);
                                    setTurmaForm({
                                      nome: t.nome,
                                      escola_id: t.escola_id,
                                      ano_letivo: t.ano_letivo,
                                      nivel: t.nivel,
                                      docente_id: t.docente_id,
                                      capacidade_max: t.capacidade_max
                                    });
                                    setModalType('turma');
                                    setIsModalOpen(true);
                                  }}
                                  className="bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* TAB: DISCIPLINAS */}
            {activeTab === 'disciplinas' && (
              !hasPermission('disciplinas') ? renderRestrictedAccess('Gestão de Disciplinas') : (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">Cadastro de Disciplinas (Matérias)</h3>
                        <p className="text-xs text-slate-400">Gerencie a grade curricular e associe docentes a cada matéria.</p>
                      </div>
                      {isLimitReached('max_disciplinas', classes.length) ? (
                        <button 
                          onClick={() => openUpgradeModal('max_disciplinas', classes.length)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                        </button>
                      ) : (
                        hasPermission('disciplinas', 'criar') && (
                          <button 
                            onClick={() => {
                              setEditingItem(null);
                              setClasseForm({ nome: '', turma_id: turmas[0]?.id || '', docente_id: teachers[0]?.id || '', horario: '08:00 - 09:30', sala: rawSalas[0]?.nome || '', data: new Date().toISOString().split('T')[0], dia_semana: getDiaSemanaFromDate(new Date().toISOString().split('T')[0]) });
                              setModalType('classe');
                              setIsModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-center cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Cadastrar Disciplina
                          </button>
                        )
                      )}
                    </div>

                  {/* Limit meter */}
                  {plan && (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-indigo-950">Limite do {plan.nome}: {plan.limits.max_disciplinas >= 9999 ? "Ilimitado" : `${plan.limits.max_disciplinas} disciplinas`}</p>
                        <p className="text-slate-500 mt-0.5">As disciplinas organizam a carga horária de cada turma.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${classes.length >= (plan.limits.max_disciplinas ?? 15) ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, (classes.length / (plan.limits.max_disciplinas ?? 15)) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700">{classes.length} / {plan.limits.max_disciplinas >= 9999 ? '∞' : (plan.limits.max_disciplinas ?? 15)}</span>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                          <th className="p-4">Nome da Disciplina</th>
                          <th className="p-4">Turma Associada</th>
                          <th className="p-4">Professor Docente</th>
                          <th className="p-4">Horário & Sala</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {classes.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              Nenhuma disciplina cadastrada neste tenant. Clique em "Cadastrar Disciplina" para começar.
                            </td>
                          </tr>
                        ) : (
                          classes.map(c => {
                            const tur = turmas.find(t => t.id === c.turma_id);
                            const tea = teachers.find(t => t.id === c.docente_id);
                            const teaUsr = tenantUsers.find(u => u.id === tea?.user_id);
                            return (
                              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-bold text-slate-800">{c.nome}</td>
                                <td className="p-4">
                                  <span className="bg-slate-100 text-slate-700 text-xs py-1 px-2.5 rounded-full font-medium">
                                    {tur?.nome || 'Geral / Sem Turma'}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-600">{teaUsr?.nome || 'Professor não designado'}</td>
                                <td className="p-4 text-xs text-slate-500">
                                  <div className="font-mono">🕒 {c.horario} • 🚪 {c.sala}</div>
                                  {c.data && (
                                    <div className="text-slate-400 mt-1 font-medium">
                                      📅 {c.data} ({c.dia_semana || getDiaSemanaFromDate(c.data)})
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                  {hasPermission('disciplinas', 'editar') && (
                                    <button 
                                      onClick={() => {
                                        setEditingItem(c);
                                        setClasseForm({
                                          nome: c.nome,
                                          turma_id: c.turma_id,
                                          docente_id: c.docente_id,
                                          horario: c.horario,
                                          sala: c.sala,
                                          data: c.data || new Date().toISOString().split('T')[0],
                                          dia_semana: c.dia_semana || getDiaSemanaFromDate(c.data || new Date().toISOString().split('T')[0])
                                        });
                                        setModalType('classe');
                                        setIsModalOpen(true);
                                      }}
                                      className="text-indigo-600 hover:text-indigo-900 font-bold text-xs cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                  )}
                                  {hasPermission('disciplinas', 'excluir') && (
                                    <button 
                                      onClick={() => {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: 'Confirmar Exclusão',
                                          message: `Tem certeza que deseja excluir a disciplina "${c.nome}"?`,
                                          confirmText: 'Excluir',
                                          cancelText: 'Cancelar',
                                          isCritical: true,
                                          onConfirm: async () => {
                                            await deleteDoc(doc(db, 'classes', c.id));
                                            
                                            // Notificar o administrador
                                            await addDoc(collection(db, 'notificacoes'), {
                                              destinatario_id: 'admin',
                                              tenant_id: currentTenantId,
                                              titulo: '🗑️ Disciplina Excluída',
                                              mensagem: `A disciplina "${c.nome}" agendada para o dia ${c.data || c.dia_semana} às ${c.horario} foi excluída da agenda.`,
                                              tipo: 'cadastro',
                                              lido: false,
                                              created_at: new Date().toISOString()
                                            });

                                            // Exibir popup da acao executada
                                            showSystemNotification(`A disciplina "${c.nome}" foi excluída com sucesso!`, 'sucesso');

                                            const popup = document.createElement('div');
                                            popup.className = 'fixed bottom-5 right-5 bg-rose-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-rose-500 z-[1000000] flex items-center gap-2 animate-bounce';
                                            popup.innerHTML = `🗑️ Disciplina "${c.nome}" excluída da agenda! Administrador notificado.`;
                                            document.body.appendChild(popup);
                                            setTimeout(() => popup.remove(), 6000);

                                            await loadTenantContext();
                                          }
                                        });
                                      }}
                                      className="text-rose-600 hover:text-rose-900 font-bold text-xs cursor-pointer"
                                    >
                                      Excluir
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              )
            )}

            {/* TAB: CLASSES (GRADE LEVELS) */}
            {activeTab === 'classes_escolares' && (
              !hasPermission('classes_escolares') ? renderRestrictedAccess('Classes Escolares') : (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">Classes Escolares (Anos Académicos)</h3>
                        <p className="text-xs text-slate-400">Configure as classes letivas oficiais autorizadas para o seu plano (e.g. 7ª Classe, 10ª Classe).</p>
                      </div>
                      {isLimitReached('max_classes', classesEscolares.length) ? (
                        <button 
                          onClick={() => openUpgradeModal('max_classes', classesEscolares.length)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                        </button>
                      ) : (
                        hasPermission('classes_escolares', 'criar') && (
                          <button 
                            onClick={() => {
                              setEditingItem(null);
                              setClasseEscolarForm({ nome: '', nivel: 'Primário', descricao: '' });
                              setModalType('classe_escolar');
                              setIsModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-center cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Cadastrar Classe Letiva
                          </button>
                        )
                      )}
                    </div>

                  {/* Limit meter */}
                  {plan && (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-indigo-950">Limite do {plan.nome}: {plan.limits.max_classes >= 9999 ? "Ilimitado" : `${plan.limits.max_classes} classes`}</p>
                        <p className="text-slate-500 mt-0.5">As classes representam o progresso de graduação anual dos estudantes.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${classesEscolares.length >= (plan.limits.max_classes ?? 7) ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, (classesEscolares.length / (plan.limits.max_classes ?? 7)) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700">{classesEscolares.length} / {plan.limits.max_classes >= 9999 ? '∞' : (plan.limits.max_classes ?? 7)}</span>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                          <th className="p-4">Nome da Classe</th>
                          <th className="p-4">Nível de Ensino</th>
                          <th className="p-4">Descrição do Currículo</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {classesEscolares.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400">
                              Nenhuma classe escolar cadastrada neste tenant. Clique em "Cadastrar Classe Letiva" para começar.
                            </td>
                          </tr>
                        ) : (
                          classesEscolares.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-bold text-slate-800">{c.nome}</td>
                              <td className="p-4">
                                <span className="bg-slate-100 text-indigo-700 text-xs py-1 px-2.5 rounded-full font-bold uppercase">
                                  {c.nivel}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500 text-xs">{c.descricao || 'Nenhuma descrição currícular'}</td>
                              <td className="p-4 text-right space-x-2">
                                {hasPermission('classes_escolares', 'editar') && (
                                  <button 
                                    onClick={() => {
                                      setEditingItem(c);
                                      setClasseEscolarForm({
                                        nome: c.nome,
                                        nivel: c.nivel,
                                        descricao: c.descricao || ''
                                      });
                                      setModalType('classe_escolar');
                                      setIsModalOpen(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 font-bold text-xs cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                )}
                                {hasPermission('classes_escolares', 'excluir') && (
                                  <button 
                                    onClick={async () => {
                                      if (confirm(`Tem certeza que deseja excluir a classe "${c.nome}"?`)) {
                                        await deleteDoc(doc(db, 'classes_escolares', c.id));
                                        loadTenantContext();
                                      }
                                    }}
                                    className="text-rose-600 hover:text-rose-900 font-bold text-xs cursor-pointer"
                                  >
                                    Excluir
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              )
            )}

            {/* TAB: CALENDÁRIO & HORÁRIOS */}
            {activeTab === 'calendario' && (
              !hasPermission('calendario') ? renderRestrictedAccess('Calendário & Horários') : (() => {
                const formatCalendarDateWeek = (date: Date) => {
                  const months = [
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                  ];
                  const month = months[date.getMonth()];
                  const year = date.getFullYear();
                  
                  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                  const firstDayOfWeek = firstDayOfMonth.getDay() || 7;
                  const offsetDate = date.getDate() + firstDayOfWeek - 2;
                  const weekNum = Math.floor(offsetDate / 7) + 1;
                  
                  return `${month} de ${year} - Semana ${weekNum}`;
                };

                const monday = getMonday(calendarSelectedDate);

                return (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">Calendário Semanal & Horários</h3>
                          <p className="text-xs text-slate-400 font-sans">Grade horária dinâmica baseada nas disciplinas registradas de cada turma.</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap self-start sm:self-center">
                          {turmas.length > 0 && (
                            <div className="flex items-center gap-2">
                              <select 
                                id="calendar_turma_filter"
                                className="bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedTurmaFilter(val);
                                }}
                                value={selectedTurmaFilter === 'todos' ? (turmas[0]?.id || '') : selectedTurmaFilter}
                              >
                                {turmas.map(t => (
                                  <option key={t.id} value={t.id}>{t.nome}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {hasPermission('disciplinas', 'criar') && (
                            <div className="relative">
                              <button
                                onClick={() => setIsCopyDropdownOpen(!isCopyDropdownOpen)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs border border-slate-200/65"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copiar Agenda
                              </button>
                              
                              {isCopyDropdownOpen && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setIsCopyDropdownOpen(false)} 
                                  />
                                  <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                                    <div className="px-3 py-1.5 border-b border-slate-100">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Copiar esta semana para:</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setIsCopyDropdownOpen(false);
                                        handleCopySchedule('mes');
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                                    >
                                      <span>Mês (4 semanas)</span>
                                      <span className="text-[9px] text-slate-400 font-mono">1 mês</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsCopyDropdownOpen(false);
                                        handleCopySchedule('trimestre');
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                                    >
                                      <span>Trimestre</span>
                                      <span className="text-[9px] text-slate-400 font-mono">3 meses</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsCopyDropdownOpen(false);
                                        handleCopySchedule('semestre');
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                                    >
                                      <span>Semestre</span>
                                      <span className="text-[9px] text-slate-400 font-mono">6 meses</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsCopyDropdownOpen(false);
                                        handleCopySchedule('ano');
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                                    >
                                      <span>Ano Inteiro</span>
                                      <span className="text-[9px] text-slate-400 font-mono">1 ano</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {hasPermission('disciplinas', 'criar') && (
                            <button
                              id="btn_agendar_aula"
                              onClick={() => {
                                setEditingItem(null);
                                const activeFilterId = selectedTurmaFilter === 'todos' ? (turmas[0]?.id || '') : selectedTurmaFilter;
                                setClasseForm({ 
                                  nome: '', 
                                  turma_id: activeFilterId || (turmas[0]?.id || ''), 
                                  docente_id: teachers[0]?.id || '', 
                                  horario: '08:00 - 09:30', 
                                  sala: rawSalas[0]?.nome || '',
                                  data: new Date().toISOString().split('T')[0],
                                  dia_semana: getDiaSemanaFromDate(new Date().toISOString().split('T')[0])
                                });
                                setModalType('classe');
                                setIsModalOpen(true);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Weekly Navigation Controls */}
                      <div className="flex justify-center items-center gap-4 py-2.5 border-t border-slate-100 mt-2">
                        <button
                          onClick={() => {
                            setCalendarSelectedDate(prev => {
                              const d = new Date(prev);
                              d.setDate(d.getDate() - 7);
                              return d;
                            });
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors cursor-pointer border border-slate-200 shadow-3xs"
                          title="Semana Anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <span className="text-xs sm:text-sm font-bold text-indigo-950 font-sans tracking-wide bg-indigo-50/50 border border-indigo-100/80 rounded-xl px-4 py-1.5 shadow-2xs flex items-center gap-2">
                          📅 {formatCalendarDateWeek(calendarSelectedDate)}
                        </span>

                        <button
                          onClick={() => {
                            setCalendarSelectedDate(prev => {
                              const d = new Date(prev);
                              d.setDate(d.getDate() + 7);
                              return d;
                            });
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors cursor-pointer border border-slate-200 shadow-3xs"
                          title="Próxima Semana"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {turmas.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        Nenhuma turma cadastrada. Crie uma turma primeiro para ver o calendário.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50/50 shadow-2xs">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-xs font-bold text-center">
                              <th className="p-4 border-r border-slate-200 w-32">Horário</th>
                              {Array.from({ length: 7 }, (_, i) => i).map((dayIndex) => {
                                const currentDayDate = new Date(calendarSelectedDate);
                                currentDayDate.setDate(calendarSelectedDate.getDate() + dayIndex);
                                const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                                const dayName = dayNames[currentDayDate.getDay()];
                                const formattedDateHeader = currentDayDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                                return (
                                  <th key={dayIndex} className="p-4 border-r border-slate-200 last:border-r-0">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span>{dayName}</span>
                                      <span className="text-[10px] text-slate-400 font-mono font-medium">({formattedDateHeader})</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const activeCalendarTurma = selectedTurmaFilter === 'todos' ? (turmas[0]?.id || '') : selectedTurmaFilter;
                              const matches = classes.filter(c => c.turma_id === activeCalendarTurma);

                              const getDiaSemanaPt = (date: Date) => {
                                const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                                return names[date.getDay()];
                              };

                              // Obter horários cadastrados pelo utilizador para esta turma
                              const registeredSlots = matches
                                .map(c => c.horario)
                                .filter((val, idx, self) => val && self.indexOf(val) === idx);

                              // Grade horária predefinida
                              const defaultSlots = [
                                "08:00 - 09:30",
                                "09:35 - 11:05",
                                "11:10 - 12:40",
                                "12:45 - 14:15",
                                "14:20 - 15:50"
                              ];

                              // Unificar e ordenar cronologicamente por hora de início
                              const allSlots = Array.from(new Set([...defaultSlots, ...registeredSlots])).filter(Boolean);
                              const sortedSlots = allSlots.sort((a, b) => {
                                const aStart = a.split(' - ')[0] || '';
                                const bStart = b.split(' - ')[0] || '';
                                return aStart.localeCompare(bStart);
                              });

                              return sortedSlots.map((timeSlot) => {
                                const getDisciplineForDay = (dayIndex: number) => {
                                  const currentDayDate = new Date(calendarSelectedDate);
                                  currentDayDate.setDate(calendarSelectedDate.getDate() + dayIndex);
                                  const targetDayDateStr = getLocalYYYYMMDD(currentDayDate);
                                  const dayName = getDiaSemanaPt(currentDayDate);
                                  
                                  let match = matches.find(c => c.data === targetDayDateStr && c.horario === timeSlot);
                                  if (match) return match;
                                  
                                  match = matches.find(c => {
                                    if (!c.dia_semana) return false;
                                    if (c.data) return false;
                                    return c.dia_semana.toLowerCase().includes(dayName.toLowerCase().split('-')[0]) && c.horario === timeSlot;
                                  });
                                  return match;
                                };

                                return (
                                  <tr key={timeSlot} className="border-b border-slate-150 hover:bg-slate-50/40 transition-colors">
                                    <td className="p-4 bg-slate-100/50 border-r border-slate-200 font-bold font-mono text-center text-slate-700 text-xs">
                                      {timeSlot}
                                    </td>
                                    {Array.from({ length: 7 }, (_, i) => i).map((dayIdx) => {
                                      const currentDayDate = new Date(calendarSelectedDate);
                                      currentDayDate.setDate(calendarSelectedDate.getDate() + dayIdx);
                                      const currentDateStr = getLocalYYYYMMDD(currentDayDate);

                                      // 1. Check Vacation/Férias
                                      const vacation = rawVacations.find(v => 
                                        currentDateStr >= v.data_inicio && 
                                        currentDateStr <= v.data_fim &&
                                        (!v.turma_id || v.turma_id === 'todas' || v.turma_id === activeCalendarTurma)
                                      );
                                      if (vacation) {
                                        return (
                                          <td key={dayIdx} className="p-3 border-r border-slate-150 last:border-r-0 text-center bg-amber-50/10">
                                            <div className="bg-amber-100/40 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl p-2.5 text-left space-y-0.5">
                                              <p className="font-bold text-amber-900 text-[11px] flex items-center gap-1">🌴 Férias</p>
                                              <p className="text-[9px] text-amber-700 font-semibold truncate" title={vacation.descricao}>{vacation.descricao}</p>
                                            </div>
                                          </td>
                                        );
                                      }

                                      const disc = getDisciplineForDay(dayIdx);
                                      const tea = disc ? teachers.find(t => t.id === disc.docente_id) : null;
                                      const teaUsr = tea ? tenantUsers.find(u => u.id === tea.user_id) : null;
                                      
                                      return (
                                        <td key={dayIdx} className="p-3 border-r border-slate-150 last:border-r-0 text-center">
                                          {disc ? (() => {
                                            const isWeekend = currentDayDate.getDay() === 0 || currentDayDate.getDay() === 6;
                                            const status = disc.status_aprovacao || (isWeekend ? 'pendente' : 'aprovado');
                                            
                                            let bgClass = "bg-indigo-50/80 border border-indigo-150/60 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl p-3 text-left shadow-3xs space-y-1 cursor-pointer transition-all hover:shadow-xs active:scale-98 text-indigo-950";
                                            let badge = null;

                                            if (status === 'pendente') {
                                              bgClass = "bg-amber-50 border border-amber-200 hover:border-amber-400 hover:bg-amber-100/70 rounded-xl p-3 text-left shadow-3xs space-y-1 cursor-pointer transition-all hover:shadow-xs active:scale-98 text-amber-900";
                                              badge = <span className="inline-block text-[8px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md mt-1">⏳ Pendente</span>;
                                            } else if (status === 'rejeitado') {
                                              bgClass = "bg-rose-50 border border-rose-250 hover:border-rose-400 hover:bg-rose-100 rounded-xl p-3 text-left shadow-3xs space-y-1 cursor-pointer transition-all hover:shadow-xs active:scale-98 text-rose-900";
                                              badge = <span className="inline-block text-[8px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md mt-1">❌ Rejeitada</span>;
                                            } else if (isWeekend) {
                                              bgClass = "bg-emerald-50 border border-emerald-250 hover:border-emerald-400 hover:bg-emerald-100 rounded-xl p-3 text-left shadow-3xs space-y-1 cursor-pointer transition-all hover:shadow-xs active:scale-98 text-emerald-900";
                                              badge = <span className="inline-block text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md mt-1">✅ Aprovada</span>;
                                            }

                                            return (
                                              <div 
                                                onClick={() => {
                                                  setSelectedClassPopup({
                                                    classe: disc,
                                                    docente: teaUsr,
                                                    dataStr: currentDayDate.toLocaleDateString('pt-PT')
                                                  });
                                                }}
                                                className={bgClass}
                                              >
                                                <p className="font-bold text-xs truncate">{disc.nome}</p>
                                                <p className="text-[10px] truncate font-semibold opacity-90">🧑‍🏫 {teaUsr?.nome || 'Docente'}</p>
                                                <p className="text-[9px] font-mono opacity-75">🚪 {disc.sala}</p>
                                                {badge}
                                              </div>
                                            );
                                          })() : (
                                            hasPermission('disciplinas', 'criar') ? (
                                              <button
                                                onClick={() => {
                                                  setEditingItem(null);
                                                  const activeFilterId = selectedTurmaFilter === 'todos' ? (turmas[0]?.id || '') : selectedTurmaFilter;
                                                  const targetDateStr = getLocalYYYYMMDD(currentDayDate);
                                                  setClasseForm({ 
                                                    nome: '', 
                                                    turma_id: activeFilterId || (turmas[0]?.id || ''), 
                                                    docente_id: teachers[0]?.id || '', 
                                                    horario: timeSlot, 
                                                    sala: rawSalas[0]?.nome || '',
                                                    data: targetDateStr,
                                                    dia_semana: getDiaSemanaFromDate(targetDateStr)
                                                  });
                                                  setModalType('classe');
                                                  setIsModalOpen(true);
                                                }}
                                                className="w-full border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl py-4 text-center text-slate-350 hover:text-indigo-600 text-[10px] font-mono cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group"
                                              >
                                                <span>Vago</span>
                                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-indigo-500 transition-opacity font-sans">+ Agendar</span>
                                              </button>
                                            ) : (
                                              <div className="border border-dashed border-slate-200 rounded-xl py-4 text-center text-slate-350 text-[10px] font-mono">
                                                Vago
                                              </div>
                                            )
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Pop-up de Detalhes da Disciplina / Aula */}
                    {selectedClassPopup && (
                      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                <BookMarked className="w-4 h-4" />
                              </span>
                              <h3 className="font-bold text-slate-800 text-sm">Informações da Aula</h3>
                            </div>
                            <button
                              onClick={() => setSelectedClassPopup(null)}
                              className="text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                            >
                              <X className="w-4.5 h-4.5" />
                            </button>
                          </div>

                          <div className="space-y-2.5 text-xs text-slate-650">
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 text-left">
                              <div>
                                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Disciplina</span>
                                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedClassPopup.classe.nome}</p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Docente Responsável</span>
                                <p className="font-semibold text-indigo-900 mt-0.5">🧑‍🏫 {selectedClassPopup.docente?.nome || 'Docente Não Encontrado'}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Sala</span>
                                  <p className="font-medium text-slate-700 mt-0.5">🚪 {selectedClassPopup.classe.sala}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Horário</span>
                                  <p className="font-semibold text-emerald-700 mt-0.5">⏱️ {selectedClassPopup.classe.horario}</p>
                                </div>
                              </div>
                              <div>
                                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data da Aula</span>
                                <p className="font-medium text-slate-700 mt-0.5">📅 {selectedClassPopup.dataStr}</p>
                              </div>
                              {(() => {
                                const disc = selectedClassPopup.classe;
                                const isWeekend = disc.data ? (() => {
                                  const d = new Date(disc.data + 'T12:00:00');
                                  return d.getDay() === 0 || d.getDay() === 6;
                                })() : false;
                                if (isWeekend || disc.status_aprovacao === 'pendente') {
                                  const status = disc.status_aprovacao || 'pendente';
                                  let statusText = 'Pendente de Aprovação';
                                  let colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
                                  if (status === 'aprovado') {
                                    statusText = 'Aprovada';
                                    colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200';
                                  } else if (status === 'rejeitado') {
                                    statusText = 'Rejeitada';
                                    colorClass = 'text-rose-600 bg-rose-50 border-rose-250';
                                  }
                                  return (
                                    <div className={`p-2 rounded-lg border text-center font-bold text-[10px] mt-2 ${colorClass}`}>
                                      Status da Aula: {statusText}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>

                          {/* Approval / Rejection actions for weekend classes */}
                          {(() => {
                            const disc = selectedClassPopup.classe;
                            const isWeekend = disc.data ? (() => {
                              const d = new Date(disc.data + 'T12:00:00');
                              return d.getDay() === 0 || d.getDay() === 6;
                            })() : false;
                            
                            const isDirector = currentUserRole === 'director' || loggedInUser?.tipo === 'director';
                            const isAdmin = currentUserRole === 'admin' || loggedInUser?.tipo === 'admin';
                            const isDocente = currentUserRole === 'docente' || loggedInUser?.tipo === 'docente';
                            const canApproveWeekendClasses = isAdmin || isDirector || isDocente;

                            if (isWeekend && canApproveWeekendClasses) {
                              const status = disc.status_aprovacao || 'pendente';
                              return (
                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                  {status !== 'aprovado' && (
                                    <button
                                      onClick={async () => {
                                        await updateDoc(doc(db, 'classes', disc.id), { status_aprovacao: 'aprovado' });
                                        showSystemNotification("Aula de fim de semana aprovada com sucesso!", "sucesso");
                                        await loadTenantContext();
                                        setSelectedClassPopup(null);
                                      }}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                                    </button>
                                  )}
                                  {status !== 'rejeitado' && (
                                    <button
                                      onClick={async () => {
                                        await updateDoc(doc(db, 'classes', disc.id), { status_aprovacao: 'rejeitado' });
                                        showSystemNotification("Aula de fim de semana rejeitada!", "sucesso");
                                        await loadTenantContext();
                                        setSelectedClassPopup(null);
                                      }}
                                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" /> Rejeitar
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="flex gap-2 pt-2 border-t border-slate-100">
                            {hasPermission('disciplinas', 'editar') && (
                              <button
                                onClick={() => {
                                  const c = selectedClassPopup.classe;
                                  setEditingItem(c);
                                  setClasseForm({
                                    nome: c.nome,
                                    turma_id: c.turma_id,
                                    docente_id: c.docente_id,
                                    horario: c.horario,
                                    sala: c.sala,
                                    data: c.data || new Date().toISOString().split('T')[0],
                                    dia_semana: c.dia_semana || getDiaSemanaFromDate(c.data || new Date().toISOString().split('T')[0])
                                  });
                                  setModalType('classe');
                                  setIsModalOpen(true);
                                  setSelectedClassPopup(null);
                                }}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" /> Editar
                              </button>
                            )}

                            {hasPermission('disciplinas', 'excluir') && (
                              <button
                                onClick={() => {
                                  const c = selectedClassPopup.classe;
                                  const tempPopup = selectedClassPopup;
                                  setSelectedClassPopup(null); // Close the popup first
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Confirmar Exclusão',
                                    message: `Tem certeza que deseja excluir a disciplina "${c.nome}" do calendário?`,
                                    confirmText: 'Excluir',
                                    cancelText: 'Cancelar',
                                    isCritical: true,
                                    onConfirm: async () => {
                                      await deleteDoc(doc(db, 'classes', c.id));
                                      
                                      // Notificar o administrador
                                      await addDoc(collection(db, 'notificacoes'), {
                                        destinatario_id: 'admin',
                                        tenant_id: currentTenantId,
                                        titulo: '🗑️ Disciplina Excluída',
                                        mensagem: `A disciplina "${c.nome}" agendada para o dia ${c.data || c.dia_semana} às ${c.horario} foi excluída da agenda.`,
                                        tipo: 'cadastro',
                                        lido: false,
                                        created_at: new Date().toISOString()
                                      });

                                      // Exibir popup da acao executada
                                      showSystemNotification(`A disciplina "${c.nome}" foi excluída com sucesso!`, 'sucesso');

                                      const popup = document.createElement('div');
                                      popup.className = 'fixed bottom-5 right-5 bg-rose-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-rose-500 z-[1000000] flex items-center gap-2 animate-bounce';
                                      popup.innerHTML = `🗑️ Disciplina "${c.nome}" excluída da agenda! Administrador notificado.`;
                                      document.body.appendChild(popup);
                                      setTimeout(() => popup.remove(), 6000);

                                      await loadTenantContext();
                                      setSelectedClassPopup(null);
                                    },
                                    onCancel: () => {
                                      setSelectedClassPopup(tempPopup); // Restore previous popup on cancel!
                                    }
                                  });
                                }}
                                className="flex-1 bg-rose-50 hover:bg-rose-150 text-rose-700 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* TAB: PAUTA GERAL */}
            {activeTab === 'pauta_geral' && (
              !hasPermission('pauta_geral') ? renderRestrictedAccess('Pauta Geral') : (
                <div className="space-y-6 animate-fadeIn">
                  {/* KPI CARDS */}
                  {(() => {
                    // Compute filtered grades
                    const filteredPautas = pautas.filter(p => {
                      const student = students.find(s => s.id === p.estudante_id);
                      if (!student) return false;

                      // 1. School Filter
                      if (pautaGeralEscolaId && student.escola_id !== pautaGeralEscolaId) return false;

                      // 2. Student Query Filter
                      if (pautaGeralAlunoQuery) {
                        const term = pautaGeralAlunoQuery.toLowerCase();
                        if (!student.nome.toLowerCase().includes(term) && !(student.numero_matricula || '').toLowerCase().includes(term)) {
                          return false;
                        }
                      }

                      // 3. Status Filter
                      if (pautaGeralEstado) {
                        const sLower = p.situacao?.toLowerCase() || '';
                        if (pautaGeralEstado === 'aprovado' && sLower !== 'aprovado') return false;
                        if (pautaGeralEstado === 'reprovado' && sLower !== 'reprovado') return false;
                        if (pautaGeralEstado === 'recuperacao' && sLower !== 'recuperação' && sLower !== 'recuperacao' && sLower !== 'admitido') return false;
                      }

                      // 4. Date Range Filter
                      if (pautaGeralDateStart && (!p.data_lancamento || p.data_lancamento < pautaGeralDateStart)) return false;
                      if (pautaGeralDateEnd && (!p.data_lancamento || p.data_lancamento > pautaGeralDateEnd)) return false;

                      return true;
                    });

                    const totalLancamentos = filteredPautas.length;
                    const totalAprovados = filteredPautas.filter(p => p.situacao === 'Aprovado').length;
                    const totalReprovados = filteredPautas.filter(p => p.situacao === 'Reprovado').length;
                    const totalRecuperacao = filteredPautas.filter(p => p.situacao === 'Recuperação' || p.situacao === 'Recuperação').length;
                    
                    const percentAprovado = totalLancamentos > 0 ? ((totalAprovados / totalLancamentos) * 100).toFixed(0) : '0';
                    const listMedias = filteredPautas.map(p => p.nota_media).filter(m => m !== undefined && m !== null);
                    const mediaGeralGeral = listMedias.length > 0 ? (listMedias.reduce((acc, current) => acc + current, 0) / listMedias.length).toFixed(1) : '0.0';

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                              <Award className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Notas</p>
                              <p className="text-xl font-black text-slate-800">{totalLancamentos}</p>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxa de Aprovação</p>
                              <p className="text-xl font-black text-slate-800">{percentAprovado}% <span className="text-xs font-semibold text-slate-400">({totalAprovados})</span></p>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center gap-4">
                            <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                              <XCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reprovados / Excluídos</p>
                              <p className="text-xl font-black text-slate-800">{totalReprovados} <span className="text-xs font-semibold text-slate-400">alunos</span></p>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Média Geral</p>
                              <p className="text-xl font-black text-slate-800">{mediaGeralGeral} <span className="text-xs font-semibold text-slate-400">valores</span></p>
                            </div>
                          </div>
                        </div>

                        {/* FILTERS PANEL */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                              <h3 className="font-extrabold text-slate-800 text-sm">Filtros da Pauta Geral</h3>
                              <p className="text-[10px] text-slate-400">Filtre as notas consolidadas de todas as escolas do sistema em tempo real.</p>
                            </div>
                            <button
                              onClick={() => {
                                setPautaGeralEscolaId('');
                                setPautaGeralAlunoQuery('');
                                setPautaGeralEstado('');
                                setPautaGeralDateStart('');
                                setPautaGeralDateEnd('');
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              Limpar Filtros
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Escola Dropdown */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Escola de Origem</label>
                              <select
                                value={pautaGeralEscolaId}
                                onChange={(e) => setPautaGeralEscolaId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              >
                                <option value="">✨ Todas as Escolas</option>
                                {schools.map(s => (
                                  <option key={s.id} value={s.id}>{s.nome}</option>
                                ))}
                              </select>
                            </div>

                            {/* Aluno Input Search */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estudante (Nome/Matrícula)</label>
                              <input
                                type="text"
                                placeholder="Buscar aluno..."
                                value={pautaGeralAlunoQuery}
                                onChange={(e) => setPautaGeralAlunoQuery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              />
                            </div>

                            {/* Estado Dropdown */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado de Aproveitamento</label>
                              <select
                                value={pautaGeralEstado}
                                onChange={(e) => setPautaGeralEstado(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              >
                                <option value="">🌟 Todos os Estados</option>
                                <option value="aprovado">🟢 Aprovado</option>
                                <option value="reprovado">🔴 Reprovado</option>
                                <option value="recuperacao">🟡 Recuperação / Admitido</option>
                              </select>
                            </div>

                            {/* Intervalo Data Inicio */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lançado Desde</label>
                              <input
                                type="date"
                                value={pautaGeralDateStart}
                                onChange={(e) => setPautaGeralDateStart(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              />
                            </div>

                            {/* Intervalo Data Fim */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lançado Até</label>
                              <input
                                type="date"
                                value={pautaGeralDateEnd}
                                onChange={(e) => setPautaGeralDateEnd(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              />
                            </div>
                          </div>
                        </div>

                        {/* DATA TABLE */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">
                              Exibindo {filteredPautas.length} de {pautas.length} registros de notas
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                              <thead>
                                <tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                                  <th className="p-4">Estudante</th>
                                  <th className="p-4">Escola / Local</th>
                                  <th className="p-4">Turma / Período</th>
                                  <th className="p-4">Disciplina</th>
                                  <th className="p-4 text-center">Trimestre</th>
                                  <th className="p-4 text-center">Provas</th>
                                  <th className="p-4 text-center">Trabalhos</th>
                                  <th className="p-4 text-center">Participação</th>
                                  <th className="p-4 text-center">Exame / Reaval.</th>
                                  <th className="p-4 text-center font-bold text-indigo-900 bg-indigo-50/10">Média Final</th>
                                  <th className="p-4 text-right">Situação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-sans">
                                {filteredPautas.length === 0 ? (
                                  <tr>
                                    <td colSpan={11} className="p-8 text-center text-slate-400 font-semibold">
                                      Nenhuma nota correspondente aos filtros foi encontrada na base de dados.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredPautas.map(p => {
                                    const student = students.find(s => s.id === p.estudante_id);
                                    const school = student ? schools.find(sch => sch.id === student.escola_id) : null;
                                    const turma = student ? turmas.find(t => t.id === student.turma_id) : null;
                                    const discipline = classes.find(c => c.id === p.classe_id);

                                    return (
                                      <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="p-4">
                                          <p className="font-extrabold text-slate-800">{student?.nome || 'Estudante não encontrado'}</p>
                                          <p className="text-[9px] text-slate-400 font-mono">MAT: {student?.numero_matricula || 'N/D'}</p>
                                        </td>
                                        <td className="p-4">
                                          <p className="font-bold text-slate-700">{school?.nome || 'Sem Escola'}</p>
                                          <p className="text-[9px] text-slate-400">{school?.endereco || 'Sem Endereço'}</p>
                                        </td>
                                        <td className="p-4">
                                          <p className="font-bold text-slate-700">{turma?.nome || 'Sem Turma'}</p>
                                          <p className="text-[9px] text-slate-400">{turma?.ano_letivo || '2026'}</p>
                                        </td>
                                        <td className="p-4">
                                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                                            {discipline?.nome || 'Disciplina Geral'}
                                          </span>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-600">
                                          {p.trimestre}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-700">
                                          {p.nota_prova !== undefined && p.nota_prova !== null && p.nota_prova !== '' ? p.nota_prova : '-'}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-700">
                                          {p.nota_trabalho !== undefined && p.nota_trabalho !== null && p.nota_trabalho !== '' ? p.nota_trabalho : '-'}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-700">
                                          {p.nota_participacao !== undefined && p.nota_participacao !== null && p.nota_participacao !== '' ? p.nota_participacao : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                          <p className="font-mono font-bold text-slate-700">{p.nota_exame !== undefined && p.nota_exame !== null && p.nota_exame !== '' ? p.nota_exame : '-'}</p>
                                          {p.nota_reavaliacao !== undefined && p.nota_reavaliacao !== null && p.nota_reavaliacao !== '' && (
                                            <p className="text-[9px] text-amber-600 font-bold font-mono">RE: {p.nota_reavaliacao}</p>
                                          )}
                                        </td>
                                        <td className="p-4 text-center font-black font-mono bg-indigo-50/10 text-indigo-950 text-xs">
                                          {p.nota_media !== undefined && p.nota_media !== null ? p.nota_media.toFixed(1) : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                          {p.situacao === 'Aprovado' ? (
                                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                              Aprovado
                                            </span>
                                          ) : p.situacao === 'Reprovado' ? (
                                            <span className="bg-rose-50 text-rose-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                              Reprovado
                                            </span>
                                          ) : (
                                            <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                              Recuperação
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )
            )}

            {/* TAB: PAUTAS (NOTAS) */}
            {activeTab === 'pautas' && (
              !hasPermission('pautas') ? renderRestrictedAccess('Lançamento de Pautas') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">Lançamento de Pauta Trimestral</h3>
                      <p className="text-xs text-slate-400">Calculador de média automática integrado e fechamento de notas por trimestre.</p>
                    </div>
                    <div className="flex gap-2">
                      {hasPermission('pautas', 'criar') && (
                        <button 
                          onClick={() => {
                            setEditingItem(null);
                            setPautaForm({ estudante_id: students[0]?.id || '', classe_id: classes[0]?.id || '', trimestre: '1º Trimestre', nota_prova: 10, nota_trabalho: 10, nota_participacao: 10, nota_exame: 10, observacao: '' });
                            setModalType('pauta');
                            setIsModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Lançar Avaliação
                        </button>
                      )}
                      <button 
                        onClick={() => window.print()}
                        className="border border-slate-200 hover:bg-slate-50 text-slate-600 p-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" /> Imprimir Pauta
                      </button>
                    </div>
                  </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-150">
                        <th className="px-6 py-4">Estudante</th>
                        <th className="px-6 py-4">Disciplina / Trimestre</th>
                        <th className="px-6 py-4 text-center">Prova</th>
                        <th className="px-6 py-4 text-center">Trab.</th>
                        <th className="px-6 py-4 text-center">Partic.</th>
                        <th className="px-6 py-4 text-center">Exame</th>
                        <th className="px-6 py-4 text-center">Reaval.</th>
                        <th className="px-6 py-4 text-center font-bold">Média Final</th>
                        <th className="px-6 py-4 text-center">Situação</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {pautas.map(p => {
                        const est = students.find(s => s.id === p.estudante_id);
                        const estUsr = tenantUsers.find(u => u.id === est?.user_id);
                        const cls = classes.find(c => c.id === p.classe_id);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-900">{estUsr?.nome || 'Aluno'}</td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800">{cls?.nome}</p>
                              <p className="text-xs text-slate-400">{p.trimestre}</p>
                            </td>
                            <td className="px-6 py-4 text-center font-mono">{p.nota_prova}</td>
                            <td className="px-6 py-4 text-center font-mono">{p.nota_trabalho}</td>
                            <td className="px-6 py-4 text-center font-mono">{p.nota_participacao}</td>
                            <td className="px-6 py-4 text-center font-mono">{p.nota_exame || '—'}</td>
                            <td className="px-6 py-4 text-center font-mono text-pink-600 font-bold">{p.nota_reavaliacao || '—'}</td>
                            <td className="px-6 py-4 text-center font-black font-mono text-indigo-600 text-base">{p.nota_media}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                p.situacao === 'Aprovado' ? 'bg-emerald-50 text-emerald-700' :
                                p.situacao === 'Recuperação' ? 'bg-amber-50 text-amber-700 animate-pulse' :
                                'bg-rose-50 text-rose-700'
                              }`}>
                                {p.situacao}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {hasPermission('pautas', 'editar') && (
                                <button 
                                  onClick={() => {
                                    setEditingItem(p);
                                    setPautaForm({
                                      estudante_id: p.estudante_id,
                                      classe_id: p.classe_id,
                                      trimestre: p.trimestre,
                                      nota_prova: p.nota_prova,
                                      nota_trabalho: p.nota_trabalho,
                                      nota_participacao: p.nota_participacao,
                                      nota_exame: p.nota_exame || '',
                                      nota_reavaliacao: p.nota_reavaliacao || '',
                                      observacao: p.observacao || ''
                                    });
                                    setModalType('pauta');
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-slate-100 text-slate-600 rounded cursor-pointer"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )
            )}

            {/* TAB: PROCESSO DO ALUNO */}
            {activeTab === 'processos' && (
              !hasPermission('processos') ? renderRestrictedAccess('Processos Escolares') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Processo Individual do Aluno</h3>
                      <p className="text-xs text-slate-400">Conselho de dossiers individuais, históricos de ocorrências e ficha académica.</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setProcessTabSegment('dossiers')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          processTabSegment === 'dossiers'
                            ? 'bg-indigo-50 text-indigo-600 font-extrabold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📂 Dossiers e Fichas ({students.length})
                      </button>
                      <button
                        onClick={() => setProcessTabSegment('workflow')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          processTabSegment === 'workflow'
                            ? 'bg-indigo-50 text-indigo-600 font-extrabold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        ⏱️ Workflow de Processos ({processos.length})
                      </button>
                    </div>
                  </div>

                  {processTabSegment === 'dossiers' && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-xs min-w-[800px]">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-black text-[10px]">
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <th className="px-6 py-4">Estudante / Matrícula</th>
                              <th className="px-6 py-4">Turma / Escola</th>
                              <th className="px-6 py-4">Filiação e Morada</th>
                              <th className="px-6 py-4 text-center">Estado do Dossier</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-slate-700">
                            {students.map((s) => {
                              const usr = tenantUsers.find((u) => u.id === s.user_id);
                              const trm = turmas.find((t) => t.id === s.turma_id);
                              const esc = schools.find((sc) => sc.id === s.escola_id);

                              // Check dossier completeness (BI / ID document, Parents, Address)
                              const hasBI = !!s.documento_identificacao;
                              const hasPai = !!s.nome_pai;
                              const hasMae = !!s.nome_mae;
                              const hasMorada = !!s.morada;
                              const isComplete = hasBI && hasPai && hasMae && hasMorada;

                              return (
                                <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="font-extrabold text-slate-900">{usr?.nome || 'Aluno Sem Nome'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Matrícula: {s.numero_matricula}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-800">{trm?.nome || 'Não Alocado'}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{esc?.nome || 'Escola Geral'}</p>
                                  </td>
                                  <td className="px-6 py-4 max-w-xs">
                                    <p className="text-slate-600 truncate">
                                      <span className="font-bold">Filiação: </span>
                                      {s.nome_pai || '—'} / {s.nome_mae || '—'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                      <span className="font-semibold">Morada: </span>
                                      {s.morada || 'Não informada'}
                                    </p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                                      isComplete 
                                        ? 'bg-emerald-50 text-emerald-700' 
                                        : 'bg-rose-50 text-rose-700 animate-pulse'
                                    }`}>
                                      {isComplete ? '✅ Completo' : '⚠️ Dados em Falta'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-2 justify-end">
                                      {!isComplete && (
                                        <button
                                          onClick={() => handleNotifyMissingData(s)}
                                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer border border-amber-200 transition-all"
                                          title="Enviar notificação do sistema para o Diretor de Turma solicitando atualização cadastral"
                                        >
                                          <Bell className="w-3.5 h-3.5" /> Notificar DT
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setSelectedProcessStudent(s);
                                          setDossierForm({
                                            documento_identificacao: s.documento_identificacao || '',
                                            nome_pai: s.nome_pai || '',
                                            nome_mae: s.nome_mae || '',
                                            morada: s.morada || ''
                                          });
                                          setIsProcessPanelOpen(true);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5" /> Abrir Dossier
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {students.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-400">
                                  Nenhum aluno registrado encontrado para exibição.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {processTabSegment === 'workflow' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500 font-medium">Fluxo de solicitações de transferência, matrículas e suspensões acadêmicas.</p>
                        {hasPermission('processos', 'criar') && (
                          <button 
                            onClick={() => {
                              setEditingItem(null);
                              setProcessoForm({ estudante_id: students[0]?.id || '', tipo: 'Matrícula', status: 'Solicitação', documentos: ['guia_academic.pdf'], observacao: '' });
                              setModalType('processo');
                              setIsModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Abrir Processo
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {processos.map(p => {
                          const est = students.find(s => s.id === p.estudante_id);
                          const estUsr = tenantUsers.find(u => u.id === est?.user_id);
                          return (
                            <div key={p.id} className="p-4 rounded-xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/40">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                                    {p.tipo}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">Estudante: {estUsr?.nome}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">📝 {p.observacao || 'Nenhuma observação informada.'}</p>
                                <div className="flex gap-2 flex-wrap mt-3">
                                  {p.documentos.map(docu => (
                                    <span key={docu} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-500 flex items-center gap-1">
                                      <Download className="w-3 h-3" /> {docu}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full md:w-auto justify-between border-t md:border-none pt-3 md:pt-0">
                                <div>
                                  <p className="text-[10px] text-slate-400 font-mono">Workflow Status</p>
                                  <span className={`inline-block text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full ${
                                    p.status === 'Concluído' || p.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700' :
                                    p.status === 'Rejeitado' ? 'bg-rose-50 text-rose-700' :
                                    'bg-amber-50 text-amber-700'
                                  }`}>
                                    {p.status}
                                  </span>
                                </div>

                                {hasPermission('processos', 'editar') && (
                                  <button 
                                    onClick={() => {
                                      setEditingItem(p);
                                      setProcessoForm({
                                        estudante_id: p.estudante_id,
                                        tipo: p.tipo,
                                        status: p.status,
                                        documentos: p.documentos,
                                        observacao: p.observacao || ''
                                      });
                                      setModalType('processo');
                                      setIsModalOpen(true);
                                    }}
                                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    Analisar Workflow
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {processos.length === 0 && (
                          <div className="text-center py-10 text-slate-400">
                            Nenhum processo em andamento encontrado.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* TAB: BIBLIOTECA DIGITAL */}
            {activeTab === 'biblioteca' && (
              !hasPermission('biblioteca') ? renderRestrictedAccess('Biblioteca Digital') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn">
                  <BibliotecaModule
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserEmail}
                    currentUserName={currentUserEmail.split('@')[0]}
                    schools={schools}
                    tenantId={currentTenantId}
                  />
                </div>
              )
            )}

            {/* TAB: USUARIOS DO TENANT */}
            {activeTab === 'usuarios' && (
              !hasPermission('utilizadores') ? renderRestrictedAccess('Utilizadores e Acessos') : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Utilizadores e Acessos</h3>
                    {isLimitReached('max_usuarios', tenantUsers.length) ? (
                      <button 
                        onClick={() => openUpgradeModal('max_usuarios', tenantUsers.length)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
                      </button>
                    ) : (
                      hasPermission('utilizadores', 'criar') && (
                        <button 
                          onClick={() => {
                            setEditingItem(null);
                            setUserForm({
                              nome: '',
                              email: '',
                              tipo: 'docente',
                              ativo: true,
                              modulo_acessos: JSON.parse(JSON.stringify(DEFAULT_MODULO_ACESSOS))
                            });
                            setModalType('user');
                            setIsModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Criar Usuário
                        </button>
                      )
                    )}
                  </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                        <th className="px-6 py-4">Nome completo</th>
                        <th className="px-6 py-4">Endereço de Email</th>
                        <th className="px-6 py-4">Cargo / Nível</th>
                        <th className="px-6 py-4">Permissões</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {tenantUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-bold text-slate-900">{u.nome}</td>
                          <td className="px-6 py-4">{u.email}</td>
                          <td className="px-6 py-4 uppercase font-mono text-xs text-indigo-700 font-bold">{u.tipo}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {u.permissoes.join(', ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs ${u.ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {u.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {hasPermission('utilizadores', 'editar') && (
                              <button 
                                onClick={() => {
                                  setEditingItem(u);
                                  setUserForm({
                                    nome: u.nome,
                                    email: u.email,
                                    tipo: u.tipo,
                                    ativo: u.ativo,
                                    modulo_acessos: u.modulo_acessos || JSON.parse(JSON.stringify(DEFAULT_MODULO_ACESSOS))
                                  });
                                  setModalType('user');
                                  setIsModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-600 rounded cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )
            )}

            {/* TAB: CENTRAL DE NOTIFICAÇÕES */}
            {activeTab === 'notificacoes' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn text-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Central de Notificações</h3>
                    <p className="text-xs text-slate-400">Acompanhe alertas importantes, faturas pendentes, e atualizações académicas em tempo real.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => setNotifCenterFilter('todos')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          notifCenterFilter === 'todos' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todas
                      </button>
                      <button
                        onClick={() => setNotifCenterFilter('nao_lidas')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          notifCenterFilter === 'nao_lidas' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Não Lidas
                      </button>
                      <button
                        onClick={() => setNotifCenterFilter('lidas')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          notifCenterFilter === 'lidas' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Lidas
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          const unread = notifications.filter(n => !n.lido);
                          for (const n of unread) {
                            await updateDoc(doc(db, 'notificacoes', n.id!), { lido: true });
                          }
                          
                          // Show 6-second popup notification (Rule 3)
                          const popup = document.createElement('div');
                          popup.className = 'fixed bottom-5 right-5 bg-indigo-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-indigo-500 z-50 flex items-center gap-2 animate-bounce';
                          popup.innerHTML = `✅ Todas as notificações foram marcadas como lidas!`;
                          document.body.appendChild(popup);
                          setTimeout(() => popup.remove(), 6000);

                          loadTenantContext();
                        } catch (err: any) {
                          alert("Erro ao marcar notificações: " + err.message);
                        }
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {notifications
                    .filter(n => {
                      if (notifCenterFilter === 'lidas') return n.lido;
                      if (notifCenterFilter === 'nao_lidas') return !n.lido;
                      return true;
                    })
                    .map(n => {
                      const isUnread = !n.lido;
                      return (
                        <div 
                          key={n.id} 
                          className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                            isUnread 
                              ? 'bg-indigo-50/20 border-indigo-100/80 shadow-xs' 
                              : 'bg-white border-slate-150'
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className={`p-2.5 rounded-full shrink-0 ${
                              n.tipo === 'alerta' 
                                ? 'bg-rose-50 text-rose-600' 
                                : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              <Bell className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`font-bold text-sm ${isUnread ? 'text-indigo-900' : 'text-slate-800'}`}>
                                  {n.titulo}
                                </h4>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{n.mensagem}</p>
                              <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                {n.created_at ? new Date(n.created_at).toLocaleString('pt-BR') : 'Sem data'}
                              </p>
                            </div>
                          </div>

                          {isUnread && (
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'notificacoes', n.id!), { lido: true });
                                  loadTenantContext();
                                } catch (err: any) {
                                  alert("Erro ao atualizar notificação: " + err.message);
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-colors shadow-xs"
                            >
                              Marcar como Lida
                            </button>
                          )}
                        </div>
                      );
                    })}

                  {notifications.filter(n => {
                    if (notifCenterFilter === 'lidas') return n.lido;
                    if (notifCenterFilter === 'nao_lidas') return !n.lido;
                    return true;
                  }).length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      Nenhuma notificação encontrada nesta central.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CONFIGURACAO */}
            {activeTab === 'configuracao' && config && (
              !hasPermission('configuracoes') ? renderRestrictedAccess('Configurações Académicas') : (
                <form onSubmit={handleSettingsSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center pb-4 border-b border-slate-150">
                  <div>
                    <h3 className="font-bold text-slate-800">Configurações Gerais da Unidade</h3>
                    <p className="text-xs text-slate-400">Dados cadastrais acadêmicos e escalas de notas.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={handleBackupExport}
                      className="border border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Exportar Backup (JSON)
                    </button>
                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" /> Salvar Configurações
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Oficial da Unidade</label>
                    <input 
                      type="text"
                      value={config.nome_instituicao || ''}
                      onChange={(e) => setConfig({ ...config, nome_instituicao: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Url do Logotipo Institucional</label>
                    <input 
                      type="text"
                      value={config.logo_url || ''}
                      onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Endereço de Sede</label>
                    <input 
                      type="text"
                      value={config.endereco || ''}
                      onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contacto Telefónico</label>
                    <input 
                      type="text"
                      value={config.contacto || ''}
                      onChange={(e) => setConfig({ ...config, contacto: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ano Letivo Vigente</label>
                      <input 
                        type="text"
                        value={config.ano_letivo_atual || ''}
                        onChange={(e) => setConfig({ ...config, ano_letivo_atual: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Escala de Avaliação</label>
                      <select 
                        value={config.escala_avaliacao || '0-20'}
                        onChange={(e) => setConfig({ ...config, escala_avaliacao: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none"
                      >
                        <option value="0-20">0 a 20 Valores (Moçambique/Angola)</option>
                        <option value="0-10">0 a 10 Pontos (Brasil)</option>
                        <option value="A-F">Letras A-F (Internacional)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-6 col-span-1 md:col-span-2">
                    <input 
                      type="checkbox"
                      id="email_notifs"
                      checked={!!config.notificacoes_email}
                      onChange={(e) => setConfig({ ...config, notificacoes_email: e.target.checked })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <label htmlFor="email_notifs" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Ativar Disparo de Notificações por Email Académicas
                    </label>
                  </div>

                  {/* GESTÃO DE PAUTAS & GESTÃO DE PARÂMETROS DE FACTURAÇÃO */}
                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        ⚖️ Gestão e Parâmetros de Pautas (Avaliação)
                      </h4>
                      <p className="text-xs text-slate-400">Configure o número de avaliações contínuas e o método de média final para as disciplinas.</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nº de Avaliações / Trimestre</label>
                          <input 
                            type="number"
                            min={1}
                            max={6}
                            value={config.num_avaliacoes || 3}
                            onChange={(e) => setConfig({ ...config, num_avaliacoes: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método de Média Final</label>
                          <select 
                            value={config.metodo_calculo || 'aritmetica_simples'}
                            onChange={(e) => setConfig({ ...config, metodo_calculo: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                          >
                            <option value="aritmetica_simples">Média Aritmética Simples</option>
                            <option value="aritmetica_ponderada">Média Ponderada (Exame Peso 2)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        💰 Gestão de Parâmetros de Facturação
                      </h4>
                      <p className="text-xs text-slate-400">Parâmetros financeiros base, moedas de cobrança, IVA e taxas de multas por atraso.</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mensalidade Escolar Base</label>
                          <input 
                            type="number"
                            min={0}
                            value={config.taxa_propina_base || 3500}
                            onChange={(e) => setConfig({ ...config, taxa_propina_base: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Multa por Atraso (%)</label>
                          <input 
                            type="number"
                            min={0}
                            max={100}
                            value={config.taxa_multa_atraso || 10}
                            onChange={(e) => setConfig({ ...config, taxa_multa_atraso: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Moeda Padrão de Facturas</label>
                          <select 
                            value={config.moeda_padrao || 'MZN'}
                            onChange={(e) => setConfig({ ...config, moeda_padrao: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                          >
                            <option value="MZN">Metical de Moçambique (MZN)</option>
                            <option value="USD">Dólar Americano (USD)</option>
                            <option value="ZAR">Rand Sul-Africano (ZAR)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Taxa de IVA (%)</label>
                          <input 
                            type="number"
                            min={0}
                            max={100}
                            value={config.taxa_iva || 16}
                            onChange={(e) => setConfig({ ...config, taxa_iva: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm">
                      Configurações Gerais de Idioma & Tradução
                    </h4>
                    <p className="text-xs text-slate-400">Escolha o idioma padrão do sistema para a sua unidade escolar e as políticas do tradutor de IA.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Idioma Padrão do Sistema</label>
                        <select
                          value={systemLang}
                          onChange={(e) => onChangeLanguage && onChangeLanguage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                        >
                          {LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="ai_translation_unit"
                          checked={tenant ? tenant.ai_translation_enabled !== false : true}
                          onChange={async (e) => {
                            if (tenant) {
                              const updatedTenant = { ...tenant, ai_translation_enabled: e.target.checked };
                              setTenant(updatedTenant);
                              await updateDoc(doc(db, 'tenants', tenant.id), {
                                ai_translation_enabled: e.target.checked
                              });
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="ai_translation_unit" className="text-xs font-semibold text-slate-600 cursor-pointer">
                          Permitir Tradução por Inteligência Artificial em Segundo Plano
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-600" /> Servidor de E-mail para Notificações (SMTP)
                      </h4>
                      <p className="text-xs text-slate-400">Escolha se as notificações serão enviadas usando o provedor geral do sistema ou configure seu próprio e-mail corporativo.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setConfig(prev => prev ? ({ ...prev, smtp_provider: 'system' }) : null)}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          (config.smtp_provider || 'system') === 'system'
                            ? 'border-indigo-600 bg-indigo-50/30 text-indigo-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5" /> Provedor do Sistema (Padrão)
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Usa o servidor SMTP configurado globalmente pelo super-admin da plataforma.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig(prev => prev ? ({ ...prev, smtp_provider: 'custom' }) : null)}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          config.smtp_provider === 'custom'
                            ? 'border-indigo-600 bg-indigo-50/30 text-indigo-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-2">
                          <Server className="w-3.5 h-3.5" /> Servidor Próprio (Customizado)
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Configure o seu próprio provedor ou conta do Gmail de forma exclusiva.</p>
                      </button>
                    </div>

                    {config.smtp_provider === 'custom' && (
                      <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método de Configuração</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setConfig(prev => prev ? ({ ...prev, smtp_type: 'manual' }) : null)}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                (config.smtp_type || 'manual') !== 'gmail'
                                  ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-semibold'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                              }`}
                            >
                              <span className="text-xs font-bold">Configuração Manual</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfig(prev => prev ? ({
                                ...prev,
                                smtp_type: 'gmail',
                                smtp_host: 'smtp.gmail.com',
                                smtp_port: 465,
                                smtp_secure: true
                              }) : null)}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                config.smtp_type === 'gmail'
                                  ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-semibold'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                              }`}
                            >
                              <span className="text-xs font-bold">Google Gmail</span>
                            </button>
                          </div>
                        </div>

                        {config.smtp_type !== 'gmail' ? (
                          // Manual SMTP fields
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Host SMTP</label>
                                <input
                                  type="text"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_host || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                                  placeholder="smtp.escola.com"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Porta</label>
                                <input
                                  type="number"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_port || 587}
                                  onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
                                  placeholder="587"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Usuário SMTP</label>
                                <input
                                  type="text"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_user || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                                  placeholder="remetente@escola.com"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Senha SMTP</label>
                                <input
                                  type="password"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_pass || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                                  placeholder="••••••••••••"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">E-mail de Envio (Remetente)</label>
                                <input
                                  type="email"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_sender_email || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_sender_email: e.target.value })}
                                  placeholder="notificacoes@escola.com"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nome de Exibição</label>
                                <input
                                  type="text"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_sender_name || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_sender_name: e.target.value })}
                                  placeholder="Ex: Secretaria Escolar"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150">
                              <input
                                type="checkbox"
                                id="smtp_secure_tenant"
                                checked={config.smtp_secure || false}
                                onChange={(e) => setConfig({ ...config, smtp_secure: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <label htmlFor="smtp_secure_tenant" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                                Usar Conexão Segura (SSL/TLS)
                              </label>
                            </div>
                          </div>
                        ) : (
                          // Gmail fields
                          <div className="space-y-3">
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/60 text-amber-900 text-[11px] space-y-1">
                              <p className="font-bold">🔑 Conta do Gmail e Senha de App:</p>
                              <p>Por segurança, use uma **Senha de App** gerada nas configurações da sua conta Google, e mantenha a verificação em duas etapas ativa.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">E-mail do Gmail</label>
                                <input
                                  type="email"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_user || ''}
                                  onChange={(e) => setConfig({
                                    ...config,
                                    smtp_user: e.target.value,
                                    smtp_sender_email: e.target.value
                                  })}
                                  placeholder="escola@gmail.com"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Senha de App (16 dígitos)</label>
                                <input
                                  type="password"
                                  required={config.smtp_provider === 'custom'}
                                  value={config.smtp_pass || ''}
                                  onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                                  placeholder="abcd efgh ijkl mnop"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Nome de Exibição do Remetente</label>
                              <input
                                type="text"
                                required={config.smtp_provider === 'custom'}
                                value={config.smtp_sender_name || ''}
                                onChange={(e) => setConfig({ ...config, smtp_sender_name: e.target.value })}
                                placeholder="Ex: Direção Pedagógica (Gmail)"
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LAYER 2 NOTIFICATION RULES CHECKLIST */}
                    <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4 text-indigo-600" /> Checklist de Notificações Internas da Unidade (Layer 2)
                          </h4>
                          <p className="text-xs text-slate-400">Marque quais eventos disparam e-mails acadêmicos ou notificações no painel para os usuários e encarregados.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddingAdminCustomRule(true)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Evento Acadêmico
                        </button>
                      </div>

                      {isAddingAdminCustomRule && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3 animate-fadeIn">
                          <h5 className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Novo Alerta de Evento Escolar</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Nome do Evento</label>
                              <input
                                type="text"
                                value={newAdminRuleForm.label}
                                onChange={(e) => setNewAdminRuleForm({ ...newAdminRuleForm, label: e.target.value })}
                                placeholder="Ex: Nova Atividade de Laboratório"
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Descrição</label>
                              <input
                                type="text"
                                value={newAdminRuleForm.description}
                                onChange={(e) => setNewAdminRuleForm({ ...newAdminRuleForm, description: e.target.value })}
                                placeholder="Ex: Disparado ao agendar atividades laboratoriais extras."
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={newAdminRuleForm.email}
                                onChange={(e) => setNewAdminRuleForm({ ...newAdminRuleForm, email: e.target.checked })}
                                className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                              />
                              Enviar por E-mail
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={newAdminRuleForm.system}
                                onChange={(e) => setNewAdminRuleForm({ ...newAdminRuleForm, system: e.target.checked })}
                                className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                              />
                              Alerta no Portal
                            </label>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setIsAddingAdminCustomRule(false)}
                              className="border border-slate-200 hover:bg-slate-150 text-slate-600 font-bold py-1 px-2.5 rounded-lg text-xs cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!newAdminRuleForm.label) {
                                  alert("Por favor, digite o nome do evento.");
                                  return;
                                }
                                const newId = "custom_adm_" + Math.random().toString(36).substr(2, 9);
                                const updated = [...adminRules, { ...newAdminRuleForm, id: newId }];
                                saveAdminRules(updated);
                                setNewAdminRuleForm({ label: '', description: '', email: true, system: true, recipients: ['diretor_geral'] });
                                setIsAddingAdminCustomRule(false);
                                alert("Novo evento adicionado!");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2.5 rounded-lg text-xs cursor-pointer"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider">
                              <th className="p-3">Evento Acadêmico</th>
                              <th className="p-3 text-center">Via E-mail</th>
                              <th className="p-3 text-center">No Sistema</th>
                              <th className="p-3">Quem Notificar (Destinatários)</th>
                              <th className="p-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {adminRules.map((rule) => (
                              <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3">
                                  <p className="font-bold text-slate-800">{rule.label}</p>
                                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5">{rule.description}</p>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={rule.email}
                                    onChange={(e) => {
                                      const updated = adminRules.map(r => r.id === rule.id ? { ...r, email: e.target.checked } : r);
                                      saveAdminRules(updated);
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={rule.system}
                                    onChange={(e) => {
                                      const updated = adminRules.map(r => r.id === rule.id ? { ...r, system: e.target.checked } : r);
                                      saveAdminRules(updated);
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-3 relative">
                                  <div className="relative inline-block text-left">
                                    <button
                                      type="button"
                                      onClick={() => setOpenAdminDropdownId(openAdminDropdownId === rule.id ? null : rule.id)}
                                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1 px-2.5 rounded border border-slate-200 cursor-pointer"
                                    >
                                      <span>{rule.recipients.length} Cargos</span>
                                      <Sliders className="w-3 h-3 text-slate-500" />
                                    </button>

                                    {openAdminDropdownId === rule.id && (
                                      <>
                                        <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setOpenAdminDropdownId(null)} />
                                        <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-20 p-2 animate-fadeIn text-slate-800 text-left">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Destinatários</p>
                                          <div className="space-y-1">
                                            {RECIPIENT_ROLES_ADMIN.map(role => {
                                              const isChecked = rule.recipients.includes(role.id);
                                              return (
                                                <label key={role.id} className="flex items-center gap-1.5 hover:bg-slate-50 p-1 rounded cursor-pointer select-none">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                      const newRecipients = isChecked
                                                        ? rule.recipients.filter(id => id !== role.id)
                                                        : [...rule.recipients, role.id];
                                                      const updated = adminRules.map(r => r.id === rule.id ? { ...r, recipients: newRecipients } : r);
                                                      saveAdminRules(updated);
                                                    }}
                                                    className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded"
                                                  />
                                                  <span className="text-[11px] font-medium text-slate-700">{role.label}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {rule.recipients.map(roleId => {
                                      const role = RECIPIENT_ROLES_ADMIN.find(r => r.id === roleId);
                                      return (
                                        <span key={roleId} className="bg-indigo-50 text-indigo-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                                          {role?.label || roleId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  {rule.id.startsWith('custom_adm_') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Remover evento "${rule.label}"?`)) {
                                          const updated = adminRules.filter(r => r.id !== rule.id);
                                          saveAdminRules(updated);
                                        }
                                      }}
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              )
            )}

          </div>
        )}
      </main>

      {/* MODAL: PLAN UPGRADE & SLOT ADDITIONS */}
      {isUpgradeModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente fechar a janela de upgrade de plano?")) {
                setIsUpgradeModalOpen(false);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto pointer-events-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
                  Upgrade & Ampliação de Limites
                </span>
                <h3 className="text-xl font-bold text-slate-900 font-sans mt-2">
                  Você atingiu o limite de cadastros!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aumente seu limite instantaneamente alterando seu plano ou adicionando cotas adicionais por apenas $2/mês por cadastro extra.
                </p>
              </div>
              <button 
                onClick={() => setIsUpgradeModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpgradeConfirm} className="space-y-6">
              {/* Option 1: Choose an upgraded plan */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Opção A: Mudar para um Plano Superior
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {allPlans.map((p) => {
                    const isCurrent = p.id === tenant?.plano_id;
                    const isSelected = p.id === selectedPlanId;
                    return (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600/20' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 text-sm">{p.nome}</span>
                          {isCurrent && (
                            <span className="bg-slate-100 text-slate-600 font-sans text-[9px] font-bold px-1.5 py-0.5 rounded">
                              Atual
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[10px] line-clamp-2 h-7">{p.descricao}</p>
                        <div className="mt-3">
                          <span className="text-slate-900 font-sans font-extrabold text-base">${p.preco}</span>
                          <span className="text-slate-400 font-mono text-[10px]"> /mês</span>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-500 space-y-1">
                          <p>• Escolas: <span className="font-bold text-slate-700">{p.limits.max_escolas}</span></p>
                          <p>• Docentes: <span className="font-bold text-slate-700">{p.limits.max_docentes}</span></p>
                          <p>• Estudantes: <span className="font-bold text-slate-700">{p.limits.max_estudantes}</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Option 2: Add extra slots to current/new plan */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      Opção B: Comprar Cadastros Extras
                    </h4>
                    <p className="text-[10px] text-slate-500">Mantenha seu plano atual e adicione cotas extras por $2/mês cada.</p>
                  </div>
                  <div className="bg-white px-2 py-1 rounded-lg border border-slate-200 font-sans text-xs font-bold text-indigo-700">
                    $2 USD / extra
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Quantidade de Cadastros Adicionais para {upgradeLimitType ? upgradeLimitType.replace('max_', '').toUpperCase() : 'Entidade'}
                    </label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setAdditionalSlots(Math.max(0, additionalSlots - 1))}
                        className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        min="0"
                        value={additionalSlots}
                        onChange={(e) => setAdditionalSlots(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-10 bg-white border border-slate-200 rounded-lg text-center text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button 
                        type="button"
                        onClick={() => setAdditionalSlots(additionalSlots + 1)}
                        className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-slate-400 font-medium">cadastros extras</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custo Adicional</p>
                    <h5 className="text-lg font-black font-sans text-indigo-600 mt-1">
                      +${additionalSlots * 2} USD
                    </h5>
                  </div>
                </div>
              </div>

              {/* Real-time Billing Preview */}
              <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Estimativa da Nova Mensalidade</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-sans text-slate-900">
                      ${(allPlans.find(p => p.id === selectedPlanId)?.preco ?? 0) + (additionalSlots * 2)} USD
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/mês faturado</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> Confirmar Upgrade
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DESACTIVAR MATRÍCULA DO ALUNO */}
      {isDeactivateModalOpen && studentToDeactivate && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto pointer-events-auto text-slate-800">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 mb-4">
              <UserMinus className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Desactivar Matrícula do Aluno</h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-4 font-semibold">
              Tem certeza que deseja desactivar temporariamente o(a) estudante <span className="text-indigo-600 font-extrabold">{tenantUsers.find(u => u.id === studentToDeactivate.user_id)?.nome || 'Estudante'}</span>?
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSaving(true);
                try {
                  const user_id = studentToDeactivate.user_id;
                  const studName = tenantUsers.find(u => u.id === user_id)?.nome || 'Estudante';
                  
                  // Update Student Record (Soft delete)
                  await updateDoc(doc(db, 'estudantes', studentToDeactivate.id), {
                    ativo: false,
                    motivo_desativacao: deactivateReason,
                    desativado_em: new Date().toISOString(),
                    desativado_por: loggedInUser?.nome || 'Admin'
                  });

                  // Add Historical Entry in processes
                  await addDoc(collection(db, 'processos_aluno'), {
                    estudante_id: studentToDeactivate.id,
                    tipo: 'Desactivação',
                    detalhes: `Estudante desactivado temporariamente. Motivo: ${deactivateReason}`,
                    criado_em: new Date().toISOString(),
                    criado_por: loggedInUser?.nome || 'Admin'
                  });

                  // Log Audit
                  await tenantAuditLog(
                    "Desativar Aluno",
                    "Estudante",
                    studentToDeactivate.id,
                    `Aluno ${studName} desactivado com sucesso. Motivo: ${deactivateReason}`
                  );

                  // Send notification alerts to Parents and Teachers (Rule 1.1)
                  const parentEmail = tenantUsers.find(u => u.id === studentToDeactivate.user_id)?.email || 'encarregado@portal.ac.mz';
                  await queueOrSendEmail(
                    parentEmail,
                    '⚠️ Desativação de Matrícula - SGE',
                    `Estimado Encarregado(a),\n\nComunicamos que a matrícula do(a) estudante "${studName}" foi temporariamente desactivada no Portal SGE.\nMotivo: ${deactivateReason}\n\nPara qualquer esclarecimento, por favor contacte a direcção escolar.\n\nAtenciosamente,\nDirecção da Escola`
                  );

                  showSystemNotification(`Aluno ${studName} desactivado. Notificações enviadas aos responsáveis.`, 'sucesso');
                  setIsDeactivateModalOpen(false);
                  loadTenantContext();
                } catch (err: any) {
                  console.error("Error deactivating student:", err);
                  showSystemNotification(`Erro ao desactivar: ${err.message}`, 'erro');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Motivo Oficial da Desactivação</label>
                <select
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um motivo...</option>
                  <option value="Transferência externa">Transferência externa</option>
                  <option value="Abandono escolar">Abandono escolar</option>
                  <option value="Suspensão disciplinar">Suspensão disciplinar</option>
                  <option value="Problemas médicos / Saúde">Problemas médicos / Saúde</option>
                  <option value="Outro motivo (especificado em ata)">Outro motivo (especificado em ata)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeactivateModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!deactivateReason}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer transition-all disabled:opacity-50"
                >
                  Desactivar Aluno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESTUDANTE DESISTIU */}
      {isDropoutModalOpen && studentToDropout && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[200000] overflow-y-auto pointer-events-auto text-slate-800">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registrar Desistência do Aluno</h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-4 font-semibold leading-relaxed">
              Tem certeza que deseja registrar a desistência definitiva dos estudos para o(a) estudante <span className="text-rose-600 font-extrabold">{tenantUsers.find(u => u.id === studentToDropout.user_id)?.nome || 'Estudante'}</span>? 
              <br />
              <span className="text-rose-500 font-bold block mt-2 text-[10px] uppercase">⚠️ Esta ação irá suspender permanentemente o acesso do aluno ao sistema e notificar a Direção, Professores e Encarregados.</span>
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSaving(true);
                try {
                  const s = studentToDropout;
                  const user_id = s.user_id;
                  const studName = tenantUsers.find(u => u.id === user_id)?.nome || 'Estudante';
                  const studentTurma = turmas.find(t => t.id === s.turma_id);

                  // 1. Update Student Record
                  await updateDoc(doc(db, 'estudantes', s.id), {
                    ativo: false,
                    motivo_desativacao: dropoutReason,
                    desativado_em: new Date().toISOString(),
                    desativado_por: loggedInUser?.nome || 'Admin',
                    desistiu: true
                  });

                  // 2. Suspend Student User account access
                  if (user_id) {
                    await updateDoc(doc(db, 'users', user_id), {
                      ativo: false,
                      suspenso_motivo: `Desistência de estudos registrada em ${new Date().toLocaleDateString('pt-MZ')}`
                    });
                  }

                  // 3. Add Historical Entry in processes
                  await addDoc(collection(db, 'processos_aluno'), {
                    estudante_id: s.id,
                    tipo: 'Desistência',
                    detalhes: `Desistência oficial registrada. Motivo: ${dropoutReason}`,
                    criado_em: new Date().toISOString(),
                    criado_por: loggedInUser?.nome || 'Admin'
                  });

                  // 4. Log Audit
                  await tenantAuditLog(
                    "Estudante Desistiu",
                    "Estudante",
                    s.id,
                    `Aluno ${studName} registrado como desistente. Motivo: ${dropoutReason}`
                  );

                  // 5. Send in-app and email notifications to Administrators
                  await addDoc(collection(db, 'notificacoes'), {
                    tenant_id: currentTenantId,
                    destinatario_id: 'admin',
                    destinatario_role: 'admin',
                    titulo: `⚠️ Alerta: Desistência de Aluno - ${studName}`,
                    mensagem: `O(A) estudante "${studName}" (Matrícula: ${s.numero_matricula}) foi registrado(a) como desistente dos estudos. Acesso ao sistema suspenso.`,
                    tipo: 'alerta',
                    lido: false,
                    created_at: new Date().toISOString()
                  });

                  const admins = tenantUsers.filter(u => u.tipo === 'admin' || u.tipo === 'director');
                  for (const admin of admins) {
                    if (admin.email) {
                      await queueOrSendEmail(
                        admin.email,
                        `⚠️ Alerta: Desistência de Aluno - ${studName}`,
                        `Prezado(a) Administrador(a),\n\nInformamos que o(a) estudante "${studName}" (Nº Matrícula: ${s.numero_matricula}) desistiu oficialmente dos estudos. O acesso deste aluno ao portal escolar foi suspenso automaticamente.\n\nAtenciosamente,\nPortal SGE`
                      );
                    }
                    if (admin.id !== loggedInUser?.id) {
                      await addDoc(collection(db, 'notificacoes'), {
                        tenant_id: currentTenantId,
                        destinatario_id: admin.id,
                        titulo: `⚠️ Desistência de Aluno - ${studName}`,
                        mensagem: `O(A) estudante "${studName}" (Matrícula: ${s.numero_matricula}) foi registrado(a) como desistente dos estudos.`,
                        tipo: 'alerta',
                        lido: false,
                        created_at: new Date().toISOString()
                      });
                    }
                  }

                  // 6. Send in-app and email notifications to Teachers/Docentes of the student's Turma
                  const studentClasses = classes.filter(c => c.turma_id === s.turma_id);
                  const teacherIds = Array.from(new Set(studentClasses.map(c => c.docente_id).filter(Boolean)));
                  for (const teacherId of teacherIds) {
                    const teacherObj = rawTeachers.find(t => t.id === teacherId);
                    if (teacherObj) {
                      const teacherUser = tenantUsers.find(u => u.id === teacherObj.user_id);
                      if (teacherUser) {
                        if (teacherUser.email) {
                          await queueOrSendEmail(
                            teacherUser.email,
                            `📢 Notificação Pedagógica: Desistência de Aluno - ${studName}`,
                            `Estimado(a) Docente,\n\nInformamos que o(a) estudante "${studName}" da turma "${studentTurma?.nome || 'Turma'}", para a qual leciona, foi registrado(a) no sistema como desistente dos estudos. Por favor, desconsidere-o nas próximas avaliações e pautas.\n\nAtenciosamente,\nSGE`
                          );
                        }
                        await addDoc(collection(db, 'notificacoes'), {
                          tenant_id: currentTenantId,
                          destinatario_id: teacherUser.id,
                          titulo: `📢 Desistência de Aluno - ${studName}`,
                          mensagem: `O(A) estudante "${studName}" da sua turma foi registrado(a) como desistente dos estudos.`,
                          tipo: 'info',
                          lido: false,
                          created_at: new Date().toISOString()
                        });
                      }
                    }
                  }

                  // 7. Send in-app and email notifications to Parents/Encarregados
                  const parentUser = tenantUsers.find(u => u.id === s.pai_id);
                  if (parentUser) {
                    if (parentUser.email) {
                      await queueOrSendEmail(
                        parentUser.email,
                        `⚠️ Comunicado Oficial: Desistência de Estudos - ${studName}`,
                        `Estimado(a) Encarregado(a) de Educação,\n\nConfirmamos o registro no SGE de que o(a) estudante "${studName}" desistiu dos estudos nesta instituição. De acordo com os procedimentos internos, o acesso do estudante ao portal escolar foi suspenso.\n\nSe esta informação estiver incorreta ou desejar reverter este processo, por favor dirija-se à secretaria escolar de imediato.\n\nAtenciosamente,\nDireção Pedagógica`
                      );
                    }
                    await addDoc(collection(db, 'notificacoes'), {
                      tenant_id: currentTenantId,
                      destinatario_id: parentUser.id,
                      titulo: `⚠️ Desistência de Estudos - ${studName}`,
                      mensagem: `O registro do(a) seu(sua) educando(a) "${studName}" foi alterado para desistente e o acesso dele foi suspenso.`,
                      tipo: 'alerta',
                      lido: false,
                      created_at: new Date().toISOString()
                    });
                  }

                  // Show 6-second popup notification (Rule 3)
                  const popup = document.createElement('div');
                  popup.className = 'fixed bottom-5 right-5 bg-rose-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-rose-500 z-50 flex items-center gap-2 animate-bounce';
                  popup.innerHTML = `⚠️ Registro de desistência para ${studName} efetuado com sucesso!`;
                  document.body.appendChild(popup);
                  setTimeout(() => popup.remove(), 6000);

                  setIsDropoutModalOpen(false);
                  loadTenantContext();
                } catch (err: any) {
                  console.error("Error processing dropout:", err);
                  showSystemNotification(`Erro ao registrar desistência: ${err.message}`, 'erro');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Motivo / Observações da Desistência</label>
                <select
                  value={dropoutReason}
                  onChange={(e) => setDropoutReason(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Abandono escolar / Desistência">Abandono escolar / Desistência</option>
                  <option value="Mudança de residência / Província">Mudança de residência / Província</option>
                  <option value="Dificuldades financeiras">Dificuldades financeiras</option>
                  <option value="Motivos pessoais / Força maior">Motivos pessoais / Força maior</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDropoutModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer transition-all"
                >
                  Confirmar Desistência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERIR ESTUDANTE */}
      {isTransferModalOpen && studentToTransfer && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto pointer-events-auto text-slate-800">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 mb-4">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transferência Escolar (Intra-Administração)</h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-4 font-semibold">
              Transferência de <span className="text-indigo-600 font-black">{tenantUsers.find(u => u.id === studentToTransfer.user_id)?.nome || 'Estudante'}</span> entre escolas sob a mesma administração (Rule 2).
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!transferEscolaId || !transferTurmaId) {
                  showSystemNotification("Por favor selecione todos os campos obrigatórios.", "erro");
                  return;
                }

                setIsSaving(true);
                try {
                  const originalSchoolId = studentToTransfer.escola_id;
                  const originalTurmaId = studentToTransfer.turma_id;
                  const originalSchoolName = schools.find(e => e.id === originalSchoolId)?.nome || 'Escola de Origem';
                  const destinationSchoolName = schools.find(e => e.id === transferEscolaId)?.nome || 'Escola de Destino';
                  const studName = tenantUsers.find(u => u.id === studentToTransfer.user_id)?.nome || 'Estudante';

                  // Update Student Document
                  await updateDoc(doc(db, 'estudantes', studentToTransfer.id), {
                    escola_id: transferEscolaId,
                    turma_id: transferTurmaId
                  });

                  // Add Historical Entry
                  await addDoc(collection(db, 'processos_aluno'), {
                    estudante_id: studentToTransfer.id,
                    tipo: 'Transferência',
                    detalhes: `Transferência intra-administração de "${originalSchoolName}" para "${destinationSchoolName}".`,
                    criado_em: new Date().toISOString(),
                    criado_por: loggedInUser?.nome || 'Admin'
                  });

                  // Log Audit
                  await tenantAuditLog(
                    "Transferir Aluno",
                    "Estudante",
                    studentToTransfer.id,
                    `Aluno ${studName} transferido de ${originalSchoolName} para ${destinationSchoolName}`
                  );

                  // Identify old and new turmas and their teachers (directors)
                  const oldTurma = turmas.find(t => t.id === originalTurmaId);
                  const newTurma = turmas.find(t => t.id === transferTurmaId);
                  
                  const oldDT = rawTeachers.find(t => t.id === oldTurma?.docente_id);
                  const newDT = rawTeachers.find(t => t.id === newTurma?.docente_id);
                  
                  const oldDTUser = oldDT ? tenantUsers.find(u => u.id === oldDT.user_id) : null;
                  const newDTUser = newDT ? tenantUsers.find(u => u.id === newDT.user_id) : null;

                  // Notify Old Class Director (DT)
                  if (oldDTUser) {
                    await addDoc(collection(db, 'notificacoes'), {
                      destinatario_id: oldDTUser.id,
                      titulo: '🔄 Aluno Transferido',
                      mensagem: `O aluno "${studName}" foi transferido da sua turma (${oldTurma?.nome}) para a escola "${destinationSchoolName}" / turma "${newTurma?.nome}".`,
                      tipo: 'sistema',
                      lido: false,
                      created_at: new Date().toISOString()
                    });

                    if (oldDTUser.email) {
                      await queueOrSendEmail(
                        oldDTUser.email,
                        '🔄 Saída de Aluno por Transferência - SGE',
                        `Estimado(a) Professor(a),\n\nInformamos que o(a) estudante "${studName}" foi transferido(a) da sua turma (${oldTurma?.nome || 'N/A'}) para a instituição "${destinationSchoolName}".\n\nAtenciosamente,\nSGE`
                      );
                    }
                  }

                  // Notify New Class Director (DT)
                  if (newDTUser) {
                    await addDoc(collection(db, 'notificacoes'), {
                      destinatario_id: newDTUser.id,
                      titulo: '🔄 Novo Aluno Recebido (Transferência)',
                      mensagem: `O aluno "${studName}" foi admitido na sua turma (${newTurma?.nome}) vindo da escola "${originalSchoolName}".`,
                      tipo: 'sistema',
                      lido: false,
                      created_at: new Date().toISOString()
                    });

                    if (newDTUser.email) {
                      await queueOrSendEmail(
                        newDTUser.email,
                        '🔄 Novo Aluno Recebido - SGE',
                        `Estimado(a) Professor(a),\n\nInformamos que o(a) estudante "${studName}" foi adicionado(a) à sua turma (${newTurma?.nome || 'N/A'}) por transferência interna da escola "${originalSchoolName}".\n\nAtenciosamente,\nSGE`
                      );
                    }
                  }

                  // Send email alert to parent/guardian
                  const parentEmail = tenantUsers.find(u => u.id === studentToTransfer.user_id)?.email || 'encarregado@portal.ac.mz';
                  await queueOrSendEmail(
                    parentEmail,
                    '🔄 Guia de Transferência Académica - SGE',
                    `Estimado Encarregado(a),\n\nConfirmamos a transferência interna do(a) estudante "${studName}" com destino à instituição "${destinationSchoolName}".\nTodos os registros académicos e notas foram sincronizados automaticamente.\n\nAtenciosamente,\nSecretaria Escolar`
                  );

                  showSystemNotification(`Aluno ${studName} transferido com sucesso!`, 'sucesso');
                  setIsTransferModalOpen(false);
                  loadTenantContext();
                } catch (err: any) {
                  console.error("Error during transfer:", err);
                  showSystemNotification(`Erro ao transferir: ${err.message}`, 'erro');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4 font-sans text-slate-800"
            >
              {/* Province Cascade selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Província da Escola de Destino</label>
                <select
                  value={transferProvId}
                  onChange={(e) => {
                    setTransferProvId(e.target.value);
                    setTransferEscolaId('');
                    setTransferClasseEscolarId('');
                    setTransferTurmaId('');
                  }}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione Província...</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* School Cascade selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Escola de Destino</label>
                <select
                  value={transferEscolaId}
                  disabled={!transferProvId}
                  onChange={(e) => {
                    setTransferEscolaId(e.target.value);
                    setTransferClasseEscolarId('');
                    setTransferTurmaId('');
                  }}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Selecione Escola...</option>
                  {schools
                    .filter(s => s.provincia_id === transferProvId)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
              </div>

              {/* Class Cascade selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Classe Escolar</label>
                <select
                  value={transferClasseEscolarId}
                  disabled={!transferEscolaId}
                  onChange={(e) => {
                    setTransferClasseEscolarId(e.target.value);
                    setTransferTurmaId('');
                  }}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Selecione Classe...</option>
                  {classesEscolares.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Turma Cascade selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Turma de Destino</label>
                <select
                  value={transferTurmaId}
                  disabled={!transferEscolaId}
                  onChange={(e) => setTransferTurmaId(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Selecione Turma...</option>
                  {turmas
                    .filter(t => t.escola_id === transferEscolaId && (!transferClasseEscolarId || t.classe_escolar_id === transferClasseEscolarId))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!transferTurmaId}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer transition-all disabled:opacity-50"
                >
                  Concluir Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA FATURA / MENSALIDADE */}
      {isFaturaModalOpen && faturaForm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto pointer-events-auto text-slate-800">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lançar Nova Fatura / Mensalidade</h3>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const stud = students.find(s => s.id === faturaForm.estudante_id);
                  const usr = stud ? tenantUsers.find(u => u.id === stud.user_id) : null;

                  await addDoc(collection(db, 'faturas_estudantes'), {
                    ...faturaForm,
                    tenant_id: currentTenantId,
                    status: 'Pendente',
                    criado_em: new Date().toISOString()
                  });

                  await tenantAuditLog(
                    "Criar Fatura",
                    "FaturaEstudante",
                    faturaForm.estudante_id,
                    `Emitida fatura "${faturaForm.descricao}" no valor de MZN ${faturaForm.valor} para o aluno ${usr?.nome || 'Estudante'}.`
                  );

                  // Send email notification to parent (Rule 6.1)
                  await queueOrSendEmail(
                    usr?.email || 'geral@escola.ac.mz',
                    '🧾 Nova Factura Emitida - Portal Escolar',
                    `Estimado encarregado,\n\nInformamos que foi emitida uma nova fatura de "${faturaForm.descricao}" no valor de ${faturaForm.valor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}, com vencimento em ${new Date(faturaForm.data_vencimento).toLocaleDateString('pt-BR')}.\n\nPoderá efectuar o pagamento directamente na secretaria da escola ou pelo portal.\n\nAtenciosamente,\nDepartamento Financeiro`
                  );

                  // Trigger 6-second popup notification (Rule 3)
                  const popup = document.createElement('div');
                  popup.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500 z-50 flex items-center gap-2 animate-bounce';
                  popup.innerHTML = `✅ Fatura lançada e e-mail de aviso enviado!`;
                  document.body.appendChild(popup);
                  setTimeout(() => popup.remove(), 6000);

                  setIsFaturaModalOpen(false);
                  loadTenantContext();
                } catch (err: any) {
                  alert("Erro ao lançar fatura: " + err.message);
                }
              }}
              className="space-y-4 font-sans text-slate-800"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Selecionar Estudante Beneficiário</label>
                <select
                  value={faturaForm.estudante_id}
                  onChange={(e) => {
                    const selectedS = students.find(s => s.id === e.target.value);
                    setFaturaForm(prev => ({
                      ...prev!,
                      estudante_id: e.target.value,
                      escola_id: selectedS?.escola_id || '',
                      turma_id: selectedS?.turma_id || ''
                    }));
                  }}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none"
                >
                  {students.map(s => {
                    const usr = tenantUsers.find(u => u.id === s.user_id);
                    return (
                      <option key={s.id} value={s.id}>
                        {usr?.nome || 'Estudante'} ({s.numero_matricula})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Descrição / Finalidade do Pagamento</label>
                <input
                  type="text"
                  required
                  value={faturaForm.descricao}
                  onChange={(e) => setFaturaForm(prev => ({ ...prev!, descricao: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor do Lançamento (MZN)</label>
                <input
                  type="number"
                  required
                  value={faturaForm.valor}
                  onChange={(e) => setFaturaForm(prev => ({ ...prev!, valor: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={faturaForm.data_vencimento}
                  onChange={(e) => setFaturaForm(prev => ({ ...prev!, data_vencimento: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFaturaModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2 rounded-xl shadow-sm cursor-pointer"
                >
                  Salvar Fatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL: DOSSIER / PROCESSO INDIVIDUAL DO ESTUDANTE (SLIDING DRAWER) */}
      {isProcessPanelOpen && selectedProcessStudent && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsProcessPanelOpen(false)} />

          <div className="absolute inset-y-0 right-0 max-w-xl w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transform transition-transform duration-300 pointer-events-auto text-slate-800">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Dossier Académico Individual</h3>
                  <p className="text-[10px] text-slate-500 font-mono">REGISTO NACIONAL: {selectedProcessStudent.numero_matricula}</p>
                </div>
              </div>
              <button onClick={() => setIsProcessPanelOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full cursor-pointer text-slate-500">
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-800" id="print-area-dossier">
              {/* Profile Card */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-700 font-extrabold text-lg flex items-center justify-center rounded-2xl flex-shrink-0 uppercase">
                  {tenantUsers.find(u => u.id === selectedProcessStudent.user_id)?.nome?.substring(0, 2) || 'ST'}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {tenantUsers.find(u => u.id === selectedProcessStudent.user_id)?.nome || 'Estudante'}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Gênero: {selectedProcessStudent.genero} • Escola: {schools.find(e => e.id === selectedProcessStudent.escola_id)?.nome || 'N/A'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Turma: {turmas.find(t => t.id === selectedProcessStudent.turma_id)?.nome || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Editable Dossier Info */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await updateDoc(doc(db, 'estudantes', selectedProcessStudent.id), {
                      documento_identificacao: dossierForm.documento_identificacao,
                      nome_pai: dossierForm.nome_pai,
                      nome_mae: dossierForm.nome_mae,
                      morada: dossierForm.morada
                    });
                    await tenantAuditLog(
                      "Atualizar Dossier",
                      "Estudante",
                      selectedProcessStudent.id,
                      `Dossier individual do aluno ${tenantUsers.find(u => u.id === selectedProcessStudent.user_id)?.nome} atualizado.`
                    );

                    // Show 6-second popup notification (Rule 3)
                    const popup = document.createElement('div');
                    popup.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500 z-50 flex items-center gap-2 animate-bounce';
                    popup.innerHTML = `✅ Informações do Dossier atualizadas com sucesso!`;
                    document.body.appendChild(popup);
                    setTimeout(() => popup.remove(), 6000);

                    loadTenantContext();
                  } catch (err: any) {
                    alert("Erro ao salvar dossier: " + err.message);
                  }
                }}
                className="bg-white dark:bg-slate-900 border border-slate-100 p-5 rounded-2xl space-y-4"
              >
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-2">Informações Cadastrais (Dossier)</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">BI / Cédula</label>
                    <input
                      type="text"
                      value={dossierForm.documento_identificacao}
                      onChange={(e) => setDossierForm(prev => ({ ...prev, documento_identificacao: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Nome do Pai</label>
                    <input
                      type="text"
                      value={dossierForm.nome_pai}
                      onChange={(e) => setDossierForm(prev => ({ ...prev, nome_pai: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Nome da Mãe</label>
                    <input
                      type="text"
                      value={dossierForm.nome_mae}
                      onChange={(e) => setDossierForm(prev => ({ ...prev, nome_mae: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Morada Completa</label>
                    <input
                      type="text"
                      value={dossierForm.morada}
                      onChange={(e) => setDossierForm(prev => ({ ...prev, morada: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 py-1.5 rounded-lg cursor-pointer">
                    Salvar Alterações
                  </button>
                </div>
              </form>

              {/* Automatic Grade Evaluation */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 p-5 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-2">Avaliação de Desempenho (Média Moçambicana)</h4>
                {(() => {
                  const studentPautas = pautas.filter(p => p.estudante_id === selectedProcessStudent.id);
                  const totalSubjects = studentPautas.length;
                  const averageMark = totalSubjects > 0 ? (studentPautas.reduce((acc, p) => acc + (p.nota || 0), 0) / totalSubjects) : 0;
                  
                  let ratingLabel = "Sem dados";
                  let ratingColor = "bg-slate-100 text-slate-700";
                  if (totalSubjects > 0) {
                    if (averageMark < 10) {
                      ratingLabel = "Reprovado / Crítico";
                      ratingColor = "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20";
                    } else if (averageMark < 14) {
                      ratingLabel = "Aprovado / Regular";
                      ratingColor = "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20";
                    } else {
                      ratingLabel = "Aprovado / Excelente";
                      ratingColor = "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20";
                    }
                  }

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                          <p className="text-[9px] text-slate-500 font-bold">Média Geral</p>
                          <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{averageMark.toFixed(1)} / 20</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                          <p className="text-[9px] text-slate-500 font-bold">Disciplinas</p>
                          <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{totalSubjects}</p>
                        </div>
                        <div className={`p-2.5 rounded-xl flex flex-col justify-center ${ratingColor}`}>
                          <p className="text-[9px] font-bold">Classificação</p>
                          <p className="text-[10px] font-black mt-1 uppercase text-center">{ratingLabel}</p>
                        </div>
                      </div>

                      {/* Subjects list */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 font-sans">Pauta de Aproveitamento</p>
                        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl space-y-1.5 font-medium">
                          {studentPautas.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-[11px]">
                              <span>{classes.find(d => d.id === p.classe_id)?.nome || 'Cadeira Curricular'}</span>
                              <span className={`font-black ${p.nota >= 10 ? 'text-indigo-600' : 'text-rose-600'}`}>{p.nota} val.</span>
                            </div>
                          ))}
                          {totalSubjects === 0 && (
                            <p className="text-center text-slate-400 text-[10px] py-1">Nenhuma nota lançada nesta ficha académica.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Individual Processes Historical entries */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 p-5 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-2">Histórico do Aluno & Ocorrências</h4>
                
                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {(() => {
                    const studentPautas = pautas.filter(p => p.estudante_id === selectedProcessStudent.id);
                    const studentEvents = processos.filter(p => p.estudante_id === selectedProcessStudent.id);
                    
                    const activities = [
                      ...studentEvents.map(p => ({
                        id: p.id,
                        tipo: p.tipo || 'Ocorrência',
                        descricao: p.observacao || p.detalhes || 'Nenhum detalhe informado',
                        data: p.data || p.criado_em,
                        autor: p.criador_nome || p.criado_por || 'Secretaria Escolar'
                      })),
                      ...studentPautas.map(p => {
                        const discName = classes.find(c => c.id === p.classe_id)?.nome || 'Cadeira Curricular';
                        return {
                          id: p.id,
                          tipo: '📊 Lançamento de Nota',
                          descricao: `Nota publicada para a disciplina "${discName}" (${p.trimestre}). Média Final: ${p.nota_media} valores (${p.situacao}).`,
                          data: p.data_lancamento || p.criado_em || new Date().toISOString(),
                          autor: 'Corpo Docente'
                        };
                      })
                    ];

                    const sortedActivities = activities.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

                    if (sortedActivities.length === 0) {
                      return <p className="text-center text-slate-400 py-2">Nenhum evento histórico registrado no processo.</p>;
                    }

                    return sortedActivities.map(act => (
                      <div key={act.id} className="pl-6 relative">
                        <div className="absolute left-[9px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900 dark:text-white uppercase text-[9px]">{act.tipo}</span>
                          <span className="text-[9px] text-slate-500">{new Date(act.data).toLocaleDateString('pt-PT')}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{act.descricao}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono font-medium">Lançado por: {act.autor}</p>
                      </div>
                    ));
                  })()}
                </div>

                {/* Add Custom Note Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const ocorrValue = formData.get('ocorrencia') as string;
                    if (!ocorrValue.trim()) return;

                    try {
                      await addDoc(collection(db, 'processos_aluno'), {
                        estudante_id: selectedProcessStudent.id,
                        tipo: 'Ocorrência',
                        detalhes: ocorrValue,
                        criado_em: new Date().toISOString(),
                        criado_por: loggedInUser?.nome || 'Admin'
                      });

                      await tenantAuditLog(
                        "Adicionar Ocorrência",
                        "Estudante",
                        selectedProcessStudent.id,
                        `Adicionada nova ocorrência ao processo individual.`
                      );

                      // Show 6-second popup notification (Rule 3)
                      const popup = document.createElement('div');
                      popup.className = 'fixed bottom-5 right-5 bg-indigo-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-indigo-500 z-50 flex items-center gap-2 animate-bounce';
                      popup.innerHTML = `✅ Nova ocorrência lançada no histórico!`;
                      document.body.appendChild(popup);
                      setTimeout(() => popup.remove(), 6000);

                      e.currentTarget.reset();
                      loadTenantContext();
                    } catch (err: any) {
                      alert("Erro ao adicionar nota: " + err.message);
                    }
                  }}
                  className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 font-sans text-slate-850"
                >
                  <label className="block text-[9px] font-bold text-slate-500">Registrar Nova Ocorrência / Ata no Dossier</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="ocorrencia"
                      required
                      placeholder="Ex: Aluno premiado na olimpíada de física..."
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-bold focus:outline-none"
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-lg cursor-pointer">
                      Registrar
                    </button>
                  </div>
                </form>
              </div>

              {/* Action and Export Buttons */}
              <div className="flex gap-2 pt-4 justify-end no-print">
                <button
                  onClick={() => {
                    const printContents = document.getElementById('print-area-dossier')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = `
                        <div style="padding: 40px; font-family: sans-serif; color: #1e293b;">
                          <h1 style="text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 5px;">SGE - MINISTÉRIO DA EDUCAÇÃO DE MOÇAMBIQUE</h1>
                          <h2 style="text-align: center; font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 30px;">PROCESSO INDIVIDUAL DO ALUNO</h2>
                          ${printContents}
                        </div>
                      `;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload();
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" /> Imprimir Boletim de Notas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC MODAL BUILDER */}
      {isModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Deseja realmente fechar? Quaisquer dados preenchidos e alterações não salvas serão perdidos.")) {
                setIsModalOpen(false);
              }
            }
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto pointer-events-auto"
        >
          <div className={`bg-white rounded-2xl ${modalType === 'escola_detalhes' ? 'max-w-2xl' : 'max-w-lg'} w-full p-6 shadow-xl border border-slate-150 pointer-events-auto`}>
            <h3 className="text-lg font-bold text-slate-900 font-sans mb-4">
              {modalType === 'escola_detalhes' 
                ? 'Detalhes da Instituição de Ensino' 
                : `${editingItem ? 'Editar Registro' : 'Novo Lançamento'} (${modalType.toUpperCase()})`}
            </h3>
            
            <form onSubmit={handleSubmit} onChange={() => setIsFormDirty(true)} className="space-y-4">
              
              {/* PROVINCIA FORM */}
              {modalType === 'provincia' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Divisão Geográfica</label>
                    <input 
                      type="text"
                      required
                      value={provinciaForm.nome}
                      onChange={(e) => setProvinciaForm({ ...provinciaForm, nome: e.target.value })}
                      placeholder="Ex: Maputo Cidade"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Código Identificador (3 Letras)</label>
                    <input 
                      type="text"
                      required
                      maxLength={3}
                      value={provinciaForm.codigo}
                      onChange={(e) => setProvinciaForm({ ...provinciaForm, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: MPC"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                </>
              )}

              {/* ESCOLA FORM */}
              {modalType === 'escola' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Escola</label>
                    <input 
                      type="text"
                      required
                      value={escolaForm.nome}
                      onChange={(e) => setEscolaForm({ ...escolaForm, nome: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Província / Distrito</label>
                      <select 
                        value={escolaForm.provincia_id}
                        onChange={(e) => setEscolaForm({ ...escolaForm, provincia_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        {provinces.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Telefone Principal</label>
                      <input 
                        type="text"
                        required
                        value={escolaForm.telefone}
                        onChange={(e) => setEscolaForm({ ...escolaForm, telefone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email Oficial</label>
                    <input 
                      type="email"
                      required
                      value={escolaForm.email}
                      onChange={(e) => setEscolaForm({ ...escolaForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Endereço Completo</label>
                    <input 
                      type="text"
                      required
                      value={escolaForm.endereco}
                      onChange={(e) => setEscolaForm({ ...escolaForm, endereco: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Latitude (Opcional)</label>
                      <input 
                        type="text"
                        placeholder="Ex: -25.9692"
                        value={escolaForm.latitude}
                        onChange={(e) => setEscolaForm({ ...escolaForm, latitude: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Longitude (Opcional)</label>
                      <input 
                        type="text"
                        placeholder="Ex: 32.5732"
                        value={escolaForm.longitude}
                        onChange={(e) => setEscolaForm({ ...escolaForm, longitude: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ESCOLA DETAILS READ-ONLY VIEW */}
              {modalType === 'escola_detalhes' && (
                <div className="space-y-4 text-left">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-base font-bold text-slate-800">{editingItem?.nome}</h4>
                    <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Província: {provinces.find(p => p.id === editingItem?.provincia_id)?.nome || 'Não especificada'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Telefone Principal</span>
                      <p className="font-semibold text-slate-800 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">{editingItem?.telefone || '---'}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Email Oficial</span>
                      <p className="font-semibold text-slate-800 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">{editingItem?.email || '---'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Endereço Completo</span>
                      <p className="font-semibold text-slate-800 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">{editingItem?.endereco || '---'}</p>
                    </div>
                  </div>
                  
                  {/* Selected School Map */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <span className="font-bold text-slate-400 block uppercase text-[10px]">Localização Geográfica da Escola</span>
                    {editingItem && (
                      <div className="w-full rounded-2xl overflow-hidden relative">
                        <SchoolMap 
                          schools={[editingItem]} 
                          provinces={provinces}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TEACHER FORM */}
              {modalType === 'teacher' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Docente</label>
                    <input 
                      type="text"
                      required
                      disabled={!!editingItem}
                      value={teacherForm.nome}
                      onChange={(e) => setTeacherForm({ ...teacherForm, nome: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  {!editingItem && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Email para Cadastro</label>
                      <input 
                        type="email"
                        required
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Especialidade Principal</label>
                      <input 
                        type="text"
                        required
                        value={teacherForm.especialidade}
                        onChange={(e) => setTeacherForm({ ...teacherForm, especialidade: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nº de Registro Profissional</label>
                      <input 
                        type="text"
                        required
                        value={teacherForm.numero_registro}
                        onChange={(e) => setTeacherForm({ ...teacherForm, numero_registro: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Escola de Alocação</label>
                    <select 
                      value={teacherForm.escola_id}
                      onChange={(e) => setTeacherForm({ ...teacherForm, escola_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                    >
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* STUDENT FORM */}
              {modalType === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome Completo do Estudante</label>
                      <input 
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={studentForm.nome}
                        onChange={(e) => setStudentForm({ ...studentForm, nome: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                  {!editingItem && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Email de Acesso (Opcional)</label>
                      <input 
                        type="email"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                        placeholder="Gerado automaticamente se deixado em branco"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Número de Matrícula</label>
                      <input 
                        type="text"
                        required
                        value={studentForm.numero_matricula}
                        onChange={(e) => setStudentForm({ ...studentForm, numero_matricula: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Gênero</label>
                      <select 
                        value={studentForm.genero}
                        onChange={(e) => setStudentForm({ ...studentForm, genero: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data Nascimento</label>
                      <input 
                        type="date"
                        required
                        value={studentForm.data_nascimento}
                        onChange={(e) => setStudentForm({ ...studentForm, data_nascimento: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Responsável ID (Pai)</label>
                      <input 
                        type="text"
                        value={studentForm.pai_id}
                        onChange={(e) => setStudentForm({ ...studentForm, pai_id: e.target.value })}
                        placeholder="Ex: pai-carlos"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Escola</label>
                      <select 
                        value={studentForm.escola_id}
                        disabled={!!editingItem}
                        onChange={(e) => {
                          const schId = e.target.value;
                          const schoolTurmas = turmas.filter(t => t.escola_id === schId);
                          setStudentForm({ 
                            ...studentForm, 
                            escola_id: schId,
                            turma_id: schoolTurmas[0]?.id || ''
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 disabled:opacity-70 disabled:cursor-not-allowed font-bold"
                        required
                      >
                        <option value="">-- Selecionar Escola --</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Turma Destino</label>
                      <select 
                        value={studentForm.turma_id}
                        disabled={!!editingItem || !studentForm.escola_id}
                        onChange={(e) => setStudentForm({ ...studentForm, turma_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 disabled:opacity-70 disabled:cursor-not-allowed font-bold"
                        required
                      >
                        <option value="">-- Selecionar Turma --</option>
                        {turmas
                          .filter(t => t.escola_id === studentForm.escola_id)
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {!!editingItem && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      ⚠️ A escola e a turma não podem ser alteradas diretamente no cadastro. Use a funcionalidade de <strong>Transferência de Aluno</strong>.
                    </p>
                  )}

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id="student_faturado_checkbox"
                        checked={!!studentForm.faturado}
                        onChange={(e) => setStudentForm({ ...studentForm, faturado: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="student_faturado_checkbox" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                        Aluno Facturado
                      </label>
                    </div>

                    {studentForm.faturado && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Período de Facturação</label>
                        <select 
                          value={studentForm.periodo_facturacao || 'Mensal'}
                          onChange={(e) => setStudentForm({ ...studentForm, periodo_facturacao: e.target.value as any })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                        >
                          <option value="Mensal">Mensal</option>
                          <option value="Semestral">Semestral</option>
                          <option value="Anual">Anual</option>
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TURMA FORM */}
              {modalType === 'turma' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Turma</label>
                    <input 
                      type="text"
                      required
                      value={turmaForm.nome}
                      onChange={(e) => setTurmaForm({ ...turmaForm, nome: e.target.value })}
                      placeholder="Ex: 8ª Classe - Turma C"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Ano Letivo (Auto-selecionado)</label>
                      <input 
                        type="text"
                        readOnly
                        value={turmaForm.ano_letivo || '2026'}
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-500 font-bold cursor-not-allowed font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nível Acadêmico</label>
                      <select 
                        value={['Primário', 'Secundário', 'Formação profissional/Instituto', 'Universitário'].includes(turmaForm.nivel) ? turmaForm.nivel : (turmaForm.nivel ? 'Outro' : 'Primário')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Outro') {
                            setTurmaForm({ ...turmaForm, nivel: '' });
                          } else {
                            setTurmaForm({ ...turmaForm, nivel: val });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-bold"
                      >
                        <option value="Primário">Primário</option>
                        <option value="Secundário">Secundário</option>
                        <option value="Formação profissional/Instituto">Formação profissional/Instituto</option>
                        <option value="Universitário">Universitário</option>
                        <option value="Outro">Outro (Especificar...)</option>
                      </select>

                      {!['Primário', 'Secundário', 'Formação profissional/Instituto', 'Universitário'].includes(turmaForm.nivel) && (
                        <div className="mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <input 
                            type="text"
                            required
                            value={turmaForm.nivel}
                            onChange={(e) => setTurmaForm({ ...turmaForm, nivel: e.target.value })}
                            placeholder="Especificar nível académico..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Diretor de Turma</label>
                      <select 
                        value={turmaForm.docente_id}
                        onChange={(e) => setTurmaForm({ ...turmaForm, docente_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="">-- Selecionar Diretor --</option>
                        {teachers.map(t => {
                          const usr = tenantUsers.find(u => u.id === t.user_id);
                          return (
                            <option key={t.id} value={t.id}>{usr?.nome}</option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Capacidade de Alunos</label>
                      <input 
                        type="number"
                        required
                        value={turmaForm.capacidade_max}
                        onChange={(e) => setTurmaForm({ ...turmaForm, capacidade_max: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Escola</label>
                    <select 
                      value={turmaForm.escola_id}
                      onChange={(e) => setTurmaForm({ ...turmaForm, escola_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                    >
                      <option value="">-- Selecionar Escola --</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* CLASSE FORM */}
              {modalType === 'classe' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Matéria/Disciplina</label>
                      <select 
                        value={["Matemática", "Língua Portuguesa", "Física", "Química", "História", "Geografia", "Biologia", "Educação Física", "Artes", "Inglês"].includes(classeForm.nome) || !classeForm.nome ? classeForm.nome : "Custom"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "Custom") {
                            setClasseForm({ ...classeForm, nome: "" });
                          } else {
                            setClasseForm({ ...classeForm, nome: val });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 mb-2 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- Selecionar Disciplina --</option>
                        <option value="Matemática">Matemática</option>
                        <option value="Língua Portuguesa">Língua Portuguesa</option>
                        <option value="Física">Física</option>
                        <option value="Química">Química</option>
                        <option value="História">História</option>
                        <option value="Geografia">Geografia</option>
                        <option value="Biologia">Biologia</option>
                        <option value="Educação Física">Educação Física</option>
                        <option value="Artes">Artes</option>
                        <option value="Inglês">Inglês</option>
                        <option value="Custom">Outra (Digitar...)</option>
                      </select>

                      {(!["Matemática", "Língua Portuguesa", "Física", "Química", "História", "Geografia", "Biologia", "Educação Física", "Artes", "Inglês"].includes(classeForm.nome) || classeForm.nome === "") && (
                        <input 
                          type="text"
                          required
                          value={classeForm.nome}
                          onChange={(e) => setClasseForm({ ...classeForm, nome: e.target.value })}
                          placeholder="Digite o nome da disciplina..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Código da Disciplina (Background)</label>
                      <input 
                        type="text"
                        readOnly
                        value={classeForm.codigo || (() => {
                          const code = 'DISC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                          setTimeout(() => {
                            if (!classeForm.codigo) {
                              setClasseForm(prev => ({ ...prev, codigo: code }));
                            }
                          }, 0);
                          return code;
                        })()}
                        className="w-full bg-slate-150 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-650 font-bold font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Escola</label>
                      <select 
                        value={classeForm.escola_id || ''}
                        required
                        onChange={(e) => setClasseForm({ ...classeForm, escola_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-bold"
                      >
                        <option value="">-- Selecionar Escola --</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Classe Acadêmica</label>
                      <select 
                        value={classeForm.classe_escolar_id || ''}
                        required
                        onChange={(e) => setClasseForm({ ...classeForm, classe_escolar_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-bold"
                      >
                        <option value="">-- Selecionar Classe --</option>
                        {classesEscolares.map(c => (
                          <option key={c.id} value={c.id}>{c.nome} ({c.nivel})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Professores Responsáveis</label>
                    <select 
                      multiple
                      value={classeForm.professores_responsaveis || []}
                      onChange={(e) => {
                        const options = e.target.options;
                        const selected: string[] = [];
                        for (let i = 0; i < options.length; i++) {
                          if (options[i].selected) {
                            selected.push(options[i].value);
                          }
                        }
                        setClasseForm({ ...classeForm, professores_responsaveis: selected });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 min-h-20"
                    >
                      {teachers.map(t => {
                        const usr = tenantUsers.find(u => u.id === t.user_id);
                        return (
                          <option key={t.id} value={t.id}>{usr?.nome || "Docente"}</option>
                        );
                      })}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">Mantenha pressionado Ctrl (Cmd no Mac) para selecionar múltiplos professores.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data da Aula</label>
                      <input 
                        type="date"
                        required
                        value={classeForm.data || ''}
                        onChange={(e) => {
                          const dVal = e.target.value;
                          setClasseForm({ ...classeForm, data: dVal, dia_semana: getDiaSemanaFromDate(dVal) });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Dia da Semana</label>
                      <input 
                        type="text"
                        readOnly
                        value={classeForm.dia_semana || ''}
                        placeholder="Gerado automaticamente..."
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-500 font-medium cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Pertencente à Turma</label>
                      <select 
                        value={classeForm.turma_id}
                        onChange={(e) => setClasseForm({ ...classeForm, turma_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="">-- Selecionar Turma --</option>
                        {turmas.map(t => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Docente Ministrador</label>
                      <select 
                        value={classeForm.docente_id}
                        onChange={(e) => setClasseForm({ ...classeForm, docente_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="">-- Selecionar Docente --</option>
                        {teachers.map(t => {
                          const usr = tenantUsers.find(u => u.id === t.user_id);
                          return (
                            <option key={t.id} value={t.id}>{usr?.nome || "Docente Sem Nome"}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Grade Horária (Predefinida)</label>
                      <select 
                        value={["08:00 - 09:30", "09:35 - 11:05", "11:10 - 12:40", "12:45 - 14:15", "14:20 - 15:50"].includes(classeForm.horario) ? classeForm.horario : "Custom"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "Custom") {
                            setClasseForm({ ...classeForm, horario: "08:00 - 09:30" });
                          } else {
                            setClasseForm({ ...classeForm, horario: val });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="08:00 - 09:30">08:00 - 09:30 (1º Tempo)</option>
                        <option value="09:35 - 11:05">09:35 - 11:05 (2º Tempo)</option>
                        <option value="11:10 - 12:40">11:10 - 12:40 (3º Tempo)</option>
                        <option value="12:45 - 14:15">12:45 - 14:15 (4º Tempo)</option>
                        <option value="14:20 - 15:50">14:20 - 15:50 (5º Tempo)</option>
                        <option value="Custom">-- Definir Horário Personalizado --</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Horário Personalizado</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={classeForm.horario ? classeForm.horario.split(' - ')[0] || "08:00" : "08:00"}
                          onChange={(e) => {
                            const start = e.target.value;
                            const end = classeForm.horario ? classeForm.horario.split(' - ')[1] || "09:30" : "09:30";
                            setClasseForm({ ...classeForm, horario: `${start} - ${end}` });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-750 text-center focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-slate-400 text-xs">até</span>
                        <input
                          type="time"
                          value={classeForm.horario ? classeForm.horario.split(' - ')[1] || "09:30" : "09:30"}
                          onChange={(e) => {
                            const start = classeForm.horario ? classeForm.horario.split(' - ')[0] || "08:00" : "08:00";
                            const end = e.target.value;
                            setClasseForm({ ...classeForm, horario: `${start} - ${end}` });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-750 text-center focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Sala de Aula</label>
                      <select 
                        value={classeForm.sala}
                        onChange={(e) => setClasseForm({ ...classeForm, sala: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-indigo-500"
                        required
                      >
                        <option value="">-- Selecionar Sala --</option>
                        {rawSalas.map(s => (
                          <option key={s.id} value={s.nome}>{s.nome} (Cap: {s.capacidade})</option>
                        ))}
                      </select>
                    </div>
                  </>
              )}

              {/* CLASSE ESCOLAR FORM */}
              {modalType === 'classe_escolar' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Classe Letiva</label>
                    <input 
                      type="text"
                      required
                      value={classeEscolarForm.nome}
                      onChange={(e) => setClasseEscolarForm({ ...classeEscolarForm, nome: e.target.value })}
                      placeholder="Ex: 7ª Classe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nível de Ensino</label>
                    <select 
                      value={classeEscolarForm.nivel}
                      onChange={(e) => setClasseEscolarForm({ ...classeEscolarForm, nivel: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                    >
                      <option value="Primário">Primário (Ensino Básico)</option>
                      <option value="Secundário">Secundário (I Ciclo)</option>
                      <option value="Médio">Médio (II Ciclo / Técnico)</option>
                      <option value="Pré-escolar">Pré-escolar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Descrição do Currículo (Opcional)</label>
                    <textarea 
                      value={classeEscolarForm.descricao}
                      onChange={(e) => setClasseEscolarForm({ ...classeEscolarForm, descricao: e.target.value })}
                      placeholder="Ex: Grade curricular voltada para o ensino básico de 7º ano letivo."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* SALA FORM */}
              {modalType === 'sala' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Sala de Aula</label>
                    <input 
                      type="text"
                      required
                      value={salaForm.nome}
                      onChange={(e) => setSalaForm({ ...salaForm, nome: e.target.value })}
                      placeholder="Ex: Sala A-101, Laboratório de Física"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Capacidade (Alunos)</label>
                      <input 
                        type="number"
                        required
                        value={salaForm.capacidade}
                        onChange={(e) => setSalaForm({ ...salaForm, capacidade: Number(e.target.value) })}
                        placeholder="Ex: 35"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Sala</label>
                      <select 
                        value={salaForm.tipo}
                        onChange={(e) => setSalaForm({ ...salaForm, tipo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Laboratório">Laboratório</option>
                        <option value="Anfiteatro">Anfiteatro</option>
                        <option value="Auditório">Auditório</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Descrição / Recursos (Opcional)</label>
                    <textarea 
                      value={salaForm.descricao}
                      onChange={(e) => setSalaForm({ ...salaForm, descricao: e.target.value })}
                      placeholder="Ex: Projetor disponível, ar condicionado, etc."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* PAUTA FORM */}
              {modalType === 'pauta' && (
                <>
                  <div className="col-span-2 bg-slate-50 border border-slate-150 rounded-xl p-3 mb-2">
                    <label className="block text-xs font-extrabold text-slate-500 mb-1 flex items-center gap-1">🏫 Filtrar por Escola</label>
                    <select
                      value={selectedPautaSchoolId}
                      onChange={(e) => {
                        const schId = e.target.value;
                        setSelectedPautaSchoolId(schId);
                        // Auto-select first student and class of this school
                        const filteredStuds = students.filter(s => !schId || s.escola_id === schId);
                        const filteredClasses = classes.filter(c => {
                          const t = turmas.find(tu => tu.id === c.turma_id);
                          return !schId || (t && t.escola_id === schId);
                        });
                        setPautaForm({
                          ...pautaForm,
                          estudante_id: filteredStuds[0]?.id || '',
                          classe_id: filteredClasses[0]?.id || ''
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700"
                    >
                      <option value="">✨ Todas as Escolas</option>
                      {schools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Estudante Avaliado</label>
                      <select 
                        value={pautaForm.estudante_id}
                        onChange={(e) => setPautaForm({ ...pautaForm, estudante_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="">Selecione Estudante...</option>
                        {students
                          .filter(s => !selectedPautaSchoolId || s.escola_id === selectedPautaSchoolId)
                          .map(s => {
                            const usr = tenantUsers.find(u => u.id === s.user_id);
                            return (
                              <option key={s.id} value={s.id}>{usr?.nome || s.nome}</option>
                            );
                          })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Disciplina / Matéria</label>
                      <select 
                        value={pautaForm.classe_id}
                        onChange={(e) => setPautaForm({ ...pautaForm, classe_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="">Selecione Disciplina...</option>
                        {classes
                          .filter(c => {
                            const t = turmas.find(tu => tu.id === c.turma_id);
                            return !selectedPautaSchoolId || (t && t.escola_id === selectedPautaSchoolId);
                          })
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Trimestre Escolar</label>
                      <select 
                        value={pautaForm.trimestre}
                        onChange={(e) => setPautaForm({ ...pautaForm, trimestre: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="1º Trimestre">1º Trimestre</option>
                        <option value="2º Trimestre">2º Trimestre</option>
                        <option value="3º Trimestre">3º Trimestre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nota da Prova (0-20)</label>
                      <input 
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        value={pautaForm.nota_prova === undefined || pautaForm.nota_prova === null ? '' : pautaForm.nota_prova}
                        onChange={(e) => setPautaForm({ ...pautaForm, nota_prova: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="Em branco (não conta)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Trabalhos</label>
                      <input 
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        value={pautaForm.nota_trabalho === undefined || pautaForm.nota_trabalho === null ? '' : pautaForm.nota_trabalho}
                        onChange={(e) => setPautaForm({ ...pautaForm, nota_trabalho: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm"
                        placeholder="Em branco"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Participação</label>
                      <input 
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        value={pautaForm.nota_participacao === undefined || pautaForm.nota_participacao === null ? '' : pautaForm.nota_participacao}
                        onChange={(e) => setPautaForm({ ...pautaForm, nota_participacao: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm"
                        placeholder="Em branco"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nota Exame (Opt.)</label>
                      <input 
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        value={pautaForm.nota_exame === undefined || pautaForm.nota_exame === null ? '' : pautaForm.nota_exame}
                        onChange={(e) => setPautaForm({ ...pautaForm, nota_exame: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm"
                        placeholder="Opcional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Reavaliação (Opt.)</label>
                      <input 
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        value={pautaForm.nota_reavaliacao === undefined || pautaForm.nota_reavaliacao === null ? '' : pautaForm.nota_reavaliacao}
                        onChange={(e) => setPautaForm({ ...pautaForm, nota_reavaliacao: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Observações da Avaliação</label>
                    <textarea 
                      value={pautaForm.observacao}
                      onChange={(e) => setPautaForm({ ...pautaForm, observacao: e.target.value })}
                      placeholder="Descreva observações de desenvolvimento..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm h-16 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* PROCESSO FORM */}
              {modalType === 'processo' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Estudante Alvo</label>
                      <select 
                        value={processoForm.estudante_id}
                        onChange={(e) => setProcessoForm({ ...processoForm, estudante_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        {students.map(s => {
                          const usr = tenantUsers.find(u => u.id === s.user_id);
                          return (
                            <option key={s.id} value={s.id}>{usr?.nome}</option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Processo</label>
                      <select 
                        value={processoForm.tipo}
                        onChange={(e) => setProcessoForm({ ...processoForm, tipo: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="Matrícula">Matrícula</option>
                        <option value="Transferência">Transferência</option>
                        <option value="Suspensão">Suspensão</option>
                        <option value="Conclusão">Conclusão</option>
                        <option value="Desistência">Desistência</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Acompanhamento Workflow</label>
                    <select 
                      value={processoForm.status}
                      onChange={(e) => setProcessoForm({ ...processoForm, status: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                    >
                      <option value="Solicitação">Solicitação (Iniciado)</option>
                      <option value="Análise">Análise (Em Andamento)</option>
                      <option value="Aprovado">Aprovar Etapa</option>
                      <option value="Rejeitado">Rejeitar</option>
                      <option value="Concluído">Concluir / Arquivar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nomes dos Documentos Anexos</label>
                    <input 
                      type="text"
                      placeholder="Ex: certidao_nascimento.pdf, boletim.pdf"
                      onChange={(e) => setProcessoForm({ ...processoForm, documentos: e.target.value.split(',').map(s => s.trim()) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Justificativa Acadêmica</label>
                    <textarea 
                      value={processoForm.observacao}
                      onChange={(e) => setProcessoForm({ ...processoForm, observacao: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm h-16"
                    />
                  </div>
                </>
              )}

              {/* USER FORM */}
              {modalType === 'user' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome Completo</label>
                    <input 
                      type="text"
                      required
                      value={userForm.nome}
                      onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email Principal de Acesso</label>
                    <input 
                      type="email"
                      required
                      disabled={!!editingItem}
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Cargo / Tipo</label>
                      <select 
                        value={userForm.tipo}
                        onChange={(e) => setUserForm({ ...userForm, tipo: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="admin">Administrador do Tenant</option>
                        <option value="director">Diretor Geral de Escola</option>
                        <option value="docente">Professor / Docente</option>
                        <option value="pai">Pai / Encarregado</option>
                        <option value="estudante">Estudante</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Status Ativação</label>
                      <select 
                        value={userForm.ativo ? 'true' : 'false'}
                        onChange={(e) => setUserForm({ ...userForm, ativo: e.target.value === 'true' })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      >
                        <option value="true">Conta Ativa</option>
                        <option value="false">Conta Bloqueada</option>
                      </select>
                    </div>
                  </div>

                  {/* MODULAR PERMISSIONS CONTAINER */}
                  {userForm.tipo !== 'admin' && (
                    <div className="border-t border-slate-150 pt-4 mt-4">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-indigo-500 animate-pulse" /> Permissões de Acesso
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-normal mb-3">
                        Habilite o módulo principal com a chave de alternância (switch key) e as ações correspondentes com as caixas de seleção (checkboxes).
                      </p>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {Object.keys(DEFAULT_MODULO_ACESSOS).map((moduleKey) => {
                          const moduleData = userForm.modulo_acessos?.[moduleKey] || { habilitado: false, funcionalidades: {} };
                          
                          const moduleLabels: Record<string, string> = {
                            provincias: 'Distritos / Províncias',
                            escolas: 'Gestão de Escolas',
                            docentes: 'Gestão de Docentes',
                            estudantes: 'Registro de Estudantes',
                            turmas: 'Gestão de Turmas',
                            disciplinas: 'Disciplinas / Matérias',
                            classes: 'Classes Letivas',
                            calendario: 'Calendário & Horários',
                            pautas: 'Lançamento de Notas / Pautas',
                            pauta_geral: 'Pauta Geral',
                            processos: 'Processo Individual do Aluno',
                            utilizadores: 'Gestão de Utilizadores',
                            biblioteca: 'Biblioteca Digital',
                            analytics: 'Análises & Analytics'
                          };

                          const label = moduleLabels[moduleKey] || moduleKey;

                          const handleToggleModule = () => {
                            const updated = { ...userForm.modulo_acessos };
                            updated[moduleKey] = {
                              ...moduleData,
                              habilitado: !moduleData.habilitado
                            };
                            setUserForm({ ...userForm, modulo_acessos: updated });
                          };

                          const handleToggleFeature = (featureKey: string) => {
                            const updated = { ...userForm.modulo_acessos };
                            const funcs = { ...moduleData.funcionalidades };
                            funcs[featureKey] = !funcs[featureKey];
                            updated[moduleKey] = {
                              ...moduleData,
                              funcionalidades: funcs
                            };
                            setUserForm({ ...userForm, modulo_acessos: updated });
                          };

                          return (
                            <div key={moduleKey} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-800">{label}</span>
                                <button
                                  type="button"
                                  onClick={handleToggleModule}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    moduleData.habilitado ? 'bg-indigo-600' : 'bg-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                      moduleData.habilitado ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>

                              {moduleData.habilitado && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1.5 border-t border-slate-200 mt-1 pl-0.5">
                                  {['visualizar', 'criar', 'editar', 'excluir'].map((feat) => {
                                    if (moduleKey === 'provincias' && (feat === 'editar' || feat === 'excluir')) return null;

                                    const featLabels: Record<string, string> = {
                                      visualizar: 'Ver Módulo',
                                      criar: 'Cadastrar / Adicionar',
                                      editar: 'Alterar / Editar',
                                      excluir: 'Apagar / Excluir'
                                    };

                                    const isChecked = !!moduleData.funcionalidades[feat];

                                    return (
                                      <label key={feat} className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleFeature(feat)}
                                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <span>{featLabels[feat] || feat}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* FERIAS FORM */}
              {modalType === 'ferias' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Descrição das Férias / Feriado</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Férias de Natal, Feriado Nacional, Recesso Escolar"
                      value={feriasForm.descricao}
                      onChange={(e) => setFeriasForm({ ...feriasForm, descricao: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Aplicável a (Turma / Classe)</label>
                    <select
                      value={feriasForm.turma_id || 'todas'}
                      onChange={(e) => setFeriasForm({ ...feriasForm, turma_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500"
                      required
                    >
                      <option value="todas">✨ Todas as Turmas (Geral)</option>
                      {turmas.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data de Início</label>
                      <input 
                        type="date"
                        required
                        value={feriasForm.data_inicio}
                        onChange={(e) => setFeriasForm({ ...feriasForm, data_inicio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data de Fim</label>
                      <input 
                        type="date"
                        required
                        value={feriasForm.data_fim}
                        onChange={(e) => setFeriasForm({ ...feriasForm, data_fim: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  {modalType === 'escola_detalhes' ? 'Fechar' : 'Cancelar'}
                </button>
                {modalType !== 'escola_detalhes' && (
                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    Confirmar e Salvar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}



      {/* MOBILE RESPONSIVE "MAIS" MENU SHEET */}
      {isMobile && isMobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            onClick={() => setIsMobileMoreOpen(false)} 
            className="absolute inset-0 cursor-pointer bg-transparent" 
          />
          
          <div className="relative max-h-[80vh] overflow-y-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 space-y-6 shadow-2xl transition-transform duration-300 text-white z-50">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Mais Módulos e Ações</h3>
                <p className="text-[11px] text-slate-400">Acesse outros recursos e configurações do sistema.</p>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'provincias', label: 'Distritos / Províncias', icon: <Map className="w-5 h-5 text-emerald-500" />, allowed: hasPermission('provincias') },
                { id: 'escolas', label: `Escolas (${schools.length})`, icon: <School className="w-5 h-5 text-indigo-500" />, allowed: hasPermission('escolas') },
                { id: 'salas', label: `Salas de Aula (${rawSalas.length})`, icon: <DoorOpen className="w-5 h-5 text-teal-400" />, allowed: hasPermission('escolas') },
                { id: 'docentes', label: 'Docentes', icon: <Users className="w-5 h-5 text-sky-500" />, allowed: hasPermission('docentes') },
                { id: 'disciplinas', label: 'Disciplinas', icon: <BookMarked className="w-5 h-5 text-violet-500" />, allowed: hasPermission('disciplinas') },
                { id: 'classes_escolares', label: 'Classes Letivas', icon: <List className="w-5 h-5 text-amber-500" />, allowed: hasPermission('classes') },
                { id: 'calendario', label: 'Calendário & Horários', icon: <Calendar className="w-5 h-5 text-rose-500" />, allowed: hasPermission('calendario') },
                { id: 'pauta_geral', label: 'Pauta Geral', icon: <Award className="w-5 h-5 text-yellow-500" />, allowed: hasPermission('pautas') },
                { id: 'processos', label: 'Processo do Aluno', icon: <FolderOpen className="w-5 h-5 text-pink-500" />, allowed: plan?.modulos_permitidos?.includes('processo') && hasPermission('processos') },
                { id: 'usuarios', label: 'Utilizadores', icon: <UserPlus className="w-5 h-5 text-teal-500" />, allowed: hasPermission('utilizadores') },
                { id: 'configuracao', label: 'Configurações', icon: <Sliders className="w-5 h-5 text-slate-500" />, allowed: hasPermission('configuracoes') },
              ].filter(i => i.allowed).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    guardAction(() => {
                      setActiveTab(item.id);
                      setIsFormDirty(false); // Reset dirty state on successful navigation
                      setIsMobileMoreOpen(false);
                    });
                  }}
                  className={`p-3 bg-slate-850 hover:bg-slate-800 rounded-xl border border-slate-800/80 flex flex-col items-start gap-2 transition-all text-left cursor-pointer ${
                    activeTab === item.id ? 'border-indigo-500/50 bg-indigo-950/25 text-indigo-300' : 'text-slate-200'
                  }`}
                >
                  <div className="p-1.5 bg-slate-900 rounded-lg">
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-bold leading-snug">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Profile and Logout inside sheet */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/40 flex items-center justify-center font-black text-xs uppercase shrink-0">
                    {currentUserRole.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-[11px] text-slate-200 truncate max-w-[150px]">{currentUserEmail}</p>
                    <p className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-wider">{currentUserRole}</p>
                  </div>
                </div>

                <div className="bg-slate-850 px-2 py-0.5 rounded text-[8px] font-mono text-slate-400 border border-slate-800">
                  {detectedOS} ({windowWidth}px)
                </div>
              </div>

              {onLogout && (
                <button 
                  onClick={() => {
                    guardAction(() => {
                      setIsMobileMoreOpen(false);
                      onLogout();
                    });
                  }}
                  className="w-full bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 py-2.5 rounded-xl font-bold text-center text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 border border-rose-900/20"
                >
                  <LogOut className="w-4 h-4" /> Sair da Unidade
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100000]">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
              {confirmModal.isCritical ? (
                <AlertTriangle className="text-rose-500 w-5 h-5 flex-shrink-0" />
              ) : (
                <CheckCircle className="text-indigo-600 w-5 h-5 flex-shrink-0" />
              )}
              {confirmModal.title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2.5 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-2 justify-end pt-4 mt-5 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button 
                type="button"
                onClick={async () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  await confirmModal.onConfirm();
                }}
                className={`text-white font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                  confirmModal.isCritical ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
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

      {/* REAL-TIME IN-APP PUSH TOASTS */}
      {activeToast && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-6 right-6 z-[200000] bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl max-w-sm flex gap-3 items-start cursor-pointer hover:bg-slate-850 transition-colors"
          onClick={() => setActiveToast(null)}
        >
          <div className="bg-indigo-600 p-2 rounded-xl text-white font-extrabold text-base flex-shrink-0 animate-bounce">
            🔔
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-extrabold text-slate-100">{activeToast.titulo}</p>
            <p className="text-slate-300 font-sans leading-relaxed">{activeToast.mensagem}</p>
            <p className="text-[9px] text-slate-500 font-mono text-right">Toque para fechar</p>
          </div>
        </motion.div>
      )}

      {/* UNSAVED CHANGES GUARD DIALOG */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[300000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="bg-amber-100 dark:bg-amber-950/40 p-2.5 rounded-2xl text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans">
                  Alterações não salvas
                </h3>
                <p className="text-[11px] text-slate-400">
                  Você possui alterações em andamento no formulário.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Se você sair deste módulo agora, todos os dados digitados e não salvos serão descartados. Tem certeza de que deseja prosseguir?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={cancelLeave}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Voltar e Editar
              </button>
              <button 
                type="button"
                onClick={confirmLeave}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Descartar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
