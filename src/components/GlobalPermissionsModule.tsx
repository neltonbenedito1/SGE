import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  Square, 
  Users, 
  GraduationCap, 
  BookOpen, 
  UserCheck, 
  Settings, 
  Building2, 
  Copy, 
  Trash2, 
  RotateCcw, 
  Save, 
  KeyRound, 
  Lock, 
  Eye, 
  Edit3, 
  PlusCircle, 
  FileText, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Layers,
  Filter
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { UserCategoryPermission, ModulePermissionConfig, ModuleActions } from '../types';

interface GlobalPermissionsModuleProps {
  tenantId?: string;
  showNotification?: (msg: string, type?: 'sucesso' | 'erro' | 'info') => void;
}

// System default modules with metadata
export interface SystemModuleInfo {
  key: string;
  label: string;
  category: 'Geral' | 'Estrutura' | 'Académico' | 'Comunicação' | 'Administração';
  description: string;
}

export const SYSTEM_MODULES: SystemModuleInfo[] = [
  { key: 'dashboard', label: 'Dashboard Principal', category: 'Geral', description: 'Painel geral com resumos e estatísticas operacionais' },
  { key: 'atividades', label: 'Actividades Pendentes', category: 'Geral', description: 'Gestão de tarefas, prazos, atribuições e notas de finalização' },
  { key: 'analise_administrativa', label: 'Análise Administrativa', category: 'Geral', description: 'Visão executiva e alertas institucionais' },
  { key: 'analytics', label: 'Análises & Analytics (BI)', category: 'Geral', description: 'Relatórios avançados e inteligência de dados' },
  
  { key: 'provincias', label: 'Distritos / Províncias', category: 'Estrutura', description: 'Mapeamento territorial das instituições' },
  { key: 'escolas', label: 'Escolas & Unidades', category: 'Estrutura', description: 'Cadastro e gestão de unidades escolares' },
  { key: 'salas', label: 'Salas de Aula', category: 'Estrutura', description: 'Capacidade e alocação de salas físicas' },

  { key: 'docentes', label: 'Docentes & Professores', category: 'Académico', description: 'Ficha, disciplinas e distribuição de corpo docente' },
  { key: 'estudantes', label: 'Matrículas & Estudantes', category: 'Académico', description: 'Inscrições, dossiês e dados acadêmicos dos alunos' },
  { key: 'turmas', label: 'Gestão de Turmas', category: 'Académico', description: 'Abertura, lotação e acompanhamento de turmas' },
  { key: 'disciplinas', label: 'Disciplinas & Matérias', category: 'Académico', description: 'Programa curicular e atribuição de cadeiras' },
  { key: 'classes_escolares', label: 'Classes Lectivas', category: 'Académico', description: 'Níveis de ensino (7ª Classe, 10ª Classe, etc.)' },
  { key: 'calendario', label: 'Calendário & Horários', category: 'Académico', description: 'Horário de aulas, exames e eventos acadêmicos' },
  { key: 'pauta_geral', label: 'Pauta Geral de Notas', category: 'Académico', description: 'Visão consolidada de todas as notas por turma' },
  { key: 'pautas', label: 'Lançamento de Notas', category: 'Académico', description: 'Digitador de notas por disciplinas e trimestres' },
  { key: 'assiduidade', label: 'Controle de Assiduidade', category: 'Académico', description: 'Presenças, faltas e relatórios de assiduidade' },
  { key: 'biblioteca', label: 'Biblioteca Digital', category: 'Académico', description: 'Consultas de acervo e repositório de livros PDF' },
  { key: 'processos', label: 'Processo Individual', category: 'Académico', description: 'Históricos, transferências e certidões' },

  { key: 'notificacoes', label: 'Notificações & Alertas', category: 'Comunicação', description: 'Envio de mensagens, avisos e comunicados' },

  { key: 'usuarios', label: 'Utilizadores & Acessos', category: 'Administração', description: 'Contas do sistema, perfis e redefinições' },
  { key: 'configuracao', label: 'Configurações da Unidade', category: 'Administração', description: 'Parâmetros académicos, ano letivo e finanças' },
  { key: 'auditoria', label: 'Logs de Auditoria', category: 'Administração', description: 'Rastreabilidade de ações e segurança da informação' }
];

const DEFAULT_ACTIONS: ModuleActions = {
  visualizar: true,
  criar: false,
  editar: false,
  excluir: false,
  exportar: false,
  aprovar: false
};

