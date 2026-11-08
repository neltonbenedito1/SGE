/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FileText, 
  UploadCloud, 
  Trash2, 
  Phone, 
  Check, 
  Calendar, 
  Hash, 
  ChevronDown, 
  Camera, 
  Paperclip,
  CheckSquare,
  AlignLeft,
  Heading
} from 'lucide-react';
import { CustomFormField } from '../types';
import { compressImageFile } from '../lib/imageCompression';

export const COUNTRY_DIALING_CODES = [
  { code: '+258', country: 'Moçambique (MZ)' },
  { code: '+244', country: 'Angola (AO)' },
  { code: '+351', country: 'Portugal (PT)' },
  { code: '+55', country: 'Brasil (BR)' },
  { code: '+238', country: 'Cabo Verde (CV)' },
  { code: '+239', country: 'São Tomé e Príncipe (ST)' },
  { code: '+245', country: 'Guiné-Bissau (GW)' },
  { code: '+240', country: 'Guiné Equatorial (GQ)' },
  { code: '+27', country: 'África do Sul (ZA)' },
  { code: '+1', country: 'Estados Unidos / Canadá (US/CA)' },
  { code: '+44', country: 'Reino Unido (UK)' },
  { code: '+34', country: 'Espanha (ES)' },
  { code: '+33', country: 'França (FR)' },
  { code: '+49', country: 'Alemanha (DE)' }
];

