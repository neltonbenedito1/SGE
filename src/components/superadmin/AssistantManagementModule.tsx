import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Building2,
  ShieldCheck,
  KeyRound,
  History,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sliders,
  Check,
  Archive,
  BarChart3,
  Inbox,
  Bot,
  GitBranch,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getCookie } from '../../lib/cookies';
import { validatePasswordPolicy } from '../../shared/passwordPolicy';
import { PasswordPolicyIndicator } from '../PasswordPolicyIndicator';
import { SupportInboxPanel } from './SupportInboxPanel';
import { AiAgentsPanel } from './AiAgentsPanel';
import { SupportDistributionPanel } from './SupportDistributionPanel';
import { SupportAnalyticsPanel } from './SupportAnalyticsPanel';
import type {
  SupportAgent,
  SupportAgentHistoryEntry,
  SupportAgentRole,
  SupportAgentStatus,
  SupportAvailability,
  SupportDepartment,
  SupportPermissionBooleanKey,
  SupportPermissionSet,
  SupportTeamOverviewStats,
  SupportWeekday,
  SupportWorkingHours,
} from '../../types';

export type AssistantSubTab =
  | 'assistant_overview'
  | 'assistant_team'
  | 'assistant_ai'
  | 'assistant_tickets'
  | 'assistant_distribution'
  | 'assistant_analytics';

export interface SupportContextSnapshot {
  isSuperAdmin: boolean;
  agent: SupportAgent | null;
  permissions: SupportPermissionSet;
  authorizedDepartmentIds: string[];
  roleDefaults?: {
    assistente: SupportPermissionSet;
    supervisor: SupportPermissionSet;
    administrador: SupportPermissionSet;
  };
}

interface AssistantManagementModuleProps {
  activeSubTab: AssistantSubTab;
  onNavigateSubTab?: (tab: AssistantSubTab) => void;
  showNotification?: (message: string, type?: 'sucesso' | 'erro' | 'info') => void;
  supportContext?: SupportContextSnapshot | null;
  tenantsList?: Array<{ id: string; nome: string }>;
}

async function buildAdminHeaders(includeJson = true, idempotencyKey?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';

  const csrfToken = getCookie('sysedu_csrf_token') || localStorage.getItem('sysedu_csrf_token') || '';
  const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  if (sessId) headers['x-session-id'] = sessId;
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch {}
  }
  return headers;
}

const WEEKDAYS: SupportWeekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

function createDefaultSchedule(): SupportWorkingHours {
  return {
    ativo: true,
    timezone: 'Africa/Maputo',
    dias: WEEKDAYS.map((dia) => ({
      dia,
      ativo: dia !== 'sab' && dia !== 'dom',
      inicio: '08:00',
      fim: '17:00',
    })),
  };
}

const DEFAULT_ROLE_PERMISSIONS: Record<SupportAgentRole, SupportPermissionSet> = {
  administrador: {
    visualizar: true,
    responder: true,
    transferir: true,
    encerrar: true,
    consultar_historico: true,
    historico_escopo: 'todos',
    consultar_analytics: true,
    gerir_funcionarios: true,
    configurar_ia: true,
    gerir_faq: true,
  },
  supervisor: {
    visualizar: true,
    responder: true,
    transferir: true,
    encerrar: true,
    consultar_historico: true,
    historico_escopo: 'todos',
    consultar_analytics: true,
    gerir_funcionarios: false,
    configurar_ia: false,
    gerir_faq: true,
  },
  assistente: {
    visualizar: true,
    responder: true,
    transferir: true,
    encerrar: true,
    consultar_historico: true,
    historico_escopo: 'proprio',
    consultar_analytics: false,
    gerir_funcionarios: false,
    configurar_ia: false,
    gerir_faq: false,
  },
};

const PERMISSION_KEYS: SupportPermissionBooleanKey[] = [
  'visualizar',
  'responder',
  'transferir',
  'encerrar',
  'consultar_historico',
  'consultar_analytics',
  'gerir_funcionarios',
  'configurar_ia',
  'gerir_faq',
];

function getStatusClasses(estado: SupportAgentStatus): string {
  switch (estado) {
    case 'activo':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'inactivo':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'suspenso':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'arquivado':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
  }
}

function getAvailabilityClasses(disp: SupportAvailability): string {
  switch (disp) {
    case 'online':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'ocupado':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'offline':
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
  }
}