const FULL_ACTIONS: ModuleActions = {
  visualizar: true,
  criar: true,
  editar: true,
  excluir: true,
  exportar: true,
  aprovar: true
};

const READONLY_ACTIONS: ModuleActions = {
  visualizar: true,
  criar: false,
  editar: false,
  excluir: false,
  exportar: false,
  aprovar: false
};

const NONE_ACTIONS: ModuleActions = {
  visualizar: false,
  criar: false,
  editar: false,
  excluir: false,
  exportar: false,
  aprovar: false
};

// Initial default categories
export const DEFAULT_CATEGORIES: UserCategoryPermission[] = [
  {
    id: 'estudantes',
    codigo: 'estudante',
    nome: 'Estudantes',
    descricao: 'Acesso restrito para consulta de horários, notas de pauta e biblioteca digital.',
    cor_badge: 'sky',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = ['dashboard', 'atividades', 'estudantes', 'turmas', 'disciplinas', 'pauta_geral', 'pautas', 'processos', 'calendario', 'assiduidade', 'biblioteca'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...READONLY_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'professores',
    codigo: 'docente',
    nome: 'Professores e Docentes',
    descricao: 'Gestão de pautas, lançamento de notas, faltas e consulta às turmas atribuídas.',
    cor_badge: 'indigo',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = !['usuarios', 'configuracao', 'provincias', 'escolas', 'auditoria'].includes(mod.key);
      const isWriteAllowed = ['pautas', 'atividades', 'assiduidade', 'processos', 'biblioteca'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? (isWriteAllowed ? { ...FULL_ACTIONS } : { ...READONLY_ACTIONS }) : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'pais_encarregados',
    codigo: 'pai',
    nome: 'Pais e Encarregados de Educação',
    descricao: 'Consulta de aproveitamento escolar, presenças e propinas dos educandos.',
    cor_badge: 'amber',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isAllowed = ['dashboard', 'atividades', 'estudantes', 'pauta_geral', 'pautas', 'assiduidade', 'notificacoes', 'processos'].includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...READONLY_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'directores',
    codigo: 'director',
    nome: 'Directores e Gestores Escolares',
    descricao: 'Acesso amplo para supervisão académica, relatórios, homologação de pautas e gestão de docentes.',
    cor_badge: 'emerald',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'suporte_tecnico',
    codigo: 'suporte',
    nome: 'Suporte Técnico',
    descricao: 'Configuração de parâmetros, manutenção de dados, gestão de utilizadores e auditoria.',
    cor_badge: 'violet',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'secretaria',
    codigo: 'secretaria',
    nome: 'Secretaria Geral',
    descricao: 'Emissão de certificados, matrículas, gestão de turmas e dotação de turmas.',
    cor_badge: 'rose',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      const isForbidden = ['analise_administrativa', 'configuracao', 'auditoria'];
      const isAllowed = !isForbidden.includes(mod.key);
      acc[mod.key] = {
        habilitado: isAllowed,
        acoes: isAllowed ? { ...FULL_ACTIONS } : { ...NONE_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  },
  {
    id: 'administradores',
    codigo: 'admin',
    nome: 'Administradores do Sistema',
    descricao: 'Acesso total e irrestrito a todas as funcionalidades e configurações do portal.',
    cor_badge: 'slate',
    is_system: true,
    modulos: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.key] = {
        habilitado: true,
        acoes: { ...FULL_ACTIONS }
      };
      return acc;
    }, {} as Record<string, ModulePermissionConfig>)
  }
];

export const GlobalPermissionsModule: React.FC<GlobalPermissionsModuleProps> = ({
  tenantId = 'global',
  showNotification
}) => {
  const [categories, setCategories] = useState<UserCategoryPermission[]>(DEFAULT_CATEGORIES);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    professores: true,
    estudantes: false
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todas');
  const [moduleSearch, setModuleSearch] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State for New Category
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDesc, setNewCategoryDesc] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('indigo');
  const [baseCategoryCopy, setBaseCategoryCopy] = useState<string>('professores');

  // Critical Action Delete Modal State
  const [deleteModalCat, setDeleteModalCat] = useState<UserCategoryPermission | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Notify helper
  const notify = (msg: string, type: 'sucesso' | 'erro' | 'info' = 'info') => {
    if (showNotification) {
      showNotification(msg, type);
    } else {
      console.log(`[Notification ${type}]: ${msg}`);
    }
  };

  // Load from Firestore
  useEffect(() => {
    setIsLoading(true);
    const colRef = collection(db, 'global_permissions');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      try {
        if (!snapshot.empty) {
          const loaded: UserCategoryPermission[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as UserCategoryPermission;
            loaded.push({ ...data, id: docSnap.id });
          });

          // Merge with default categories to ensure all default ones exist
          const merged = [...loaded];
          DEFAULT_CATEGORIES.forEach((def) => {
            if (!merged.some((m) => m.id === def.id || m.codigo === def.codigo)) {
              merged.push(def);
            }
          });
          setCategories(merged);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      } catch (err: any) {
        console.error('Error loading global permissions from Firestore:', err);
        setCategories(DEFAULT_CATEGORIES);
      } finally {
        setIsLoading(false);
      }
    }, (err) => {
      console.error('Snapshot error for global_permissions:', err);
      setCategories(DEFAULT_CATEGORIES);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Toggle Category Accordion Expand/Collapse
  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    categories.forEach((c) => {
      next[c.id] = true;
    });
    setExpandedCategories(next);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  // Helper to mirror category permissions to all users belonging to that category in Firestore
  const mirrorCategoryToUsers = async (cat: UserCategoryPermission) => {
    try {
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      const catCode = (cat.codigo || '').toLowerCase().trim();
      const catId = (cat.id || '').toLowerCase().trim();
      const catName = (cat.nome || '').toLowerCase().trim();

      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userType = (userData.tipo || userData.cargo || userData.categoria_codigo || userData.categoria_id || userData.categoria || '').toString().toLowerCase().trim();

        const isMatch = 
          (catCode && userType === catCode) || 
          (catId && userType === catId) || 
          (catName && userType === catName) ||
          (catCode && userType.includes(catCode)) ||
          (catId && userType.includes(catId));

        if (isMatch) {
          batch.update(doc(db, 'users', userDoc.id), {
            modulo_acessos: cat.modulos,
            updated_at: new Date().toISOString()
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
      }
      return updatedCount;
    } catch (err) {
      console.warn('Error mirroring category permissions to users:', err);
      return 0;
    }
  };

  // Helper to persist updated category to Firestore and directly update all associated users
  const persistCategoryAndSyncUsers = async (cat: UserCategoryPermission) => {
    try {
      const docRef = doc(db, 'global_permissions', cat.id);
      await setDoc(docRef, {
        ...cat,
        updated_at: new Date().toISOString()
      });

      const count = await mirrorCategoryToUsers(cat);
      console.log(`Directly synchronized permissions for category "${cat.nome}" (${cat.codigo}) to ${count} user(s).`);
      return count;
    } catch (err) {
      console.error('Error persisting category and syncing users:', err);
      return 0;
    }
  };

  // Toggle Module Switch Key
  const handleModuleSwitch = (catId: string, moduleKey: string, enabled: boolean) => {
    let targetCat: UserCategoryPermission | null = null;
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;

        const currentMod = cat.modulos[moduleKey] || {
          habilitado: false,
          acoes: { ...NONE_ACTIONS }
        };

        const nextMod: ModulePermissionConfig = {
          ...currentMod,
          habilitado: enabled,
          acoes: enabled
            ? currentMod.acoes.visualizar
              ? currentMod.acoes
              : { ...READONLY_ACTIONS }
            : { ...NONE_ACTIONS }
        };

        const updated = {
          ...cat,
          modulos: {
            ...cat.modulos,
            [moduleKey]: nextMod
          }
        };
        targetCat = updated;
        return updated;
      })
    );

    if (targetCat) {
      persistCategoryAndSyncUsers(targetCat).catch(err => console.warn('Background sync error:', err));
    }
  };

  // Toggle Granular Action Checkbox
  const handleActionCheckbox = (
    catId: string,
    moduleKey: string,
    actionKey: keyof ModuleActions,
    checked: boolean
  ) => {
    let targetCat: UserCategoryPermission | null = null;
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;

        const currentMod = cat.modulos[moduleKey] || {
          habilitado: true,
          acoes: { ...READONLY_ACTIONS }
        };

        const nextActions = {
          ...currentMod.acoes,
          [actionKey]: checked
        };

        // If at least one action is checked, module should stay enabled
        const hasAnyAction = Object.values(nextActions).some(Boolean);

        const updated = {
          ...cat,
          modulos: {
            ...cat.modulos,
            [moduleKey]: {
              habilitado: hasAnyAction || currentMod.habilitado,
              acoes: nextActions
            }
          }
        };
        targetCat = updated;
        return updated;
      })
    );

    if (targetCat) {
      persistCategoryAndSyncUsers(targetCat).catch(err => console.warn('Background sync error:', err));
    }
  };

  // Quick Action Presets per Module
  const setModulePreset = (catId: string, moduleKey: string, preset: 'all' | 'readonly' | 'none') => {
    let newActions = { ...NONE_ACTIONS };
    let enabled = false;

    if (preset === 'all') {
      newActions = { ...FULL_ACTIONS };
      enabled = true;
    } else if (preset === 'readonly') {
      newActions = { ...READONLY_ACTIONS };
      enabled = true;
    }

    let targetCat: UserCategoryPermission | null = null;
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        const updated = {
          ...cat,
          modulos: {
            ...cat.modulos,
            [moduleKey]: {
              habilitado: enabled,
              acoes: newActions
            }
          }
        };
        targetCat = updated;
        return updated;
      })
    );

    if (targetCat) {
      persistCategoryAndSyncUsers(targetCat).catch(err => console.warn('Background sync error:', err));
    }
  };

  // Quick Action Presets per Category
  const setCategoryPreset = (catId: string, preset: 'all' | 'readonly' | 'none') => {
    let targetCat: UserCategoryPermission | null = null;
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;

        const updatedModulos = { ...cat.modulos };
        SYSTEM_MODULES.forEach((m) => {
          if (preset === 'all') {
            updatedModulos[m.key] = { habilitado: true, acoes: { ...FULL_ACTIONS } };
          } else if (preset === 'readonly') {
            updatedModulos[m.key] = { habilitado: true, acoes: { ...READONLY_ACTIONS } };
          } else {
            updatedModulos[m.key] = { habilitado: false, acoes: { ...NONE_ACTIONS } };
          }
        });

        const updated = {
          ...cat,
          modulos: updatedModulos
        };
        targetCat = updated;
        return updated;
      })
    );

    if (targetCat) {
      notify(`Ajustando permissões da categoria...`, 'info');
      persistCategoryAndSyncUsers(targetCat).then((count) => {
        notify(`Permissões salvas e sincronizadas para ${count} utilizador(es)!`, 'sucesso');
      }).catch(err => console.warn('Background sync error:', err));
    }
  };

  // Save all permissions to Firestore and mirror to users
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const results = await Promise.all(categories.map(cat => persistCategoryAndSyncUsers(cat)));
      const totalUsersMirrored = results.reduce((acc, curr) => acc + curr, 0);
      notify(`Matriz de Permissões Globais salva no banco de dados e sincronizada diretamente para ${totalUsersMirrored} utilizador(es)!`, 'sucesso');
    } catch (err: any) {
      console.error('Error saving global permissions:', err);
      notify(`Erro ao salvar permissões: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Create New Category Handler
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      notify('Por favor, informe o nome da nova categoria.', 'erro');
      return;
    }

    const code = newCategoryName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');

    const newId = `cat_${Date.now()}_${code}`;

    // Copy permissions from base category if selected
    const baseCat = categories.find((c) => c.id === baseCategoryCopy || c.codigo === baseCategoryCopy);
    const copiedModulos = baseCat
      ? JSON.parse(JSON.stringify(baseCat.modulos))
      : SYSTEM_MODULES.reduce((acc, mod) => {
          acc[mod.key] = { habilitado: true, acoes: { ...READONLY_ACTIONS } };
          return acc;
        }, {} as Record<string, ModulePermissionConfig>);

    const newCategoryObj: UserCategoryPermission = {
      id: newId,
      tenant_id: tenantId,
      nome: newCategoryName.trim(),
      codigo: code,
      descricao: newCategoryDesc.trim() || 'Categoria de utilizador personalizada do sistema.',
      cor_badge: newCategoryColor,
      is_system: false,
      modulos: copiedModulos,
      criado_em: new Date().toISOString()
    };

    try {
      setIsSaving(true);
      await setDoc(doc(db, 'global_permissions', newId), newCategoryObj);
      setCategories((prev) => [...prev, newCategoryObj]);
      setExpandedCategories((prev) => ({ ...prev, [newId]: true }));
      setIsCreateModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      notify(`Categoria "${newCategoryName}" criada e disponibilizada com sucesso!`, 'sucesso');
    } catch (err: any) {
      console.error('Error creating category:', err);
      notify(`Erro ao criar categoria: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Critical Delete Confirmation Modal
  const handleDeleteCategory = (cat: UserCategoryPermission) => {
    setDeleteModalCat(cat);
    setDeleteConfirmText('');
  };

  // Confirm Delete Category from Firestore & State
  const confirmDeleteCategory = async () => {
    if (!deleteModalCat) return;

    try {
      setIsSaving(true);
      await deleteDoc(doc(db, 'global_permissions', deleteModalCat.id));
      if (deleteModalCat.codigo && deleteModalCat.codigo !== deleteModalCat.id) {
        try {
          await deleteDoc(doc(db, 'global_permissions', deleteModalCat.codigo));
        } catch (e) {
          // ignore secondary delete errors if doc doesn't exist
        }
      }

      setCategories((prev) => prev.filter((c) => c.id !== deleteModalCat.id && c.codigo !== deleteModalCat.codigo));
      notify(`Categoria "${deleteModalCat.nome}" eliminada com sucesso.`, 'info');
      setDeleteModalCat(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      console.error('Error deleting category:', err);
      notify(`Erro ao remover categoria: ${err.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Badge Color Styles
  const getBadgeStyle = (color: string) => {
    switch (color) {
      case 'sky':
        return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800';
      case 'indigo':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
      case 'violet':
        return 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800';
      case 'rose':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
    }
  };

  // Filter Categories
  const filteredCategories = categories.filter((cat) => {
    if (selectedCategoryFilter !== 'todas' && cat.id !== selectedCategoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-extrabold tracking-wide uppercase">Matriz de Permissões Globais</h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono px-2.5 py-0.5 rounded-full font-bold">
                Módulo Administrativo
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Configure as autorizações e visibilidade de módulos para cada perfil de utilizador no sistema. Ative o alternador (Switch Key) para conceder visibilidade e selecione as ações permitidas em cada módulo.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-98"
            >
              <Plus className="w-4 h-4" /> Criar Categoria
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-950/40 active:scale-98"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Gravando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Drop-down inteiriço selector for active category focus */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-500" /> Filtrar Categoria:
          </label>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
          >
            <option value="todas">Exibir Todas as Categorias ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome} ({cat.codigo})
              </option>
            ))}
          </select>
        </div>

        {/* Search modules filter */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            placeholder="Pesquisar módulo ou ação..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>

        {/* Accordion Expand/Collapse All */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={expandAll}
            className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Expandir Todas
          </button>
          <button
            onClick={collapseAll}
            className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Recolher Todas
          </button>
        </div>
      </div>

      {/* CATEGORIES LIST (Drop-down Inteiriço Accordions) */}
      <div className="space-y-4">
        {filteredCategories.map((cat) => {
          const isExpanded = !!expandedCategories[cat.id];
          
          // Calculate active module stats for header badge
          const activeModulesCount = SYSTEM_MODULES.filter(
            (m) => cat.modulos[m.key]?.habilitado
          ).length;

          // Filter system modules based on search query
          const displayedModules = SYSTEM_MODULES.filter((m) => {
            if (!moduleSearch.trim()) return true;
            const query = moduleSearch.toLowerCase();
            return (
              m.label.toLowerCase().includes(query) ||
              m.category.toLowerCase().includes(query) ||
              m.description.toLowerCase().includes(query)
            );
          });

          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Category Header (Drop-down inteiriço bar) */}
              <div
                onClick={() => toggleCategoryExpand(cat.id)}
                className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                  isExpanded
                    ? 'bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800'
                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start md:items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0 mt-0.5 md:mt-0">
                    <KeyRound className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {cat.nome}
                      </h3>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getBadgeStyle(
                          cat.cor_badge
                        )}`}
                      >
                        {cat.codigo}
                      </span>
                      {cat.is_system && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                          Sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {cat.descricao}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <span className="text-indigo-600 dark:text-indigo-400 font-black">{activeModulesCount}</span> / {SYSTEM_MODULES.length} módulos visíveis
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Presets */}
                    <button
                      onClick={() => setCategoryPreset(cat.id, 'all')}
                      title="Ativar Acesso Total"
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors"
                    >
                      Total
                    </button>
                    <button
                      onClick={() => setCategoryPreset(cat.id, 'readonly')}
                      title="Ativar Apenas Leitura"
                      className="text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800 transition-colors"
                    >
                      Leitura
                    </button>

                    {!cat.is_system && (
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        title="Excluir esta categoria personalizada"
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-500" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accordion Body (Modules List & Switch Keys) */}
              {isExpanded && (
                <div className="p-4 md:p-6 space-y-6 bg-slate-50/40 dark:bg-slate-900/40">
                  {displayedModules.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Nenhum módulo encontrado com o termo "{moduleSearch}".
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {displayedModules.map((mod) => {
                        const config = cat.modulos[mod.key] || {
                          habilitado: false,
                          acoes: { ...NONE_ACTIONS }
                        };

                        const isEnabled = config.habilitado;

                        return (
                          <div
                            key={mod.key}
                            className={`p-4 rounded-xl border transition-all duration-200 ${
                              isEnabled
                                ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900 shadow-2xs'
                                : 'bg-slate-100/60 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 opacity-80'
                            }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                              {/* Left Module info + Switch Key */}
                              <div className="flex items-center gap-3">
                                {/* Switch Key */}
                                <button
                                  type="button"
                                  onClick={() => handleModuleSwitch(cat.id, mod.key, !isEnabled)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                                      {mod.label}
                                    </span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                                      {mod.category}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {mod.description}
                                  </p>
                                </div>
                              </div>

                              {/* Right Preset buttons for this module */}
                              {isEnabled && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => setModulePreset(cat.id, mod.key, 'readonly')}
                                    className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-1 rounded-md transition-colors"
                                  >
                                    Apenas Leitura
                                  </button>
                                  <button
                                    onClick={() => setModulePreset(cat.id, mod.key, 'all')}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 px-2 py-1 rounded-md transition-colors"
                                  >
                                    Todas Ações
                                  </button>
                                  <button
                                    onClick={() => setModulePreset(cat.id, mod.key, 'none')}
                                    className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 px-2 py-1 rounded-md transition-colors"
                                  >
                                    Desativar
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Checkboxes para ações do módulo */}
                            {isEnabled && (
                              <div className="mt-3.5 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.visualizar}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'visualizar', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <Eye className="w-3.5 h-3.5 text-slate-400" /> Visualizar
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.criar}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'criar', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <PlusCircle className="w-3.5 h-3.5 text-emerald-500" /> Criar
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.editar}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'editar', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <Edit3 className="w-3.5 h-3.5 text-amber-500" /> Editar
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.excluir}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'excluir', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Excluir
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.exportar}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'exportar', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <FileText className="w-3.5 h-3.5 text-sky-500" /> Exportar
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                                  <input
                                    type="checkbox"
                                    checked={!!config.acoes.aprovar}
                                    onChange={(e) =>
                                      handleActionCheckbox(cat.id, mod.key, 'aprovar', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                                  />
                                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Aprovar
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: Criar Categoria */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Nova Categoria de Utilizador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cadastre um novo perfil de autorização no sistema.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Inspetores Pedagógicos, Monitores de Turma"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Perfil
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva a finalidade desta categoria no portal escolar..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cor do Selo (Badge)
                  </label>
                  <select
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:text-white font-bold"
                  >
                    <option value="indigo">Anil (Indigo)</option>
                    <option value="emerald">Esmeralda (Emerald)</option>
                    <option value="amber">Âmbar (Amber)</option>
                    <option value="sky">Céu (Sky)</option>
                    <option value="violet">Violeta (Violet)</option>
                    <option value="rose">Rosa (Rose)</option>
                    <option value="slate">Cinza (Slate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Copiar Permissões De
                  </label>
                  <select
                    value={baseCategoryCopy}
                    onChange={(e) => setBaseCategoryCopy(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:text-white font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Criar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão de Categoria (Ação Crítica) */}
      {deleteModalCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
                  <AlertTriangle className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded-md tracking-wider">
                    Ação Crítica Irreversível
                  </span>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
                    Eliminar Categoria de Utilizador
                  </h3>
                </div>
              </div>

              <button
                onClick={() => {
                  setDeleteModalCat(null);
                  setDeleteConfirmText('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Aviso de Segurança de Acesso
                </p>
                <p className="leading-relaxed">
                  Tem certeza de que deseja eliminar permanentemente a categoria <strong className="underline">{deleteModalCat.nome}</strong> (<code className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded text-[11px]">{deleteModalCat.codigo}</code>)?
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                  Esta ação excluirá as definições de permissões do banco de dados e removerá as autorizações específicas vinculadas a esta categoria.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Para confirmar a eliminação, digite o nome exato da categoria (<span className="text-rose-600 font-mono select-all">{deleteModalCat.nome}</span>):
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModalCat.nome}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 dark:text-white font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalCat(null);
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving || deleteConfirmText.trim().toLowerCase() !== deleteModalCat.nome.trim().toLowerCase()}
                  onClick={confirmDeleteCategory}
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-950/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isSaving ? 'Eliminando...' : 'Confirmar Eliminação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
