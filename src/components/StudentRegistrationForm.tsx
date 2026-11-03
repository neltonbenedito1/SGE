/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Componente Unificado e Responsivo de Matrícula de Estudantes com 4 Níveis de Ensino
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
  HelpCircle,
  Clock,
  HeartPulse,
  Home,
  FileCheck,
  X
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
  TipoInstituicao 
} from '../types';
import { isInstitutionCompatibleWithLevel } from '../config/institutionTypes';
import { SearchableDropdown } from './SearchableDropdown';

export interface StudentRegistrationFormProps {
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isEditing: boolean;
  schools: Escola[];
  turmas: Turma[];
  tenantUsers: User[];
  cursos?: Curso[];
  cadeiras?: Cadeira[];
  tenantTipoInstituicao?: TipoInstituicao;
  allowedLevels?: NivelEnsino[]; // Níveis autorizados para a escola/instituição
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
  tenantTipoInstituicao = 'escola',
  allowedLevels = ['primario', 'secundario', 'superior', 'profissional'],
  onPhotoUploaded,
  onPhotoRemoved,
  students = [],
  salas = [],
  isUniversidade = false
}) => {
  const isSingleLevelInstitution = tenantTipoInstituicao !== 'global' && (tenantTipoInstituicao === 'universidade' || tenantTipoInstituicao === 'instituto' || allowedLevels.length <= 1);

  React.useEffect(() => {
    if (isSingleLevelInstitution) {
      let target: NivelEnsino = 'secundario';
      if (tenantTipoInstituicao === 'universidade') target = 'superior';
      else if (tenantTipoInstituicao === 'instituto') target = 'profissional';
      else if (allowedLevels.length > 0) target = allowedLevels[0];

      if (formData.nivelEnsino !== target) {
        setFormData(prev => ({ ...prev, nivelEnsino: target }));
      }
    }
  }, [isSingleLevelInstitution, tenantTipoInstituicao, allowedLevels]);

  const currentNivel: NivelEnsino = (formData.nivelEnsino as NivelEnsino) || 'secundario';
  const schema: StudentLevelSchema = STUDENT_LEVEL_SCHEMAS[currentNivel] || STUDENT_LEVEL_SCHEMAS.secundario;

  // Filtragem estrita de instituições compatíveis com o nível de ensino selecionado (Regra 4.1 e 8.3)
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

  // Selected Turma & Real-time Vacancies (Regra 2.3)
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
    
    // Check same turma in other regime
    const otherRegEnrolled = students.filter(s => {
      if (s.id === formData.id || s.ativo === false) return false;
      return s.turma_id === formData.turma_id && s.regime === otherReg;
    }).length;
    const otherRegVagas = Math.max(0, turmaCapacidade - otherRegEnrolled);
    if (otherRegVagas > 0) {
      suggestions.push(`O regime ${otherReg} possui ${otherRegVagas} vagas disponíveis nesta mesma turma.`);
    }

    // Check other turmas in same school
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

    // Se já existem dados preenchidos além dos básicos, pedir confirmação
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
        // Preserva os dados comuns essenciais
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
    <div className="space-y-6 text-left">
      {/* 1. SELETOR / DROPDOWN DE NÍVEL DE ENSINO (Ocultado quando a instituição tem um único tipo de ensino - Regra 2.1) */}
      {!isSingleLevelInstitution && (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nível de Ensino / Tipo de Matrícula <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Selecione o nível de ensino para carregar o formulário e requisitos oficiais específicos.
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-${schema.badgeColor}-100 text-${schema.badgeColor}-700 border border-${schema.badgeColor}-200 self-start sm:self-auto`}>
              {schema.badgeLabel}
            </span>
          </div>

          {/* Dropdown com os 4 níveis */}
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
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      {lvl === 'primario' && <BookOpen className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-sky-500'}`} />}
                      {lvl === 'secundario' && <GraduationCap className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />}
                      {lvl === 'superior' && <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-purple-500'}`} />}
                      {lvl === 'profissional' && <Wrench className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <span className="block text-xs font-bold leading-tight">{info.title}</span>
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

      {/* 2. FOTOGRAFIA DO ESTUDANTE */}
      <div className="flex flex-col items-center justify-center border-b border-slate-100 dark:border-slate-800 pb-4">
        <label className="block text-xs font-bold text-slate-500 mb-2">Fotografia do Aluno</label>
        <div className="flex flex-col items-center gap-3">
          {formData.foto_url ? (
            <div className="relative group">
              <img 
                src={formData.foto_url} 
                alt="Estudante" 
                className="w-24 h-24 object-cover rounded-full border-2 border-indigo-200 shadow-sm"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => {
                  updateField('foto_url', '');
                  if (onPhotoRemoved) onPhotoRemoved();
                }}
                className="absolute -top-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1.5 shadow-md transition-all cursor-pointer"
                title="Remover Fotografia"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-full flex flex-col items-center justify-center text-slate-400">
              <UserIcon className="w-8 h-8 text-slate-300" />
              <span className="text-[9px] mt-1 font-bold uppercase text-slate-400">Sem Foto</span>
            </div>
          )}
          
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
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <Upload className="w-3 h-3 text-slate-400" /> Carregar Foto
            </label>
          </div>
        </div>
      </div>

      {/* 3. DADOS DE ENQUADRAMENTO ESCOLAR / TURMA (Vínculo multi-tenant essencial) */}
      <div className="bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <Building2 className="w-4 h-4" /> Alocação Institucional & Turma
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
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
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-60"
            >
              <option value="">-- Selecionar Instituição Compatível --</option>
              {compatibleSchools.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} {s.tipo_instituicao ? `(${s.tipo_instituicao})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Filtrado estritamente para o nível {currentNivel}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
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
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-60"
            >
              <option value="">-- Selecionar Curso / Qualificação --</option>
              {availableCursos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.codigo}) — {c.grau || c.tipo}
                </option>
              ))}
            </select>

            {/* Quick interactive course selector cards with contrast-adjusted hover (theme aware) */}
            {availableCursos.length > 0 && !isEditing && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableCursos.slice(0, 6).map(c => {
                  const isSelected = formData.curso_id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        const cCadeiras = cadeiras.filter(cad => cad.cursoId === c.id);
                        const firstPeriodName = cCadeiras[0]?.periodo_lectivo || '1º Semestre';
                        const firstPeriodCadeiras = cCadeiras.filter(cad => 
                          cad.periodo_lectivo === firstPeriodName && cad.tipo_disciplina === 'obrigatoria'
                        );
                        setFormData(prev => ({
                          ...prev,
                          curso_id: c.id,
                          curso: c.nome,
                          curso_nome: c.nome,
                          primeiro_periodo_cadeiras_ids: firstPeriodCadeiras.map(x => x.id)
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-indigo-50/70 dark:hover:bg-slate-800/90 hover:border-indigo-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          {c.codigo || 'CURSO'}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.grau || c.tipo}
                        </span>
                      </div>
                      <p className={`text-xs font-bold mt-1 line-clamp-1 transition-colors ${
                        isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {c.nome}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Regime de Estudos (Diurno / Nocturno) - Regra 2.3 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Regime de Estudos <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.regime || 'Diurno'}
              onChange={(e) => updateField('regime', e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold"
            >
              <option value="Diurno">Diurno</option>
              <option value="Nocturno">Nocturno</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                Turma Destino <span className="text-rose-500">*</span>
              </label>
              {formData.turma_id && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isLotacaoEsgotada 
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' 
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}>
                  {isLotacaoEsgotada ? '0 Vagas Disponíveis' : `${vagasDisponiveis} vagas disponíveis (Lotação: ${enrolledCount}/${turmaCapacidade})`}
                </span>
              )}
            </div>
            <select
              value={formData.turma_id || ''}
              disabled={isEditing || !formData.escola_id}
              required
              onChange={(e) => updateField('turma_id', e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-60"
            >
              <option value="">-- Selecionar Turma --</option>
              {turmas
                .filter(t => t.escola_id === formData.escola_id)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
            </select>

            {/* Aviso de Lotação Esgotada com Sugestão de Alternativas (Regra 2.3) */}
            {isLotacaoEsgotada && (
              <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1.5 text-xs text-rose-800 dark:text-rose-200">
                <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Vagas esgotadas para a combinação selecionada
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-300">
                  Esta turma atingiu a capacidade máxima ({turmaCapacidade} alunos) no regime {formData.regime || 'Diurno'}.
                </p>
                {alternativeSuggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-rose-200/80 dark:border-rose-800 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                    <span className="font-bold text-slate-900 dark:text-white block">Alternativas sugeridas com vagas disponíveis:</span>
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

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Nº de Matrícula <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.numero_matricula || ''}
              onChange={(e) => updateField('numero_matricula', e.target.value)}
              placeholder="Ex: 2026-MAT-001"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <SearchableDropdown
              label="Encarregado / Responsável Vinculado"
              placeholder="Selecione o responsável..."
              searchPlaceholder="Pesquisar por nome ou e-mail..."
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

        {/* PLANO CURRICULAR EM FORMATO DE ACORDEÃO INTERATIVO (Regra 8.3) */}
        {selectedCurso && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Plano Curricular & Grade de Disciplinas &bull; {selectedCurso.nome}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Estrutura curricular oficial agrupada por períodos. O estudante será matriculado automaticamente no 1º período.
                </p>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 self-start sm:self-auto flex items-center gap-1">
                <Check className="w-3 h-3" /> Auto-inscrição Activa no 1º Período
              </span>
            </div>

            {selectedCursoCadeiras.length === 0 ? (
              <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl text-center text-xs text-slate-400">
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
                      className={`rounded-xl border transition-all ${
                        isFirstPeriod 
                          ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePeriodAccordion(period)}
                        className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                            {period} ({cadList.length} Disciplinas)
                          </span>
                          {isFirstPeriod && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.2 rounded-full bg-indigo-600 text-white">
                              1º Período &bull; Inscrição Automática
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {totalCreditsPeriod > 0 && <span className="font-mono text-[10px]">{totalCreditsPeriod} ECTS</span>}
                          <span>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/60 divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                          {cadList.map(cad => (
                            <div key={cad.id} className="py-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900">
                                  {cad.codigo}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{cad.nome}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {cad.creditos_ects && (
                                  <span className="text-[10px] font-mono text-slate-400">{cad.creditos_ects} ECTS</span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  cad.tipo_disciplina === 'obrigatoria' 
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' 
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
      {schema.sections.map((section) => {
        return (
          <div key={section.id} className="space-y-4 pt-2 border-t border-slate-150 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {section.title}
              </h4>
              {section.description && (
                <p className="text-[11px] text-slate-400 mt-0.5">{section.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.filter(isFieldVisible).map((field) => {
                const required = isFieldRequired(field);
                const colSpanClass = field.colSpan === 2 ? 'sm:col-span-2' : '';

                if (field.type === 'checkbox') {
                  return (
                    <div key={field.id} className={`flex items-center gap-2.5 ${colSpanClass}`}>
                      <input
                        type="checkbox"
                        id={`field_${field.id}`}
                        checked={!!formData[field.id]}
                        onChange={(e) => updateField(field.id, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor={`field_${field.id}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                    </div>
                  );
                }

                if (field.type === 'select') {
                  return (
                    <div key={field.id} className={colSpanClass}>
                      <label htmlFor={`field_${field.id}`} className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        id={`field_${field.id}`}
                        value={formData[field.id] || ''}
                        required={required}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                    <div key={field.id} className={colSpanClass}>
                      <label htmlFor={`field_${field.id}`} className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {field.label} {required && <span className="text-rose-500">*</span>}
                      </label>
                      <textarea
                        id={`field_${field.id}`}
                        rows={2}
                        value={formData[field.id] || ''}
                        required={required}
                        placeholder={field.placeholder}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  );
                }

                return (
                  <div key={field.id} className={colSpanClass}>
                    <label htmlFor={`field_${field.id}`} className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {field.label} {required && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      id={`field_${field.id}`}
                      type={field.type}
                      required={required}
                      placeholder={field.placeholder}
                      value={formData[field.id] || ''}
                      onChange={(e) => updateField(field.id, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 5. OPÇÕES DE COBRANÇA E ACESSO AO PORTAL */}
      <div className="border-t border-slate-150 dark:border-slate-800 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox"
              id="student_faturado_cb"
              checked={!!formData.faturado}
              onChange={(e) => updateField('faturado', e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="student_faturado_cb" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              Estudante Faturado (Gera cobranças e propinas)
            </label>
          </div>
          {formData.faturado && (
            <select 
              value={formData.periodo_facturacao || 'Mensal'}
              onChange={(e) => updateField('periodo_facturacao', e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="Mensal">Mensal</option>
              <option value="Semestral">Semestral</option>
              <option value="Anual">Anual</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="checkbox"
            id="student_usuario_cb"
            checked={!!formData.usuario_sistema}
            onChange={(e) => updateField('usuario_sistema', e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="student_usuario_cb" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            Habilitar Acesso do Estudante ao Portal
          </label>
        </div>

        {formData.usuario_sistema && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Senha Temporária de Primeiro Acesso
            </label>
            <input
              type="text"
              required={formData.usuario_sistema}
              placeholder="Defina uma senha provisória"
              value={formData.senha_temporaria || ''}
              onChange={(e) => updateField('senha_temporaria', e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE MUDANÇA DE NÍVEL */}
      {confirmSwitchModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Alterar Nível de Ensino?
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Você já preencheu campos neste formulário. Ao trocar de nível para <strong>{STUDENT_LEVEL_SCHEMAS[confirmSwitchModal.targetLevel!]?.title}</strong>, os campos específicos do nível anterior que não se aplicam serão limpos. Os dados pessoais comuns (nome, nascimento, residência) serão preservados.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSwitchModal({ isOpen: false, targetLevel: null })}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSwitch}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 cursor-pointer"
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
