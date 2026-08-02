import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  PlusCircle,
  Edit3,
  Trash2,
  FileText,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Check,
  CheckSquare
} from 'lucide-react';
import { SYSTEM_MODULES, SystemModuleInfo } from './GlobalPermissionsModule';
import { ModulePermissionConfig, ModuleActions, UserCategoryPermission } from '../types';

interface UserPermissionsChecklistProps {
  userCategoryCode: string;
  globalCategories: UserCategoryPermission[];
  moduloAcessos: Record<string, ModulePermissionConfig>;
  onChangeModuloAcessos: (newAcessos: Record<string, ModulePermissionConfig>) => void;
  showNotification?: (msg: string, type?: 'sucesso' | 'erro' | 'info') => void;
}

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

export const UserPermissionsChecklist: React.FC<UserPermissionsChecklistProps> = ({
  userCategoryCode,
  globalCategories,
  moduloAcessos,
  onChangeModuloAcessos,
  showNotification
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todas');
  const [moduleSearch, setModuleSearch] = useState<string>('');

  // Find user's category from globalCategories
  const userCategory = globalCategories.find(
    (c) =>
      c.codigo === userCategoryCode ||
      c.id === userCategoryCode ||
      c.nome.toLowerCase() === userCategoryCode.toLowerCase()
  );

  const activeCategoryName = userCategory ? userCategory.nome : userCategoryCode;

  // Auto-synchronize permissions with category defaults in background if empty
  React.useEffect(() => {
    if (userCategory && userCategory.modulos) {
      if (!moduloAcessos || Object.keys(moduloAcessos).length === 0) {
        const copied = JSON.parse(JSON.stringify(userCategory.modulos));
        onChangeModuloAcessos(copied);
      }
    }
  }, [userCategoryCode, globalCategories]);

  // Toggle Module Switch Key
  const handleModuleSwitch = (moduleKey: string, enabled: boolean) => {
    const currentMod = moduloAcessos[moduleKey] || {
      habilitado: false,
      acoes: { ...NONE_ACTIONS }
    };

    const nextMod: ModulePermissionConfig = {
      ...currentMod,
      habilitado: enabled,
      acoes: enabled
        ? currentMod.acoes?.visualizar
          ? currentMod.acoes
          : { ...READONLY_ACTIONS }
        : { ...NONE_ACTIONS }
    };

    onChangeModuloAcessos({
      ...moduloAcessos,
      [moduleKey]: nextMod
    });
  };

  // Toggle Granular Action Checkbox
  const handleActionCheckbox = (
    moduleKey: string,
    actionKey: keyof ModuleActions,
    checked: boolean
  ) => {
    const currentMod = moduloAcessos[moduleKey] || {
      habilitado: true,
      acoes: { ...READONLY_ACTIONS }
    };

    const nextActions: ModuleActions = {
      ...currentMod.acoes,
      [actionKey]: checked
    };

    const hasAnyAction = Object.values(nextActions).some(Boolean);

    onChangeModuloAcessos({
      ...moduloAcessos,
      [moduleKey]: {
        habilitado: hasAnyAction || currentMod.habilitado,
        acoes: nextActions
      }
    });
  };

  // Module Level Preset
  const setModulePreset = (moduleKey: string, preset: 'all' | 'readonly' | 'none') => {
    let newActions = { ...NONE_ACTIONS };
    let enabled = false;

    if (preset === 'all') {
      newActions = { ...FULL_ACTIONS };
      enabled = true;
    } else if (preset === 'readonly') {
      newActions = { ...READONLY_ACTIONS };
      enabled = true;
    }

    onChangeModuloAcessos({
      ...moduloAcessos,
      [moduleKey]: {
        habilitado: enabled,
        acoes: newActions
      }
    });
  };

  // Global Presets for User
  const setGlobalUserPreset = (preset: 'all' | 'readonly' | 'none') => {
    const next: Record<string, ModulePermissionConfig> = {};
    SYSTEM_MODULES.forEach((mod) => {
      if (preset === 'all') {
        next[mod.key] = { habilitado: true, acoes: { ...FULL_ACTIONS } };
      } else if (preset === 'readonly') {
        next[mod.key] = { habilitado: true, acoes: { ...READONLY_ACTIONS } };
      } else {
        next[mod.key] = { habilitado: false, acoes: { ...NONE_ACTIONS } };
      }
    });
    onChangeModuloAcessos(next);
    if (showNotification) {
      showNotification(`Permissões do utilizador definidas para: ${preset.toUpperCase()}`, 'info');
    }
  };

  // Calculate enabled count
  const enabledCount = SYSTEM_MODULES.filter(
    (m) => moduloAcessos[m.key]?.habilitado
  ).length;

  // Filter modules
  const filteredModules = SYSTEM_MODULES.filter((m) => {
    if (selectedCategoryFilter !== 'todas' && m.category !== selectedCategoryFilter) {
      return false;
    }
    if (moduleSearch.trim()) {
      const q = moduleSearch.toLowerCase();
      return (
        m.label.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 border border-indigo-100 dark:border-indigo-950/60 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
      {/* Category Sync Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl border border-indigo-800/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">
                Permissões Individuais de Acesso
              </h4>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold px-2 py-0.5 rounded-full font-mono">
                {enabledCount} / {SYSTEM_MODULES.length} Visíveis
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Categoria base: <strong className="text-indigo-300">{activeCategoryName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Sincronizado em background</span>
        </div>
      </div>

      {/* Filter and Presets Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
          >
            <option value="todas">Todas as Áreas ({SYSTEM_MODULES.length})</option>
            <option value="Geral">Geral</option>
            <option value="Estrutura">Estrutura</option>
            <option value="Académico">Académico</option>
            <option value="Comunicação">Comunicação</option>
            <option value="Administração">Administração</option>
          </select>
        </div>

        <div className="relative w-full sm:w-48">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            placeholder="Buscar módulo..."
            className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setGlobalUserPreset('all')}
            className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 cursor-pointer"
          >
            Ativar Tudo
          </button>
          <button
            type="button"
            onClick={() => setGlobalUserPreset('readonly')}
            className="text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 px-2 py-1 rounded border border-sky-200 dark:border-sky-800 cursor-pointer"
          >
            Leitura
          </button>
          <button
            type="button"
            onClick={() => setGlobalUserPreset('none')}
            className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 px-2 py-1 rounded border border-rose-200 dark:border-rose-800 cursor-pointer"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Modules Checklist Grid */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {filteredModules.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Nenhum módulo encontrado para o filtro aplicado.
          </div>
        ) : (
          filteredModules.map((mod) => {
            const config = moduloAcessos[mod.key] || {
              habilitado: false,
              acoes: { ...NONE_ACTIONS }
            };
            const isEnabled = !!config.habilitado;

            return (
              <div
                key={mod.key}
                className={`p-3 rounded-xl border transition-all duration-150 ${
                  isEnabled
                    ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900 shadow-2xs'
                    : 'bg-slate-100/70 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Switch Key + Label */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleModuleSwitch(mod.key, !isEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={isEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                          {mod.label}
                        </span>
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
                          {mod.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Presets */}
                  {isEnabled && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setModulePreset(mod.key, 'readonly')}
                        className="text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Leitura
                      </button>
                      <button
                        type="button"
                        onClick={() => setModulePreset(mod.key, 'all')}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => setModulePreset(mod.key, 'none')}
                        className="text-[9px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Off
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Checkboxes (6 granular permissions) */}
                {isEnabled && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.visualizar}
                        onChange={(e) => handleActionCheckbox(mod.key, 'visualizar', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <Eye className="w-3 h-3 text-slate-400" /> Ver
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.criar}
                        onChange={(e) => handleActionCheckbox(mod.key, 'criar', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <PlusCircle className="w-3 h-3 text-emerald-500" /> Criar
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.editar}
                        onChange={(e) => handleActionCheckbox(mod.key, 'editar', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <Edit3 className="w-3 h-3 text-amber-500" /> Editar
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.excluir}
                        onChange={(e) => handleActionCheckbox(mod.key, 'excluir', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <Trash2 className="w-3 h-3 text-rose-500" /> Excluir
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.exportar}
                        onChange={(e) => handleActionCheckbox(mod.key, 'exportar', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <FileText className="w-3 h-3 text-indigo-500" /> Exportar
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600">
                      <input
                        type="checkbox"
                        checked={!!config.acoes?.aprovar}
                        onChange={(e) => handleActionCheckbox(mod.key, 'aprovar', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <CheckCircle2 className="w-3 h-3 text-teal-500" /> Aprovar
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
