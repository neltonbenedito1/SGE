/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  GripVertical, 
  Save, 
  Eye, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Calendar, 
  Hash, 
  ChevronDown, 
  Camera, 
  Paperclip, 
  CheckSquare, 
  AlignLeft, 
  Heading, 
  Layers, 
  Power, 
  Copy, 
  Settings,
  Sparkles,
  ShieldAlert,
  GraduationCap,
  Users,
  Building,
  Award,
  Type
} from 'lucide-react';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getOrFetchCached,
  buildTenantCacheKey,
  CACHE_TTLS,
  invalidateTenantCache,
} from '../lib/referenceCache';
import { 
  CustomForm, 
  CustomFormField, 
  CustomFieldTipo, 
  CustomFormStatus 
} from '../types';
import { CustomFieldsRenderer, COUNTRY_DIALING_CODES } from './CustomFieldsRenderer';
import { CORE_NATIVE_FORM_FIELD_IDS, DEFAULT_SYSTEM_FORMS } from '../config/customFormDefaults';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export { CORE_NATIVE_FORM_FIELD_IDS, DEFAULT_SYSTEM_FORMS };

interface FormulariosCustomizadosModuleProps {
  tenantId: string;
  showNotification: (msg: string, type: 'sucesso' | 'erro' | 'info' | 'alerta') => void;
  canEdit?: boolean;
  onFormulariosUpdated?: () => void;
}

// Definição dos tipos de campos disponíveis para arrastar ou clicar
interface FieldTypeDefinition {
  tipo: CustomFieldTipo;
  label: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultLabel: string;
  defaultPlaceholder?: string;
}

const AVAILABLE_FIELD_TYPES: FieldTypeDefinition[] = [
  {
    tipo: 'texto_curto',
    label: 'Campos de texto curto',
    descricao: 'Linha única para textos gerais, identificadores e anotações',
    icon: AlignLeft,
    defaultLabel: 'Novo Campo de Texto',
    defaultPlaceholder: 'Digite a informação...'
  },
  {
    tipo: 'alfabetico',
    label: 'Alfabético (Somente Letras)',
    descricao: 'Aceita estritamente letras e espaços (sem números nem símbolos)',
    icon: Type,
    defaultLabel: 'Campo Alfabético',
    defaultPlaceholder: 'Digite apenas letras...'
  },
  {
    tipo: 'alfanumerico',
    label: 'Alfanumérico (Letras e Números)',
    descricao: 'Aceita letras, números, espaços e hífens (sem caracteres especiais)',
    icon: Hash,
    defaultLabel: 'Campo Alfanumérico',
    defaultPlaceholder: 'Digite letras e números...'
  },
  {
    tipo: 'numero',
    label: 'Número (Somente Números)',
    descricao: 'Campo numérico estrito para notas, quantidades ou valores decimais',
    icon: Hash,
    defaultLabel: 'Quantidade ou Valor Numérico',
    defaultPlaceholder: '0'
  },
  {
    tipo: 'data',
    label: 'Data (com Calendário)',
    descricao: 'Seletor de data oficial com ícone interativo de calendário à direita',
    icon: Calendar,
    defaultLabel: 'Data de Registro',
    defaultPlaceholder: 'AAAA-MM-DD'
  },
  {
    tipo: 'dropdown',
    label: 'Drop-down',
    descricao: 'Lista suspensa de seleção com opções personalizáveis',
    icon: ChevronDown,
    defaultLabel: 'Selecione uma Opção',
    defaultPlaceholder: 'Selecione...'
  },
  {
    tipo: 'checkbox',
    label: 'Checkbox',
    descricao: 'Caixa de seleção para confirmação, sim/não ou autorização',
    icon: CheckSquare,
    defaultLabel: 'Confirmar Termo ou Requisito',
    defaultPlaceholder: ''
  },
  {
    tipo: 'texto_longo',
    label: 'Campos de texto longo',
    descricao: 'Área com múltiplas linhas para observações ou pareceres',
    icon: FileText,
    defaultLabel: 'Observações Adicionais',
    defaultPlaceholder: 'Insira as notas detalhadas aqui...'
  },
  {
    tipo: 'telefone_ddd',
    label: 'Contacto telefónico (DDD)',
    descricao: 'Seleção do DDD / código de país com entrada do número',
    icon: Phone,
    defaultLabel: 'Telefone de Contacto',
    defaultPlaceholder: '84 123 4567'
  },
  {
    tipo: 'titulo',
    label: 'Títulos',
    descricao: 'Separador visual e cabeçalho de seção dentro do formulário',
    icon: Heading,
    defaultLabel: 'Título de Seção',
    defaultPlaceholder: 'Subtítulo explicativo opcional'
  },
  {
    tipo: 'upload_arquivo',
    label: 'Upload de ficheiros (PDF ou XLSX)',
    descricao: 'Envio seguro de documentos em formato PDF ou planilha Excel',
    icon: Paperclip,
    defaultLabel: 'Anexo de Documento (PDF ou XLSX)',
    defaultPlaceholder: ''
  },
  {
    tipo: 'upload_foto',
    label: 'Upload de foto',
    descricao: 'Carregamento de foto com compressão e pré-visualização instantânea',
    icon: Camera,
    defaultLabel: 'Fotografia Digital',
    defaultPlaceholder: ''
  }
];

