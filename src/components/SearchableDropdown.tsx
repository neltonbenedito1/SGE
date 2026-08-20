import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface DropdownOption {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção...',
  searchPlaceholder = 'Pesquisar...',
  label,
  required = false,
  disabled = false,
  id
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const safeOptions = Array.isArray(options) ? options.filter(Boolean) : [];

  const selectedOption = safeOptions.find(opt => opt && String(opt.value) === String(value));

  const filteredOptions = safeOptions.filter(opt => {
    if (!opt) return false;
    const labelStr = String(opt.label ?? opt.value ?? '');
    const searchStr = String(searchTerm || '').toLowerCase();
    return labelStr.toLowerCase().includes(searchStr);
  });

  return (
    <div className="relative w-full text-left font-sans" ref={dropdownRef} id={id}>
      {label && (
        <label className="block text-xs font-bold text-slate-500 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500 hover:bg-slate-100/50 transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400 font-normal' : ''}`}>
          {selectedOption ? (selectedOption.label ?? selectedOption.value ?? '') : placeholder}
        </span>
        <div className="flex items-center gap-1.5">
          {selectedOption && !required && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="relative flex items-center bg-slate-50 rounded-lg border border-slate-150 px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-700 outline-none border-none p-0 focus:ring-0"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-750 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-3">
                Nenhum resultado encontrado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