export const AssistantManagementModule: React.FC<AssistantManagementModuleProps> = ({
  activeSubTab,
  onNavigateSubTab,
  showNotification,
  supportContext,
  tenantsList = [],
}) => {
  const { t } = useTranslation('common');

  const [teamTab, setTeamTab] = useState<'staff' | 'departments' | 'permissions'>('staff');
  const [meContext, setMeContext] = useState<SupportContextSnapshot | null>(supportContext || null);

  const [overview, setOverview] = useState<SupportTeamOverviewStats | null>(null);
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [staff, setStaff] = useState<SupportAgent[]>([]);
  const [allStaffForMatrix, setAllStaffForMatrix] = useState<SupportAgent[]>([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffPage, setStaffPage] = useState(1);
  const [staffTotalPages, setStaffTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalError, setModalError] = useState('');

  // Staff Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('todos');
  const [filterRole, setFilterRole] = useState<'todas' | SupportAgentRole>('todas');
  const [filterStatus, setFilterStatus] = useState<'todos' | SupportAgentStatus>('todos');
  const [filterAvail, setFilterAvail] = useState<'todas' | SupportAvailability>('todas');

  // Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<SupportDepartment | null>(null);
  const [deptNome, setDeptNome] = useState('');
  const [deptDescricao, setDeptDescricao] = useState('');
  const [deptEmail, setDeptEmail] = useState('');
  const [deptSlaResp, setDeptSlaResp] = useState(60);
  const [deptSlaRes, setDeptSlaRes] = useState(24);
  const [deptOrdem, setDeptOrdem] = useState(0);
  const [deptAtivo, setDeptAtivo] = useState(true);
  const [deptPadrao, setDeptPadrao] = useState(false);
  const [deptSaving, setDeptSaving] = useState(false);

  // Staff Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SupportAgent | null>(null);
  const [staffNome, setStaffNome] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDeptId, setStaffDeptId] = useState('');
  const [staffAuthDepts, setStaffAuthDepts] = useState<string[]>([]);
  const [staffRole, setStaffRole] = useState<SupportAgentRole>('assistente');
  const [staffStatus, setStaffStatus] = useState<SupportAgentStatus>('activo');
  const [staffAvail, setStaffAvail] = useState<SupportAvailability>('offline');
  const [staffLimit, setStaffLimit] = useState(10);
  const [staffSchedule, setStaffSchedule] = useState<SupportWorkingHours>(createDefaultSchedule());
  const [staffAutoAssign, setStaffAutoAssign] = useState(true);
  const [staffScheduleOnly, setStaffScheduleOnly] = useState(true);
  const [staffPriority, setStaffPriority] = useState(50);
  const [staffSpecialties, setStaffSpecialties] = useState('');
  const [staffInitialPassword, setStaffInitialPassword] = useState('');
  const [staffMustReset, setStaffMustReset] = useState(true);
  const [staffSaving, setStaffSaving] = useState(false);

  // Permission Matrix State
  const [matrixAgentId, setMatrixAgentId] = useState('');
  const [matrixRole, setMatrixRole] = useState<SupportAgentRole>('assistente');
  const [matrixPerms, setMatrixPerms] = useState<SupportPermissionSet>(DEFAULT_ROLE_PERMISSIONS.assistente);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Credential Reset Modal
  const [credTarget, setCredTarget] = useState<SupportAgent | null>(null);
  const [credPassword, setCredPassword] = useState('');
  const [credConfirm, setCredConfirm] = useState('');
  const [credMustReset, setCredMustReset] = useState(true);
  const [credRevokeSessions, setCredRevokeSessions] = useState(true);
  const [credSaving, setCredSaving] = useState(false);

  // History Modal
  const [historyTarget, setHistoryTarget] = useState<SupportAgent | null>(null);
  const [historyEntries, setHistoryEntries] = useState<SupportAgentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'department' | 'staff'; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (supportContext) {
      setMeContext(supportContext);
    }
  }, [supportContext]);

  const canManageTeam = Boolean(meContext?.isSuperAdmin || meContext?.permissions?.gerir_funcionarios);
  const selfAgentId = meContext?.agent?.id || '';

  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) showNotification(msg, type);
  };

  const fetchMeContext = useCallback(async () => {
    if (supportContext) return;
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/assistant/me', { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMeContext(data);
      }
    } catch {}
  }, [supportContext]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/assistant/overview', { headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar visão geral.');
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar visão geral.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/assistant/departments?includeInactive=true', {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar departamentos.');
      const list = Array.isArray(data.departments) ? data.departments : [];
      setDepartments(list);
      return list as SupportDepartment[];
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar departamentos.');
      return [];
    }
  }, []);

  const fetchStaff = useCallback(
    async (overrides?: { page?: number; resetFilters?: boolean }) => {
      setLoading(true);
      setErrorMsg('');
      try {
        const effectivePage = overrides?.page ?? staffPage;
        const resetFilters = Boolean(overrides?.resetFilters);

        const params = new URLSearchParams();
        params.set('page', String(effectivePage));
        params.set('pageSize', '15');
        if (!resetFilters) {
          if (searchQuery.trim()) params.set('q', searchQuery.trim());
          if (filterDept !== 'todos') params.set('departamento_id', filterDept);
          if (filterRole !== 'todas') params.set('funcao', filterRole);
          if (filterStatus !== 'todos') params.set('estado', filterStatus);
          if (filterAvail !== 'todas') params.set('disponibilidade', filterAvail);
        }

        const headers = await buildAdminHeaders(false);
        const res = await fetch(`/api/superadmin/assistant/staff?${params.toString()}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Erro ao listar funcionários.');

        const items = Array.isArray(data.items) ? data.items : [];
        setStaff(items);
        setStaffTotal(Number(data.total ?? items.length ?? 0));
        setStaffTotalPages(Math.max(1, Number(data.totalPages || 1)));
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao listar funcionários.');
      } finally {
        setLoading(false);
      }
    },
    [staffPage, searchQuery, filterDept, filterRole, filterStatus, filterAvail]
  );

  const fetchAllStaffForMatrix = useCallback(async () => {
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch('/api/superadmin/assistant/staff?page=1&pageSize=100', {
        headers,
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const items: SupportAgent[] = Array.isArray(data.items) ? data.items : [];
      setAllStaffForMatrix(items);
      setMatrixAgentId((prev) => (prev && items.some((i) => i.id === prev) ? prev : items[0]?.id || ''));
    } catch {}
  }, []);

  const loadMatrixPermissions = useCallback(async (agentId: string) => {
    if (!agentId) return;
    setMatrixLoading(true);
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/staff/${agentId}/permissions`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao carregar permissões.');
      if (data.record) {
        setMatrixRole(data.record.funcao || 'assistente');
        setMatrixPerms(data.record.permissoes || DEFAULT_ROLE_PERMISSIONS.assistente);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar matriz de permissões.');
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeContext();
  }, [fetchMeContext]);

  useEffect(() => {
    if (activeSubTab === 'assistant_overview') {
      fetchOverview();
      fetchDepartments();
    } else if (activeSubTab === 'assistant_team') {
      fetchOverview();
      fetchDepartments();
      if (teamTab === 'staff') {
        fetchStaff();
      } else if (teamTab === 'permissions') {
        fetchAllStaffForMatrix();
      }
    } else if (
      activeSubTab === 'assistant_ai' ||
      activeSubTab === 'assistant_distribution' ||
      activeSubTab === 'assistant_analytics'
    ) {
      fetchDepartments();
    }
  }, [activeSubTab, teamTab, fetchOverview, fetchDepartments, fetchStaff, fetchAllStaffForMatrix]);

  useEffect(() => {
    if (activeSubTab === 'assistant_team' && teamTab === 'permissions' && matrixAgentId && canManageTeam) {
      loadMatrixPermissions(matrixAgentId);
    }
  }, [activeSubTab, teamTab, matrixAgentId, canManageTeam, loadMatrixPermissions]);

  // Esc closes open modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDeptModalOpen(false);
        setIsStaffModalOpen(false);
        setCredTarget(null);
        setHistoryTarget(null);
        setDeleteTarget(null);
        setModalError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openNewDepartmentModal = () => {
    setModalError('');
    setEditingDept(null);
    setDeptNome('');
    setDeptDescricao('');
    setDeptEmail('');
    setDeptSlaResp(60);
    setDeptSlaRes(24);
    setDeptOrdem(departments.length);
    setDeptAtivo(true);
    setDeptPadrao(departments.length === 0);
    setIsDeptModalOpen(true);
  };

  const openEditDepartmentModal = (d: SupportDepartment) => {
    setModalError('');
    setEditingDept(d);
    setDeptNome(d.nome);
    setDeptDescricao(d.descricao || '');
    setDeptEmail(d.email_fila || '');
    setDeptSlaResp(d.sla_resposta_minutos || 60);
    setDeptSlaRes(d.sla_resolucao_horas || 24);
    setDeptOrdem(d.ordem ?? 0);
    setDeptAtivo(d.ativo !== false);
    setDeptPadrao(Boolean(d.padrao));
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptNome.trim()) {
      setModalError('Informe o nome do departamento.');
      return;
    }
    setDeptSaving(true);
    setErrorMsg('');
    setModalError('');
    try {
      const idemKey = editingDept ? undefined : `dept_${Date.now()}_${deptNome.trim()}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const url = editingDept
        ? `/api/superadmin/assistant/departments/${editingDept.id}`
        : '/api/superadmin/assistant/departments';
      const method = editingDept ? 'PUT' : 'POST';

      const payload: Record<string, any> = {
        nome: deptNome.trim(),
        descricao: deptDescricao.trim(),
        email_fila: deptEmail.trim(),
        sla_resposta_minutos: Number(deptSlaResp) || 60,
        sla_resolucao_horas: Number(deptSlaRes) || 24,
        ordem: Number(deptOrdem) || 0,
        ativo: deptAtivo,
        padrao: deptPadrao,
      };
      if (!editingDept) payload.tenant_id = 'global';

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao guardar departamento.');

      setIsDeptModalOpen(false);
      notify(editingDept ? 'Departamento actualizado com sucesso.' : 'Departamento criado com sucesso.', 'sucesso');
      await Promise.all([fetchDepartments(), fetchOverview()]);
    } catch (err: any) {
      const msg = err.message || 'Erro ao guardar departamento.';
      setModalError(msg);
      setErrorMsg(msg);
      notify(msg, 'erro');
    } finally {
      setDeptSaving(false);
    }
  };

  const openNewStaffModal = async () => {
    setModalError('');
    let availableDepts = departments;
    if (availableDepts.length === 0) {
      availableDepts = await fetchDepartments();
    }
    const defaultDeptId = availableDepts[0]?.id || '';
    setEditingStaff(null);
    setStaffNome('');
    setStaffEmail('');
    setStaffDeptId(defaultDeptId);
    setStaffAuthDepts(defaultDeptId ? [defaultDeptId] : []);
    setStaffRole('assistente');
    setStaffStatus('activo');
    setStaffAvail('offline');
    setStaffLimit(10);
    setStaffSchedule(createDefaultSchedule());
    setStaffAutoAssign(true);
    setStaffScheduleOnly(true);
    setStaffPriority(50);
    setStaffSpecialties('');
    setStaffInitialPassword('');
    setStaffMustReset(true);
    setIsStaffModalOpen(true);
  };

  const openEditStaffModal = (a: SupportAgent) => {
    setModalError('');
    setEditingStaff(a);
    setStaffNome(a.nome);
    setStaffEmail(a.email);
    setStaffDeptId(a.departamento_id);
    setStaffAuthDepts(
      Array.isArray(a.departamentos_autorizados) && a.departamentos_autorizados.length > 0
        ? a.departamentos_autorizados
        : a.departamento_id
        ? [a.departamento_id]
        : []
    );
    setStaffRole(a.funcao || 'assistente');
    setStaffStatus(a.estado || 'activo');
    setStaffAvail(a.disponibilidade || 'offline');
    setStaffLimit(a.limite_simultaneo || 10);
    setStaffSchedule(a.horario_atendimento?.dias?.length ? a.horario_atendimento : createDefaultSchedule());
    setStaffAutoAssign(a.regras_atribuicao?.auto_atribuir !== false);
    setStaffScheduleOnly(a.regras_atribuicao?.apenas_horario !== false);
    setStaffPriority(a.regras_atribuicao?.prioridade_atribuicao ?? 50);
    setStaffSpecialties((a.regras_atribuicao?.categorias_especialidade || []).join(', '));
    setStaffInitialPassword('');
    setStaffMustReset(Boolean(a.must_reset_password));
    setIsStaffModalOpen(true);
  };

  const toggleAuthorizedDept = (deptId: string) => {
    setStaffAuthDepts((prev) => {
      if (prev.includes(deptId)) {
        if (deptId === staffDeptId) return prev; // Keep primary department always authorized
        return prev.filter((d) => d !== deptId);
      }
      return [...prev, deptId];
    });
  };

  const handlePrimaryDeptChange = (nextDeptId: string) => {
    setStaffDeptId(nextDeptId);
    if (nextDeptId && !staffAuthDepts.includes(nextDeptId)) {
      setStaffAuthDepts((prev) => [...prev, nextDeptId]);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNome.trim() || !staffEmail.trim() || !staffDeptId) {
      setModalError('Preencha nome, e-mail e departamento principal do funcionário.');
      return;
    }
    if (!editingStaff && staffInitialPassword.trim()) {
      const check = validatePasswordPolicy(staffInitialPassword, staffEmail);
      if (!check.valid) {
        setModalError(check.errors[0] || 'A palavra-passe inicial não cumpre a política de segurança.');
        return;
      }
    }

    setStaffSaving(true);
    setErrorMsg('');
    setModalError('');
    try {
      const idemKey = editingStaff ? undefined : `staff_${Date.now()}_${staffEmail.trim().toLowerCase()}`;
      const headers = await buildAdminHeaders(true, idemKey);
      const url = editingStaff
        ? `/api/superadmin/assistant/staff/${editingStaff.id}`
        : '/api/superadmin/assistant/staff';
      const method = editingStaff ? 'PUT' : 'POST';

      const specialties = staffSpecialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const authDepts = Array.from(new Set([staffDeptId, ...staffAuthDepts].filter(Boolean)));

      const payload: Record<string, any> = {
        nome: staffNome.trim(),
        email: staffEmail.trim().toLowerCase(),
        departamento_id: staffDeptId,
        departamentos_autorizados: authDepts,
        funcao: staffRole,
        estado: staffStatus,
        disponibilidade: staffAvail,
        limite_simultaneo: Number(staffLimit) || 10,
        horario_atendimento: staffSchedule,
        regras_atribuicao: {
          auto_atribuir: staffAutoAssign,
          apenas_horario: staffScheduleOnly,
          prioridade_atribuicao: Number(staffPriority) || 50,
          categorias_especialidade: specialties,
        },
      };

      if (!editingStaff) {
        payload.tenant_id = 'global';
        if (staffInitialPassword.trim()) {
          payload.initialPassword = staffInitialPassword;
        }
        payload.mustResetPassword = staffMustReset;
      }

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao guardar funcionário.');

      setIsStaffModalOpen(false);
      notify(editingStaff ? 'Funcionário actualizado com sucesso.' : 'Funcionário cadastrado com sucesso.', 'sucesso');
      if (!editingStaff) {
        setStaffPage(1);
        setSearchQuery('');
        setFilterDept('todos');
        setFilterRole('todas');
        setFilterStatus('todos');
        setFilterAvail('todas');
      }
      await Promise.all([
        fetchStaff(!editingStaff ? { page: 1, resetFilters: true } : undefined),
        fetchDepartments(),
        fetchOverview(),
        fetchAllStaffForMatrix(),
      ]);
    } catch (err: any) {
      const msg = err.message || 'Erro ao guardar funcionário.';
      setModalError(msg);
      setErrorMsg(msg);
      notify(msg, 'erro');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleQuickAvailabilityChange = async (agent: SupportAgent, nextAvail: SupportAvailability) => {
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/staff/${agent.id}/availability`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ disponibilidade: nextAvail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao actualizar disponibilidade.');
      notify(`Disponibilidade alterada para ${t(`assistant.availability_${nextAvail}`)}.`, 'sucesso');
      await Promise.all([fetchStaff(), fetchOverview(), fetchAllStaffForMatrix()]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao actualizar disponibilidade.');
    }
  };

  const handleQuickStatusChange = async (agent: SupportAgent, nextStatus: SupportAgentStatus) => {
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/staff/${agent.id}/status`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ estado: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao actualizar estado.');
      notify(`Estado alterado para ${t(`assistant.status_${nextStatus}`)}.`, 'sucesso');
      await Promise.all([fetchStaff(), fetchDepartments(), fetchOverview(), fetchAllStaffForMatrix()]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao actualizar estado.');
    }
  };

  const handleSaveMatrixPermissions = async () => {
    if (!matrixAgentId) return;
    setMatrixSaving(true);
    setErrorMsg('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/staff/${matrixAgentId}/permissions`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          funcao: matrixRole,
          permissoes: matrixPerms,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao guardar matriz de permissões.');
      notify('Matriz de permissões actualizada e registada em auditoria.', 'sucesso');
      await Promise.all([fetchAllStaffForMatrix(), fetchStaff(), fetchOverview()]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao guardar matriz de permissões.');
    } finally {
      setMatrixSaving(false);
    }
  };

  const handleResetCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credTarget) return;
    const policy = validatePasswordPolicy(credPassword, credTarget.email);
    if (!policy.valid) {
      setModalError(policy.errors[0] || 'Palavra-passe não cumpre a política de segurança.');
      return;
    }
    if (credPassword !== credConfirm) {
      setModalError('As palavras-passe não coincidem.');
      return;
    }

    setCredSaving(true);
    setErrorMsg('');
    setModalError('');
    try {
      const headers = await buildAdminHeaders(true);
      const res = await fetch(`/api/superadmin/assistant/staff/${credTarget.id}/reset-credentials`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          newPassword: credPassword,
          confirmPassword: credConfirm,
          mustResetPassword: credMustReset,
          revokeActiveSessions: credRevokeSessions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Falha ao redefinir credenciais.');

      setCredTarget(null);
      setCredPassword('');
      setCredConfirm('');
      notify('Credenciais redefinidas com sucesso.', 'sucesso');
      await Promise.all([fetchStaff(), fetchOverview()]);
    } catch (err: any) {
      const msg = err.message || 'Falha ao redefinir credenciais.';
      setModalError(msg);
      setErrorMsg(msg);
    } finally {
      setCredSaving(false);
    }
  };

  const openHistoryModal = async (agent: SupportAgent) => {
    setHistoryTarget(agent);
    setHistoryEntries([]);
    setHistoryLoading(true);
    try {
      const headers = await buildAdminHeaders(false);
      const res = await fetch(`/api/superadmin/assistant/staff/${agent.id}/history`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Sem permissão para consultar histórico.');
      setHistoryEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    setModalError('');
    try {
      const headers = await buildAdminHeaders(false);
      const endpoint =
        deleteTarget.type === 'department'
          ? `/api/superadmin/assistant/departments/${deleteTarget.id}`
          : `/api/superadmin/assistant/staff/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Não foi possível eliminar este registo.');

      setDeleteTarget(null);
      notify('Registo eliminado com sucesso.', 'sucesso');
      await Promise.all([fetchDepartments(), fetchStaff(), fetchOverview(), fetchAllStaffForMatrix()]);
    } catch (err: any) {
      const msg = err.message || 'Não foi possível eliminar.';
      setModalError(msg);
      setErrorMsg(msg);
    } finally {
      setDeleting(false);
    }
  };

  const selectedMatrixAgent = useMemo(
    () => allStaffForMatrix.find((a) => a.id === matrixAgentId) || null,
    [allStaffForMatrix, matrixAgentId]
  );

  const canSeeHistoryForAgent = (agentId: string): boolean => {
    if (meContext?.isSuperAdmin || canManageTeam) return true;
    const perms = meContext?.permissions;
    if (!perms?.consultar_historico) return false;
    if (perms.historico_escopo === 'todos') return true;
    return selfAgentId === agentId;
  };

  const renderHeader = () => {
    const titleKey =
      activeSubTab === 'assistant_overview'
        ? 'assistant.overview_title'
        : activeSubTab === 'assistant_ai'
        ? 'assistant.ai_title'
        : activeSubTab === 'assistant_tickets'
        ? 'assistant.tickets_title'
        : activeSubTab === 'assistant_distribution'
        ? 'assistant.distribution_title'
        : activeSubTab === 'assistant_analytics'
        ? 'assistant.analytics_title'
        : 'assistant.team_title';

    const subtitleKey =
      activeSubTab === 'assistant_overview'
        ? 'assistant.overview_subtitle'
        : activeSubTab === 'assistant_ai'
        ? 'assistant.ai_subtitle'
        : activeSubTab === 'assistant_tickets'
        ? 'assistant.tickets_subtitle'
        : activeSubTab === 'assistant_distribution'
        ? 'assistant.distribution_subtitle'
        : activeSubTab === 'assistant_analytics'
        ? 'assistant.analytics_subtitle'
        : 'assistant.team_subtitle';

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t(titleKey)}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t(subtitleKey)}</p>
        </div>
        {canManageTeam && (activeSubTab === 'assistant_overview' || activeSubTab === 'assistant_team') && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openNewDepartmentModal}
              className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>{t('assistant.new_department')}</span>
            </button>
            <button
              type="button"
              onClick={openNewStaffModal}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('assistant.new_staff')}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderOverviewTab = () => {
    if (loading && !overview) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
          {t('loading')}
        </div>
      );
    }

    const stats = overview || {
      totalFuncionarios: 0,
      totalAgentesIa: 0,
      activos: 0,
      inactivos: 0,
      suspensos: 0,
      arquivados: 0,
      online: 0,
      ocupado: 0,
      offline: 0,
      totalDepartamentos: 0,
      departamentosActivos: 0,
      capacidadeTotalSimultanea: 0,
      cargaActualTotal: 0,
      porFuncao: { administrador: 0, supervisor: 0, assistente: 0 },
      porDepartamento: [],
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('assistant.kpi_total_staff')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {stats.totalFuncionarios}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {t('assistant.kpi_active_summary', {
                active: stats.activos,
                inactive: stats.inactivos + stats.suspensos + stats.arquivados,
              })}
              {Number(stats.totalAgentesIa || 0) > 0 ? ` · ${stats.totalAgentesIa} IA` : ''}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('assistant.kpi_online_now')}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
              {stats.online}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {t('assistant.kpi_busy_offline', { busy: stats.ocupado, offline: stats.offline })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('assistant.kpi_departments')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {stats.totalDepartamentos}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {t('assistant.kpi_departments_active', { count: stats.departamentosActivos })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('assistant.kpi_capacity')}</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 tabular-nums">
              {stats.capacidadeTotalSimultanea}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {t('assistant.kpi_current_load', { load: stats.cargaActualTotal })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('assistant.by_role_title')}</h3>
              {onNavigateSubTab && (
                <button
                  type="button"
                  onClick={() => onNavigateSubTab('assistant_team')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t('assistant.nav_team')}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(['administrador', 'supervisor', 'assistente'] as SupportAgentRole[]).map((roleKey) => (
                <div
                  key={roleKey}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t(`assistant.role_${roleKey}`)}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.porFuncao[roleKey]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              {t('assistant.by_department_title')}
            </h3>
            {stats.porDepartamento.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                {t('assistant.no_department_data')}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.porDepartamento.map((dept) => (
                  <div
                    key={dept.departamento_id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{dept.nome}</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {dept.total_membros} membros · {dept.online} online · {dept.capacidade} vagas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStaffSubTab = () => (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setStaffPage(1);
              setSearchQuery(e.target.value);
            }}
            placeholder={t('assistant.search_staff_placeholder')}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <select
          value={filterDept}
          onChange={(e) => {
            setStaffPage(1);
            setFilterDept(e.target.value);
          }}
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="todos">{t('assistant.all_departments')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>

        <select
          value={filterRole}
          onChange={(e) => {
            setStaffPage(1);
            setFilterRole(e.target.value as any);
          }}
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="todas">{t('assistant.all_roles')}</option>
          <option value="administrador">{t('assistant.role_administrador')}</option>
          <option value="supervisor">{t('assistant.role_supervisor')}</option>
          <option value="assistente">{t('assistant.role_assistente')}</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterStatus}
            onChange={(e) => {
              setStaffPage(1);
              setFilterStatus(e.target.value as any);
            }}
            className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="todos">{t('assistant.all_statuses')}</option>
            <option value="activo">{t('assistant.status_activo')}</option>
            <option value="inactivo">{t('assistant.status_inactivo')}</option>
            <option value="suspenso">{t('assistant.status_suspenso')}</option>
            <option value="arquivado">{t('assistant.status_arquivado')}</option>
          </select>

          <select
            value={filterAvail}
            onChange={(e) => {
              setStaffPage(1);
              setFilterAvail(e.target.value as any);
            }}
            className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="todas">{t('assistant.all_availabilities')}</option>
            <option value="online">{t('assistant.availability_online')}</option>
            <option value="ocupado">{t('assistant.availability_ocupado')}</option>
            <option value="offline">{t('assistant.availability_offline')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">{t('loading')}</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
            {t('assistant.empty_staff')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">{t('assistant.field_primary_department')}</th>
                  <th className="py-3 px-4">{t('assistant.field_role')}</th>
                  <th className="py-3 px-4">{t('assistant.field_status')}</th>
                  <th className="py-3 px-4">{t('assistant.field_availability')}</th>
                  <th className="py-3 px-4">Capacidade</th>
                  <th className="py-3 px-4 text-right">{t('acoes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {staff.map((agent) => {
                  const canToggleAvail = canManageTeam || selfAgentId === agent.id;
                  return (
                    <tr key={agent.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{agent.nome}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{agent.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {agent.departamento_nome || agent.departamento_id}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {agent.departamentos_autorizados?.length || 1} fila(s) autorizada(s)
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {t(`assistant.role_${agent.funcao}`)}
                      </td>
                      <td className="py-3.5 px-4">
                        {canManageTeam ? (
                          <select
                            value={agent.estado}
                            onChange={(e) => handleQuickStatusChange(agent, e.target.value as SupportAgentStatus)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${getStatusClasses(agent.estado)}`}
                          >
                            <option value="activo">{t('assistant.status_activo')}</option>
                            <option value="inactivo">{t('assistant.status_inactivo')}</option>
                            <option value="suspenso">{t('assistant.status_suspenso')}</option>
                            <option value="arquivado">{t('assistant.status_arquivado')}</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getStatusClasses(agent.estado)}`}>
                            {t(`assistant.status_${agent.estado}`)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {canToggleAvail ? (
                          <select
                            value={agent.disponibilidade}
                            onChange={(e) => handleQuickAvailabilityChange(agent, e.target.value as SupportAvailability)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${getAvailabilityClasses(agent.disponibilidade)}`}
                          >
                            <option value="online">{t('assistant.availability_online')}</option>
                            <option value="ocupado">{t('assistant.availability_ocupado')}</option>
                            <option value="offline">{t('assistant.availability_offline')}</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getAvailabilityClasses(agent.disponibilidade)}`}>
                            {t(`assistant.availability_${agent.disponibilidade}`)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-700 dark:text-slate-300">
                        {agent.carga_actual || 0} / {agent.limite_simultaneo || 10}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {canSeeHistoryForAgent(agent.id) && (
                            <button
                              type="button"
                              onClick={() => openHistoryModal(agent)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title={t('assistant.action_history')}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManageTeam && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setTeamTab('permissions');
                                  setMatrixAgentId(agent.id);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title={t('assistant.action_permissions')}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCredTarget(agent);
                                  setCredPassword('');
                                  setCredConfirm('');
                                  setCredMustReset(true);
                                  setCredRevokeSessions(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title={t('assistant.action_reset_credentials')}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditStaffModal(agent)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title={t('assistant.action_edit')}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'staff', id: agent.id, label: agent.nome })}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title={t('assistant.action_delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {(staffTotal > 0 || staffTotalPages > 1) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <span className="tabular-nums">
              {t('assistant.pagination_info', { page: staffPage, totalPages: staffTotalPages, total: staffTotal })}
            </span>
            {staffTotalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={staffPage <= 1}
                  onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('assistant.prev_page')}</span>
                </button>
                <button
                  type="button"
                  disabled={staffPage >= staffTotalPages}
                  onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>{t('assistant.next_page')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderDepartmentsSubTab = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {departments.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
          {t('assistant.empty_departments')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">{t('assistant.field_dept_name')}</th>
                <th className="py-3 px-4">SLA Resposta / Resolução</th>
                <th className="py-3 px-4">Membros</th>
                <th className="py-3 px-4">{t('assistant.field_status')}</th>
                <th className="py-3 px-4 text-right">{t('acoes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{d.nome}</span>
                      {d.padrao && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40">
                          Padrão
                        </span>
                      )}
                    </div>
                    {d.descricao && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{d.descricao}</p>}
                    {d.email_fila && <p className="text-[11px] text-slate-400 mt-0.5">{d.email_fila}</p>}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 tabular-nums">
                    {d.sla_resposta_minutos} min · {d.sla_resolucao_horas} h
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 tabular-nums">
                    {d.membros_count ?? 0}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                        d.ativo !== false
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {d.ativo !== false ? t('assistant.status_activo') : t('assistant.status_inactivo')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {canManageTeam && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditDepartmentModal(d)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title={t('assistant.action_edit')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'department', id: d.id, label: d.nome })}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title={t('assistant.action_delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPermissionsSubTab = () => (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>{t('assistant.permissions_superadmin_note')}</span>
      </div>

      {/* Role Reference Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('assistant.permissions_reference_title')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Permissão</th>
                <th className="py-2.5 px-4 text-center">{t('assistant.role_assistente')}</th>
                <th className="py-2.5 px-4 text-center">{t('assistant.role_supervisor')}</th>
                <th className="py-2.5 px-4 text-center">{t('assistant.role_administrador')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PERMISSION_KEYS.map((key) => (
                <tr key={key}>
                  <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {t(`assistant.perm_${key}`)}
                  </td>
                  {(['assistente', 'supervisor', 'administrador'] as SupportAgentRole[]).map((role) => (
                    <td key={role} className="py-2.5 px-4 text-center">
                      {DEFAULT_ROLE_PERMISSIONS[role][key] ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                  {t('assistant.perm_historico_escopo')}
                </td>
                <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">
                  {t('assistant.perm_scope_proprio')}
                </td>
                <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">
                  {t('assistant.perm_scope_todos')}
                </td>
                <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">
                  {t('assistant.perm_scope_todos')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Staff Permission Editor */}
      {canManageTeam && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('assistant.permissions_select_staff')}
              </label>
              <select
                value={matrixAgentId}
                onChange={(e) => setMatrixAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {allStaffForMatrix.length === 0 ? (
                  <option value="">{t('assistant.empty_staff')}</option>
                ) : (
                  allStaffForMatrix.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.email}) — {t(`assistant.role_${a.funcao}`)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedMatrixAgent && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole('assistente');
                    setMatrixPerms({ ...DEFAULT_ROLE_PERMISSIONS.assistente });
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('assistant.permissions_apply_assistant')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole('supervisor');
                    setMatrixPerms({ ...DEFAULT_ROLE_PERMISSIONS.supervisor });
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('assistant.permissions_apply_supervisor')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole('administrador');
                    setMatrixPerms({ ...DEFAULT_ROLE_PERMISSIONS.administrador });
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('assistant.permissions_apply_admin')}
                </button>
              </div>
            )}
          </div>

          {matrixLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">{t('loading')}</div>
          ) : selectedMatrixAgent ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PERMISSION_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer"
                  >
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {t(`assistant.perm_${key}`)}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(matrixPerms[key])}
                      onChange={(e) => setMatrixPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </label>
                ))}

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {t('assistant.perm_historico_escopo')}
                  </span>
                  <select
                    value={matrixPerms.historico_escopo}
                    onChange={(e) =>
                      setMatrixPerms((prev) => ({
                        ...prev,
                        historico_escopo: e.target.value as 'proprio' | 'todos',
                      }))
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="proprio">{t('assistant.perm_scope_proprio')}</option>
                    <option value="todos">{t('assistant.perm_scope_todos')}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={matrixSaving}
                  onClick={handleSaveMatrixPermissions}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {matrixSaving ? t('loading') : t('assistant.permissions_save')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );

  const renderPhasePlaceholder = (icon: React.ReactNode, noteKey: string) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
      <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
        {icon}
      </div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {t('assistant.phase_pending_badge')}
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md mx-auto">{t(noteKey)}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderHeader()}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeSubTab === 'assistant_overview' && renderOverviewTab()}

      {activeSubTab === 'assistant_team' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTeamTab('staff')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors ${
                  teamTab === 'staff'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('assistant.tab_staff')}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums bg-black/10 dark:bg-white/10">
                  {overview ? overview.totalFuncionarios : staffTotal}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTeamTab('departments')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors ${
                  teamTab === 'departments'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{t('assistant.tab_departments')}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums bg-black/10 dark:bg-white/10">
                  {departments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTeamTab('permissions')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors ${
                  teamTab === 'permissions'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t('assistant.tab_permissions')}</span>
              </button>
            </div>

            {overview && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {overview.activos} activos · {overview.online} online
                </span>
                <span>
                  {overview.capacidadeTotalSimultanea} vagas
                </span>
              </div>
            )}
          </div>

          {teamTab === 'staff' && renderStaffSubTab()}
          {teamTab === 'departments' && renderDepartmentsSubTab()}
          {teamTab === 'permissions' && renderPermissionsSubTab()}
        </div>
      )}

      {activeSubTab === 'assistant_tickets' && (
        <SupportInboxPanel
          supportContext={meContext}
          showNotification={showNotification}
          tenantsList={tenantsList}
        />
      )}
      {activeSubTab === 'assistant_ai' && (
        <AiAgentsPanel
          supportContext={meContext}
          departments={departments}
          showNotification={showNotification}
          tenantsList={tenantsList}
        />
      )}
      {activeSubTab === 'assistant_distribution' && (
        <SupportDistributionPanel
          supportContext={meContext}
          departments={departments}
          showNotification={showNotification}
          tenantsList={tenantsList}
        />
      )}
      {activeSubTab === 'assistant_analytics' && (
        <SupportAnalyticsPanel
          supportContext={meContext}
          departments={departments}
          showNotification={showNotification}
          tenantsList={tenantsList}
        />
      )}

      {/* MODAL: CREATE / EDIT DEPARTMENT */}
      {isDeptModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeptModalOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingDept ? t('assistant.edit_department') : t('assistant.new_department')}
              </h3>
              <button type="button" onClick={() => setIsDeptModalOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('assistant.field_dept_name')}
                </label>
                <input
                  type="text"
                  required
                  value={deptNome}
                  onChange={(e) => setDeptNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('assistant.field_dept_desc')}
                </label>
                <textarea
                  rows={2}
                  value={deptDescricao}
                  onChange={(e) => setDeptDescricao(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('assistant.field_dept_email')}
                </label>
                <input
                  type="email"
                  value={deptEmail}
                  onChange={(e) => setDeptEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_sla_response')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={43200}
                    value={deptSlaResp}
                    onChange={(e) => setDeptSlaResp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_sla_resolution')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={deptSlaRes}
                    onChange={(e) => setDeptSlaRes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_dept_order')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={deptOrdem}
                    onChange={(e) => setDeptOrdem(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptAtivo}
                    onChange={(e) => setDeptAtivo(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{t('assistant.field_dept_active')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptPadrao}
                    onChange={(e) => setDeptPadrao(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{t('assistant.field_dept_default')}</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={deptSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {deptSaving ? t('loading') : t('assistant.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT STAFF */}
      {isStaffModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStaffModalOpen(false);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingStaff ? t('assistant.edit_staff') : t('assistant.new_staff')}
              </h3>
              <button type="button" onClick={() => setIsStaffModalOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-5 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={staffNome}
                    onChange={(e) => setStaffNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_email')}
                  </label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_primary_department')}
                  </label>
                  <select
                    required
                    value={staffDeptId}
                    onChange={(e) => handlePrimaryDeptChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Seleccione --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_role')}
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as SupportAgentRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="assistente">{t('assistant.role_assistente')}</option>
                    <option value="supervisor">{t('assistant.role_supervisor')}</option>
                    <option value="administrador">{t('assistant.role_administrador')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_max_concurrent')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={staffLimit}
                    onChange={(e) => setStaffLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_status')}
                  </label>
                  <select
                    value={staffStatus}
                    onChange={(e) => setStaffStatus(e.target.value as SupportAgentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="activo">{t('assistant.status_activo')}</option>
                    <option value="inactivo">{t('assistant.status_inactivo')}</option>
                    <option value="suspenso">{t('assistant.status_suspenso')}</option>
                    <option value="arquivado">{t('assistant.status_arquivado')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('assistant.field_availability')}
                  </label>
                  <select
                    value={staffAvail}
                    onChange={(e) => setStaffAvail(e.target.value as SupportAvailability)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="online">{t('assistant.availability_online')}</option>
                    <option value="ocupado">{t('assistant.availability_ocupado')}</option>
                    <option value="offline">{t('assistant.availability_offline')}</option>
                  </select>
                </div>
              </div>

              {/* Authorized Departments */}
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('assistant.field_authorized_departments')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {departments.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={staffAuthDepts.includes(d.id) || staffDeptId === d.id}
                        disabled={staffDeptId === d.id}
                        onChange={() => toggleAuthorizedDept(d.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-slate-800 dark:text-slate-200 truncate">{d.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Working Hours */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {t('assistant.field_schedule')}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffSchedule.ativo}
                      onChange={(e) => setStaffSchedule((prev) => ({ ...prev, ativo: e.target.checked }))}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{t('assistant.field_schedule_active')}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {staffSchedule.dias.map((day, idx) => (
                    <div
                      key={day.dia}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                    >
                      <label className="flex items-center gap-2 cursor-pointer min-w-[60px]">
                        <input
                          type="checkbox"
                          checked={day.ativo}
                          onChange={(e) => {
                            const updated = [...staffSchedule.dias];
                            updated[idx] = { ...day, ativo: e.target.checked };
                            setStaffSchedule((prev) => ({ ...prev, dias: updated }));
                          }}
                          className="w-3.5 h-3.5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {t(`assistant.day_${day.dia}`)}
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          disabled={!day.ativo}
                          value={day.inicio}
                          onChange={(e) => {
                            const updated = [...staffSchedule.dias];
                            updated[idx] = { ...day, inicio: e.target.value };
                            setStaffSchedule((prev) => ({ ...prev, dias: updated }));
                          }}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                        />
                        <span>-</span>
                        <input
                          type="time"
                          disabled={!day.ativo}
                          value={day.fim}
                          onChange={(e) => {
                            const updated = [...staffSchedule.dias];
                            updated[idx] = { ...day, fim: e.target.value };
                            setStaffSchedule((prev) => ({ ...prev, dias: updated }));
                          }}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment Rules */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {t('assistant.field_assignment_rules')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffAutoAssign}
                      onChange={(e) => setStaffAutoAssign(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{t('assistant.field_auto_assign')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffScheduleOnly}
                      onChange={(e) => setStaffScheduleOnly(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{t('assistant.field_schedule_only')}</span>
                  </label>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {t('assistant.field_priority')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={staffPriority}
                      onChange={(e) => setStaffPriority(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {t('assistant.field_specialties')}
                  </label>
                  <input
                    type="text"
                    value={staffSpecialties}
                    onChange={(e) => setStaffSpecialties(e.target.value)}
                    placeholder="Matrículas, Facturação, Acesso..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Optional Initial Password (Creation only) */}
              {!editingStaff && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('assistant.field_initial_password')}
                    </label>
                    <input
                      type="password"
                      value={staffInitialPassword}
                      onChange={(e) => setStaffInitialPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  {staffInitialPassword.length > 0 && (
                    <PasswordPolicyIndicator password={staffInitialPassword} userEmail={staffEmail} />
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffMustReset}
                      onChange={(e) => setStaffMustReset(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{t('assistant.field_must_reset')}</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={staffSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {staffSaving ? t('loading') : t('assistant.action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET CREDENTIALS */}
      {credTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCredTarget(null);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('assistant.credentials_title')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {credTarget.nome} · {credTarget.email}
                </p>
              </div>
              <button type="button" onClick={() => setCredTarget(null)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetCredentials} className="space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('assistant.credentials_new_password')}
                </label>
                <input
                  type="password"
                  required
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <PasswordPolicyIndicator password={credPassword} userEmail={credTarget.email} />

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('assistant.credentials_confirm_password')}
                </label>
                <input
                  type="password"
                  required
                  value={credConfirm}
                  onChange={(e) => setCredConfirm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={credMustReset}
                    onChange={(e) => setCredMustReset(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t('assistant.field_must_reset')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={credRevokeSessions}
                    onChange={(e) => setCredRevokeSessions(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t('assistant.credentials_revoke_sessions')}</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCredTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  {t('assistant.action_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={credSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {credSaving ? t('loading') : t('assistant.credentials_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SERVICE HISTORY */}
      {historyTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryTarget(null);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('assistant.history_title')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {historyTarget.nome} · {historyTarget.email}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryTarget(null)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {historyLoading ? (
                <div className="py-10 text-center text-xs text-slate-500">{t('loading')}</div>
              ) : historyEntries.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">{t('assistant.history_empty')}</div>
              ) : (
                historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{entry.titulo}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {entry.data ? new Date(entry.data).toLocaleString('pt-PT') : '-'}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{entry.detalhe}</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">{entry.origem}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {t('assistant.action_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('assistant.delete_confirm_title')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem a certeza que deseja eliminar "{deleteTarget.label}"? Esta operação será registada nos logs de auditoria.
            </p>
            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {t('assistant.action_cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {deleting ? t('loading') : t('assistant.action_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantManagementModule;
