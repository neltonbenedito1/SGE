import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

export interface SalaItem {
  id: string;
  nome: string;
  capacidade: number;
  tipo: string;
  descricao?: string;
  escola_id?: string;
}

interface SalasModuleProps {
  rawSalas: SalaItem[];
  hasPermission: (module: string, action?: string) => boolean;
  renderRestrictedAccess: (moduleName: string) => React.ReactNode;
  renderModuleRefreshButton: (moduleName: string) => React.ReactNode;
  onOpenCreate: () => void;
  onOpenEdit: (sala: SalaItem) => void;
  onDelete: (sala: SalaItem) => void;
}

export const SalasModule: React.FC<SalasModuleProps> = ({
  rawSalas,
  hasPermission,
  renderRestrictedAccess,
  renderModuleRefreshButton,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}) => {
  if (!hasPermission('escolas')) {
    return <>{renderRestrictedAccess('Gestão de Salas de Aula')}</>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Salas de Aula</h3>
            <p className="text-xs text-slate-400 mt-0.5">Gerenciamento de espaços físicos e laboratórios para agendamento.</p>
          </div>
          {renderModuleRefreshButton('Salas')}
        </div>
        {hasPermission('escolas', 'criar') && (
          <button 
            type="button"
            onClick={onOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nova Sala
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rawSalas.map(s => (
          <div key={s.id} className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between bg-slate-50/30">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  {s.tipo}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Capacidade: {s.capacidade} alunos
                </span>
              </div>
              <p className="font-bold text-slate-800 text-base">{s.nome}</p>
              {s.descricao && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.descricao}</p>
              )}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 justify-end">
              {hasPermission('escolas', 'editar') && (
                <button 
                  type="button"
                  onClick={() => onOpenEdit(s)}
                  className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg hover:text-indigo-700 transition-colors cursor-pointer"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {hasPermission('escolas', 'excluir') && (
                <button 
                  type="button"
                  onClick={() => onDelete(s)}
                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg hover:text-rose-700 transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {rawSalas.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm">
            Nenhuma sala cadastrada no sistema.
          </div>
        )}
      </div>
    </div>
  );
};