// Defaults movidos para ../config/customFormDefaults e reexportados acima para code-splitting.

// Campos nativos do sistema analisados para cada formulário base
const NATIVE_FIELDS_SUMMARY: Record<string, string[]> = {
  cadastro_escola: [
    'Nome da Instituição/Escola',
    'Tipo de Unidade (Escola, Faculdade, Instituto)',
    'Província e Endereço Físico',
    'Contacto Telefónico Oficial',
    'E-mail Institucional',
    'NUIT da Unidade',
    'Diretor(a) Responsável',
    'Regimes de Funcionamento (Manhã/Tarde/Noite)',
    'Níveis de Ensino Atendidos'
  ],
  cadastro_docente: [
    'Nome Completo do Docente',
    'E-mail de Acesso ao Sistema',
    'Fotografia do Docente',
    'Gênero e Data de Nascimento',
    'Documento de Identificação (BI/DIRE)',
    'NUIT',
    'Contacto Telefónico',
    'Endereço e Província',
    'Escola / Faculdade de Alocação',
    'Categoria Profissional e Tipo de Vínculo',
    'Formação Académica e Especialidade'
  ],
  cadastro_estudante: [
    'Fotografia Oficial do Aluno',
    'Nome Completo do Estudante',
    'Número de Matrícula',
    'Escola / Faculdade',
    'Turma / Curso Alocado',
    'Nível de Ensino / Ano Curricular',
    'Data de Nascimento e Gênero',
    'Documento de Identificação',
    'Naturalidade e Residência',
    'Telemóvel do Aluno e E-mail',
    'Nome e Contacto de Emergência'
  ],
  lancamento_notas: [
    'Identificação do Estudante',
    'Disciplina / Cadeira / Classe',
    'Trimestre / Semestre / Módulo',
    'Avaliação 1 / Teste 1 / Frequência 1',
    'Avaliação 2 / Teste 2 / Frequência 2',
    'Avaliação 3 / Trabalho Prático',
    'Nota de Exame Normal e Recurso',
    'Média Final e Situação Acadêmica',
    'Observações Pedagógicas'
  ]
};

