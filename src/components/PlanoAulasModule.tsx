import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  X, 
  ChevronRight, 
  BookOpen, 
  Users, 
  AlertTriangle, 
  Bell, 
  Check, 
  ArrowLeft,
  Calendar,
  Layers,
  RotateCcw,
  RefreshCw,
  Eye,
  ListOrdered
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  PlanoAula, 
  Docente, 
  Turma, 
  Classe, 
  Escola, 
  Estudante, 
  Pai, 
  User, 
  PeriodoTipo, 
  StatusPlanoAula 
} from '../types';
import { sendAppNotification } from '../services/notificationDispatcher';
import { useLanguage } from '../hooks/useLanguage';

export interface PlanoAulasModuleProps {
  tenantId: string;
  loggedInUser?: any;
  currentUserRole?: string;
  teachers: Docente[];
  classes: Classe[]; // disciplines & scheduled classes
  turmas: Turma[];
  schools: Escola[];
  students?: Estudante[];
  parents?: Pai[];
  tenantUsers?: User[];
  currentAcademicYear?: string;
  onAuditLog?: (action: string, entity: string, entityId: string, details: string) => void;
  showNotification?: (msg: string, type?: 'sucesso' | 'erro' | 'info') => void;
}

export const PlanoAulasModule: React.FC<PlanoAulasModuleProps> = ({
  tenantId,
  loggedInUser,
  currentUserRole = 'docente',
  teachers = [],
  classes = [],
  turmas = [],
  schools = [],
  students = [],
  parents = [],
  tenantUsers = [],
  currentAcademicYear = '2026',
  onAuditLog,
  showNotification
}) => {
  const { t } = useLanguage();

  // Determine user role and mode
  const effectiveRole = (loggedInUser?.tipo || currentUserRole || '').toLowerCase().trim();
  const isSuperAdmin = effectiveRole === 'super_admin' || effectiveRole === 'admin';
  const isSchoolDirector = effectiveRole === 'director' || effectiveRole.includes('direc');
  const isSecretaria = effectiveRole === 'secretaria';
  const isEstudante = effectiveRole === 'estudante' || effectiveRole.includes('alun');
  const isPai = effectiveRole === 'pai' || effectiveRole.includes('encarregado');
  const isDocente = effectiveRole === 'docente' || effectiveRole.includes('prof');

  // Can this role trigger notifications for skipped pending classes?
  // Only director da escola, director pedagógico, secretaria geral (and super admin)
  const canSendPendingNotification = isSuperAdmin || isSchoolDirector || isSecretaria;

  // Find docente record corresponding to logged-in user if docente
  const currentDocenteRecord = useMemo(() => {
    if (!isDocente) return null;
    return teachers.find(t => t.user_id === loggedInUser?.id || t.id === loggedInUser?.docente_id || t.user_id === loggedInUser?.uid);
  }, [isDocente, teachers, loggedInUser]);

  // Is Teacher Mode active?
  // If the user is docente and we found their teacher profile (or isDocente is true), layout do docente is active
  const isTeacherLayout = isDocente && !isSuperAdmin;

  // Master State for Plano de Aulas records
  const [planoAulas, setPlanoAulas] = useState<PlanoAula[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters State
  const [filterDataDe, setFilterDataDe] = useState<string>('');
  const [filterDataAte, setFilterDataAte] = useState<string>('');
  const [filterDisciplinaId, setFilterDisciplinaId] = useState<string>('todos');
  const [filterTurmaId, setFilterTurmaId] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchTopico, setSearchTopico] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Admin View State
  const [searchDocenteName, setSearchDocenteName] = useState<string>('');
  const [filterAdminDisciplina, setFilterAdminDisciplina] = useState<string>('todos');
  const [selectedTeacherForSlideOver, setSelectedTeacherForSlideOver] = useState<Docente | null>(null);

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PlanoAula | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState<PlanoAula | null>(null);
  const [notifyingItem, setNotifyingItem] = useState<PlanoAula | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [formDocenteId, setFormDocenteId] = useState<string>('');
  const [formDisciplinaId, setFormDisciplinaId] = useState<string>('');
  const [formTurmaId, setFormTurmaId] = useState<string>('');
  const [formTopico, setFormTopico] = useState<string>('');
  const [formPeriodoTipo, setFormPeriodoTipo] = useState<PeriodoTipo>('trimestre');
  const [formPeriodoNumero, setFormPeriodoNumero] = useState<number>(1);
  const [formAnoLectivo, setFormAnoLectivo] = useState<string>(currentAcademicYear);
  const [formDataPrevista, setFormDataPrevista] = useState<string>('');
  const [formOrdem, setFormOrdem] = useState<number>(1);

  // Debounce search topic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTopico.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTopico]);

  // Real-time listener for planoAulas filtered by tenantId
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const q = query(
        collection(db, 'planoAulas'),
        where('tenantId', '==', tenantId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: PlanoAula[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          // Sort default by ordem ascending, then createdAt
          list.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
          setPlanoAulas(list);
          setIsLoading(false);
        },
        (err) => {
          console.error('[PlanoAulasModule] Erro ao carregar plano de aulas:', err);
          setLoadError(err.message || 'Erro ao carregar dados do plano de aulas');
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error('[PlanoAulasModule] Excepção ao subscrever:', err);
      setLoadError(err.message || 'Erro inesperado');
      setIsLoading(false);
    }
  }, [tenantId]);

  // Close slide-over on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTeacherForSlideOver(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Distinct disciplines list
  const baseDisciplines = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; nome: string }[] = [];
    classes.forEach(c => {
      const key = c.disciplina_id || c.nome;
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ id: c.disciplina_id || c.id, nome: c.nome });
      }
    });
    return list;
  }, [classes]);

  // Assigned disciplines for the current logged-in teacher
  const teacherDisciplines = useMemo(() => {
    if (!currentDocenteRecord) return baseDisciplines;
    // Find classes / scheduled items assigned to this teacher
    const teacherClasses = classes.filter(c => c.docente_id === currentDocenteRecord.id);
    const seen = new Set<string>();
    const list: { id: string; nome: string }[] = [];
    teacherClasses.forEach(c => {
      const key = c.disciplina_id || c.nome;
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ id: c.disciplina_id || c.id, nome: c.nome });
      }
    });
    return list.length > 0 ? list : baseDisciplines;
  }, [currentDocenteRecord, classes, baseDisciplines]);

  // List of teachers for student/parent filtering
  const visibleTeachersForAdmin = useMemo(() => {
    if (isEstudante) {
      // Find the student's turma
      const myStudent = students.find(s => s.user_id === loggedInUser?.id || s.id === loggedInUser?.estudante_id);
      if (!myStudent) return [];
      const studentTurmaId = myStudent.turma_id;
      // Get teacher IDs who have classes in this turma
      const turmaTeacherIds = new Set(
        classes.filter(c => c.turma_id === studentTurmaId).map(c => c.docente_id)
      );
      return teachers.filter(t => turmaTeacherIds.has(t.id));
    }

    if (isPai) {
      // Find parent's children
      const myPai = parents.find(p => p.user_id === loggedInUser?.id || p.id === loggedInUser?.pai_id);
      const studentIds = myPai?.estudantes_ids || [];
      const myChildren = students.filter(s => studentIds.includes(s.id) || (s as any).pai_id === myPai?.id);
      const childrenTurmaIds = new Set(myChildren.map(c => c.turma_id).filter(Boolean));
      const turmaTeacherIds = new Set(
        classes.filter(c => childrenTurmaIds.has(c.turma_id)).map(c => c.docente_id)
      );
      return teachers.filter(t => turmaTeacherIds.has(t.id));
    }

    // Default: all teachers in the school/tenant
    return teachers;
  }, [isEstudante, isPai, students, parents, loggedInUser, classes, teachers]);

  // Filtered teachers on the admin overview list
  const filteredTeachers = useMemo(() => {
    return visibleTeachersForAdmin.filter(t => {
      const usr = tenantUsers.find(u => u.id === t.user_id);
      const teacherName = (usr?.nome || t.nome || '').toLowerCase();
      if (searchDocenteName.trim() && !teacherName.includes(searchDocenteName.trim().toLowerCase())) {
        return false;
      }
      if (filterAdminDisciplina !== 'todos') {
        const teachesDisc = classes.some(c => 
          c.docente_id === t.id && (c.disciplina_id === filterAdminDisciplina || c.id === filterAdminDisciplina)
        );
        if (!teachesDisc) return false;
      }
      return true;
    });
  }, [visibleTeachersForAdmin, searchDocenteName, filterAdminDisciplina, tenantUsers, classes]);

  // Calculate teacher progress summary
  const getTeacherStats = useCallback((teacherId: string) => {
    const items = planoAulas.filter(p => p.docenteId === teacherId);
    const total = items.length;
    const completed = items.filter(p => p.status === 'lecionado').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent, pending: total - completed };
  }, [planoAulas]);

  // Teacher items filtered for current teacher view or slide-over
  const activeTeacherId = isTeacherLayout 
    ? (currentDocenteRecord?.id || teachers[0]?.id || '') 
    : (selectedTeacherForSlideOver?.id || '');

  const filteredTeacherPlanItems = useMemo(() => {
    if (!activeTeacherId) return [];

    return planoAulas.filter(item => {
      if (item.docenteId !== activeTeacherId) return false;

      // Filter by disciplina
      if (filterDisciplinaId !== 'todos') {
        if (item.disciplinaId !== filterDisciplinaId) return false;
      }

      // Filter by turma
      if (filterTurmaId !== 'todos') {
        if (item.turmaId !== filterTurmaId) return false;
      }

      // Filter by status
      if (filterStatus !== 'todos') {
        if (item.status !== filterStatus) return false;
      }

      // Filter by date range
      if (filterDataDe) {
        const itemDate = item.dataPrevista || item.createdAt?.split('T')[0];
        if (itemDate && itemDate < filterDataDe) return false;
      }
      if (filterDataAte) {
        const itemDate = item.dataPrevista || item.createdAt?.split('T')[0];
        if (itemDate && itemDate > filterDataAte) return false;
      }

      // Search by topic
      if (debouncedSearch) {
        const topicoLower = (item.topico || '').toLowerCase();
        if (!topicoLower.includes(debouncedSearch)) return false;
      }

      return true;
    });
  }, [
    planoAulas, 
    activeTeacherId, 
    filterDisciplinaId, 
    filterTurmaId, 
    filterStatus, 
    filterDataDe, 
    filterDataAte, 
    debouncedSearch
  ]);

  // RULE FOR "NOTIFICAR AULA PENDENTE":
  // The button is ONLY ACTIVE if there is, for the same docente, disciplina, and turma,
  // at least one later topic (with higher ordem, or later dataPrevista) with status "lecionado" (skipped class).
  const canNotifyPendingItem = useCallback((item: PlanoAula): { allowed: boolean; reason?: string } => {
    if (item.status === 'lecionado') {
      return { allowed: false, reason: 'A aula já foi lecionada' };
    }

    // Find all items for same teacher, discipline, and turma
    const siblingItems = planoAulas.filter(p => 
      p.docenteId === item.docenteId && 
      p.disciplinaId === item.disciplinaId &&
      (item.turmaId ? p.turmaId === item.turmaId : true)
    );

    // Look for a later item (higher order or later date) with status === 'lecionado'
    const hasLaterTaughtLesson = siblingItems.some(sibling => {
      if (sibling.status !== 'lecionado') return false;
      
      // Order comparison
      if (sibling.ordem !== undefined && item.ordem !== undefined) {
        if (sibling.ordem > item.ordem) return true;
      }

      // Date comparison fallback
      if (sibling.dataPrevista && item.dataPrevista) {
        if (sibling.dataPrevista > item.dataPrevista) return true;
      }

      // Creation date fallback
      if (sibling.createdAt && item.createdAt) {
        if (sibling.createdAt > item.createdAt) return true;
      }

      return false;
    });

    if (!hasLaterTaughtLesson) {
      return { 
        allowed: false, 
        reason: t('notificar_tooltip_inativo') || 'Só é possível notificar quando uma aula posterior já foi leccionada' 
      };
    }

    return { allowed: true };
  }, [planoAulas, t]);

  // Handler to clear filters
  const handleClearFilters = () => {
    setFilterDataDe('');
    setFilterDataAte('');
    setFilterDisciplinaId('todos');
    setFilterTurmaId('todos');
    setFilterStatus('todos');
    setSearchTopico('');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormDocenteId(activeTeacherId || currentDocenteRecord?.id || teachers[0]?.id || '');
    setFormDisciplinaId(teacherDisciplines[0]?.id || baseDisciplines[0]?.id || '');
    setFormTurmaId(turmas[0]?.id || '');
    setFormTopico('');
    setFormPeriodoTipo('trimestre');
    setFormPeriodoNumero(1);
    setFormAnoLectivo(currentAcademicYear);
    setFormDataPrevista('');
    // Auto-calculate next order
    const teacherItems = planoAulas.filter(p => p.docenteId === activeTeacherId);
    const maxOrder = teacherItems.reduce((max, cur) => Math.max(max, cur.ordem || 0), 0);
    setFormOrdem(maxOrder + 1);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PlanoAula) => {
    if (item.status !== 'pendente') {
      if (showNotification) showNotification('Apenas matérias com status Pendente podem ser editadas.', 'info');
      return;
    }
    setEditingItem(item);
    setFormDocenteId(item.docenteId);
    setFormDisciplinaId(item.disciplinaId);
    setFormTurmaId(item.turmaId || '');
    setFormTopico(item.topico);
    setFormPeriodoTipo(item.periodoTipo || 'trimestre');
    setFormPeriodoNumero(item.periodoNumero || 1);
    setFormAnoLectivo(item.anoLectivo || currentAcademicYear);
    setFormDataPrevista(item.dataPrevista || '');
    setFormOrdem(item.ordem || 1);
    setIsModalOpen(true);
  };

  // Save (Create or Update) Topic
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopico.trim()) {
      if (showNotification) showNotification('Por favor, informe o tópico da matéria.', 'erro');
      return;
    }
    if (!formDisciplinaId) {
      if (showNotification) showNotification('Por favor, selecione a disciplina.', 'erro');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const currentUserId = loggedInUser?.id || loggedInUser?.uid || 'user';

      if (editingItem) {
        // Update existing item (only if pending)
        const updatePayload: Partial<PlanoAula> = {
          disciplinaId: formDisciplinaId,
          turmaId: formTurmaId || undefined,
          topico: formTopico.trim(),
          periodoTipo: formPeriodoTipo,
          periodoNumero: Number(formPeriodoNumero),
          anoLectivo: formAnoLectivo,
          dataPrevista: formDataPrevista || undefined,
          ordem: Number(formOrdem) || 1,
          updatedAt: now
        };

        await updateDoc(doc(db, 'planoAulas', editingItem.id), updatePayload);
        if (showNotification) showNotification(t('success_generic') || 'Matéria actualizada com sucesso!', 'sucesso');
        if (onAuditLog) {
          onAuditLog('editar', 'PlanoAula', editingItem.id, `Actualizou tópico: ${formTopico}`);
        }
      } else {
        // Create new item
        const newRecord: Omit<PlanoAula, 'id'> = {
          tenantId,
          docenteId: formDocenteId || activeTeacherId,
          disciplinaId: formDisciplinaId,
          turmaId: formTurmaId || undefined,
          topico: formTopico.trim(),
          periodoTipo: formPeriodoTipo,
          periodoNumero: Number(formPeriodoNumero),
          anoLectivo: formAnoLectivo,
          dataPrevista: formDataPrevista || undefined,
          status: 'pendente',
          extraordinario: false,
          ordem: Number(formOrdem) || 1,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUserId
        };

        const docRef = await addDoc(collection(db, 'planoAulas'), newRecord);
        if (showNotification) showNotification(t('success_generic') || 'Matéria planeada adicionada com sucesso!', 'sucesso');
        if (onAuditLog) {
          onAuditLog('criar', 'PlanoAula', docRef.id, `Criou tópico planeado: ${formTopico}`);
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error('[PlanoAulasModule] Erro ao guardar matéria:', err);
      if (showNotification) showNotification(`Erro ao guardar: ${err.message || err}`, 'erro');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status (Mark as Lecionado / Revert to Pendente)
  const handleToggleStatus = async (item: PlanoAula) => {
    const newStatus: StatusPlanoAula = item.status === 'pendente' ? 'lecionado' : 'pendente';
    const now = new Date().toISOString();

    try {
      const updateData: Partial<PlanoAula> = {
        status: newStatus,
        updatedAt: now,
        dataLecionada: newStatus === 'lecionado' ? now.split('T')[0] : undefined
      };

      await updateDoc(doc(db, 'planoAulas', item.id), updateData);

      // When marked as lecionado, automatically complete any pending activity linked to this lesson!
      if (newStatus === 'lecionado') {
        try {
          const actQuery = query(
            collection(db, 'atividades'),
            where('tenant_id', '==', tenantId),
            where('dedup_key', '==', `plano_aula_${item.id}`)
          );
          const actSnapshot = await getDocs(actQuery);
          actSnapshot.forEach(async (actDoc) => {
            const actData = actDoc.data();
            if (actData.status !== 'Concluída' && actData.status !== 'Finalizada') {
              await updateDoc(doc(db, 'atividades', actDoc.id), {
                status: 'Concluída',
                data_finalizacao: now,
                concluido_em: now,
                concluido_por_nome: loggedInUser?.nome || 'Docente',
                nota_finalizacao: 'Resolvido automaticamente: Aula marcada como leccionada no Plano de Aulas.',
                resolvido_automaticamente: true,
                origem_resolucao: 'Plano de Aulas'
              });
            }
          });
        } catch (actErr) {
          console.warn('[PlanoAulasModule] Falha ao concluir actividade associada:', actErr);
        }
      }

      if (showNotification) {
        showNotification(
          newStatus === 'lecionado' 
            ? (t('marcar_lecionado') + '!') 
            : (t('desmarcar_lecionado') + '!'),
          'sucesso'
        );
      }
      if (onAuditLog) {
        onAuditLog(
          'alterar_status', 
          'PlanoAula', 
          item.id, 
          `Alterou status para ${newStatus} na matéria: ${item.topico}`
        );
      }
    } catch (err: any) {
      console.error('[PlanoAulasModule] Erro ao alternar status:', err);
      if (showNotification) showNotification(`Erro ao alterar status: ${err.message || err}`, 'erro');
    }
  };

  // Delete Item (only if pending)
  const handleDeleteItem = async () => {
    if (!isDeletingItem) return;
    if (isDeletingItem.status !== 'pendente') {
      if (showNotification) showNotification('Apenas matérias com status Pendente podem ser eliminadas.', 'erro');
      setIsDeletingItem(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'planoAulas', isDeletingItem.id));
      if (showNotification) showNotification('Matéria eliminada com sucesso!', 'sucesso');
      if (onAuditLog) {
        onAuditLog('eliminar', 'PlanoAula', isDeletingItem.id, `Eliminou tópico: ${isDeletingItem.topico}`);
      }
      setIsDeletingItem(null);
    } catch (err: any) {
      console.error('[PlanoAulasModule] Erro ao eliminar matéria:', err);
      if (showNotification) showNotification(`Erro ao eliminar: ${err.message || err}`, 'erro');
    }
  };

  // Trigger Notification for Skipped Pending Lesson
  const handleConfirmPendingNotification = async () => {
    if (!notifyingItem) return;

    const teacher = teachers.find(t => t.id === notifyingItem.docenteId);
    const teacherUser = tenantUsers.find(u => u.id === teacher?.user_id);
    const targetUserId = teacherUser?.id || teacher?.user_id || notifyingItem.docenteId;
    const teacherName = teacherUser?.nome || teacher?.nome || 'Docente';
    const discObj = classes.find(c => c.disciplina_id === notifyingItem.disciplinaId || c.id === notifyingItem.disciplinaId);
    const discNome = discObj?.nome || 'Disciplina';

    const now = new Date().toISOString();

    try {
      // 1. Send Notification to Teacher
      await sendAppNotification({
        tenant_id: tenantId,
        destinatario_id: targetUserId,
        destinatario_role: 'docente',
        destinatario_email: teacherUser?.email || '',
        usuario_id: targetUserId,
        docente_id: notifyingItem.docenteId,
        disciplina_id: notifyingItem.disciplinaId,
        disciplina_nome: discNome,
        titulo: 'Alerta: Aula Pendente no Plano de Aulas',
        mensagem: `A aula '${notifyingItem.topico}' de ${discNome} está pendente e já foi leccionada uma aula posterior.`,
        tipo: 'alerta',
        modulo: 'plano_aulas',
        link: 'plano_aulas'
      });

      // 2. Automatically create an Activity in "Actividades"
      const suggestedDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const periodoLabel = `${notifyingItem.periodoNumero}.º ${notifyingItem.periodoTipo === 'semestre' ? 'Semestre' : 'Trimestre'}`;

      const newActivity = {
        tenant_id: tenantId,
        titulo: `Regularizar aula pendente: ${notifyingItem.topico}`,
        detalhes: `Disciplina: ${discNome} | Período: ${periodoLabel} | Data Prevista: ${notifyingItem.dataPrevista || 'N/A'}. A aula foi ultrapassada por uma posterior leccionada e necessita de regularização.`,
        responsavel_id: targetUserId,
        responsavel_nome: teacherName,
        responsavel_cargo: 'Docente',
        responsavel_email: teacherUser?.email || '',
        severidade: 'Médio',
        status: 'Pendente',
        criado_por_id: loggedInUser?.id || 'admin',
        criado_por_nome: loggedInUser?.nome || 'Direcção / Secretaria',
        data_criacao: now,
        data_prazo: suggestedDeadline,
        categoria_atribuicao: 'Professores',
        modulo_origem: 'Plano de Aulas',
        dedup_key: `plano_aula_${notifyingItem.id}`,
        plano_aula_id: notifyingItem.id
      };

      await addDoc(collection(db, 'atividades'), newActivity);

      // 3. Mark the topic as notified
      await updateDoc(doc(db, 'planoAulas', notifyingItem.id), {
        notificadoEm: now,
        notificadoPor: loggedInUser?.nome || loggedInUser?.email || 'Administração',
        updatedAt: now
      });

      // 4. Audit Log
      if (onAuditLog) {
        onAuditLog(
          'notificar_aula_pendente',
          'PlanoAula',
          notifyingItem.id,
          `Notificou docente ${teacherName} sobre aula pendente saltada: ${notifyingItem.topico}`
        );
      }

      if (showNotification) {
        showNotification(
          t('notificar_sucesso') || 'Docente notificado e actividade de regularização criada com sucesso!',
          'sucesso'
        );
      }

      setNotifyingItem(null);
    } catch (err: any) {
      console.error('[PlanoAulasModule] Erro ao notificar aula pendente:', err);
      if (showNotification) showNotification(`Erro ao notificar: ${err.message || err}`, 'erro');
    }
  };

  // Helper to get discipline name
  const getDisciplineName = (discId: string) => {
    const d = classes.find(c => c.disciplina_id === discId || c.id === discId);
    return d ? d.nome : discId;
  };

  // Helper to get turma name
  const getTurmaName = (turmaId?: string) => {
    if (!turmaId) return 'Geral';
    const tObj = turmas.find(t => t.id === turmaId);
    return tObj ? tObj.nome : turmaId;
  };

  // Skeleton loading component
  const renderSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl w-full" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ======================================================== */}
      {/* 1. TEACHER LAYOUT (LAYOUT DO DOCENTE)                    */}
      {/* ======================================================== */}
      {isTeacherLayout ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-850">
                    {t('plano_aulas_title') || 'Plano de Aulas'}
                  </h2>
                  <p className="text-xs text-slate-500 font-sans">
                    {t('plano_aulas_subtitle') || 'Planeamento e acompanhamento dos tópicos curriculares a leccionar'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                📅 {currentAcademicYear}
              </span>
              <button
                id="btn_adicionar_materia"
                onClick={handleOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                {t('adicionar_materia') || 'Adicionar Matéria'}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Topic */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('buscar_topico') || 'Buscar tópico...'}
                  value={searchTopico}
                  onChange={(e) => setSearchTopico(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Disciplina */}
              <div>
                <select
                  value={filterDisciplinaId}
                  onChange={(e) => setFilterDisciplinaId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todos">{t('todas_disciplinas') || 'Todas as Disciplinas'}</option>
                  {teacherDisciplines.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todos">{t('todos_status') || 'Todos os Estados'}</option>
                  <option value="pendente">⏳ {t('status_pendente') || 'Pendente'}</option>
                  <option value="lecionado">✅ {t('status_lecionado') || 'Lecionado'}</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-center">
                <button
                  onClick={handleClearFilters}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('limpar_filtros') || 'Limpar filtros'}
                </button>
              </div>
            </div>

            {/* Date Range Sub-row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Intervalo:
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500">De:</label>
                <input
                  type="date"
                  value={filterDataDe}
                  onChange={(e) => setFilterDataDe(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500">Até:</label>
                <input
                  type="date"
                  value={filterDataAte}
                  onChange={(e) => setFilterDataAte(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Teacher Content: Table on Desktop, Cards on Mobile */}
          {isLoading ? (
            renderSkeleton()
          ) : loadError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-rose-800">{loadError}</p>
            </div>
          ) : filteredTeacherPlanItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">
                {t('nenhuma_materia_planeada') || 'Nenhuma matéria planeada encontrada'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t('nenhuma_materia_desc') || 'Comece por registar os tópicos e matérias a leccionar ao longo do período lectivo.'}
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> {t('adicionar_materia') || 'Adicionar Matéria'}
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-150">
                      <th className="p-3.5 font-bold w-12 text-center">#</th>
                      <th className="p-3.5 font-bold">{t('topico') || 'Tópico'}</th>
                      <th className="p-3.5 font-bold">{t('disciplina') || 'Disciplina'}</th>
                      <th className="p-3.5 font-bold">{t('periodo') || 'Período'}</th>
                      <th className="p-3.5 font-bold">{t('data_prevista') || 'Data Prevista'}</th>
                      <th className="p-3.5 font-bold text-center">{t('status') || 'Status'}</th>
                      <th className="p-3.5 font-bold text-right sticky right-0 bg-slate-50">{t('acoes') || 'Ações'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredTeacherPlanItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 text-center font-mono text-slate-400 font-bold">
                          {item.ordem || '-'}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span>{item.topico}</span>
                            {item.extraordinario && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {t('badge_extraordinario') || 'Extraordinário'}
                              </span>
                            )}
                          </div>
                          {item.turmaId && (
                            <span className="text-[11px] text-slate-400">
                              Turma: {getTurmaName(item.turmaId)}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-650 font-semibold">
                          {getDisciplineName(item.disciplinaId)}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {item.periodoNumero}.º {item.periodoTipo === 'semestre' ? 'Semestre' : 'Trimestre'}
                        </td>
                        <td className="p-3.5 font-mono text-slate-500">
                          {item.dataPrevista ? new Date(item.dataPrevista + 'T12:00:00').toLocaleDateString('pt-PT') : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          {item.status === 'lecionado' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {t('status_lecionado') || 'Lecionado'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {t('status_pendente') || 'Pendente'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right sticky right-0 bg-white">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Lecionado / Pendente */}
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                item.status === 'lecionado'
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600'
                              }`}
                              title={item.status === 'lecionado' ? t('desmarcar_lecionado') : t('marcar_lecionado')}
                            >
                              <Check className="w-4 h-4" />
                            </button>

                            {/* Edit (only if pending) */}
                            {item.status === 'pendente' && (
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title={t('editar_materia') || 'Editar'}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete (only if pending) */}
                            {item.status === 'pendente' && (
                              <button
                                onClick={() => setIsDeletingItem(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={t('eliminar_materia') || 'Eliminar'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="block md:hidden space-y-3">
                {filteredTeacherPlanItems.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-slate-400">#{item.ordem}</span>
                          <span className="font-bold text-slate-850 text-sm">{item.topico}</span>
                        </div>
                        <p className="text-xs text-indigo-600 font-semibold">{getDisciplineName(item.disciplinaId)}</p>
                      </div>

                      {item.status === 'lecionado' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Lecionado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pendente
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>{item.periodoNumero}.º {item.periodoTipo}</span>
                      <span>•</span>
                      <span>Prev: {item.dataPrevista || 'Sem data'}</span>
                      {item.extraordinario && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700">
                          Extraordinário
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors ${
                          item.status === 'lecionado'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {item.status === 'lecionado' ? 'Lecionado' : 'Marcar Lecionado'}
                      </button>

                      <div className="flex items-center gap-1">
                        {item.status === 'pendente' && (
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {item.status === 'pendente' && (
                          <button
                            onClick={() => setIsDeletingItem(item)}
                            className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* 2. ADMINISTRATIVE LAYOUT (DIREÇÃO, SECRETARIA, ESTUDANTE) */
        /* ======================================================== */
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-850">
                  {t('plano_aulas_admin_title') || 'Acompanhamento do Plano de Aulas'}
                </h2>
                <p className="text-xs text-slate-500 font-sans">
                  {t('plano_aulas_admin_subtitle') || 'Supervisão pedagógica dos tópicos programáticos e assiduidade dos docentes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                Ano Lectivo: {currentAcademicYear}
              </span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('buscar_docente') || 'Buscar docente por nome...'}
                value={searchDocenteName}
                onChange={(e) => setSearchDocenteName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:w-64">
              <select
                value={filterAdminDisciplina}
                onChange={(e) => setFilterAdminDisciplina(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="todos">{t('todas_disciplinas') || 'Todas as Disciplinas'}</option>
                {baseDisciplines.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Teachers Cards Grid */}
          {isLoading ? (
            renderSkeleton()
          ) : filteredTeachers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">
                {t('nenhum_docente_encontrado') || 'Nenhum docente encontrado'}
              </h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher) => {
                const usr = tenantUsers.find(u => u.id === teacher.user_id);
                const teacherName = usr?.nome || teacher.nome || 'Docente';
                const stats = getTeacherStats(teacher.id);

                return (
                  <div
                    key={teacher.id}
                    onClick={() => setSelectedTeacherForSlideOver(teacher)}
                    className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer space-y-4 group"
                  >
                    <div className="flex items-center gap-3">
                      {teacher.foto_url ? (
                        <img
                          src={teacher.foto_url}
                          alt={teacherName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-150"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-base flex items-center justify-center border border-indigo-100">
                          {teacherName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <h4 className="font-extrabold text-slate-850 text-sm group-hover:text-indigo-600 transition-colors truncate">
                          {teacherName}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium truncate">
                          {teacher.especialidade || 'Docente'}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500">
                          {t('progresso_lecionadas', { completed: stats.completed, total: stats.total })}
                        </span>
                        <span className="text-indigo-600 font-mono">{stats.percent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 font-semibold text-[11px]">
                        {stats.pending} aulas pendentes
                      </span>
                      <span className="font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Ver Plano <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SLIDE-OVER PANEL (PAINEL LATERAL DIREITA -> ESQUERDA)   */}
      {/* ======================================================== */}
      {selectedTeacherForSlideOver && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setSelectedTeacherForSlideOver(null)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
              {/* Slide-over Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center font-bold">
                    {(tenantUsers.find(u => u.id === selectedTeacherForSlideOver.user_id)?.nome || selectedTeacherForSlideOver.nome || 'D').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">
                      {tenantUsers.find(u => u.id === selectedTeacherForSlideOver.user_id)?.nome || selectedTeacherForSlideOver.nome}
                    </h3>
                    <p className="text-xs text-indigo-400 font-mono">
                      {selectedTeacherForSlideOver.especialidade || 'Docente'} • Plano de Aulas
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTeacherForSlideOver(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Fechar (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Slide-over Filters Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="Buscar tópico..."
                  value={searchTopico}
                  onChange={(e) => setSearchTopico(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <select
                  value={filterDisciplinaId}
                  onChange={(e) => setFilterDisciplinaId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="todos">Todas as Disciplinas</option>
                  {baseDisciplines.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="todos">Todos os Estados</option>
                  <option value="pendente">⏳ Pendente</option>
                  <option value="lecionado">✅ Lecionado</option>
                </select>
              </div>

              {/* Slide-over Body: Plan Items List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {filteredTeacherPlanItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhuma matéria encontrada para este docente com os filtros aplicados.
                  </div>
                ) : (
                  filteredTeacherPlanItems.map((item) => {
                    const notifyCheck = canNotifyPendingItem(item);
                    const isAlreadyNotified = !!item.notificadoEm;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          item.status === 'lecionado'
                            ? 'bg-slate-50/70 border-slate-200/70'
                            : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-400">#{item.ordem}</span>
                              <span className="font-bold text-slate-850 text-sm">{item.topico}</span>
                              {item.extraordinario && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  Extraordinário
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-indigo-600 font-semibold">
                              {getDisciplineName(item.disciplinaId)} • {item.periodoNumero}.º {item.periodoTipo}
                            </p>
                          </div>

                          {item.status === 'lecionado' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Lecionado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pendente
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                          <div className="text-slate-400 font-mono text-[11px]">
                            {item.dataPrevista ? `Previsto: ${item.dataPrevista}` : 'Data prevista: N/A'}
                            {item.dataLecionada && ` • Lecionado em: ${item.dataLecionada}`}
                          </div>

                          {/* NOTIFY BUTTON (Visible only to administrative roles, NOT to students/parents) */}
                          {canSendPendingNotification && item.status === 'pendente' && (
                            <div className="relative group">
                              <button
                                disabled={!notifyCheck.allowed || isAlreadyNotified}
                                onClick={() => setNotifyingItem(item)}
                                className={`text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isAlreadyNotified
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : notifyCheck.allowed
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                }`}
                              >
                                <Bell className="w-3.5 h-3.5" />
                                {isAlreadyNotified 
                                  ? (t('notificado_em', { data: new Date(item.notificadoEm!).toLocaleDateString('pt-PT') }) || 'Notificado') 
                                  : (t('notificar_aula_pendente') || 'Notificar Aula Pendente')}
                              </button>

                              {!notifyCheck.allowed && !isAlreadyNotified && (
                                <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-20">
                                  {notifyCheck.reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL: ADICIONAR / EDITAR MATÉRIA                     */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-150 animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-850">
                {editingItem ? (t('editar_materia') || 'Editar Matéria') : (t('adicionar_materia') || 'Adicionar Matéria')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4">
              {/* Docente selection (if admin is creating) */}
              {!isTeacherLayout && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Docente Responsável</label>
                  <select
                    value={formDocenteId}
                    onChange={(e) => setFormDocenteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                  >
                    {teachers.map(t => {
                      const usr = tenantUsers.find(u => u.id === t.user_id);
                      return (
                        <option key={t.id} value={t.id}>{usr?.nome || t.nome}</option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Disciplina */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('disciplina') || 'Disciplina'} <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formDisciplinaId}
                  onChange={(e) => setFormDisciplinaId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Selecione a Disciplina --</option>
                  {(isTeacherLayout ? teacherDisciplines : baseDisciplines).map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>

              {/* Turma (Opcional) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('turma') || 'Turma'} (Opcional)
                </label>
                <select
                  value={formTurmaId}
                  onChange={(e) => setFormTurmaId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Geral (Todas as Turmas) --</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tópico */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('topico') || 'Tópico / Matéria'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Introdução às Funções Quadráticas"
                  value={formTopico}
                  onChange={(e) => setFormTopico(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Período Tipo + Número */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Período</label>
                  <select
                    value={formPeriodoTipo}
                    onChange={(e) => setFormPeriodoTipo(e.target.value as PeriodoTipo)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="trimestre">Trimestre</option>
                    <option value="semestre">Semestre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Número do Período</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={formPeriodoNumero}
                    onChange={(e) => setFormPeriodoNumero(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Ordem & Data Prevista */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ordem do Tópico</label>
                  <input
                    type="number"
                    min="1"
                    value={formOrdem}
                    onChange={(e) => setFormOrdem(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data Prevista (Opcional)</label>
                  <input
                    type="date"
                    value={formDataPrevista}
                    onChange={(e) => setFormDataPrevista(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel') || 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {isSubmitting ? (t('loading') || 'A guardar...') : (t('save') || 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CONFIRM DELETE MODAL                                  */}
      {/* ======================================================== */}
      {isDeletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-slate-850 text-sm">
                {t('confirmar_eliminacao') || 'Confirmar eliminação'}
              </h4>
            </div>

            <p className="text-xs text-slate-500">
              {t('confirmar_eliminacao_desc') || 'Esta ação não poderá ser desfeita. Deseja eliminar a matéria:'}
              <br />
              <strong className="text-slate-700">"{isDeletingItem.topico}"</strong>?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDeletingItem(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t('cancel') || 'Cancelar'}
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {t('eliminar_materia') || 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. CONFIRM NOTIFY PENDING LESSON MODAL                   */}
      {/* ======================================================== */}
      {notifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-850 text-sm">
                  {t('notificar_confirm_title') || 'Notificar Aula Pendente'}
                </h4>
                <p className="text-[11px] text-slate-400">Regularização de tópico programático saltado</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Será enviada uma notificação ao docente responsável e criada automaticamente uma tarefa no módulo <strong>Actividades</strong> com prazo de 7 dias para regularização da aula:
              <br />
              <span className="block mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800">
                "{notifyingItem.topico}"
              </span>
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setNotifyingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t('cancel') || 'Cancelar'}
              </button>
              <button
                onClick={handleConfirmPendingNotification}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                Confirmar e Notificar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanoAulasModule;
