import React from 'react';
import { Plus, Edit } from 'lucide-react';

export interface ProvinciaItem {
  id: string;
  nome: string;
  codigo: string;
}

interface ProvinciasModuleProps {
  provinces: ProvinciaItem[];
  hasPermission: (module: string, action?: string) => boolean;
  renderRestrictedAccess: (moduleName: string) => React.ReactNode;
  renderModuleRefreshButton: (moduleName: string) => React.ReactNode;
  onOpenCreate: () => void;
  onOpenEdit: (provincia: ProvinciaItem) => void;
}

export const ProvinciasModule: React.FC<ProvinciasModuleProps> = ({
  provinces,
  hasPermission,
  renderRestrictedAccess,
  renderModuleRefreshButton,
  onOpenCreate,
  onOpenEdit,
}) => {
  if (!hasPermission('provincias')) {
    return <>{renderRestrictedAccess('Distritos / Províncias')}</>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800">Províncias Educacionais</h3>
          {renderModuleRefreshButton('Províncias')}
        </div>
        {hasPermission('provincias', 'criar') && (
          <button 
            type="button"
            onClick={onOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" /> Cadastrar Divisão
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {provinces.map(p => (
          <div key={p.id} className="p-4 rounded-xl border border-slate-150 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">{p.nome}</p>
              <p className="text-xs text-slate-400">Código de Referência: {p.codigo}</p>
            </div>
            <div className="flex gap-1">
              {hasPermission('provincias', 'editar') && (
                <button 
                  type="button"
                  onClick={() => onOpenEdit(p)}
                  className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition-colors cursor-pointer"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {provinces.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 text-sm">
            Nenhuma província ou distrito cadastrado.
          </div>
        )}
      </div>
    </div>
  );
};
