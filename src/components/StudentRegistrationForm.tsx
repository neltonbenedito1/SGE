/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Componente Unificado e Responsivo de Matrícula de Estudantes - Redesign Minimalista Dark Slate
 */

import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Building2, 
  Wrench, 
  AlertCircle, 
  Check, 
  Upload, 
  User as UserIcon,
  ChevronDown,
  X,
  Sparkles
} from 'lucide-react';
import { 
  NivelEnsino, 
  STUDENT_LEVEL_SCHEMAS, 
  StudentLevelSchema,
  StudentFormField
} from '../config/studentFormSchemas';
import { 
  Escola, 
  Turma, 
  User, 
  Curso, 
  Cadeira, 
  TipoInstituicao,
  CustomFormField 
} from '../types';
import { isInstitutionCompatibleWithLevel } from '../config/institutionTypes';
import { SearchableDropdown } from './SearchableDropdown';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';

export interface StudentRegistrationFormProps {
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isEditing: boolean;
  schools: Escola[];
  turmas: Turma[];
  tenantUsers: User[];
  cursos?: Curso[];
  cadeiras?: Cadeira[];
  customFields?: CustomFormField[];
  tenantTipoInstituicao?: TipoInstituicao;
  allowedLevels?: NivelEnsino[];
  onPhotoUploaded?: (base64: string) => void;
  onPhotoRemoved?: () => void;
  students?: any[];
  salas?: any[];
  isUniversidade?: boolean;
}

