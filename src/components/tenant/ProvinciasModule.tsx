import React, { useState, useMemo } from 'react';
import { Globe, MapPin, Search, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { MOZAMBIQUE_PROVINCES, getAutomaticProvincesForCountries, ProvinceDefinition } from '../../shared/catalogs';

export interface ProvinciaItem {
  id: string;
  nome: string;
  codigo: string;
  pais?: string;
  distritos?: string[];
}

interface ProvinciasModuleProps {
  provinces: ProvinciaItem[];
  paisOrigem?: string;
  paisesSucursais?: string[];
  hasPermission: (module: string, action?: string) => boolean;
  renderRestrictedAccess: (moduleName: string) => React.ReactNode;
  renderModuleRefreshButton: (moduleName: string) => React.ReactNode;
  onSyncAutomaticProvinces?: () => void;
  isSyncing?: boolean;
}

export const ProvinciasModule: React.FC<ProvinciasModuleProps> = ({
  provinces,
  paisOrigem = 'Moçambique',
  paisesSucursais = [],
  hasPermission,
  renderRestrictedAccess,
  renderModuleRefreshButton,
  onSyncAutomaticProvinces,
  isSyncing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState('todos');

  if (!hasPermission('provincias')) {
    return <>{renderRestrictedAccess('Distritos / Províncias')}</>;
  }

  // Países de atuação da instituição
  const allInstitutionCountries = useMemo(() => {
    const list = [paisOrigem, ...paisesSucursais].filter(Boolean);
    return Array.from(new Set(list));
  }, [paisOrigem, paisesSucursais]);

  // Catálogo oficial de divisões para os países configurados
  const officialDivisions: ProvinceDefinition[] = useMemo(() => {
    return getAutomaticProvincesForCountries(allInstitutionCountries);
  }, [allInstitutionCountries]);

  // Lista consolidada de províncias (banco ou catálogo automático)
  const displayProvinces = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    // Mesclar dados do banco com catálogo oficial
    const combined = officialDivisions.map(off => {
      const dbMatch = provinces.find(p => p.nome.toLowerCase() === off.nome.toLowerCase());
      return {
        id: dbMatch?.id || `auto_${off.codigo}`,
        nome: off.nome,
        codigo: off.codigo,
        pais: off.pais,
        distritos: off.distritos
      };
    });

    return combined.filter(item => {
      if (selectedCountryFilter !== 'todos' && item.pais.toLowerCase() !== selectedCountryFilter.toLowerCase()) {
        return false;
      }
      if (!term) return true;
      const matchProv = item.nome.toLowerCase().includes(term) || item.codigo.toLowerCase().includes(term);
      const matchDist = item.distritos?.some(d => d.toLowerCase().includes(term));
      return matchProv || matchDist;
    });
  }, [officialDivisions, provinces, searchTerm, selectedCountryFilter]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xs space-y-6 text-left">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              Divisões Territoriais (Províncias e Distritos)
            </h3>
            {renderModuleRefreshButton('Províncias')}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastro automático baseado na sede e sucursais da instituição.
          </p>
        </div>

        {/* Botão de sincronização automática */}
        {onSyncAutomaticProvinces && (
          <button 
            type="button"
            onClick={onSyncAutomaticProvinces}
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            title="Sincronizar divisões territoriais automaticamente"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Divisões Automáticas'}
          </button>
        )}
      </div>

      {/* Banner Informativo sobre Cadastro Automático */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-850 dark:to-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-700 space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Territórios de Atuação da Instituição
          </span>
          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
            Automático
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          As províncias e distritos abaixo são padronizados e registrados automaticamente pelo sistema conforme o <strong>país de origem ({paisOrigem})</strong> e os países onde a instituição possui filiais ou escolas ({paisesSucursais.length > 0 ? paisesSucursais.join(', ') : 'Nenhuma sucursal adicional'}). O cadastro manual foi desativado para garantir conformidade geográfica.
        </p>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por província, código ou distrito..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {allInstitutionCountries.length > 1 && (
          <select
            value={selectedCountryFilter}
            onChange={(e) => setSelectedCountryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="todos">Todos os Países</option>
            {allInstitutionCountries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Grid de Províncias e Distritos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayProvinces.map(p => (
          <div key={p.id} className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.nome}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Código: <strong className="text-slate-600 dark:text-slate-300 font-mono">{p.codigo}</strong> • País: <span className="font-medium">{p.pais}</span>
                </p>
              </div>
              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {p.distritos?.length || 0} Distritos
              </span>
            </div>

            {/* Lista dos distritos da província */}
            {p.distritos && p.distritos.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-900">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Distritos / Municípios Oficiais:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {p.distritos.map(d => (
                    <span 
                      key={d} 
                      className="text-[11px] bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {displayProvinces.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm">
            Nenhuma província ou distrito corresponde à pesquisa.
          </div>
        )}
      </div>
    </div>
  );
};
