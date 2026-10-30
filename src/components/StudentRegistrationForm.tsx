/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Componente Unificado e Responsivo de Matrícula de Estudantes com 4 Níveis de Ensino
 */

import React, { useState } from 'react';
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
  FileCheck
} from 'lucide-react';
import { 
  NivelEnsino, 
  STUDENT_LEVEL_SCHEMAS, 
  StudentLevelSchema,
  StudentFormField
} from '../config/studentFormSchemas';
import { Escola, Turma, User } from '../types';
import { SearchableDropdown } from './SearchableDropdown';

export interface StudentRegistrationFormProps {
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isEditing: boolean;
  schools: Escola[];
  turmas: Turma[];
  tenantUsers: User[];
  allowedLevels?: NivelEnsino[]; // Níveis autorizados para a escola/instituição
  onPhotoUploaded?: (base64: string) => void;
  onPhotoRemoved?: () => void;
}

export const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({
  formData,
  setFormData,
  isEditing,
  schools,
  turmas,
  tenantUsers,
  allowedLevels = ['primario', 'secundario', 'superior', 'profissional'],
  onPhotoUploaded,
  onPhotoRemoved
}) => {
  const currentNivel: NivelEnsino = (formData.nivelEnsino as NivelEnsino) || 'secundario';
  const schema: StudentLevelSchema = STUDENT_LEVEL_SCHEMAS[currentNivel] || STUDENT_LEVEL_SCHEMAS.secundario;

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
      {/* 1. SELETOR / DROPDOWN DE NÍVEL DE ENSINO */}
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
                      : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
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
                <span className="text-xs leading-none block font-bold">✕</span>
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
              Escola / Unidade <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.escola_id || ''}
              disabled={isEditing}
              required
              onChange={(e) => {
                const sId = e.target.value;
                const filteredTurmas = turmas.filter(t => t.escola_id === sId);
                setFormData(prev => ({
                  ...prev,
                  escola_id: sId,
                  turma_id: filteredTurmas[0]?.id || ''
                }));
              }}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-60"
            >
              <option value="">-- Selecionar Escola --</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Turma Destino <span className="text-rose-500">*</span>
            </label>
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