export const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({
  formData,
  setFormData,
  isEditing,
  schools,
  turmas,
  tenantUsers,
  cursos = [],
  cadeiras = [],
  customFields = [],
  tenantTipoInstituicao = 'escola',
  allowedLevels = ['primario', 'secundario', 'superior', 'profissional'],
  onPhotoUploaded,
  onPhotoRemoved,
  students = [],
  salas = [],
  isUniversidade = false
}) => {
  // Seletor de nível de ensino estritamente ocultado para instituições com tipo único
  // Só aparece se for Global com múltiplos níveis configurados
  const isSingleLevelInstitution = tenantTipoInstituicao !== 'global';

  React.useEffect(() => {
    if (isSingleLevelInstitution) {
      let target: NivelEnsino = 'secundario';
      if (tenantTipoInstituicao === 'universidade') target = 'superior';
      else if (tenantTipoInstituicao === 'instituto') target = 'profissional';
      else if (tenantTipoInstituicao === 'escola') {
        target = allowedLevels.includes('secundario') ? 'secundario' : (allowedLevels[0] || 'secundario');
      } else if (allowedLevels.length > 0) {
        target = allowedLevels[0];
      }

      if (formData.nivelEnsino !== target) {
        setFormData(prev => ({ ...prev, nivelEnsino: target }));
      }
    }
  }, [isSingleLevelInstitution, tenantTipoInstituicao, allowedLevels, formData.nivelEnsino, setFormData]);

  const currentNivel: NivelEnsino = (formData.nivelEnsino as NivelEnsino) || (
    tenantTipoInstituicao === 'universidade' ? 'superior' :
    tenantTipoInstituicao === 'instituto' ? 'profissional' : 'secundario'
  );
  
  const schema: StudentLevelSchema = STUDENT_LEVEL_SCHEMAS[currentNivel] || STUDENT_LEVEL_SCHEMAS.secundario;

  // Filtragem estrita de instituições compatíveis com o nível de ensino selecionado
  const compatibleSchools = useMemo(() => {
    const list = schools.filter(s => {
      const sType: TipoInstituicao = 
        (s as any).tipoInstituicao || 
        (s.tipo_instituicao === 'Faculdade' ? 'universidade' : 
         s.tipo_instituicao === 'Instituto' ? 'instituto' : 
         tenantTipoInstituicao === 'global' ? 'global' :
         tenantTipoInstituicao || 'escola');
      return isInstitutionCompatibleWithLevel(sType, currentNivel);
    });
    return list.length > 0 ? list : schools;
  }, [schools, currentNivel, tenantTipoInstituicao]);

  // Cursos disponíveis para a instituição selecionada
  const availableCursos = useMemo(() => {
    if (!formData.escola_id) return cursos;
    return cursos.filter(c => !c.institutionId || c.institutionId === formData.escola_id);
  }, [cursos, formData.escola_id]);

  // Curso selecionado
  const selectedCurso = useMemo(() => {
    return cursos.find(c => c.id === formData.curso_id);
  }, [cursos, formData.curso_id]);

  // Cadeiras do curso selecionado
  const selectedCursoCadeiras = useMemo(() => {
    if (!formData.curso_id) return [];
    return cadeiras.filter(c => c.cursoId === formData.curso_id);
  }, [cadeiras, formData.curso_id]);

  // Agrupamento por período lectivo
  const cadeirasByPeriod = useMemo(() => {
    return selectedCursoCadeiras.reduce((acc, cad) => {
      const p = cad.periodo_lectivo || '1º Período';
      if (!acc[p]) acc[p] = [];
      acc[p].push(cad);
      return acc;
    }, {} as Record<string, Cadeira[]>);
  }, [selectedCursoCadeiras]);

  // Turma selecionada e cálculo em tempo real de lotação e vagas
  const selectedTurma = useMemo(() => {
    return turmas.find(t => t.id === formData.turma_id);
  }, [turmas, formData.turma_id]);

  const turmaCapacidade = useMemo(() => {
    if (!selectedTurma) return 30;
    if ((selectedTurma as any).capacidade) return Number((selectedTurma as any).capacidade);
    if (salas && (selectedTurma as any).sala) {
      const s = salas.find(r => r.nome?.toLowerCase().trim() === (selectedTurma as any).sala?.toLowerCase().trim());
      if (s?.capacidade) return Number(s.capacidade);
    }
    return 30;
  }, [selectedTurma, salas]);

  const enrolledCount = useMemo(() => {
    if (!formData.turma_id || !students || students.length === 0) return 0;
    const reg = formData.regime || 'Diurno';
    return students.filter(s => {
      if (s.id === formData.id) return false;
      if (s.ativo === false) return false;
      if (s.turma_id !== formData.turma_id) return false;
      if (s.regime && s.regime !== reg) return false;
      return true;
    }).length;
  }, [students, formData.turma_id, formData.regime, formData.id]);

  const vagasDisponiveis = Math.max(0, turmaCapacidade - enrolledCount);
  const isLotacaoEsgotada = !!formData.turma_id && vagasDisponiveis <= 0;

  const alternativeSuggestions = useMemo(() => {
    if (!isLotacaoEsgotada || !students) return [];
    const suggestions: string[] = [];
    const currentReg = formData.regime || 'Diurno';
    const otherReg = currentReg === 'Diurno' ? 'Nocturno' : 'Diurno';
    
    // Verificar mesma turma em outro turno
    const otherRegEnrolled = students.filter(s => {
      if (s.id === formData.id || s.ativo === false) return false;
      return s.turma_id === formData.turma_id && s.regime === otherReg;
    }).length;
    const otherRegVagas = Math.max(0, turmaCapacidade - otherRegEnrolled);
    if (otherRegVagas > 0) {
      suggestions.push(`O regime ${otherReg} possui ${otherRegVagas} vagas disponíveis nesta mesma turma.`);
    }

    // Verificar outras turmas na mesma escola
    const otherTurmas = turmas.filter(t => t.id !== formData.turma_id && (!formData.escola_id || t.escola_id === formData.escola_id));
    for (const ot of otherTurmas.slice(0, 2)) {
      const cap = Number((ot as any).capacidade) || 30;
      const enr = students.filter(s => s.id !== formData.id && s.ativo !== false && s.turma_id === ot.id && (!s.regime || s.regime === currentReg)).length;
      const v = Math.max(0, cap - enr);
      if (v > 0) {
        suggestions.push(`A turma "${ot.nome}" possui ${v} vagas livres no regime ${currentReg}.`);
      }
    }
    return suggestions;
  }, [isLotacaoEsgotada, students, formData.turma_id, formData.regime, formData.escola_id, turmaCapacidade, turmas, formData.id]);

  const [expandedCurricularPeriods, setExpandedCurricularPeriods] = useState<string[]>([]);
  const togglePeriodAccordion = (period: string) => {
    setExpandedCurricularPeriods(prev => 
      prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]
    );
  };

  const [confirmSwitchModal, setConfirmSwitchModal] = useState<{
    isOpen: boolean;
    targetLevel: NivelEnsino | null;
  }>({
    isOpen: false,
    targetLevel: null
  });

  const handleLevelChange = (newLevel: NivelEnsino) => {
    if (newLevel === currentNivel) return;

    const hasData = Object.keys(formData).some(k => 
      !['nivelEnsino', 'escola_id', 'turma_id', 'ano_lectivo', 'genero'].includes(k) && !!formData[k]
    );

    if (hasData) {
      setConfirmSwitchModal({ isOpen: true, targetLevel: newLevel });
    } else {
      setFormData(prev => ({ ...prev, nivelEnsino: newLevel }));
    }
  };

  const confirmSwitch = () => {
    if (confirmSwitchModal.targetLevel) {
      setFormData(prev => ({
        nome: prev.nome || '',
        data_nascimento: prev.data_nascimento || '',
        genero: prev.genero || 'Masculino',
        escola_id: prev.escola_id || '',
        turma_id: prev.turma_id || '',
        numero_matricula: prev.numero_matricula || '',
        foto_url: prev.foto_url || '',
        nacionalidade: prev.nacionalidade || 'Moçambicana',
        residencia_provincia: prev.residencia_provincia || '',
        residencia_distrito: prev.residencia_distrito || '',
        residencia_bairro: prev.residencia_bairro || '',
        contacto_emergencia_nome: prev.contacto_emergencia_nome || '',
        contacto_emergencia_telefone: prev.contacto_emergencia_telefone || '',
        nivelEnsino: confirmSwitchModal.targetLevel,
        faturado: prev.faturado,
        periodo_facturacao: prev.periodo_facturacao,
        usuario_sistema: prev.usuario_sistema,
        senha_temporaria: prev.senha_temporaria
      }));
    }
    setConfirmSwitchModal({ isOpen: false, targetLevel: null });
  };

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const isFieldRequired = (field: StudentFormField): boolean => {
    if (field.requiredCondition) {
      return field.requiredCondition(formData);
    }
    return !!field.required;
  };

  const isFieldVisible = (field: StudentFormField): boolean => {
    if (field.visibilityCondition) {
      return field.visibilityCondition(formData);
    }
    return true;
  };

  return (
    <div className="space-y-8 text-left text-slate-100">
      {/* 0. SELETOR DE NÍVEL DE ENSINO (Apenas para instituições Globais com mais de um tipo de ensino) */}
      {!isSingleLevelInstitution && (
        <div className="bg-[#0e1422]/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-200">
                Nível de Ensino / Tipo de Matrícula <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Selecione o nível de ensino para carregar os requisitos curriculares correspondentes.
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 self-start sm:self-auto">
              {schema.badgeLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(['primario', 'secundario', 'superior', 'profissional'] as NivelEnsino[])
              .filter(lvl => allowedLevels.includes(lvl))
              .map((lvl) => {
                const info = STUDENT_LEVEL_SCHEMAS[lvl];
                const isSelected = currentNivel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleLevelChange(lvl)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-[#090d16] text-slate-300 border-slate-800 hover:border-indigo-500/50 hover:bg-[#131b2e]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      {lvl === 'primario' && <BookOpen className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-sky-400'}`} />}
                      {lvl === 'secundario' && <GraduationCap className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />}
                      {lvl === 'superior' && <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-purple-400'}`} />}
                      {lvl === 'profissional' && <Wrench className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <span className="block text-xs font-semibold leading-tight">{info.title}</span>
                      <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {info.badgeLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 1. SEÇÃO DE FOTOGRAFIA DO ALUNO */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#0e1422]/50 border border-slate-800/50">
        <div className="relative group">
          {formData.foto_url ? (
            <div className="relative">
              <img 
                src={formData.foto_url} 
                alt="Estudante" 
                className="w-20 h-20 object-cover rounded-full border-2 border-indigo-500/60 shadow-inner"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => {
                  updateField('foto_url', '');
                  if (onPhotoRemoved) onPhotoRemoved();
                }}
                className="absolute -top-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md transition-all cursor-pointer"
                title="Remover Fotografia"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700 flex flex-col items-center justify-center bg-[#090d16] text-slate-400 shadow-inner overflow-hidden">
              <UserIcon className="w-6 h-6 mb-1 text-slate-500" />
              <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Sem Foto</span>
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fotografia do Aluno</h2>
          <p className="text-xs text-slate-500">Carregue uma imagem em formato PNG ou JPG com pelo menos 400x400px.</p>
          <div>
            <input 
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    updateField('foto_url', base64);
                    if (onPhotoUploaded) onPhotoUploaded(base64);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="student-photo-dynamic-input"
            />
            <label 
              htmlFor="student-photo-dynamic-input"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Carregar Foto
            </label>
          </div>
        </div>
      </div>

      {/* 2. ALOCAÇÃO INSTITUCIONAL & TURMA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-indigo-400">Alocação Institucional & Turma</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Instituição / Unidade de Ensino */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Instituição / Unidade de Ensino <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.escola_id || ''}
              disabled={isEditing}
              required
              onChange={(e) => {
                const sId = e.target.value;
                const selectedSch = schools.find(s => s.id === sId);
                const filteredTurmas = turmas.filter(t => t.escola_id === sId);
                const filteredCursos = cursos.filter(c => !c.institutionId || c.institutionId === sId);
                const firstCurso = filteredCursos[0];
                setFormData(prev => ({
                  ...prev,
                  escola_id: sId,
                  faculdade_departamento: selectedSch?.nome || prev.faculdade_departamento || '',
                  turma_id: filteredTurmas[0]?.id || '',
                  curso_id: firstCurso?.id || '',
                  curso: firstCurso?.nome || prev.curso || '',
                  curso_nome: firstCurso?.nome || prev.curso_nome || ''
                }));
              }}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60"
            >
              <option value="">-- Selecionar Instituição Compatível --</option>
              {compatibleSchools.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} {s.tipo_instituicao ? `(${s.tipo_instituicao})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Filtrado estritamente para o nível {currentNivel}.
            </p>
          </div>

          {/* Curso / Qualificação Formativa */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Curso / Qualificação Formativa {availableCursos.length > 0 && <span className="text-rose-500">*</span>}
            </label>
            <select
              value={formData.curso_id || ''}
              disabled={isEditing}
              onChange={(e) => {
                const cId = e.target.value;
                const cCadeiras = cadeiras.filter(cad => cad.cursoId === cId);
                const firstPeriodName = cCadeiras[0]?.periodo_lectivo || '1º Semestre';
                const firstPeriodCadeiras = cCadeiras.filter(cad => 
                  cad.periodo_lectivo === firstPeriodName && cad.tipo_disciplina === 'obrigatoria'
                );
                const foundCurso = availableCursos.find(c => c.id === cId);
                setFormData(prev => ({
                  ...prev,
                  curso_id: cId,
                  curso: foundCurso?.nome || '',
                  curso_nome: foundCurso?.nome || '',
                  primeiro_periodo_cadeiras_ids: firstPeriodCadeiras.map(c => c.id)
                }));
              }}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60"
            >
              <option value="">-- Selecionar Curso / Qualificação --</option>
              {availableCursos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.codigo}) — {c.grau || c.tipo}
                </option>
              ))}
            </select>

            {/* Selected Course Indicator Pill / Tag (Replaces redundant floating cards) */}
            {selectedCurso && (
              <div className="pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span className="font-mono text-indigo-400 font-semibold">{selectedCurso.codigo || 'CURSO'}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">{selectedCurso.grau || selectedCurso.tipo || 'Curso'}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 font-medium truncate max-w-[200px]">{selectedCurso.nome}</span>
                </div>
              </div>
            )}
          </div>

          {/* Regime de Estudos */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Regime de Estudos <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.regime || 'Diurno'}
              onChange={(e) => updateField('regime', e.target.value)}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            >
              <option value="Diurno">Diurno</option>
              <option value="Nocturno">Nocturno</option>
              <option value="Pós-Laboral">Pós-Laboral</option>
            </select>
          </div>

          {/* Turma Destino */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300">
                Turma Destino <span className="text-rose-500">*</span>
              </label>
              {formData.turma_id && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  isLotacaoEsgotada 
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLotacaoEsgotada ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
                  {isLotacaoEsgotada ? '0 vagas disponíveis' : `${vagasDisponiveis} vagas disponíveis (Lotação: ${enrolledCount}/${turmaCapacidade})`}
                </span>
              )}
            </div>
            <select
              value={formData.turma_id || ''}
              disabled={isEditing || !formData.escola_id}
              required
              onChange={(e) => updateField('turma_id', e.target.value)}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60"
            >
              <option value="">-- Selecionar Turma --</option>
              {turmas
                .filter(t => t.escola_id === formData.escola_id)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
            </select>

            {/* Aviso e Alternativas de Lotação Esgotada */}
            {isLotacaoEsgotada && (
              <div className="mt-2 p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl space-y-1.5 text-xs text-rose-200">
                <div className="font-semibold flex items-center gap-1.5 text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Vagas esgotadas para a combinação selecionada
                </div>
                <p className="text-[11px] text-rose-300">
                  Esta turma atingiu a capacidade máxima ({turmaCapacidade} alunos) no regime {formData.regime || 'Diurno'}.
                </p>
                {alternativeSuggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-rose-900/60 text-[11px] text-slate-300 space-y-1">
                    <span className="font-semibold text-white block">Alternativas sugeridas com vagas disponíveis:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {alternativeSuggestions.map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nº de Matrícula */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Nº de Matrícula <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.numero_matricula || ''}
              onChange={(e) => updateField('numero_matricula', e.target.value)}
              placeholder="Ex: 2026-MAT-001"
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Encarregado / Responsável Vinculado */}
          <div className="space-y-1.5">
            <SearchableDropdown
              label="Encarregado / Responsável Vinculado"
              placeholder="Selecione o responsável vinculado..."
              searchPlaceholder="Pesquisar por nome ou e-mail..."
              theme="dark"
              value={formData.pai_id || ''}
              options={tenantUsers
                .filter((u: any) => !formData.escola_id || !u.escola_id || u.escola_id === formData.escola_id)
                .map((u: any) => ({
                  value: u.id,
                  label: `${u.nome || u.email} (${u.tipo || 'Utilizador'}${u.email ? ` - ${u.email}` : ''})`
                }))
              }
              onChange={(val) => updateField('pai_id', val)}
            />
          </div>
        </div>

        {/* 3. PLANO CURRICULAR & GRADE DE DISCIPLINAS */}
        {selectedCurso && (
          <div className="mt-6 pt-5 border-t border-slate-800/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-300 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  Plano Curricular &bull; {selectedCurso.nome.toUpperCase()}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Grade formativa oficial. O estudante será pré-inscrito nas disciplinas do 1º período.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 self-start sm:self-auto">
                <Check className="w-3.5 h-3.5" /> Auto-inscrição Activa no 1º Período
              </span>
            </div>

            {selectedCursoCadeiras.length === 0 ? (
              <div className="p-4 bg-[#0e1422]/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                Nenhuma disciplina cadastrada na grade curricular deste curso ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(cadeirasByPeriod).map(([period, cadListRaw], idx) => {
                  const cadList = cadListRaw as Cadeira[];
                  const isFirstPeriod = idx === 0;
                  const isExpanded = expandedCurricularPeriods.includes(period) || isFirstPeriod;
                  const totalCreditsPeriod = cadList.reduce((acc, c) => acc + (c.creditos_ects || 0), 0);

                  return (
                    <div 
                      key={period} 
                      className="border border-slate-800 rounded-xl overflow-hidden bg-[#0e1422]/60"
                    >
                      <button
                        type="button"
                        onClick={() => togglePeriodAccordion(period)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-200">
                            {period} ({cadList.length} Disciplinas)
                          </span>
                          {isFirstPeriod && (
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-indigo-600 text-white">
                              1º Período • Inscrição Automática
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {totalCreditsPeriod > 0 && (
                            <span className="font-mono text-xs text-slate-400 font-medium">
                              {totalCreditsPeriod} ECTS
                            </span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 divide-y divide-slate-800/40">
                          {cadList.map(cad => (
                            <div 
                              key={cad.id} 
                              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#131b2e]/40 px-2 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[11px] font-medium border border-indigo-900/50">
                                  {cad.codigo || 'DISC'}
                                </span>
                                <span className="font-medium text-slate-200">{cad.nome}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {cad.creditos_ects && (
                                  <span className="font-mono text-slate-400 text-[11px]">{cad.creditos_ects} ECTS</span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  cad.tipo_disciplina === 'obrigatoria' 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                  {cad.tipo_disciplina === 'obrigatoria' ? 'Obrigatória' : 'Opcional'}
                                </span>
                              </div>
                            </div>
                          ))}
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

      {/* 4. SEÇÕES DINÂMICAS DO ESQUEMA ESPECÍFICO */}
      {schema.sections.map((section, sIdx) => {
        const sectionLetter = String.fromCharCode(65 + sIdx); // 'A', 'B', 'C', ...
        return (
          <div key={section.id} className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <span className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                {sectionLetter}
              </span>
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                {section.title}
              </h3>
            </div>
            {section.description && (
              <p className="text-[11px] text-slate-500 -mt-2">{section.description}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.filter(isFieldVisible).map((field) => {
                const required = isFieldRequired(field);
                const colSpanClass = field.colSpan === 2 ? 'sm:col-span-2' : '';

                if (field.type === 'checkbox') {
                  return (
                    <div key={field.id} className={`flex items-center gap-2.5 ${colSpanClass} pt-2`}>
                      <input
                        type="checkbox"
                        id={`field_${field.id}`}
                        checked={!!formData[field.id]}
                        onChange={(e) => updateField(field.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-[#090d16] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <label htmlFor={`field_${field.id}`} className="text-xs font-medium text-slate-300 cursor-pointer select-none">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                    </div>
                  );
                }

                if (field.type === 'select') {
                  return (
                    <div key={field.id} className={`space-y-1.5 ${colSpanClass}`}>
                      <label htmlFor={`field_${field.id}`} className="block text-xs font-medium text-slate-300">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        id={`field_${field.id}`}
                        value={formData[field.id] || ''}
                        required={required}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                      >
                        <option value="">-- Selecionar --</option>
                        {field.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={field.id} className={`space-y-1.5 ${colSpanClass}`}>
                      <label htmlFor={`field_${field.id}`} className="block text-xs font-medium text-slate-300">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                      <textarea
                        id={`field_${field.id}`}
                        rows={2}
                        value={formData[field.id] || ''}
                        required={required}
                        placeholder={field.placeholder}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                      />
                    </div>
                  );
                }

                return (
                  <div key={field.id} className={`space-y-1.5 ${colSpanClass}`}>
                    <label htmlFor={`field_${field.id}`} className="block text-xs font-medium text-slate-300">
                      {field.label} {required && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      id={`field_${field.id}`}
                      type={field.type}
                      required={required}
                      placeholder={field.placeholder}
                      value={formData[field.id] || ''}
                      onChange={(e) => updateField(field.id, e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 5. OPÇÕES DE COBRANÇA E ACESSO AO PORTAL */}
      <div className="p-4 rounded-xl bg-[#0e1422]/50 border border-slate-800/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox"
              id="student_faturado_cb"
              checked={!!formData.faturado}
              onChange={(e) => updateField('faturado', e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-[#090d16] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-200">
              Estudante Faturado (Gera cobranças e propinas periódicas)
            </span>
          </label>
          {formData.faturado && (
            <select 
              value={formData.periodo_facturacao || 'Mensal'}
              onChange={(e) => updateField('periodo_facturacao', e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="Mensal">Mensal</option>
              <option value="Semestral">Semestral</option>
              <option value="Anual">Anual</option>
            </select>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800/40">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox"
              id="student_usuario_cb"
              checked={!!formData.usuario_sistema}
              onChange={(e) => updateField('usuario_sistema', e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-[#090d16] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-200">
              Habilitar Acesso do Estudante ao Portal Académico
            </span>
          </label>
        </div>

        {formData.usuario_sistema && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Senha Temporária de Primeiro Acesso
            </label>
            <input
              type="text"
              required={formData.usuario_sistema}
              placeholder="Defina uma senha provisória"
              value={formData.senha_temporaria || ''}
              onChange={(e) => updateField('senha_temporaria', e.target.value)}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        )}
      </div>

      {/* CAMPOS PERSONALIZADOS DO FORMULÁRIO DE ESTUDANTE */}
      {customFields && customFields.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Campos Personalizados do Estudante
            </h3>
          </div>
          <CustomFieldsRenderer
            fields={customFields}
            values={formData.dados_customizados || {}}
            onChange={(fieldId, val) => {
              setFormData(prev => ({
                ...prev,
                dados_customizados: {
                  ...(prev.dados_customizados || {}),
                  [fieldId]: val
                }
              }));
            }}
          />
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE MUDANÇA DE NÍVEL */}
      {confirmSwitchModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#05070b]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101b] p-6 rounded-2xl max-w-md w-full border border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-semibold text-slate-100">
                Alterar Nível de Ensino?
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Você já preencheu campos neste formulário. Ao trocar de nível para <strong className="text-slate-200">{STUDENT_LEVEL_SCHEMAS[confirmSwitchModal.targetLevel!]?.title}</strong>, os campos específicos do nível anterior que não se aplicam serão limpos. Os dados pessoais comuns (nome, nascimento, residência) serão preservados.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSwitchModal({ isOpen: false, targetLevel: null })}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSwitch}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition cursor-pointer"
              >
                Confirmar e Alterar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
