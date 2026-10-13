import React from 'react';
import { Plus, Sparkles } from 'lucide-react';

export interface ClasseEscolarItem {
  id: string;
  nome: string;
  nivel: any;
  descricao?: string;
  escola_id?: string;
}

interface SchoolItem {
  id: string;
  nome: string;
}

interface PlanInfo {
  nome: string;
  limits: {
    max_classes?: number;
    [key: string]: any;
  };
}

interface ClassesEscolaresModuleProps {
  classesEscolares: ClasseEscolarItem[];
  schools: SchoolItem[];
  plan: PlanInfo | null;
  hasPermission: (module: string, action?: string) => boolean;
  isLimitReached: (featureKey: string, currentCount: number) => boolean;
  openUpgradeModal: (featureKey: string, currentCount: number) => void;
  renderRestrictedAccess: (moduleName: string) => React.ReactNode;
  renderModuleRefreshButton: (moduleName: string) => React.ReactNode;
  onOpenCreate: () => void;
  onOpenEdit: (classe: ClasseEscolarItem) => void;
  onDelete: (classe: ClasseEscolarItem) => void;
}

export const ClassesEscolaresModule: React.FC<ClassesEscolaresModuleProps> = ({
  classesEscolares,
  schools,
  plan,
  hasPermission,
  isLimitReached,
  openUpgradeModal,
  renderRestrictedAccess,
  renderModuleRefreshButton,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}) => {
  if (!hasPermission('classes_escolares')) {
    return <>{renderRestrictedAccess('Classes Escolares')}</>;
  }

  const maxClassesLimit = plan?.limits?.max_classes ?? 7;
  const isLimitFull = isLimitReached('max_classes', classesEscolares.length);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Classes Escolares (Anos Académicos)</h3>
              <p className="text-xs text-slate-400">Configure as classes letivas oficiais autorizadas para o seu plano (e.g. 7ª Classe, 10ª Classe).</p>
            </div>
            {renderModuleRefreshButton('Classes Escolares')}
          </div>
          {isLimitFull ? (
            <button 
              type="button"
              onClick={() => openUpgradeModal('max_classes', classesEscolares.length)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Upgrade • Limite Atingido
            </button>
          ) : (
            hasPermission('classes_escolares', 'criar') && (
              <button 
                type="button"
                onClick={onOpenCreate}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-center cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Classe Letiva
              </button>
            )
          )}
        </div>

        {/* Limit meter */}
        {plan && (
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <p className="font-bold text-indigo-950">
                Limite do {plan.nome}: {plan.limits.max_classes >= 9999 ? "Ilimitado" : `${plan.limits.max_classes} classes`}
              </p>
              <p className="text-slate-500 mt-0.5">As classes representam o progresso de graduação anual dos estudantes.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${classesEscolares.length >= maxClassesLimit ? 'bg-rose-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, (classesEscolares.length / maxClassesLimit) * 100)}%` }}
                />
              </div>
              <span className="font-mono font-bold text-slate-700">
                {classesEscolares.length} / {plan.limits.max_classes >= 9999 ? '∞' : maxClassesLimit}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <th className="p-4">Nome da Classe</th>
                <th className="p-4">Escola Associada</th>
                <th className="p-4">Nível de Ensino</th>
                <th className="p-4">Descrição do Currículo</th>
                <th className="p-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-900 z-10">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {classesEscolares.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Nenhuma classe escolar cadastrada neste tenant. Clique em "Cadastrar Classe Letiva" para começar.
                  </td>
                </tr>
              ) : (
                classesEscolares.map(c => {
                  const sch = schools.find(s => s.id === c.escola_id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{c.nome}</td>
                      <td className="p-4 font-semibold text-xs text-indigo-950">{sch ? sch.nome : 'Sem Escola'}</td>
                      <td className="p-4">
                        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                          {c.nivel}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-xs">{c.descricao || 'Nenhuma descrição currícular'}</td>
                      <td className="p-4 text-right space-x-2 sticky right-0 bg-white dark:bg-slate-900 z-10">
                        {hasPermission('classes_escolares', 'editar') && (
                          <button 
                            type="button"
                            onClick={() => onOpenEdit(c)}
                            className="text-indigo-600 hover:text-indigo-900 font-bold text-xs cursor-pointer"
                          >
                            Editar
                          </button>
                        )}
                        {hasPermission('classes_escolares', 'excluir') && (
                          <button 
                            type="button"
                            onClick={() => onDelete(c)}
                            className="text-rose-600 hover:text-rose-900 font-bold text-xs cursor-pointer"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
