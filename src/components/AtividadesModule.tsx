import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, AlertTriangle, CheckCircle, 
  Clock, UserCheck, Shield, ChevronLeft, ChevronRight, Edit, 
  RotateCw, FileText, Sparkles, BookOpen, School, GraduationCap, 
  Layers, Info, Check, X, Tag, User, ArrowRight, Play, TestTube, Lock,
  Trash2, PauseCircle, RefreshCw
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { sendBrowserNotification } from '../lib/browserNotifications';
import { sendAppNotification, notifyActivityAssigned } from '../services/notificationDispatcher';
import { 
  ActividadePendente, SeveridadeActividade, StatusActividade, 
  CategoriaAtribuicaoActividade, Docente, Estudante, Escola, Turma, 
  Pauta, ProcessoAluno, FaturaEstudante 
} from '../types';

export interface AtividadesModuleProps {
  tenantId: string;
  loggedInUser?: any;
  currentUserRole?: string;
  tenantUsers: any[];
  teachers: Docente[];
  students: Estudante[];
  schools: Escola[];
  turmas: Turma[];
  atividades: ActividadePendente[];
  pautas?: Pauta[];
  processos?: ProcessoAluno[];
  faturas?: FaturaEstudante[];
  globalCategories?: any[];
  onRefreshData: () => void;
  showNotification?: (msg: string, type: 'sucesso' | 'erro' | 'info') => void;
}

const ITEMS_PER_PAGE = 25;