export const FormulariosCustomizadosModule: React.FC<FormulariosCustomizadosModuleProps> = ({
  tenantId,
  showNotification,
  canEdit = true,
  onFormulariosUpdated
}) => {
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);
  const [filterEntity, setFilterEntity] = useState<string>('todas');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Modo de edição
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<'estrutura' | 'preview'>('estrutura');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [isDraggingOverDropzone, setIsDraggingOverDropzone] = useState(false);

  // Modal de novo formulário
  const [isNewFormModalOpen, setIsNewFormModalOpen] = useState(false);
  const [newFormNome, setNewFormNome] = useState('');
  const [newFormDescricao, setNewFormDescricao] = useState('');
  const [newFormEntidade, setNewFormEntidade] = useState<'escola' | 'docente' | 'estudante' | 'notas' | 'outro'>('estudante');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Diálogo de confirmação in-app (zero window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Carregar formulários do Firestore via cache isolada por tenant e garantir campos padrão
  const loadForms = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const cacheKey = buildTenantCacheKey(tenantId, 'custom_forms');
      const loaded = await getOrFetchCached<CustomForm[]>({
        key: cacheKey,
        ttlMs: CACHE_TTLS.CUSTOM_FORMS,
        forceRefresh,
        fetcher: async () => {
          const q = query(
            collection(db, 'custom_forms'),
            where('tenant_id', '==', tenantId)
          );
          const snapshot = await getDocs(q);
          const items: CustomForm[] = [];
          snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...docSnap.data() } as CustomForm);
          });
          return items;
        },
      });
      
      if (loaded.length > 0) {
        const mergedForms: CustomForm[] = [...loaded];
        let mutated = false;
        for (let i = 0; i < mergedForms.length; i++) {
          const existing = mergedForms[i];
          const defaultForm = DEFAULT_SYSTEM_FORMS.find(d => d.codigo === existing.codigo || (d.entidade === existing.entidade && existing.codigo === d.codigo));
          if (defaultForm && !existing.campos_padrao_v2_inicializados) {
            const existingCampos = Array.isArray(existing.campos) ? existing.campos : [];
            const existingIds = new Set(existingCampos.map(c => c.id));
            const missingDefaults = defaultForm.campos.filter(dc => !existingIds.has(dc.id));
            const combined = [...existingCampos, ...missingDefaults]
              .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
              .map((c, idx) => ({ ...c, ordem: idx + 1 }));

            const upgraded: CustomForm = {
              ...existing,
              campos: combined,
              campos_padrao_inicializados: true,
              campos_padrao_v2_inicializados: true,
              updated_at: new Date().toISOString()
            };
            mergedForms[i] = upgraded;
            mutated = true;
            try {
              await setDoc(doc(db, 'custom_forms', existing.id), upgraded);
            } catch (syncErr) {
              console.warn('Aviso ao sincronizar campos padrão do formulário:', syncErr);
            }
          }
        }

        // Garantir que todos os formulários base padrão existam
        for (const defaultForm of DEFAULT_SYSTEM_FORMS) {
          const exists = mergedForms.some(f => f.codigo === defaultForm.codigo);
          if (!exists) {
            const initialized: CustomForm = {
              ...defaultForm,
              id: `${tenantId}_${defaultForm.codigo}`,
              tenant_id: tenantId,
              campos_padrao_inicializados: true,
              campos_padrao_v2_inicializados: true
            };
            await setDoc(doc(db, 'custom_forms', initialized.id), initialized);
            mergedForms.push(initialized);
            mutated = true;
          }
        }
        if (mutated) {
          await invalidateTenantCache(tenantId, ['custom_forms']);
        }
        setForms(mergedForms);
      } else {
        // Inicializar com todos os formulários base e respectivos campos padrão
        const initializedForms: CustomForm[] = [];
        for (const defaultForm of DEFAULT_SYSTEM_FORMS) {
          const formWithTenant: CustomForm = {
            ...defaultForm,
            id: `${tenantId}_${defaultForm.codigo}`,
            tenant_id: tenantId,
            campos_padrao_inicializados: true,
            campos_padrao_v2_inicializados: true
          };
          await setDoc(doc(db, 'custom_forms', formWithTenant.id), formWithTenant);
          initializedForms.push(formWithTenant);
        }
        await invalidateTenantCache(tenantId, ['custom_forms']);
        setForms(initializedForms);
      }
    } catch (err: any) {
      console.error('Erro ao carregar formulários customizados:', err);
      // Fallback local seguro para evitar bloqueio da interface
      const localForms = DEFAULT_SYSTEM_FORMS.map(f => ({
        ...f,
        id: `${tenantId}_${f.codigo}`,
        tenant_id: tenantId,
        campos_padrao_inicializados: true,
        campos_padrao_v2_inicializados: true
      }));
      setForms(localForms);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadForms();
    }
  }, [tenantId]);

  // Filtro dinâmico na visão geral (com debounce)
  const filteredForms = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    return forms.filter(f => {
      const matchesSearch =
        !q ||
        f.nome.toLowerCase().includes(q) ||
        (f.descricao && f.descricao.toLowerCase().includes(q)) ||
        f.codigo.toLowerCase().includes(q);

      const matchesEntity =
        filterEntity === 'todas' ||
        f.entidade === filterEntity;

      const matchesStatus =
        filterStatus === 'todos' ||
        f.status === filterStatus;

      return matchesSearch && matchesEntity && matchesStatus;
    });
  }, [forms, debouncedSearchQuery, filterEntity, filterStatus]);

  // Alternar status de Suspensão / Reactivação
  const handleToggleStatus = async (form: CustomForm) => {
    if (!canEdit) {
      showNotification('Você não tem permissão para alterar formulários.', 'erro');
      return;
    }

    const nextStatus: CustomFormStatus = form.status === 'ativo' ? 'suspenso' : 'ativo';
    const updatedForm: CustomForm = {
      ...form,
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'custom_forms', form.id), {
        status: nextStatus,
        updated_at: updatedForm.updated_at
      });
      await invalidateTenantCache(tenantId, ['custom_forms']);

      setForms(prev => prev.map(f => f.id === form.id ? updatedForm : f));
      onFormulariosUpdated?.();
      showNotification(
        nextStatus === 'ativo' 
          ? `Formulário "${form.nome}" reactivado com sucesso!` 
          : `Formulário "${form.nome}" suspenso temporariamente.`,
        nextStatus === 'ativo' ? 'sucesso' : 'alerta'
      );
    } catch (err: any) {
      console.error('Erro ao atualizar status do formulário:', err);
      showNotification(`Erro ao alterar status: ${err?.message || err}`, 'erro');
    }
  };

  // Iniciar edição de um formulário
  const handleStartEdit = (form: CustomForm) => {
    setEditingForm(JSON.parse(JSON.stringify(form)));
    setIsDirty(false);
    setEditorTab('estrutura');
    setSelectedFieldId(form.campos[0]?.id || null);
    setPreviewValues({});
  };

  // Descartar alterações
  const handleDiscardChanges = () => {
    if (isDirty) {
      setConfirmDialog({
        title: 'Descartar Alterações',
        message: 'Existem alterações não salvas. Deseja realmente descartar e voltar à visão geral?',
        confirmLabel: 'Descartar',
        onConfirm: () => {
          setEditingForm(null);
          setIsDirty(false);
          setSelectedFieldId(null);
          setConfirmDialog(null);
        }
      });
      return;
    }
    setEditingForm(null);
    setIsDirty(false);
    setSelectedFieldId(null);
  };

  // Adicionar campo ao formulário em edição
  const handleAddField = (tipo: CustomFieldTipo) => {
    if (!editingForm) return;

    const def = AVAILABLE_FIELD_TYPES.find(t => t.tipo === tipo);
    const newFieldId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nextOrder = (editingForm.campos.length > 0)
      ? Math.max(...editingForm.campos.map(c => c.ordem || 0)) + 1
      : 1;

    const newField: CustomFormField = {
      id: newFieldId,
      tipo,
      label: def?.defaultLabel || 'Novo Campo',
      placeholder: def?.defaultPlaceholder || '',
      obrigatorio: false,
      ordem: nextOrder,
      opcoes: tipo === 'dropdown' ? ['Opção 1', 'Opção 2', 'Opção 3'] : undefined,
      ddd_padrao: tipo === 'telefone_ddd' ? '+258' : undefined,
      formatos_permitidos: tipo === 'upload_arquivo' ? ['pdf', 'xlsx'] : undefined,
      tamanho_maximo_mb: 15
    };

    setEditingForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        campos: [...prev.campos, newField]
      };
    });
    setSelectedFieldId(newFieldId);
    setIsDirty(true);
    showNotification(`Campo "${def?.label}" adicionado ao formulário!`, 'info');
  };

  // Remover campo
  const handleRemoveField = (fieldId: string) => {
    if (!editingForm) return;
    setEditingForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        campos: prev.campos.filter(c => c.id !== fieldId)
      };
    });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
    setIsDirty(true);
  };

  // Duplicar campo
  const handleDuplicateField = (field: CustomFormField) => {
    if (!editingForm) return;
    const duplicatedId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicatedField: CustomFormField = {
      ...field,
      id: duplicatedId,
      label: `${field.label} (Cópia)`,
      ordem: field.ordem + 1
    };

    setEditingForm(prev => {
      if (!prev) return null;
      const updated = [...prev.campos, duplicatedField].map((c, idx) => ({ ...c, ordem: idx + 1 }));
      return {
        ...prev,
        campos: updated
      };
    });
    setSelectedFieldId(duplicatedId);
    setIsDirty(true);
  };

  // Reordenar campos para cima
  const handleMoveUp = (index: number) => {
    if (!editingForm || index <= 0) return;
    const updatedCampos = [...editingForm.campos];
    const temp = updatedCampos[index];
    updatedCampos[index] = updatedCampos[index - 1];
    updatedCampos[index - 1] = temp;

    // Atualizar ordem numérica
    const reordered = updatedCampos.map((c, i) => ({ ...c, ordem: i + 1 }));
    setEditingForm(prev => prev ? { ...prev, campos: reordered } : null);
    setIsDirty(true);
  };

  // Reordenar campos para baixo
  const handleMoveDown = (index: number) => {
    if (!editingForm || index >= editingForm.campos.length - 1) return;
    const updatedCampos = [...editingForm.campos];
    const temp = updatedCampos[index];
    updatedCampos[index] = updatedCampos[index + 1];
    updatedCampos[index + 1] = temp;

    // Atualizar ordem numérica
    const reordered = updatedCampos.map((c, i) => ({ ...c, ordem: i + 1 }));
    setEditingForm(prev => prev ? { ...prev, campos: reordered } : null);
    setIsDirty(true);
  };

  // Drag and drop nativo para reordenar dentro da lista
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  const handleFieldDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', `reorder:${index}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFieldIndex(index);
  };

  const handleFieldDropOnIndex = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedFieldIndex === null || !editingForm) return;
    if (draggedFieldIndex === targetIndex) return;

    const list = [...editingForm.campos];
    const [movedItem] = list.splice(draggedFieldIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    const reordered = list.map((item, idx) => ({ ...item, ordem: idx + 1 }));
    setEditingForm(prev => prev ? { ...prev, campos: reordered } : null);
    setIsDirty(true);
    setDraggedFieldIndex(null);
  };

  // Restaurar campos padrão originais do formulário do sistema
  const handleRestoreDefaultFields = () => {
    if (!editingForm) return;
    const defForm = DEFAULT_SYSTEM_FORMS.find(d => d.codigo === editingForm.codigo || d.entidade === editingForm.entidade);
    if (!defForm) {
      showNotification('Nenhum modelo padrão encontrado para este formulário.', 'alerta');
      return;
    }
    setConfirmDialog({
      title: 'Restaurar Campos Padrão',
      message: `Deseja restaurar todos os campos padrão originais de "${editingForm.nome}"? Esta ação restaurará a estrutura padrão completa com todos os campos personalizáveis.`,
      confirmLabel: 'Restaurar Campos',
      onConfirm: () => {
        setEditingForm(prev => prev ? {
          ...prev,
          campos_padrao_inicializados: true,
          campos_padrao_v2_inicializados: true,
          campos: JSON.parse(JSON.stringify(defForm.campos))
        } : null);
        setIsDirty(true);
        setConfirmDialog(null);
        showNotification('Campos padrão restaurados com sucesso!', 'sucesso');
      }
    });
  };

  // Drag over dropzone para adicionar novo campo da paleta
  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverDropzone(false);
    const data = e.dataTransfer.getData('text/plain');

    if (data && data.startsWith('type:')) {
      const tipo = data.replace('type:', '') as CustomFieldTipo;
      handleAddField(tipo);
    }
  };

  // Atualizar propriedades do campo selecionado
  const updateFieldProperty = (fieldId: string, updates: Partial<CustomFormField>) => {
    if (!editingForm) return;
    setEditingForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        campos: prev.campos.map(c => c.id === fieldId ? { ...c, ...updates } : c)
      };
    });
    setIsDirty(true);
  };

  // Salvar formulário no Firestore
  const handleSaveForm = async (targetStatus?: CustomFormStatus) => {
    if (!editingForm) return;
    if (!canEdit) {
      showNotification('Você não tem permissão para salvar formulários.', 'erro');
      return;
    }

    if (!editingForm.nome.trim()) {
      showNotification('O formulário precisa de um nome válido.', 'erro');
      return;
    }

    setIsSaving(true);
    const finalStatus: CustomFormStatus = targetStatus || editingForm.status;
    const updatedForm: CustomForm = {
      ...editingForm,
      campos_padrao_inicializados: true,
      campos_padrao_v2_inicializados: true,
      status: finalStatus,
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'custom_forms', updatedForm.id), updatedForm);
      await invalidateTenantCache(tenantId, ['custom_forms']);
      setForms(prev => prev.map(f => f.id === updatedForm.id ? updatedForm : f));
      setEditingForm(updatedForm);
      setIsDirty(false);
      onFormulariosUpdated?.();

      if (targetStatus === 'ativo') {
        showNotification(`Formulário "${updatedForm.nome}" salvo e activado com sucesso!`, 'sucesso');
      } else if (targetStatus === 'rascunho') {
        showNotification(`Formulário "${updatedForm.nome}" salvo como rascunho.`, 'info');
      } else {
        showNotification(`Formulário "${updatedForm.nome}" salvo com sucesso!`, 'sucesso');
      }
    } catch (err: any) {
      console.error('Erro ao salvar formulário:', err);
      showNotification(`Erro ao salvar formulário: ${err?.message || err}`, 'erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Criar novo formulário customizado
  const handleCreateNewForm = async () => {
    if (!newFormNome.trim()) {
      showNotification('Informe o nome do novo formulário.', 'erro');
      return;
    }

    const newCode = `custom_${Date.now()}`;
    const newFormId = `${tenantId}_${newCode}`;
    const newForm: CustomForm = {
      id: newFormId,
      tenant_id: tenantId,
      codigo: newCode,
      nome: newFormNome.trim(),
      descricao: newFormDescricao.trim() || 'Formulário customizado criado pela instituição.',
      entidade: newFormEntidade,
      status: 'rascunho',
      campos: [
        {
          id: `field_${Date.now()}_1`,
          tipo: 'texto_curto',
          label: 'Campo Inicial',
          placeholder: 'Preencha o campo...',
          obrigatorio: true,
          ordem: 1
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'custom_forms', newFormId), newForm);
      await invalidateTenantCache(tenantId, ['custom_forms']);
      setForms(prev => [newForm, ...prev]);
      onFormulariosUpdated?.();
      setIsNewFormModalOpen(false);
      setNewFormNome('');
      setNewFormDescricao('');
      showNotification(`Novo formulário "${newForm.nome}" criado como rascunho!`, 'sucesso');
      handleStartEdit(newForm);
    } catch (err: any) {
      console.error('Erro ao criar novo formulário:', err);
      showNotification(`Erro ao criar: ${err?.message || err}`, 'erro');
    }
  };

  // Rótulo da entidade
  const getEntityLabel = (entidade: string) => {
    switch (entidade) {
      case 'escola': return 'Escola / Unidade';
      case 'docente': return 'Docentes';
      case 'estudante': return 'Estudantes';
      case 'notas': return 'Lançamento de Notas / Pautas';
      default: return 'Geral';
    }
  };

  // Ícone da entidade
  const getEntityIcon = (entidade: string) => {
    switch (entidade) {
      case 'escola': return Building;
      case 'docente': return Users;
      case 'estudante': return GraduationCap;
      case 'notas': return Award;
      default: return Layers;
    }
  };

  // Cor do status badge
  const getStatusBadge = (status: CustomFormStatus) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Activo
          </span>
        );
      case 'suspenso':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Suspenso
          </span>
        );
      case 'rascunho':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Rascunho
          </span>
        );
    }
  };

  // --------------------------------------------------------------------------
  // MODO DE EDIÇÃO
  // --------------------------------------------------------------------------
  if (editingForm) {
    const activeField = editingForm.campos.find(c => c.id === selectedFieldId);

    return (
      <div className="space-y-6">
        {/* Barra superior de ações do Editor */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Voltar à visão geral"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={editingForm.nome}
                  onChange={(e) => {
                    setEditingForm({ ...editingForm, nome: e.target.value });
                    setIsDirty(true);
                  }}
                  className="font-bold text-base sm:text-lg text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1"
                />
                {getStatusBadge(editingForm.status)}
                {isDirty && (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                    Alterações pendentes
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 px-1 mt-0.5">
                Entidade: <span className="font-semibold text-slate-700 dark:text-slate-300">{getEntityLabel(editingForm.entidade)}</span> · {editingForm.campos.length} campos customizados
              </p>
            </div>
          </div>

          {/* Botões requeridos: descartar, salvar rascunho, salvar, salvar e activar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Descartar alterações
            </button>
            <button
              type="button"
              disabled={isSaving || !canEdit}
              onClick={() => handleSaveForm('rascunho')}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Salvar como rascunho
            </button>
            <button
              type="button"
              disabled={isSaving || !canEdit}
              onClick={() => handleSaveForm()}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar formulário
            </button>
            <button
              type="button"
              disabled={isSaving || !canEdit}
              onClick={() => handleSaveForm('ativo')}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar e activar formulário
            </button>
          </div>
        </div>

        {/* Tab switcher entre Estrutura e Preview */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorTab('estrutura')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                editorTab === 'estrutura'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Estrutura & Drag-and-Drop
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('preview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                editorTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Visualização Ao Vivo (Preview)
            </button>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Arraste os tipos de dados do lado esquerdo para o lado direito
          </span>
        </div>

        {/* Layout Dividido em Dois */}
        {editorTab === 'estrutura' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LADO ESQUERDO: Lista de tipos de dados */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 sticky top-4">
              <div className="border-b border-slate-150 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tipos de Dados Disponíveis
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Arraste para a direita ou clique em + para adicionar
                </p>
              </div>

              <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                {AVAILABLE_FIELD_TYPES.map((typeDef) => {
                  const Icon = typeDef.icon;
                  return (
                    <div
                      key={typeDef.tipo}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `type:${typeDef.tipo}`);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shadow-2xs">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {typeDef.label}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                            {typeDef.descricao}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddField(typeDef.tipo)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                        title="Adicionar ao formulário"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LADO DIREITO: Preview de edição e reordenação */}
            <div className="lg:col-span-8 space-y-4">
              {/* Informação de Customização Total & Ação para Restaurar Campos Padrão */}
              <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Personalização Total de Campos ({editingForm.campos.length} campos)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Todos os campos deste formulário podem ser reordenados por arrastar e soltar, editados, duplicados, renomeados ou excluídos.
                    </p>
                  </div>
                </div>

                {DEFAULT_SYSTEM_FORMS.some(d => d.codigo === editingForm.codigo || d.entidade === editingForm.entidade) && (
                  <button
                    type="button"
                    onClick={handleRestoreDefaultFields}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Campos Padrão
                  </button>
                )}
              </div>

              {/* Área de Soltura / Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setIsDraggingOverDropzone(true);
                }}
                onDragLeave={() => setIsDraggingOverDropzone(false)}
                onDrop={handleDropzoneDrop}
                className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
                  isDraggingOverDropzone
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Campos Customizados ({editingForm.campos.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Arraste para reordenar a sequência
                  </span>
                </div>

                {editingForm.campos.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Nenhum campo customizado adicionado
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Arraste qualquer tipo de dado do painel à esquerda para esta área para compor o formulário.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editingForm.campos.map((campo, index) => {
                      const typeDef = AVAILABLE_FIELD_TYPES.find(t => t.tipo === campo.tipo);
                      const Icon = typeDef?.icon || FileText;
                      const isSelected = selectedFieldId === campo.id;

                      return (
                        <div
                          key={campo.id}
                          draggable
                          onDragStart={(e) => handleFieldDragStart(e, index)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
                              setDragOverIndex(index);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverIndex === index) setDragOverIndex(null);
                          }}
                          onDrop={(e) => handleFieldDropOnIndex(e, index)}
                          className={`rounded-2xl border transition-all ${
                            dragOverIndex === index
                              ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/50 shadow-md scale-[1.01]'
                              : isSelected
                                ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Cabeçalho do Cartão de Campo */}
                          <div className="p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div 
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                                title="Arraste para reordenar a sequência de campos"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {campo.label}
                                  </span>
                                  {campo.obrigatorio && (
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded-sm">
                                      Obrigatório
                                    </span>
                                  )}
                                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                    {campo.largura === '1/2' ? '50% Largura' : '100% Largura'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  Tipo: {typeDef?.label} · Ordem: {campo.ordem}
                                </span>
                              </div>
                            </div>

                            {/* Controles de Ação do Campo */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveUp(index)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === editingForm.campos.length - 1}
                                onClick={() => handleMoveDown(index)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateField(campo)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                title="Duplicar campo"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedFieldId(isSelected ? null : campo.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {isSelected ? 'Concluir' : 'Configurar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(campo.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remover campo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Painel Expansível de Configuração do Campo */}
                          {isSelected && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl space-y-3.5">
                              {/* Alteração Dinâmica do Tipo de Dado e Largura do Campo */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-150 dark:border-slate-800">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    Tipo de Dado do Campo
                                  </label>
                                  <select
                                    value={campo.tipo}
                                    onChange={(e) => {
                                      const novoTipo = e.target.value as CustomFieldTipo;
                                      updateFieldProperty(campo.id, {
                                        tipo: novoTipo,
                                        opcoes: novoTipo === 'dropdown' ? (campo.opcoes || ['Opção 1', 'Opção 2', 'Opção 3']) : undefined,
                                        ddd_padrao: novoTipo === 'telefone_ddd' ? (campo.ddd_padrao || '+258') : undefined,
                                        formatos_permitidos: novoTipo === 'upload_arquivo' ? (campo.formatos_permitidos || ['pdf', 'xlsx']) : undefined
                                      });
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                                  >
                                    {AVAILABLE_FIELD_TYPES.map(t => (
                                      <option key={t.tipo} value={t.tipo}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    Largura no Formulário
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateFieldProperty(campo.id, { largura: '1/2' })}
                                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                        campo.largura === '1/2'
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-250 dark:border-slate-750'
                                      }`}
                                    >
                                      50% (Meia Linha)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateFieldProperty(campo.id, { largura: 'full' })}
                                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                        campo.largura !== '1/2'
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-250 dark:border-slate-750'
                                      }`}
                                    >
                                      100% (Linha Toda)
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    Rótulo do Campo (Label) *
                                  </label>
                                  <input
                                    type="text"
                                    value={campo.label}
                                    onChange={(e) => updateFieldProperty(campo.id, { label: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                </div>

                                {campo.tipo !== 'checkbox' && campo.tipo !== 'titulo' && (
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                      Texto Placeholder / Dica
                                    </label>
                                    <input
                                      type="text"
                                      value={campo.placeholder || ''}
                                      onChange={(e) => updateFieldProperty(campo.id, { placeholder: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                  Texto de Ajuda / Instrução Complementar
                                </label>
                                <input
                                  type="text"
                                  value={campo.texto_ajuda || ''}
                                  placeholder="Orientação exibida logo abaixo do campo..."
                                  onChange={(e) => updateFieldProperty(campo.id, { texto_ajuda: e.target.value })}
                                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </div>

                              {/* Configuração específica: Dropdown (Gerenciador de Opções) */}
                              {campo.tipo === 'dropdown' && (
                                <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800">
                                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Opções do Drop-down
                                  </label>
                                  <div className="space-y-1.5">
                                    {(campo.opcoes || []).map((opcao, opIdx) => (
                                      <div key={opIdx} className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={opcao}
                                          onChange={(e) => {
                                            const updatedOpcoes = [...(campo.opcoes || [])];
                                            updatedOpcoes[opIdx] = e.target.value;
                                            updateFieldProperty(campo.id, { opcoes: updatedOpcoes });
                                          }}
                                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedOpcoes = (campo.opcoes || []).filter((_, i) => i !== opIdx);
                                            updateFieldProperty(campo.id, { opcoes: updatedOpcoes });
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                          title="Excluir opção"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedOpcoes = [...(campo.opcoes || []), `Nova Opção ${(campo.opcoes?.length || 0) + 1}`];
                                      updateFieldProperty(campo.id, { opcoes: updatedOpcoes });
                                    }}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
                                  >
                                    <Plus className="w-3 h-3" /> Adicionar Opção
                                  </button>
                                </div>
                              )}

                              {/* Configuração específica: Telefone com DDD (DDD Padrão) */}
                              {campo.tipo === 'telefone_ddd' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    DDD / Indicativo Padrão
                                  </label>
                                  <select
                                    value={campo.ddd_padrao || '+258'}
                                    onChange={(e) => updateFieldProperty(campo.id, { ddd_padrao: e.target.value })}
                                    className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 cursor-pointer"
                                  >
                                    {COUNTRY_DIALING_CODES.map((item) => (
                                      <option key={item.code} value={item.code}>
                                        {item.code} - {item.country}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Configuração específica: Upload de Ficheiro (Formatos) */}
                              {campo.tipo === 'upload_arquivo' && (
                                <div className="space-y-1.5">
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                    Formatos de Ficheiro Permitidos
                                  </label>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={campo.formatos_permitidos?.includes('pdf') ?? true}
                                        onChange={(e) => {
                                          const current = new Set(campo.formatos_permitidos || ['pdf', 'xlsx']);
                                          if (e.target.checked) current.add('pdf');
                                          else current.delete('pdf');
                                          updateFieldProperty(campo.id, { formatos_permitidos: Array.from(current) as any });
                                        }}
                                        className="rounded-sm text-indigo-600"
                                      />
                                      Documento PDF (.pdf)
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={campo.formatos_permitidos?.includes('xlsx') ?? true}
                                        onChange={(e) => {
                                          const current = new Set(campo.formatos_permitidos || ['pdf', 'xlsx']);
                                          if (e.target.checked) current.add('xlsx');
                                          else current.delete('xlsx');
                                          updateFieldProperty(campo.id, { formatos_permitidos: Array.from(current) as any });
                                        }}
                                        className="rounded-sm text-indigo-600"
                                      />
                                      Planilha Excel (.xlsx, .xls)
                                    </label>
                                  </div>
                                </div>
                              )}

                              {/* Toggle de Obrigatoriedade */}
                              {campo.tipo !== 'titulo' && (
                                <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between">
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                      Preenchimento Obrigatório
                                    </label>
                                    <p className="text-[10px] text-slate-400">
                                      O formulário não poderá ser submetido sem este campo preenchido.
                                    </p>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={campo.obrigatorio}
                                    onChange={(e) => updateFieldProperty(campo.id, { obrigatorio: e.target.checked })}
                                    className="w-4 h-4 rounded-sm text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* MODO PREVIEW AO VIVO */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-6">
            <div className="border-b border-slate-150 dark:border-slate-800 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                Modo Preview Interativo
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {editingForm.nome}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {editingForm.descricao}
              </p>
            </div>

            {/* Renderização real dos campos customizados */}
            <CustomFieldsRenderer
              fields={editingForm.campos}
              values={previewValues}
              onChange={(fieldId, val) => {
                setPreviewValues(prev => ({ ...prev, [fieldId]: val }));
              }}
            />

            <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewValues({})}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Limpar Campos do Preview
              </button>
            </div>
          </div>
        )}
        {/* Modal de Confirmação In-App */}
        {confirmDialog && (
          <div className="fixed inset-0 z-[170000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{confirmDialog.title}</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VISÃO GERAL (LISTAGEM DE FORMULÁRIOS COM FILTRO DINÂMICO)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Pesquisa Dinâmica */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por nome do formulário ou entidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por Entidade */}
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            <option value="todas">Todas as Entidades</option>
            <option value="notas">Lançamento de Notas / Pautas</option>
            <option value="escola">Escolas / Faculdades</option>
            <option value="docente">Docentes / Professores</option>
            <option value="estudante">Estudantes / Alunos</option>
            <option value="outro">Outros Formulários</option>
          </select>

          {/* Filtro por Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Activos</option>
            <option value="suspenso">Suspensos</option>
            <option value="rascunho">Rascunhos</option>
          </select>

          {/* Botão Novo Formulário */}
          <button
            type="button"
            onClick={() => setIsNewFormModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo Formulário
          </button>
        </div>
      </div>

      {/* Listagem de Formulários */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Carregando formulários do sistema...
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Nenhum formulário encontrado
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não há formulários correspondentes aos filtros selecionados. Tente ajustar o termo de pesquisa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredForms.map((form) => {
            const EntityIcon = getEntityIcon(form.entidade);
            const nativeCount = NATIVE_FIELDS_SUMMARY[form.codigo]?.length || 0;
            const customCount = form.campos.length;

            return (
              <div
                key={form.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 p-5 shadow-xs transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <EntityIcon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {getEntityLabel(form.entidade)}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {form.nome}
                        </h4>
                      </div>
                    </div>
                    {getStatusBadge(form.status)}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {form.descricao || 'Sem descrição cadastrada.'}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>
                      {nativeCount > 0 ? `${nativeCount} campos nativos · ` : ''}{customCount} customizados
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {form.codigo}
                    </span>
                  </div>
                </div>

                {/* Botões Requeridos: Editar, Suspensão / Reactivação */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(form)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      form.status === 'ativo'
                        ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/80'
                        : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-800/80'
                    }`}
                    title={form.status === 'ativo' ? 'Suspender formulário' : 'Reactivar formulário'}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {form.status === 'ativo' ? 'Suspender' : 'Reactivar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(form)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Formulário
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: NOVO FORMULÁRIO */}
      {isNewFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Novo Formulário Customizado
              </h3>
              <button
                type="button"
                onClick={() => setIsNewFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Formulário *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ficha Complementar de Saúde"
                  value={newFormNome}
                  onChange={(e) => setNewFormNome(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Entidade Associada
                </label>
                <select
                  value={newFormEntidade}
                  onChange={(e) => setNewFormEntidade(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                >
                  <option value="estudante">Estudantes / Alunos</option>
                  <option value="docente">Docentes / Professores</option>
                  <option value="escola">Escola / Unidade</option>
                  <option value="notas">Lançamento de Notas / Pautas</option>
                  <option value="outro">Outro / Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Objetivo
                </label>
                <textarea
                  rows={3}
                  placeholder="Explique para que serve este formulário..."
                  value={newFormDescricao}
                  onChange={(e) => setNewFormDescricao(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewFormModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewForm}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Criar e Abrir no Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