export interface CustomFieldsRendererProps {
  fields: CustomFormField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  className?: string;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  fields,
  values = {},
  onChange,
  disabled = false,
  errors = {},
  className = ''
}) => {
  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const handleFileUpload = async (field: CustomFormField, file: File) => {
    if (!file) return;

    // Check size limit (default 15MB)
    const maxMb = field.tamanho_maximo_mb || 15;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`O arquivo excede o limite máximo permitido de ${maxMb}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onChange(field.id, {
        nome: file.name,
        tamanho_kb: Math.round(file.size / 1024),
        tipo: file.type,
        data_url: base64
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async (field: CustomFormField, file: File) => {
    if (!file) return;
    try {
      const compressedBase64 = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85
      });
      onChange(field.id, compressedBase64);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange(field.id, e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {sortedFields.map((field) => {
        const val = values[field.id];
        const errorMsg = errors[field.id];
        const isRequired = field.obrigatorio;

        if (field.tipo === 'titulo') {
          return (
            <div key={field.id} className="pt-3 pb-1 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Heading className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {field.label}
              </h4>
              {field.texto_ajuda && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{field.texto_ajuda}</p>
              )}
            </div>
          );
        }

        if (field.tipo === 'checkbox') {
          return (
            <div key={field.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/40 border border-slate-200/80 dark:border-slate-800">
              <input
                type="checkbox"
                id={`field-${field.id}`}
                checked={Boolean(val)}
                disabled={disabled}
                onChange={(e) => onChange(field.id, e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-sm text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="flex-1">
                <label 
                  htmlFor={`field-${field.id}`} 
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {field.label} {isRequired && <span className="text-rose-500">*</span>}
                </label>
                {field.texto_ajuda && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{field.texto_ajuda}</p>
                )}
                {errorMsg && <p className="text-[11px] text-rose-500 mt-1 font-semibold">{errorMsg}</p>}
              </div>
            </div>
          );
        }

        if (field.tipo === 'texto_longo') {
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                value={typeof val === 'string' ? val : ''}
                disabled={disabled}
                required={isRequired}
                rows={3}
                placeholder={field.placeholder || 'Digite o texto...'}
                onChange={(e) => onChange(field.id, e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                  errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
                } rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'dropdown') {
          const opcoes = field.opcoes || [];
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <select
                  value={val || ''}
                  disabled={disabled}
                  required={isRequired}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className={`w-full appearance-none bg-slate-50 dark:bg-slate-850 border ${
                    errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
                  } rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer`}
                >
                  <option value="">{field.placeholder || 'Selecione uma opção...'}</option>
                  {opcoes.map((op, idx) => (
                    <option key={idx} value={op}>{op}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'data') {
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={val || ''}
                  disabled={disabled}
                  required={isRequired}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                    errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
                  } rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                />
              </div>
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'numero') {
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="number"
                value={val ?? ''}
                disabled={disabled}
                required={isRequired}
                placeholder={field.placeholder || '0'}
                onChange={(e) => onChange(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                  errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
                } rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'telefone_ddd') {
          // Values stored as { ddd: string, numero: string } or string with prefix
          const telData = typeof val === 'object' && val !== null 
            ? val 
            : { ddd: field.ddd_padrao || '+258', numero: typeof val === 'string' ? val : '' };

          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="w-40 shrink-0 relative">
                  <select
                    value={telData.ddd || field.ddd_padrao || '+258'}
                    disabled={disabled}
                    onChange={(e) => onChange(field.id, { ...telData, ddd: e.target.value })}
                    className="w-full appearance-none bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    {COUNTRY_DIALING_CODES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} {item.country.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex-1 relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={telData.numero || ''}
                    disabled={disabled}
                    required={isRequired}
                    placeholder={field.placeholder || '84 123 4567'}
                    onChange={(e) => onChange(field.id, { ...telData, numero: e.target.value })}
                    className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                      errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
                    } rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                  />
                </div>
              </div>
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'upload_arquivo') {
          const fileData = typeof val === 'object' && val !== null ? val : null;
          const formatos = field.formatos_permitidos && field.formatos_permitidos.length > 0 
            ? field.formatos_permitidos 
            : ['pdf', 'xlsx'];
          const acceptAttr = formatos.map(f => f === 'pdf' ? '.pdf' : '.xlsx,.xls').join(',');

          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              
              {fileData?.nome ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80">
                  <div className="flex items-center gap-2.5 truncate">
                    <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{fileData.nome}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{fileData.tamanho_kb} KB</p>
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(field.id, null)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Remover ficheiro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-slate-250 dark:border-slate-750 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-4 text-center bg-slate-50/60 dark:bg-slate-850/40 transition-colors cursor-pointer">
                  <input
                    type="file"
                    disabled={disabled}
                    accept={acceptAttr}
                    required={isRequired && !val}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(field, f);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                  />
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Carregar ficheiro ({formatos.map(f => f.toUpperCase()).join(' ou ')})
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Máximo de {field.tamanho_maximo_mb || 15}MB
                  </p>
                </div>
              )}
              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        if (field.tipo === 'upload_foto') {
          const photoUrl = typeof val === 'string' ? val : '';

          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/40 border border-slate-200/80 dark:border-slate-800">
                <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                      <Camera className="w-3.5 h-3.5" />
                      {photoUrl ? 'Alterar Foto' : 'Carregar Foto'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={disabled}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload(field, f);
                        }}
                        className="hidden"
                      />
                    </label>

                    {photoUrl && !disabled && (
                      <button
                        type="button"
                        onClick={() => onChange(field.id, '')}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    PNG, JPG ou WEBP até 10MB
                  </p>
                </div>
              </div>

              {field.texto_ajuda && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
              )}
              {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
            </div>
          );
        }

        // Default: texto_curto
        return (
          <div key={field.id} className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {field.label} {isRequired && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              value={typeof val === 'string' ? val : ''}
              disabled={disabled}
              required={isRequired}
              placeholder={field.placeholder || 'Digite o texto...'}
              onChange={(e) => onChange(field.id, e.target.value)}
              className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                errorMsg ? 'border-rose-400' : 'border-slate-250 dark:border-slate-750'
              } rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
            />
            {field.texto_ajuda && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.texto_ajuda}</p>
            )}
            {errorMsg && <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>}
          </div>
        );
      })}
    </div>
  );
};