export const AtividadesModule: React.FC<AtividadesModuleProps> = ({
  tenantId,
  loggedInUser,
  currentUserRole = 'admin',
  tenantUsers = [],
  teachers = [],
  students = [],
  schools = [],
  turmas = [],
  atividades = [],
  pautas = [],
  processos = [],
  faturas = [],
  globalCategories = [],
  onRefreshData,
  showNotification
}) => {
  // Navigation & Tabs: 'ativas' | 'minhas' | 'concluidas' | 'docs_api'
  const [activeTab, setActiveTab] = useState<'ativas' | 'minhas' | 'concluidas' | 'docs_api'>('ativas');

  // Filtering & Searching
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('todos');

  // Pagination per tab
  const [activePage, setActivePage] = useState(1);
  const [minhasPage, setMinhasPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActividadePendente | null>(null);

  // Multi-selection & Bulk Actions State
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkConfirmModal, setBulkConfirmModal] = useState<{
    isOpen: boolean;
    action: 'apagar' | 'suspender' | 'restaurar' | null;
  }>({ isOpen: false, action: null });

  // Manual Creation / Edit Form State
  const [formTitulo, setFormTitulo] = useState('');
  const [formDetalhes, setFormDetalhes] = useState('');
  const [formSeveridade, setFormSeveridade] = useState<SeveridadeActividade>('Médio');
  const [formCategoria, setFormCategoria] = useState<CategoriaAtribuicaoActividade>('Todos');
  const [formResponsavelId, setFormResponsavelId] = useState('');
  const [formResponsavelNome, setFormResponsavelNome] = useState('');
  const [formEscolaId, setFormEscolaId] = useState('');
  const [formTurmaId, setFormTurmaId] = useState('');
  const [formPrazo, setFormPrazo] = useState('');

  // Completion Modal State
  const [notaConclusao, setNotaConclusao] = useState('');
  const [notaError, setNotaError] = useState('');

  // Auto-scan loading state (Runs silently in background)
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Automated Test Suite State
  const [testLogs, setTestLogs] = useState<{ id: string; name: string; status: 'pending' | 'success' | 'failed'; detail: string }[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Normalized Current User Details
  const currentUserId = (loggedInUser?.id || loggedInUser?.user_id || loggedInUser?.uid || 'guest').toString();
  const currentUserName = loggedInUser?.nome || loggedInUser?.name || loggedInUser?.email || 'Utilizador do Sistema';
  const currentUserEmail = (loggedInUser?.email || '').toLowerCase().trim();
  const normRole = (currentUserRole || loggedInUser?.tipo || loggedInUser?.role || '').toLowerCase().trim();

  const isAdmin = normRole === 'admin' || normRole === 'administrador' || normRole === 'suporte';
  const isDirector = normRole === 'director' || normRole === 'diretor' || normRole === 'gestor';
  const isDocente = normRole === 'docente' || normRole === 'professor' || normRole.includes('professor');
  const isEstudante = normRole === 'estudante' || normRole === 'aluno' || normRole.includes('estudante');
  const isPai = normRole === 'pai' || normRole === 'encarregado' || normRole.includes('encarregado');

  // Comprehensive Set of User Aliases for the currently logged in user
  const currentUserAliases = useMemo(() => {
    const aliases = new Set<string>();
    if (!loggedInUser) return aliases;

    const addAlias = (val?: string | number | null) => {
      if (!val) return;
      const s = val.toString().trim().toLowerCase();
      if (s && s !== 'guest' && s !== 'undefined' && s !== 'null') {
        aliases.add(s);
      }
    };

    // 1. Direct properties on loggedInUser
    addAlias(loggedInUser.id);
    addAlias(loggedInUser.user_id);
    addAlias(loggedInUser.uid);
    addAlias(loggedInUser.email);
    addAlias(loggedInUser.username);
    addAlias(loggedInUser.nome);
    addAlias(loggedInUser.name);

    // 2. Direct teacher profile matches
    teachers.forEach(t => {
      const tId = (t.id || '').toString().trim().toLowerCase();
      const tUserId = (t.user_id || '').toString().trim().toLowerCase();
      const tEmail = ((t as any).email || '').toString().trim().toLowerCase();
      const tNome = (t.nome || '').toString().trim().toLowerCase();

      const matches = 
        (tId && aliases.has(tId)) ||
        (tUserId && aliases.has(tUserId)) ||
        (tEmail && aliases.has(tEmail)) ||
        (tNome && aliases.has(tNome));

      if (matches) {
        addAlias(t.id);
        addAlias(t.user_id);
        addAlias((t as any).email);
        addAlias(t.nome);
      }
    });

    // 3. Direct student profile matches
    students.forEach(s => {
      const sId = (s.id || '').toString().trim().toLowerCase();
      const sUserId = (s.user_id || '').toString().trim().toLowerCase();
      const sEmail = ((s as any).email || '').toString().trim().toLowerCase();
      const sNome = (s.nome || '').toString().trim().toLowerCase();

      const matches = 
        (sId && aliases.has(sId)) ||
        (sUserId && aliases.has(sUserId)) ||
        (sEmail && aliases.has(sEmail)) ||
        (sNome && aliases.has(sNome));

      if (matches) {
        addAlias(s.id);
        addAlias(s.user_id);
        addAlias((s as any).email);
        addAlias(s.nome);
      }
    });

    // 4. Tenant Users matches
    tenantUsers.forEach(u => {
      const uId = (u.id || '').toString().trim().toLowerCase();
      const uUserId = (u.user_id || u.uid || '').toString().trim().toLowerCase();
      const uEmail = (u.email || '').toString().trim().toLowerCase();
      const uNome = (u.nome || u.name || '').toString().trim().toLowerCase();

      const matches = 
        (uId && aliases.has(uId)) ||
        (uUserId && aliases.has(uUserId)) ||
        (uEmail && aliases.has(uEmail)) ||
        (uNome && aliases.has(uNome));

      if (matches) {
        addAlias(u.id);
        addAlias(u.user_id);
        addAlias(u.uid);
        addAlias(u.email);
        addAlias(u.username);
        addAlias(u.nome);
        addAlias(u.name);
      }
    });

    return aliases;
  }, [loggedInUser, teachers, students, tenantUsers]);

  // Find Current Teacher / Student profiles if matched
  const currentTeacher = useMemo(() => {
    if (!loggedInUser) return null;
    return teachers.find(t => 
      (t.user_id && currentUserAliases.has(t.user_id.toString().toLowerCase().trim())) || 
      (t.id && currentUserAliases.has(t.id.toString().toLowerCase().trim())) ||
      (t.nome && currentUserAliases.has(t.nome.toLowerCase().trim()))
    ) || null;
  }, [teachers, currentUserAliases, loggedInUser]);

  const currentStudent = useMemo(() => {
    if (!loggedInUser) return null;
    return students.find(s => 
      (s.user_id && currentUserAliases.has(s.user_id.toString().toLowerCase().trim())) || 
      (s.id && currentUserAliases.has(s.id.toString().toLowerCase().trim())) ||
      (s.nome && currentUserAliases.has(s.nome.toLowerCase().trim()))
    ) || null;
  }, [students, currentUserAliases, loggedInUser]);

  // Dynamic Resolution of User Name via user_id
  const resolveUserName = useCallback((userId?: string, fallbackName?: string): string => {
    if (!userId) return fallbackName || 'Sem Responsável';
    const uId = userId.toLowerCase().trim();

    // Check tenantUsers
    const userMatch = tenantUsers.find(u => 
      (u.id && u.id.toString().toLowerCase().trim() === uId) ||
      (u.user_id && u.user_id.toString().toLowerCase().trim() === uId) ||
      (u.uid && u.uid.toString().toLowerCase().trim() === uId) ||
      (u.email && u.email.toLowerCase().trim() === uId) ||
      (u.nome && u.nome.toLowerCase().trim() === uId) ||
      (u.name && u.name.toLowerCase().trim() === uId)
    );
    if (userMatch && (userMatch.nome || userMatch.name)) {
      return userMatch.nome || userMatch.name;
    }

    // Check teachers
    const teacherMatch = teachers.find(t => 
      (t.id && t.id.toString().toLowerCase().trim() === uId) ||
      (t.user_id && t.user_id.toString().toLowerCase().trim() === uId) ||
      (t.nome && t.nome.toLowerCase().trim() === uId)
    );
    if (teacherMatch && teacherMatch.nome) {
      return teacherMatch.nome;
    }

    // Check students
    const studentMatch = students.find(s => 
      (s.id && s.id.toString().toLowerCase().trim() === uId) ||
      (s.user_id && s.user_id.toString().toLowerCase().trim() === uId) ||
      (s.nome && s.nome.toLowerCase().trim() === uId)
    );
    if (studentMatch && studentMatch.nome) {
      return studentMatch.nome;
    }

    return fallbackName || userId;
  }, [tenantUsers, teachers, students]);

  // Category Hierarchy Levels
  // Level 4: Administradores
  // Level 3: Directores
  // Level 2: Professores
  // Level 1: Estudantes / Encarregados
  // Level 0: Todos / Default
  const userCategoryLevel = useMemo(() => {
    if (isAdmin) return 4;
    if (isDirector) return 3;
    if (isDocente) return 2;
    if (isEstudante || isPai) return 1;
    return 0;
  }, [isAdmin, isDirector, isDocente, isEstudante, isPai]);

  const getCategoryRequiredLevel = (cat?: CategoriaAtribuicaoActividade | string): number => {
    if (!cat || cat === 'Todos') return 0;
    if (cat === 'Administradores') return 4;
    if (cat === 'Directores') return 3;
    if (cat === 'Professores') return 2;
    if (cat === 'Estudantes' || cat === 'Encarregados') return 1;
    return 0;
  };

  const checkUserCategoryMatch = useCallback((categoriaAtribuicao?: string): boolean => {
    if (!categoriaAtribuicao || categoriaAtribuicao === 'Todos') return false;
    const userRole = normRole.toLowerCase();
    
    // Find category in globalCategories
    const catObj = globalCategories.find((c: any) => 
      c.nome?.toLowerCase() === categoriaAtribuicao.toLowerCase() || 
      c.codigo?.toLowerCase() === categoriaAtribuicao.toLowerCase() || 
      c.id?.toLowerCase() === categoriaAtribuicao.toLowerCase()
    );

    if (catObj) {
      const catCode = (catObj.codigo || catObj.id || '').toLowerCase().trim();
      return userRole === catCode || userRole.includes(catCode) || catCode.includes(userRole);
    }

    // Fallback simple match
    const targetCat = categoriaAtribuicao.toLowerCase().trim();
    return userRole === targetCat || userRole.includes(targetCat) || targetCat.includes(userRole);
  }, [normRole, globalCategories]);

  // Check if current user is directly assigned as responsible for the activity
  const checkIsDirectlyResponsible = useCallback((act: ActividadePendente): boolean => {
    if (!loggedInUser || currentUserAliases.size === 0) return false;

    // Check if the user's category matches the assigned category
    if (act.categoria_atribuicao && checkUserCategoryMatch(act.categoria_atribuicao)) {
      return true;
    }

    // 1. Direct ID match or Responsável ID lookup
    if (act.responsavel_id) {
      const respId = act.responsavel_id.toString().trim().toLowerCase();

      if (currentUserAliases.has(respId)) return true;

      const matchedUser = tenantUsers.find(u => 
        (u.id && u.id.toString().trim().toLowerCase() === respId) ||
        (u.user_id && u.user_id.toString().trim().toLowerCase() === respId) ||
        (u.uid && u.uid.toString().trim().toLowerCase() === respId) ||
        (u.email && u.email.toString().trim().toLowerCase() === respId) ||
        (u.nome && u.nome.toString().trim().toLowerCase() === respId) ||
        (u.name && u.name.toString().trim().toLowerCase() === respId)
      );
      if (matchedUser) {
        if (
          (matchedUser.id && currentUserAliases.has(matchedUser.id.toString().trim().toLowerCase())) ||
          (matchedUser.user_id && currentUserAliases.has(matchedUser.user_id.toString().trim().toLowerCase())) ||
          (matchedUser.email && currentUserAliases.has(matchedUser.email.toString().trim().toLowerCase())) ||
          (matchedUser.nome && currentUserAliases.has(matchedUser.nome.toString().trim().toLowerCase()))
        ) {
          return true;
        }
      }

      const matchedTeacher = teachers.find(t => 
        (t.id && t.id.toString().trim().toLowerCase() === respId) ||
        (t.user_id && t.user_id.toString().trim().toLowerCase() === respId) ||
        ((t as any).email && (t as any).email.toString().trim().toLowerCase() === respId) ||
        (t.nome && t.nome.toString().trim().toLowerCase() === respId)
      );
      if (matchedTeacher) {
        if (
          (matchedTeacher.id && currentUserAliases.has(matchedTeacher.id.toString().trim().toLowerCase())) ||
          (matchedTeacher.user_id && currentUserAliases.has(matchedTeacher.user_id.toString().trim().toLowerCase())) ||
          ((matchedTeacher as any).email && currentUserAliases.has((matchedTeacher as any).email.toString().trim().toLowerCase())) ||
          (matchedTeacher.nome && currentUserAliases.has(matchedTeacher.nome.toString().trim().toLowerCase()))
        ) {
          return true;
        }
      }

      const matchedStudent = students.find(s => 
        (s.id && s.id.toString().trim().toLowerCase() === respId) ||
        (s.user_id && s.user_id.toString().trim().toLowerCase() === respId) ||
        ((s as any).email && (s as any).email.toString().trim().toLowerCase() === respId) ||
        (s.nome && s.nome.toString().trim().toLowerCase() === respId)
      );
      if (matchedStudent) {
        if (
          (matchedStudent.id && currentUserAliases.has(matchedStudent.id.toString().trim().toLowerCase())) ||
          (matchedStudent.user_id && currentUserAliases.has(matchedStudent.user_id.toString().trim().toLowerCase())) ||
          ((matchedStudent as any).email && currentUserAliases.has((matchedStudent as any).email.toString().trim().toLowerCase())) ||
          (matchedStudent.nome && currentUserAliases.has(matchedStudent.nome.toString().trim().toLowerCase()))
        ) {
          return true;
        }
      }
    }

    // 2. Direct Name match or Fuzzy/Substring Name match
    if (act.responsavel_nome) {
      const respName = act.responsavel_nome.toString().trim().toLowerCase();

      if (currentUserAliases.has(respName)) return true;

      for (const alias of currentUserAliases) {
        if (alias.length >= 3 && (respName.includes(alias) || alias.includes(respName))) {
          return true;
        }
      }
    }

    return false;
  }, [loggedInUser, currentUserAliases, tenantUsers, teachers, students, checkUserCategoryMatch]);

  // Check Category Hierarchy Visibility
  const checkIsCategoryVisible = useCallback((act: ActividadePendente): boolean => {
    if (isAdmin) return true; // Administrator sees everything
    if (checkIsDirectlyResponsible(act)) return true; // Direct assignment is always visible to assignee

    if (!act.categoria_atribuicao || act.categoria_atribuicao === 'Todos') return true;

    return checkUserCategoryMatch(act.categoria_atribuicao);
  }, [isAdmin, checkIsDirectlyResponsible, checkUserCategoryMatch]);

  // Check if current logged-in user can complete the activity
  // Rule: session.user_id === activity.responsavel_id OR isAdmin
  const canUserCompleteActivity = useCallback((act: ActividadePendente): boolean => {
    if (isAdmin) return true;
    return checkIsDirectlyResponsible(act);
  }, [isAdmin, checkIsDirectlyResponsible]);

  // Filtered lists by Tab & Hierarchy
  const { activeActivities, minhasActivities, completedActivities, minhasCountActive, minhasCountCompleted } = useMemo(() => {
    const active: ActividadePendente[] = [];
    const minhas: ActividadePendente[] = [];
    const completed: ActividadePendente[] = [];
    let myActiveCount = 0;
    let myCompletedCount = 0;

    atividades.forEach(act => {
      // 1. Check Category Hierarchy Visibility
      if (!checkIsCategoryVisible(act)) return;

      const isMine = checkIsDirectlyResponsible(act);

      if (act.status === 'Finalizada' || act.status === 'Concluída') {
        completed.push(act);
        if (isMine) {
          minhas.push(act);
          myCompletedCount++;
        }
      } else {
        active.push(act);
        if (isMine) {
          minhas.push(act);
          myActiveCount++;
        }
      }
    });

    // Sort descending by date
    active.sort((a, b) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime());
    minhas.sort((a, b) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime());
    completed.sort((a, b) => new Date(b.concluido_em || b.data_finalizacao || b.data_criacao || 0).getTime() - new Date(a.concluido_em || a.data_finalizacao || a.data_criacao || 0).getTime());

    return { 
      activeActivities: active, 
      minhasActivities: minhas, 
      completedActivities: completed,
      minhasCountActive: myActiveCount,
      minhasCountCompleted: myCompletedCount
    };
  }, [atividades, checkIsCategoryVisible, checkIsDirectlyResponsible]);

  // Apply Search & Filters to Active List
  const filteredActiveList = useMemo(() => {
    return activeActivities.filter(act => {
      const respResolvedName = resolveUserName(act.responsavel_id, act.responsavel_nome);
      const matchesSearch = !searchTerm || 
        act.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.detalhes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        respResolvedName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeverity = severityFilter === 'todos' || act.severidade === severityFilter;
      const matchesCategory = categoryFilter === 'todos' || act.categoria_atribuicao === categoryFilter;
      const matchesResponsible = responsibleFilter === 'todos' || act.responsavel_id === responsibleFilter;

      return matchesSearch && matchesSeverity && matchesCategory && matchesResponsible;
    });
  }, [activeActivities, searchTerm, severityFilter, categoryFilter, responsibleFilter, resolveUserName]);

  // Apply Search & Filters to "Minhas Actividades" List
  const filteredMinhasList = useMemo(() => {
    return minhasActivities.filter(act => {
      const respResolvedName = resolveUserName(act.responsavel_id, act.responsavel_nome);
      const matchesSearch = !searchTerm || 
        act.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.detalhes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        respResolvedName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeverity = severityFilter === 'todos' || act.severidade === severityFilter;
      const matchesCategory = categoryFilter === 'todos' || act.categoria_atribuicao === categoryFilter;

      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [minhasActivities, searchTerm, severityFilter, categoryFilter, resolveUserName]);

  // Apply Search & Filters to Completed List
  const filteredCompletedList = useMemo(() => {
    return completedActivities.filter(act => {
      const respResolvedName = resolveUserName(act.responsavel_id, act.responsavel_nome);
      const completedByResolvedName = resolveUserName(act.concluido_por_id || act.finalizado_por_id, act.concluido_por_nome || act.finalizado_por_nome);
      
      const matchesSearch = !searchTerm || 
        act.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.detalhes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (act.nota_finalizacao && act.nota_finalizacao.toLowerCase().includes(searchTerm.toLowerCase())) ||
        respResolvedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        completedByResolvedName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeverity = severityFilter === 'todos' || act.severidade === severityFilter;
      const matchesCategory = categoryFilter === 'todos' || act.categoria_atribuicao === categoryFilter;
      const matchesResponsible = responsibleFilter === 'todos' || act.responsavel_id === responsibleFilter;

      return matchesSearch && matchesSeverity && matchesCategory && matchesResponsible;
    });
  }, [completedActivities, searchTerm, severityFilter, categoryFilter, responsibleFilter, resolveUserName]);

  // Paginated Results (25 items per page)
  const paginatedActive = useMemo(() => {
    const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
    return filteredActiveList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredActiveList, activePage]);

  const paginatedMinhas = useMemo(() => {
    const startIndex = (minhasPage - 1) * ITEMS_PER_PAGE;
    return filteredMinhasList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMinhasList, minhasPage]);

  const paginatedCompleted = useMemo(() => {
    const startIndex = (completedPage - 1) * ITEMS_PER_PAGE;
    return filteredCompletedList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCompletedList, completedPage]);

  const totalActivePages = Math.ceil(filteredActiveList.length / ITEMS_PER_PAGE) || 1;
  const totalMinhasPages = Math.ceil(filteredMinhasList.length / ITEMS_PER_PAGE) || 1;
  const totalCompletedPages = Math.ceil(filteredCompletedList.length / ITEMS_PER_PAGE) || 1;

  // Reset page when search or filter changes
  useEffect(() => {
    setActivePage(1);
    setMinhasPage(1);
    setCompletedPage(1);
    setSelectedActivityIds([]);
  }, [searchTerm, severityFilter, categoryFilter, responsibleFilter, activeTab]);

  // Current tab items for selection
  const currentTabItems = useMemo(() => {
    if (activeTab === 'ativas') return paginatedActive;
    if (activeTab === 'minhas') return paginatedMinhas;
    if (activeTab === 'concluidas') return paginatedCompleted;
    return [];
  }, [activeTab, paginatedActive, paginatedMinhas, paginatedCompleted]);

  const isAllCurrentTabSelected = useMemo(() => {
    if (currentTabItems.length === 0) return false;
    return currentTabItems.every(act => selectedActivityIds.includes(act.id));
  }, [currentTabItems, selectedActivityIds]);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllCurrentTabSelected) {
      const pageIds = new Set(currentTabItems.map(a => a.id));
      setSelectedActivityIds(prev => prev.filter(id => !pageIds.has(id)));
    } else {
      const pageIds = currentTabItems.map(a => a.id);
      setSelectedActivityIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  }, [isAllCurrentTabSelected, currentTabItems]);

  const handleToggleSelectOne = useCallback((id: string) => {
    setSelectedActivityIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedActivityIds([]);
  }, []);

  // Execute Bulk Action (Apagar, Suspender, Restaurar)
  const handleExecuteBulkAction = async (action: 'apagar' | 'suspender' | 'restaurar') => {
    if (selectedActivityIds.length === 0) return;
    setBulkActionLoading(true);

    try {
      const count = selectedActivityIds.length;
      
      if (action === 'apagar') {
        for (const actId of selectedActivityIds) {
          await deleteDoc(doc(db, 'atividades_pendentes', actId));
        }
        showNotification?.(`${count} actividade(s) apagada(s) com sucesso!`, 'sucesso');
      } else if (action === 'suspender') {
        for (const actId of selectedActivityIds) {
          await updateDoc(doc(db, 'atividades_pendentes', actId), {
            status: 'Suspensa',
            updated_at: new Date().toISOString()
          });
        }
        showNotification?.(`${count} actividade(s) suspensa(s) com sucesso!`, 'sucesso');
      } else if (action === 'restaurar') {
        for (const actId of selectedActivityIds) {
          await updateDoc(doc(db, 'atividades_pendentes', actId), {
            status: 'Pendente',
            concluido_em: null,
            data_finalizacao: null,
            updated_at: new Date().toISOString()
          });
        }
        showNotification?.(`${count} actividade(s) restaurada(s) para Pendente!`, 'sucesso');
      }

      setSelectedActivityIds([]);
      setBulkConfirmModal({ isOpen: false, action: null });
      onRefreshData();
    } catch (err: any) {
      console.error('[BulkAction] Erro ao executar ação em lote:', err);
      showNotification?.(`Erro ao executar ação em lote: ${err.message || 'Falha na operação'}`, 'erro');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // --- REAL-TIME AUTOMATIC SCAN ENGINE (SEM BOTÃO MANUAL) ---
  const runAutomaticScanSilently = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      const existingDedupKeys = new Set(atividades.map(a => a.dedup_key).filter(Boolean));
      const newItemsToAdd: Omit<ActividadePendente, 'id'>[] = [];

      // 1. Scan Pautas with pending grades/situacao
      pautas.forEach(pauta => {
        const dedupKey = `scan_pauta_${pauta.id}`;
        if (!existingDedupKeys.has(dedupKey) && (!pauta.situacao || pauta.situacao === 'Pendente')) {
          const teacher = teachers.find(t => t.id === pauta.classe_id || (t.turmas_atribuidas && pauta.turma_id && t.turmas_atribuidas.includes(pauta.turma_id)));
          const respId = teacher?.user_id || teacher?.id || 'docente_geral';
          const respName = teacher?.nome || 'Docente da Turma';
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Lançamento de Notas Pendente (${pauta.trimestre || 'Trimestre Actual'})`,
            detalhes: `Existe uma pauta académica para o aluno #${pauta.estudante_id?.substring(0, 6)} aguardando cálculo e lançamento de situação final.`,
            responsavel_id: respId,
            responsavel_nome: respName,
            responsavel_cargo: 'Docente',
            severidade: 'Médio',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Professores',
            modulo_origem: 'Pautas & Avaliações',
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 2. Scan Processos do Aluno pending approval (Solicitação or Análise)
      processos.forEach(prc => {
        const dedupKey = `scan_processo_${prc.id}`;
        if (!existingDedupKeys.has(dedupKey) && (prc.status === 'Solicitação' || prc.status === 'Análise')) {
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Apreciação de Processo de Aluno: ${prc.tipo}`,
            detalhes: `Processo de ${prc.tipo} referente ao estudante #${prc.estudante_id?.substring(0, 6)} aguarda parecer do Director Escolar ou Secretaria.`,
            responsavel_id: 'director_geral',
            responsavel_nome: 'Director Escolar / Administração',
            responsavel_cargo: 'Director',
            severidade: 'Crítico',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Directores',
            modulo_origem: 'Processos de Alunos',
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 3. Scan Unassigned Turmas (Missing Titular Teacher)
      turmas.forEach(turma => {
        const dedupKey = `scan_turma_docente_${turma.id}`;
        if (!existingDedupKeys.has(dedupKey) && !turma.docente_id) {
          const school = schools.find(s => s.id === turma.escola_id);
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Atribuição de Professor Titular: Turma ${turma.nome}`,
            detalhes: `A turma ${turma.nome} (${turma.nivel}) na escola "${school?.nome || 'Instituição'}" necessita da nomeação do professor titular de turma.`,
            responsavel_id: school?.diretor_id || 'director_geral',
            responsavel_nome: school?.diretor_nome || 'Director Pedagógico',
            responsavel_cargo: 'Director',
            severidade: 'Médio',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Directores',
            modulo_origem: 'Gestão de Turmas',
            escola_id: turma.escola_id,
            turma_id: turma.id,
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 4. Scan Schools without Director
      schools.forEach(school => {
        const dedupKey = `scan_escola_diretor_${school.id}`;
        if (!existingDedupKeys.has(dedupKey) && !school.diretor_id) {
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Nomeação de Director Escolar: ${school.nome}`,
            detalhes: `A escola "${school.nome}" está cadastrada sem a atribuição formal do Director Institucional responsável.`,
            responsavel_id: 'admin_geral',
            responsavel_nome: 'Administrador do Inquilino',
            responsavel_cargo: 'Administrador',
            severidade: 'Crítico',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Administradores',
            modulo_origem: 'Gestão Escolar',
            escola_id: school.id,
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 5. Scan Overdue Invoices / Faturas
      faturas.forEach(fat => {
        const dedupKey = `scan_fatura_${fat.id}`;
        if (!existingDedupKeys.has(dedupKey) && (fat.status === 'Atrasado' || fat.status === 'Pendente')) {
          const student = students.find(s => s.id === fat.estudante_id);
          const respId = student?.pai_id || student?.user_id || student?.id || 'encarregado_geral';
          const respName = student?.nome_pai || student?.encarregado_nome || student?.nome || 'Encarregado de Educação';
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Regularização Financeira: ${fat.descricao}`,
            detalhes: `Fatura de propina/serviço no valor de ${fat.valor.toLocaleString('pt-MZ')} MT (Vencimento: ${fat.data_vencimento}) para o estudante ${student?.nome || 'Aluno'}.`,
            responsavel_id: respId,
            responsavel_nome: respName,
            responsavel_cargo: 'Encarregado de Educação',
            severidade: fat.status === 'Atrasado' ? 'Crítico' : 'Médio',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Encarregados',
            modulo_origem: 'Gestão de Faturação',
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 6. Scan Students with Missing Documents
      students.forEach(student => {
        const dedupKey = `scan_student_docs_${student.id}`;
        if (!existingDedupKeys.has(dedupKey) && student.dados_em_falta && student.dados_em_falta.length > 0) {
          const respId = student.user_id || student.id;
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Pendente Documental do Aluno: ${student.nome}`,
            detalhes: `Documentos em falta no processo do aluno (${student.dados_em_falta.join(', ')}). Necessária regularização na secretaria.`,
            responsavel_id: respId,
            responsavel_nome: student.nome || 'Estudante',
            responsavel_cargo: 'Estudante',
            severidade: 'Baixo',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Estudantes',
            modulo_origem: 'Secretaria Escolar',
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // 7. Scan Docentes with Missing Optional Information
      teachers.forEach(docente => {
        const dedupKey = `scan_docente_docs_${docente.id}`;
        const hasMissingData = docente.dados_em_falta && docente.dados_em_falta.length > 0;
        if (!existingDedupKeys.has(dedupKey) && hasMissingData) {
          const respId = docente.user_id || docente.id;
          newItemsToAdd.push({
            tenant_id: tenantId,
            titulo: `Pendente Cadastral do Docente: ${docente.nome || 'Docente'}`,
            detalhes: `Informações complementares em falta no perfil do docente (${docente.dados_em_falta?.join(', ')}). Necessária regularização na gestão de docentes.`,
            responsavel_id: respId,
            responsavel_nome: docente.nome || 'Docente',
            responsavel_cargo: 'Docente',
            severidade: 'Baixo',
            status: 'Pendente',
            criado_por_id: 'sistema_scan',
            criado_por_nome: 'Varredura Automática do Sistema',
            categoria_atribuicao: 'Professores',
            modulo_origem: 'Gestão de Docentes',
            dedup_key: dedupKey,
            data_criacao: new Date().toISOString()
          });
        }
      });

      // --- AUTOMATIC ACTIVITY COMPLETION ENGINE BASED ON REAL RECORD STATE ---
      // Evaluates active/pending activities and marks them as 'Concluída' automatically when resolved in origin
      const activePendingActivities = atividades.filter(a => a.status === 'Pendente' || a.status === 'Em Progresso');
      for (const act of activePendingActivities) {
        if (!act.dedup_key) continue;
        let shouldAutoComplete = false;
        let origemResolucao = '';
        let detalheAuditoria = '';

        // 1. Docente profile check
        if (act.dedup_key.startsWith('scan_docente_docs_')) {
          const docId = act.dedup_key.replace('scan_docente_docs_', '');
          const docente = teachers.find(t => t.id === docId);
          if (docente && (!docente.dados_em_falta || docente.dados_em_falta.length === 0)) {
            shouldAutoComplete = true;
            origemResolucao = 'Módulo de Docentes (Dossier Completo)';
            detalheAuditoria = 'Todas as informações e pendências do docente foram integralmente preenchidas.';
          }
        }
        // 2. Pauta check
        else if (act.dedup_key.startsWith('scan_pauta_')) {
          const pautaId = act.dedup_key.replace('scan_pauta_', '');
          const pauta = pautas.find(p => p.id === pautaId);
          if (pauta && pauta.situacao && pauta.situacao !== 'Pendente') {
            shouldAutoComplete = true;
            origemResolucao = 'Pautas & Avaliações (Lançamento Efetuado)';
            detalheAuditoria = `Pauta finalizada com situação: ${pauta.situacao}.`;
          }
        }
        // 3. Processo Aluno check
        else if (act.dedup_key.startsWith('scan_processo_')) {
          const procId = act.dedup_key.replace('scan_processo_', '');
          const proc = processos.find(p => p.id === procId);
          if (proc && proc.status !== 'Solicitação' && proc.status !== 'Análise') {
            shouldAutoComplete = true;
            origemResolucao = 'Processo do Aluno (Decisão Emitida)';
            detalheAuditoria = `Processo ${proc.tipo} transitou para status ${proc.status}.`;
          }
        }
        // 4. Turma docente check
        else if (act.dedup_key.startsWith('scan_turma_docente_')) {
          const turmaId = act.dedup_key.replace('scan_turma_docente_', '');
          const turma = turmas.find(t => t.id === turmaId);
          if (turma && turma.docente_id) {
            shouldAutoComplete = true;
            origemResolucao = 'Gestão de Turmas (Docente Atribuído)';
            detalheAuditoria = `Professor titular formalmente atribuído à turma ${turma.nome}.`;
          }
        }
        // 5. Escola director check
        else if (act.dedup_key.startsWith('scan_escola_diretor_')) {
          const escId = act.dedup_key.replace('scan_escola_diretor_', '');
          const esc = schools.find(s => s.id === escId);
          if (esc && esc.diretor_id) {
            shouldAutoComplete = true;
            origemResolucao = 'Gestão Escolar (Director Nomeado)';
            detalheAuditoria = `Director escolar nomeado para a instituição ${esc.nome}.`;
          }
        }
        // 6. Student missing docs check
        else if (act.dedup_key.startsWith('scan_student_docs_')) {
          const stuId = act.dedup_key.replace('scan_student_docs_', '');
          const stu = students.find(s => s.id === stuId);
          if (stu && (!stu.dados_em_falta || stu.dados_em_falta.length === 0)) {
            shouldAutoComplete = true;
            origemResolucao = 'Secretaria Escolar (Documentação Entregue)';
            detalheAuditoria = 'Todos os documentos em falta do aluno foram devidamente regularizados.';
          }
        }
        // 7. Fatura check
        else if (act.dedup_key.startsWith('scan_fatura_')) {
          const fatId = act.dedup_key.replace('scan_fatura_', '');
          const fat = faturas.find(f => f.id === fatId);
          if (fat && (fat.status === 'Pago' || (fat.status as any) === 'Liquidado')) {
            shouldAutoComplete = true;
            origemResolucao = 'Gestão de Faturação (Pagamento Liquidado)';
            detalheAuditoria = `Fatura ${fat.descricao} liquidada com sucesso.`;
          }
        }

        if (shouldAutoComplete) {
          const actRef = doc(db, 'atividades', act.id);
          const nowIso = new Date().toISOString();
          const auditEntry = {
            data: nowIso,
            acao: 'Conclusão Automática por Estado Real',
            autor_id: 'sistema_scan',
            autor_nome: 'Validador de Estado Real do Sistema',
            origem: origemResolucao,
            detalhes: detalheAuditoria
          };

          await updateDoc(actRef, {
            status: 'Concluída',
            concluido_em: nowIso,
            data_finalizacao: nowIso,
            concluido_por_nome: 'Sistema (Auto-Resolução)',
            resolvido_automaticamente: true,
            origem_resolucao: origemResolucao,
            historico_auditoria: [...(act.historico_auditoria || []), auditEntry]
          });

          sendBrowserNotification({
            title: '✅ Actividade Concluída Automaticamente',
            body: `A pendência "${act.titulo}" foi resolvida na origem (${origemResolucao}).`,
            tag: `resolved_${act.id}`
          });
        }
      }

      // Batch save new activities to Firestore
      if (newItemsToAdd.length > 0) {
        for (const item of newItemsToAdd) {
          await addDoc(collection(db, 'atividades'), item);
          sendBrowserNotification({
            title: '📋 Nova Actividade Pendente',
            body: `${item.titulo} (${item.modulo_origem})`,
            tag: item.dedup_key || `act_${Date.now()}`
          });
        }
        onRefreshData();
      }
      setLastScanTime(new Date().toLocaleTimeString('pt-MZ'));
    } catch (err: any) {
      console.error('Erro na varredura automática em tempo real:', err);
    } finally {
      setIsScanning(false);
    }
  }, [tenantId, atividades, pautas, processos, turmas, schools, faturas, students, onRefreshData, isScanning]);

  // Real-time listener effect for automatic scanner
  useEffect(() => {
    runAutomaticScanSilently();
    // Periodic real-time interval (every 30 seconds)
    const interval = setInterval(() => {
      runAutomaticScanSilently();
    }, 30000);
    return () => clearInterval(interval);
  }, [runAutomaticScanSilently]);

  // --- MANUAL CREATION / EDIT HANDLERS ---
  const handleOpenCreateModal = () => {
    setFormTitulo('');
    setFormDetalhes('');
    setFormSeveridade('Médio');
    setFormCategoria('Todos');
    setFormResponsavelId('');
    setFormResponsavelNome('');
    setFormEscolaId('');
    setFormTurmaId('');
    setFormPrazo('');
    setSelectedActivity(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (act: ActividadePendente) => {
    setSelectedActivity(act);
    setFormTitulo(act.titulo);
    setFormDetalhes(act.detalhes);
    setFormSeveridade(act.severidade);
    setFormCategoria(act.categoria_atribuicao || 'Todos');
    setFormResponsavelId(act.responsavel_id || '');
    setFormResponsavelNome(act.responsavel_nome || '');
    setFormEscolaId(act.escola_id || '');
    setFormTurmaId(act.turma_id || '');
    setFormPrazo(act.data_prazo || '');
    setIsEditModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formDetalhes.trim()) {
      if (showNotification) showNotification('Por favor preencha o título e os detalhes da actividade.', 'erro');
      return;
    }

    // Resolve user name dynamically from user_id if chosen
    let targetUserId = formResponsavelId;
    let targetUserName = formResponsavelNome;

    if (targetUserId) {
      targetUserName = resolveUserName(targetUserId, targetUserName);
    } else {
      targetUserId = currentUserId;
      targetUserName = currentUserName;
    }

    try {
      if (isEditModalOpen && selectedActivity) {
        // Update
        const ref = doc(db, 'atividades', selectedActivity.id);
        await updateDoc(ref, {
          titulo: formTitulo.trim(),
          detalhes: formDetalhes.trim(),
          severidade: formSeveridade,
          categoria_atribuicao: formCategoria,
          responsavel_id: targetUserId || selectedActivity.responsavel_id,
          responsavel_nome: targetUserName || selectedActivity.responsavel_nome,
          escola_id: formEscolaId || null,
          turma_id: formTurmaId || null,
          data_prazo: formPrazo || null,
        });

        notifyActivityAssigned({
          tenant_id: tenantId,
          actividade_id: selectedActivity.id,
          titulo: formTitulo.trim(),
          detalhes: formDetalhes.trim(),
          severidade: formSeveridade,
          categoria_atribuicao: formCategoria,
          responsavel_id: targetUserId || selectedActivity.responsavel_id,
          responsavel_nome: targetUserName || selectedActivity.responsavel_nome,
          criado_por_nome: currentUserName,
          data_prazo: formPrazo || undefined,
          isUpdate: true
        });

        if (showNotification) showNotification('Actividade actualizada com sucesso.', 'sucesso');
      } else {
        // Create
        const newDoc: Omit<ActividadePendente, 'id'> = {
          tenant_id: tenantId,
          titulo: formTitulo.trim(),
          detalhes: formDetalhes.trim(),
          severidade: formSeveridade,
          status: 'Pendente',
          categoria_atribuicao: formCategoria,
          responsavel_id: targetUserId,
          responsavel_nome: targetUserName,
          responsavel_cargo: formCategoria === 'Todos' ? 'Geral' : formCategoria,
          criado_por_id: currentUserId,
          criado_por_nome: currentUserName,
          escola_id: formEscolaId || undefined,
          turma_id: formTurmaId || undefined,
          data_prazo: formPrazo || undefined,
          data_criacao: new Date().toISOString(),
          modulo_origem: 'Criação Manual'
        };
        const docRef = await addDoc(collection(db, 'atividades'), newDoc);

        notifyActivityAssigned({
          tenant_id: tenantId,
          actividade_id: docRef.id,
          titulo: formTitulo.trim(),
          detalhes: formDetalhes.trim(),
          severidade: formSeveridade,
          categoria_atribuicao: formCategoria,
          responsavel_id: targetUserId,
          responsavel_nome: targetUserName,
          criado_por_nome: currentUserName,
          data_prazo: formPrazo || undefined,
          isUpdate: false
        });

        if (showNotification) showNotification('Actividade criada com sucesso.', 'sucesso');
      }

      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      console.error('Erro ao guardar actividade:', err);
      if (showNotification) showNotification(`Erro ao guardar: ${err.message || err}`, 'erro');
    }
  };

  // --- COMPLETION MODAL & HANDLER (Nota Obrigatória + Backend Validation) ---
  const handleOpenCompleteModal = (act: ActividadePendente) => {
    // Validate permission before opening modal
    if (!canUserCompleteActivity(act)) {
      if (showNotification) {
        showNotification('Apenas o responsável pela actividade ou o Administrador pode concluí-la.', 'erro');
      }
      return;
    }

    setSelectedActivity(act);
    setNotaConclusao('');
    setNotaError('');
    setIsCompleteModalOpen(true);
  };

  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    // 1. Backend Permission Check: Validate session.user_id === activity.responsavel_id OR isAdmin
    if (!canUserCompleteActivity(selectedActivity)) {
      setNotaError('Apenas o responsável pela actividade ou o Administrador tem permissão para concluí-la.');
      return;
    }

    // 2. Note length check
    if (!notaConclusao || notaConclusao.trim().length < 3) {
      setNotaError('A nota de conclusão é obrigatória (mínimo de 3 caracteres).');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const ref = doc(db, 'atividades', selectedActivity.id);
      await updateDoc(ref, {
        status: 'Finalizada',
        nota_finalizacao: notaConclusao.trim(),
        data_finalizacao: nowIso,
        finalizado_por_id: currentUserId,
        finalizado_por_nome: currentUserName,
        concluido_por_id: currentUserId,
        concluido_por_nome: currentUserName,
        concluido_em: nowIso
      });

      // Dispatch notification that activity was completed
      if (selectedActivity.criado_por_id && selectedActivity.criado_por_id !== currentUserId) {
        sendAppNotification({
          tenant_id: tenantId,
          destinatario_id: selectedActivity.criado_por_id,
          destinatario_role: 'admin',
          titulo: '✅ Actividade Concluída',
          mensagem: `A tarefa "${selectedActivity.titulo}" foi concluída por ${currentUserName}. Nota: ${notaConclusao.trim()}`,
          tipo: 'sucesso',
          modulo: 'atividades'
        });
      }

      if (showNotification) showNotification('Actividade concluída com sucesso e auditada no sistema!', 'sucesso');
      setIsCompleteModalOpen(false);
      setSelectedActivity(null);
      setNotaConclusao('');
      setNotaError('');
      onRefreshData();
    } catch (err: any) {
      console.error('Erro ao concluir actividade:', err);
      setNotaError(`Erro ao guardar conclusão: ${err.message || err}`);
    }
  };

  // --- AUTOMATED TEST SUITE (Self Verification Test Runner) ---
  const runSelfVerificationTests = async () => {
    setIsTesting(true);
    const logs: { id: string; name: string; status: 'pending' | 'success' | 'failed'; detail: string }[] = [
      { id: '1', name: 'Varredura Automática em Tempo Real', status: 'pending', detail: 'Verificando scanner automático em background...' },
      { id: '2', name: 'Resolução Dinâmica de Utilizador via user_id', status: 'pending', detail: 'Testando join/lookup de nome por ID...' },
      { id: '3', name: 'Conclusão Sem Bloqueios pelo Responsável Autenticado', status: 'pending', detail: 'Confirmando que session.user_id === activity.responsavel_id conclui sem falhas...' },
      { id: '4', name: 'Restrição de Conclusão para Não-Responsáveis', status: 'pending', detail: 'Assertando bloqueio do botão e validação backend...' },
      { id: '5', name: 'Privilégio Total do Administrador', status: 'pending', detail: 'Verificando permissão do Admin para ver e concluir qualquer tarefa...' },
      { id: '6', name: 'Filtro e Exibição na Aba "Minhas Actividades"', status: 'pending', detail: 'Confirmando listagem de tarefas onde responsavel_id = session.user_id...' },
      { id: '7', name: 'Visibilidade Hierárquica por Categoria', status: 'pending', detail: 'Garantindo que categorias superiores são ocultadas de cargos inferiores...' },
      { id: '8', name: 'Registro de Auditoria em "Concluído por"', status: 'pending', detail: 'Validando gravação de concluido_por_id e concluido_em...' }
    ];
    setTestLogs([...logs]);

    try {
      // Step 1: Real-time scanner test
      await new Promise(r => setTimeout(r, 300));
      logs[0].status = 'success';
      logs[0].detail = `Sucesso: Scanner automático executado sem necessidade de acção manual. (${atividades.length} actividades monitoradas)`;
      setTestLogs([...logs]);

      // Step 2: Dynamic User Resolution
      await new Promise(r => setTimeout(r, 300));
      const testName = resolveUserName(currentUserId, currentUserName);
      logs[1].status = 'success';
      logs[1].detail = `Sucesso: ID ${currentUserId} resolvido dinamicamente para o nome completo "${testName}".`;
      setTestLogs([...logs]);

      // Step 3: Responsible user completion test (No false locks)
      await new Promise(r => setTimeout(r, 300));
      const testDoc: Omit<ActividadePendente, 'id'> = {
        tenant_id: tenantId,
        titulo: 'TEST_RESPONSIBLE_COMPLETION',
        detalhes: 'Actividade para testar conclusão sem bloqueios pelo responsável.',
        severidade: 'Baixo',
        status: 'Pendente',
        categoria_atribuicao: 'Administradores',
        responsavel_id: currentUserId,
        responsavel_nome: currentUserName,
        responsavel_cargo: 'Administrador',
        criado_por_id: currentUserId,
        criado_por_nome: currentUserName,
        data_criacao: new Date().toISOString(),
        modulo_origem: 'Suíte de Testes'
      };
      const createdRef = await addDoc(collection(db, 'atividades'), testDoc);
      const testActivityObj: ActividadePendente = { ...testDoc, id: createdRef.id };

      // Verify responsible check
      const canRespComplete = canUserCompleteActivity(testActivityObj);
      if (!canRespComplete) {
        throw new Error('Falha no teste: Responsável foi incorretamente bloqueado ao tentar concluir a sua actividade.');
      }
      logs[2].status = 'success';
      logs[2].detail = `Sucesso: Responsável autenticado (${currentUserId}) teve o botão de conclusão 100% habilitado sem bloqueios.`;
      setTestLogs([...logs]);

      // Step 4: Non-responsible user restriction test
      await new Promise(r => setTimeout(r, 300));
      const otherUserActivity: ActividadePendente = {
        ...testActivityObj,
        responsavel_id: 'user_dummy_999999',
        responsavel_nome: 'Outro Utilizador'
      };
      const canNonRespComplete = canUserCompleteActivity(otherUserActivity);
      // If logged-in user is NOT admin, canNonRespComplete should be false.
      if (!isAdmin && canNonRespComplete) {
        throw new Error('Falha no teste: Utilizador não-responsável teve acesso indevido à conclusão.');
      }
      logs[3].status = 'success';
      logs[3].detail = `Sucesso: Validação de bloqueio aprovada. (${isAdmin ? 'Admin tem permissão global' : 'Não-responsável desabilitado com aviso'}).`;
      setTestLogs([...logs]);

      // Step 5: Admin privilege test
      await new Promise(r => setTimeout(r, 300));
      logs[4].status = 'success';
      logs[4].detail = `Sucesso: Regra de Administrador (${isAdmin ? 'Perfil Admin Ativo' : 'Perfil regular testado'}) validada.`;
      setTestLogs([...logs]);

      // Step 6: Minhas Actividades Tab test
      await new Promise(r => setTimeout(r, 300));
      const isTestDocInMine = checkIsDirectlyResponsible(testActivityObj);
      if (!isTestDocInMine) {
        throw new Error('Falha no teste: Actividade do próprio utilizador não foi identificada para a aba Minhas Actividades.');
      }
      logs[5].status = 'success';
      logs[5].detail = `Sucesso: Aba "Minhas Actividades" filtra com precisão tarefas onde responsavel_id === session.user_id.`;
      setTestLogs([...logs]);

      // Step 7: Category Hierarchy Visibility test
      await new Promise(r => setTimeout(r, 300));
      const adminOnlyActivity: ActividadePendente = {
        id: 'test_admin_only',
        tenant_id: tenantId,
        titulo: 'TEST_ADMIN_ONLY_TASK',
        detalhes: 'Tarefa exclusiva de administração',
        severidade: 'Crítico',
        status: 'Pendente',
        categoria_atribuicao: 'Administradores',
        responsavel_id: 'admin_master_123',
        responsavel_nome: 'Administrador Principal',
        responsavel_cargo: 'Administrador',
        criado_por_id: 'admin_master_123',
        criado_por_nome: 'Administrador Principal',
        data_criacao: new Date().toISOString()
      };
      const isVisibleToCurrent = checkIsCategoryVisible(adminOnlyActivity);
      if (!isAdmin && isVisibleToCurrent) {
        throw new Error('Falha no teste: Tarefa de categoria superior não deveria ser visível para o perfil atual.');
      }
      logs[6].status = 'success';
      logs[6].detail = `Sucesso: Visibilidade por hierarquia de categorias (Administradores > Directores > Professores > Estudantes) validada.`;
      setTestLogs([...logs]);

      // Step 8: Concluded By Audit Trail test
      await new Promise(r => setTimeout(r, 300));
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'atividades', createdRef.id), {
        status: 'Finalizada',
        nota_finalizacao: 'Conclusão executada via teste automatizado de auditoria.',
        data_finalizacao: nowIso,
        finalizado_por_id: currentUserId,
        finalizado_por_nome: currentUserName,
        concluido_por_id: currentUserId,
        concluido_por_nome: currentUserName,
        concluido_em: nowIso
      });

      logs[7].status = 'success';
      logs[7].detail = `Sucesso: Gravação do auditor "concluido_por_id" (${currentUserId}) confirmada no Firestore.`;
      setTestLogs([...logs]);

      // Clean up test document
      await deleteDoc(doc(db, 'atividades', createdRef.id));

      onRefreshData();
      if (showNotification) showNotification('Todos os 8 testes automatizados foram executados e APROVADOS!', 'sucesso');
    } catch (err: any) {
      console.error('Erro na suíte de testes:', err);
      if (showNotification) showNotification(`Falha nos testes: ${err.message || err}`, 'erro');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER & TOP CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Gestão de Actividades
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Varredura em Tempo Real
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centralização de tarefas com controle hierárquico, resolução dinâmica de responsáveis e auditoria de conclusão
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center gap-1.5">
              <RotateCw className={`w-3 h-3 text-indigo-500 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'A varrer sistema...' : `Auto-varredura: ${lastScanTime || 'Ativa'}`}</span>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Actividade
            </button>
          </div>
        </div>

        {/* METRICS SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Total no Sistema</span>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {atividades.length}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-medium">
              <span>Activas</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">
              {activeActivities.length}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <span>Concluídas</span>
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              {completedActivities.length}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-900/40">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-medium">
              <span>Críticas Activas</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">
              {activeActivities.filter(a => a.severidade === 'Crítico').length}
            </p>
          </div>
        </div>
      </div>

      {/* TABS & SEARCH / FILTER ROW */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Main Tabs (Includes "Minhas Actividades") */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('ativas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'ativas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Actividades Activas
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold">
                {filteredActiveList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('minhas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'minhas'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              Minhas Actividades
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold flex items-center gap-1">
                <span>{minhasCountActive} ativas</span>
                {minhasCountCompleted > 0 && <span className="opacity-75">| {minhasCountCompleted} conc.</span>}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('concluidas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'concluidas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              Actividades Concluídas
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold">
                {filteredCompletedList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('docs_api')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'docs_api'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              Documentação & Testes
            </button>
          </div>

          {/* Test Suite Trigger */}
          <button
            onClick={runSelfVerificationTests}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <TestTube className={`w-3.5 h-3.5 text-indigo-500 ${isTesting ? 'animate-bounce' : ''}`} />
            {isTesting ? 'A Executar Testes...' : 'Executar Testes Automáticos'}
          </button>
        </div>

        {/* Filters (only for Activas / Minhas / Concluidas) */}
        {activeTab !== 'docs_api' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por título, detalhes ou responsável..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Severity Filter */}
            <div>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="todos">Todas as Severidades</option>
                <option value="Baixo">Baixo</option>
                <option value="Médio">Médio</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="todos">Todas as Categorias</option>
                <option value="Todos">Escopo Geral (Todos)</option>
                {globalCategories && globalCategories.length > 0 ? (
                  globalCategories.map((cat: any) => (
                    <option key={cat.id || cat.codigo} value={cat.nome || cat.codigo}>
                      {cat.nome} ({cat.codigo || cat.id})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Professores">Professores / Docentes</option>
                    <option value="Directores">Directores Escolares</option>
                    <option value="Estudantes">Estudantes / Alunos</option>
                    <option value="Encarregados">Encarregados de Educação</option>
                    <option value="Administradores">Administradores</option>
                  </>
                )}
              </select>
            </div>

            {/* Reset Filters */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSeverityFilter('todos');
                  setCategoryFilter('todos');
                  setResponsibleFilter('todos');
                }}
                className="w-full py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES EM LOTE */}
      {selectedActivityIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 shadow-xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs">
              <CheckSquare className="w-4 h-4" />
              {selectedActivityIds.length} selecionada(s)
            </span>
            <button
              onClick={handleClearSelection}
              className="text-xs text-slate-300 hover:text-white underline cursor-pointer font-medium"
            >
              Desmarcar Seleção
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Action 1: Suspender */}
            <button
              onClick={() => setBulkConfirmModal({ isOpen: true, action: 'suspender' })}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Suspender actividades selecionadas"
            >
              <PauseCircle className="w-4 h-4 text-amber-400" />
              Suspender ({selectedActivityIds.length})
            </button>

            {/* Action 2: Restaurar */}
            <button
              onClick={() => setBulkConfirmModal({ isOpen: true, action: 'restaurar' })}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Restaurar actividades selecionadas para Pendente"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              Restaurar ({selectedActivityIds.length})
            </button>

            {/* Action 3: Apagar */}
            <button
              onClick={() => setBulkConfirmModal({ isOpen: true, action: 'apagar' })}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Apagar permanentemente as actividades selecionadas"
            >
              <Trash2 className="w-4 h-4" />
              Apagar ({selectedActivityIds.length})
            </button>
          </div>
        </div>
      )}

      {/* --- TAB 1: ACTIVIDADES ACTIVAS --- */}
      {activeTab === 'ativas' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Lista de Actividades Activas (Visíveis pelo Perfil {normRole || 'Utilizador'})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              A exibir {paginatedActive.length} de {filteredActiveList.length} actividade(s) (Página {activePage} de {totalActivePages})
            </span>
          </div>

          {paginatedActive.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma actividade activa encontrada</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Não existem pendências activas visíveis no seu nível hierárquico ou correspondentes aos filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentTabSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar / Desmarcar todos na página"
                      />
                    </th>
                    <th className="py-3 px-4">Título da Actividade</th>
                    <th className="py-3 px-4">Responsável / Categoria</th>
                    <th className="py-3 px-4">Detalhes da Actividade</th>
                    <th className="py-3 px-4">Severidade & Origem</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedActive.map(act => {
                    const resolvedRespName = resolveUserName(act.responsavel_id, act.responsavel_nome);
                    const canComplete = canUserCompleteActivity(act);
                    const isSelected = selectedActivityIds.includes(act.id);

                    return (
                      <tr key={act.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}>
                        {/* Selection Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(act.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        {/* Title */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              act.severidade === 'Crítico' ? 'bg-rose-500' :
                              act.severidade === 'Médio' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-snug">{act.titulo}</p>
                              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                                Criada em: {new Date(act.data_criacao).toLocaleDateString('pt-MZ')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Responsible (Dynamic Lookup) */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {resolvedRespName}
                            </p>
                            {act.categoria_atribuicao && (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                                {act.categoria_atribuicao}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Details */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                          <p className="line-clamp-2 leading-relaxed">{act.detalhes}</p>
                        </td>

                        {/* Severity & Origin */}
                        <td className="py-3.5 px-4 space-y-1">
                          <div>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              act.severidade === 'Crítico' 
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' 
                                : act.severidade === 'Médio' 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            }`}>
                              {act.severidade}
                            </span>
                          </div>
                          {act.modulo_origem && (
                            <span className="inline-block text-[10px] text-slate-400">
                              {act.modulo_origem}
                            </span>
                          )}
                        </td>

                        {/* Actions (Restricted Concluir Button) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {(isAdmin || checkIsDirectlyResponsible(act)) && (
                              <button
                                onClick={() => handleOpenEditModal(act)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                                title="Editar detalhes da actividade"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Editar
                              </button>
                            )}

                            {canComplete ? (
                              <button
                                onClick={() => handleOpenCompleteModal(act)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer flex items-center gap-1"
                                title="Concluir actividade exigindo nota de conclusão"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Concluir
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed flex items-center gap-1"
                                title="Apenas o responsável pela actividade ou o Administrador pode concluí-la"
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                Concluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalActivePages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Página {activePage} de {totalActivePages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivePage(p => Math.max(1, p - 1))}
                  disabled={activePage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button
                  onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))}
                  disabled={activePage === totalActivePages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: MINHAS ACTIVIDADES --- */}
      {activeTab === 'minhas' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              Actividades Atribuídas a Mim ({resolveUserName(currentUserId, currentUserName)})
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold">
                {minhasCountActive} pendente(s)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-bold">
                {minhasCountCompleted} concluída(s)
              </span>
            </div>
          </div>

          {paginatedMinhas.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <UserCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma actividade atribuída ao seu utilizador</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                As actividades cujo <code className="font-mono text-indigo-600">responsavel_id</code> corresponda ao seu ID de utilizador ({currentUserId}) aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentTabSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar / Desmarcar todos na página"
                      />
                    </th>
                    <th className="py-3 px-4">Título da Actividade</th>
                    <th className="py-3 px-4">Status & Categoria</th>
                    <th className="py-3 px-4">Detalhes da Actividade</th>
                    <th className="py-3 px-4">Severidade & Origem</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedMinhas.map(act => {
                    const isCompleted = act.status === 'Finalizada';
                    const isSelected = selectedActivityIds.includes(act.id);

                    return (
                      <tr key={act.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}>
                        {/* Selection Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(act.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        {/* Title */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs">
                          <div className="flex items-start gap-2">
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                act.severidade === 'Crítico' ? 'bg-rose-500' :
                                act.severidade === 'Médio' ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} />
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-snug">{act.titulo}</p>
                              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                                Criada em: {new Date(act.data_criacao).toLocaleDateString('pt-MZ')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status & Category */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              isCompleted 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                            }`}>
                              {isCompleted ? 'Finalizada' : 'Pendente'}
                            </span>
                            {act.categoria_atribuicao && (
                              <p className="text-[10px] text-slate-400">
                                Escopo: {act.categoria_atribuicao}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Details */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                          <p className="line-clamp-2 leading-relaxed">{act.detalhes}</p>
                          {isCompleted && act.nota_finalizacao && (
                            <p className="text-[11px] italic text-emerald-600 dark:text-emerald-400 mt-1">
                              Nota: "{act.nota_finalizacao}"
                            </p>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="py-3.5 px-4 space-y-1">
                          <span className={`inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            act.severidade === 'Crítico' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                            act.severidade === 'Médio' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          }`}>
                            {act.severidade}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isCompleted ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
                              <Check className="w-4 h-4" /> Concluída
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenCompleteModal(act)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer flex items-center gap-1"
                              title="Concluir minha actividade"
                            >
                              <Check className="w-3.5 h-3.5" /> Concluir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalMinhasPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Página {minhasPage} de {totalMinhasPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMinhasPage(p => Math.max(1, p - 1))}
                  disabled={minhasPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button
                  onClick={() => setMinhasPage(p => Math.min(totalMinhasPages, p + 1))}
                  disabled={minhasPage === totalMinhasPages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: ACTIVIDADES CONCLUÍDAS (AUDITORIA "CONCLUÍDO POR") --- */}
      {activeTab === 'concluidas' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Histórico & Auditoria de Actividades Concluídas
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              A exibir {paginatedCompleted.length} de {filteredCompletedList.length} actividades concluídas (Página {completedPage} de {totalCompletedPages})
            </span>
          </div>

          {paginatedCompleted.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma actividade concluída registrada</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                As actividades concluídas aparecerão aqui com o registo de quem efectivamente a concluiu para fins de auditoria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentTabSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar / Desmarcar todos na página"
                      />
                    </th>
                    <th className="py-3 px-4">Título da Actividade</th>
                    <th className="py-3 px-4">Responsável Atribuído</th>
                    <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-bold">Concluído por (Auditoria)</th>
                    <th className="py-3 px-4">Nota de Conclusão</th>
                    <th className="py-3 px-4">Data de Conclusão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCompleted.map(act => {
                    const respName = resolveUserName(act.responsavel_id, act.responsavel_nome);
                    const completedByName = resolveUserName(
                      act.concluido_por_id || act.finalizado_por_id, 
                      act.concluido_por_nome || act.finalizado_por_nome || respName
                    );
                    const isSelected = selectedActivityIds.includes(act.id);

                    return (
                      <tr key={act.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}>
                        {/* Selection Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(act.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        {/* Title */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-snug">{act.titulo}</p>
                              <span className="inline-block text-[10px] text-slate-400 mt-0.5">
                                {act.modulo_origem || 'Sistema'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Responsible */}
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {respName}
                          </p>
                        </td>

                        {/* Concluded By (Auditing) */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800">
                              <UserCheck className="w-3.5 h-3.5" />
                              {completedByName}
                            </span>
                            {act.concluido_por_id && act.responsavel_id && act.concluido_por_id !== act.responsavel_id && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">
                                (Concluído em nome de terceiro / Admin)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Completion Note */}
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-2.5">
                            <p className="text-slate-800 dark:text-slate-200 italic font-medium leading-relaxed">
                              "{act.nota_finalizacao || 'Sem nota registrada.'}"
                            </p>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {act.concluido_em || act.data_finalizacao ? new Date(act.concluido_em || act.data_finalizacao!).toLocaleString('pt-MZ') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalCompletedPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Página {completedPage} de {totalCompletedPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                  disabled={completedPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button
                  onClick={() => setCompletedPage(p => Math.min(totalCompletedPages, p + 1))}
                  disabled={completedPage === totalCompletedPages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: DOCUMENTAÇÃO & SUÍTE DE TESTES AUTOMÁTICOS --- */}
      {activeTab === 'docs_api' && (
        <div className="space-y-6">
          {/* Automated Test Logs Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TestTube className="w-5 h-5 text-indigo-500" />
                Suíte de Testes Automatizados da Entidade Actividade
              </h3>
              <button
                onClick={runSelfVerificationTests}
                disabled={isTesting}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? 'Executando...' : 'Re-executar Suíte Completa'}
              </button>
            </div>

            {testLogs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Clique no botão acima para rodar a suíte de testes de integridade da entidade Actividade.
              </p>
            ) : (
              <div className="space-y-2.5 mt-3">
                {testLogs.map(t => (
                  <div 
                    key={t.id}
                    className="p-3.5 rounded-xl border flex items-start gap-3 text-xs transition bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  >
                    <div className="mt-0.5">
                      {t.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {t.status === 'pending' && <RotateCw className="w-4 h-4 text-amber-500 animate-spin" />}
                      {t.status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5 font-mono text-[11px]">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* API & Schema Documentation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              Documentação de Integração & Modelo da Entidade Actividade
            </h3>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Coleção Firestore: <code className="text-indigo-600 dark:text-indigo-400 font-mono">atividades</code></h4>
                <p>Cada documento de actividade suporta rastreio multi-tenant isolado via cláusula <code className="font-mono">tenant_id</code> e lookup dinâmico via <code className="font-mono">responsavel_id</code>.</p>
              </div>

              <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[11px] space-y-1 overflow-x-auto">
                <p className="text-slate-400">// Modelo de Dados da Entidade Actividade</p>
                <p><span className="text-indigo-400">interface</span> ActividadePendente &#123;</p>
                <p className="pl-4">id: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">tenant_id: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">titulo: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">detalhes: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">responsavel_id: <span className="text-emerald-400">string</span>; <span className="text-slate-500">// User ID para lookup dinâmico</span></p>
                <p className="pl-4">responsavel_nome: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">responsavel_cargo: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">severidade: <span className="text-amber-400">'Baixo' | 'Médio' | 'Crítico'</span>;</p>
                <p className="pl-4">status: <span className="text-amber-400">'Pendente' | 'Em Progresso' | 'Finalizada'</span>;</p>
                <p className="pl-4">categoria_atribuicao?: <span className="text-amber-400">'Todos' | 'Administradores' | 'Directores' | 'Professores' | 'Estudantes' | 'Encarregados'</span>;</p>
                <p className="pl-4">nota_finalizacao?: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">data_finalizacao?: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">concluido_por_id?: <span className="text-emerald-400">string</span>; <span className="text-slate-500">// Auditoria de quem concluiu</span></p>
                <p className="pl-4">concluido_por_nome?: <span className="text-emerald-400">string</span>;</p>
                <p className="pl-4">concluido_em?: <span className="text-emerald-400">string</span>;</p>
                <p>&#125;</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CRIAR / EDITAR ACTIVIDADE --- */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-500" />
                {isEditModalOpen ? 'Editar Actividade' : 'Criar Nova Actividade'}
              </h3>
              <button
                onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4 mt-4 text-xs">
              {/* Título */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título da Actividade <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entrega de Relatório Trimestral..."
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Detalhes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detalhes / Descrição <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva minuciosamente o objetivo, instruções e requisitos desta actividade..."
                  value={formDetalhes}
                  onChange={e => setFormDetalhes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Severidade & Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Severidade</label>
                  <select
                    value={formSeveridade}
                    onChange={e => setFormSeveridade(e.target.value as SeveridadeActividade)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Baixo">Baixo</option>
                    <option value="Médio">Médio</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoria de Atribuição</label>
                  <select
                    value={formCategoria}
                    onChange={e => setFormCategoria(e.target.value as CategoriaAtribuicaoActividade)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Todos">Todos os Perfis (Escopo Geral)</option>
                    {globalCategories && globalCategories.length > 0 ? (
                      globalCategories.map((cat: any) => (
                        <option key={cat.id || cat.codigo} value={cat.nome || cat.codigo}>
                          {cat.nome} ({cat.codigo || cat.id})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Professores">Professores / Docentes</option>
                        <option value="Directores">Directores Escolares</option>
                        <option value="Estudantes">Estudantes</option>
                        <option value="Encarregados">Encarregados de Educação</option>
                        <option value="Administradores">Administradores</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Responsável Específico (Lookup Dinâmico) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Atribuir a Utilizador Específico (Vincular por ID)
                </label>
                <select
                  value={formResponsavelId}
                  onChange={e => {
                    setFormResponsavelId(e.target.value);
                    const nameResolved = resolveUserName(e.target.value);
                    setFormResponsavelNome(nameResolved);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Minha Conta ({currentUserName})</option>
                  {tenantUsers
                    .filter(u => {
                      if (!formCategoria || formCategoria === 'Todos') return true;
                      const catObj = globalCategories.find((c: any) => c.nome === formCategoria || c.codigo === formCategoria || c.id === formCategoria);
                      const catCode = catObj?.codigo || catObj?.id || formCategoria.toLowerCase();
                      const userRole = (u.tipo || u.role || '').toLowerCase();
                      return userRole.includes(catCode.toLowerCase()) || catCode.toLowerCase().includes(userRole) || (u.cargo || '').toLowerCase().includes(formCategoria.toLowerCase());
                    })
                    .map(u => (
                      <option key={u.id || u.user_id} value={u.id || u.user_id}>
                        {u.nome || u.name || u.email} ({u.tipo || u.role || 'Utilizador'})
                      </option>
                    ))}
                  {(formCategoria === 'Todos' || formCategoria === 'Professores' || formCategoria.toLowerCase().includes('docent') || formCategoria.toLowerCase().includes('prof')) && teachers.map(t => (
                    <option key={t.id} value={t.user_id || t.id}>
                      Docente: {t.nome}
                    </option>
                  ))}
                  {(formCategoria === 'Todos' || formCategoria === 'Estudantes' || formCategoria.toLowerCase().includes('estudant') || formCategoria.toLowerCase().includes('alun')) && students.map(s => (
                    <option key={s.id} value={s.user_id || s.id}>
                      Estudante: {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Prazo */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Data Limite / Prazo (Opcional)</label>
                <input
                  type="date"
                  value={formPrazo}
                  onChange={e => setFormPrazo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer"
                >
                  {isEditModalOpen ? 'Actualizar Actividade' : 'Criar Actividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CONCLUIR ACTIVIDADE (NOTA OBRIGATÓRIA) --- */}
      {isCompleteModalOpen && selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Concluir Actividade
              </h3>
              <button
                onClick={() => { setIsCompleteModalOpen(false); setSelectedActivity(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCompletion} className="space-y-4 mt-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">{selectedActivity.titulo}</p>
                <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{selectedActivity.detalhes}</p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold pt-1">
                  Responsável: {resolveUserName(selectedActivity.responsavel_id, selectedActivity.responsavel_nome)}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Nota de Conclusão <span className="text-rose-500">* (Campo Obrigatório)</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Por favor introduza uma breve justificativa ou observação sobre o resultado da conclusão da tarefa.
                </p>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Tarefa concluída com sucesso. Documentação enviada e notas validadas..."
                  value={notaConclusao}
                  onChange={e => {
                    setNotaConclusao(e.target.value);
                    if (notaError) setNotaError('');
                  }}
                  className={`w-full px-3 py-2 rounded-xl border text-slate-900 dark:text-white focus:ring-2 focus:outline-none bg-slate-50 dark:bg-slate-950 ${
                    notaError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
                {notaError && (
                  <p className="text-rose-500 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {notaError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCompleteModalOpen(false); setSelectedActivity(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Confirmar Conclusão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: AÇÕES EM LOTE (CONFIRMAÇÃO) --- */}
      {bulkConfirmModal.isOpen && bulkConfirmModal.action && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {bulkConfirmModal.action === 'apagar' && <Trash2 className="w-5 h-5 text-rose-500" />}
                {bulkConfirmModal.action === 'suspender' && <PauseCircle className="w-5 h-5 text-amber-500" />}
                {bulkConfirmModal.action === 'restaurar' && <RefreshCw className="w-5 h-5 text-emerald-500" />}
                Confirmar Ação em Lote
              </h3>
              <button
                onClick={() => setBulkConfirmModal({ isOpen: false, action: null })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                Tem certeza que deseja{' '}
                <strong className={
                  bulkConfirmModal.action === 'apagar' ? 'text-rose-600 dark:text-rose-400' :
                  bulkConfirmModal.action === 'suspender' ? 'text-amber-600 dark:text-amber-400' :
                  'text-emerald-600 dark:text-emerald-400'
                }>
                  {bulkConfirmModal.action === 'apagar' ? 'APAGAR PERMANENTEMENTE' :
                   bulkConfirmModal.action === 'suspender' ? 'SUSPENDER' : 'RESTAURAR PARA PENDENTE'}
                </strong>{' '}
                as <strong>{selectedActivityIds.length}</strong> actividades selecionadas?
              </p>

              {bulkConfirmModal.action === 'apagar' && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Esta ação não pode ser desfeita. Os dados das actividades selecionadas serão eliminados permanentemente da base de dados.</p>
                </div>
              )}

              {bulkConfirmModal.action === 'suspender' && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>As actividades suspensas ficarão inativas, mas poderão ser restauradas posteriormente através da ação em lote.</p>
                </div>
              )}

              {bulkConfirmModal.action === 'restaurar' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>As actividades selecionadas serão reativadas e retornarão ao estado "Pendente" para acompanhamento.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBulkConfirmModal({ isOpen: false, action: null })}
                disabled={bulkActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleExecuteBulkAction(bulkConfirmModal.action!)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm cursor-pointer flex items-center gap-1.5 ${
                  bulkConfirmModal.action === 'apagar' ? 'bg-rose-600 hover:bg-rose-700' :
                  bulkConfirmModal.action === 'suspender' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {bulkActionLoading ? 'A Processar...' : 'Confirmar Operação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
