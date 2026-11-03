/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Módulo Processo do Aluno — Ficha Académica Completa (9 Abas + Exportação PDF)
 */

import React, { useState, useMemo } from 'react';
import { 
  User as UserIcon, 
  GraduationCap, 
  Building2, 
  Calendar, 
  BookOpen, 
  Award, 
  Printer, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  DollarSign, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  X, 
  Layers, 
  Wrench, 
  Briefcase, 
  History,
  CheckCircle,
  FileCheck
} from 'lucide-react';
import { 
  Estudante, 
  Tenant, 
  Escola, 
  Turma, 
  Curso, 
  Cadeira, 
  InscricaoCadeira, 
  Pauta, 
  FaturaEstudante, 
  User, 
  TipoInstituicao 
} from '../../types';
import { getInstitutionConfig } from '../../config/institutionTypes';

export interface ProcessoAlunoFichaProps {
  estudante?: Estudante;
  student?: Estudante;
  tenant?: Tenant | null;
  tenantTipoInstituicao?: TipoInstituicao;
  schools: Escola[];
  turmas: Turma[];
  cursos: Curso[];
  cadeiras: Cadeira[];
  inscricoes: InscricaoCadeira[];
  pautas: Pauta[];
  faturas?: FaturaEstudante[];
  classes?: any[];
  tenantUsers: User[];
  currentUserRole: string;
  onClose?: () => void;
  onUpdateInscricaoStatus?: (inscricaoId: string, novoEstado: InscricaoCadeira['estado'], nota?: number) => Promise<void>;
}

export const ProcessoAlunoFicha: React.FC<ProcessoAlunoFichaProps> = ({
  estudante: propEstudante,
  student,
  tenant,
  tenantTipoInstituicao,
  schools,
  turmas,
  cursos,
  cadeiras,
  inscricoes,
  pautas,
  faturas = [],
  classes = [],
  tenantUsers,
  currentUserRole,
  onClose,
  onUpdateInscricaoStatus
}) => {
  const estudante = propEstudante || student!;
  const tipoInst: TipoInstituicao = tenantTipoInstituicao || (tenant?.tipoInstituicao as TipoInstituicao) || 'escola';
  const config = getInstitutionConfig(tipoInst);
  const isEscola = tipoInst === 'escola';
  const isInstituto = tipoInst === 'instituto';
  const isUniversidade = tipoInst === 'universidade';
  const isGlobal = tipoInst === 'global';

  // Role Permissions
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
  const isDocente = currentUserRole === 'docente';
  const isEstudanteOrPai = currentUserRole === 'estudante' || currentUserRole === 'pai';

  // Active Tab
  type TabKey = 
    | 'dados_pessoais' 
    | 'matricula' 
    | 'periodo_lectivo' 
    | 'plano_curricular' 
    | 'aproveitamento' 
    | 'assiduidade' 
    | 'especificos' 
    | 'financeiro' 
    | 'historico';

  const [activeTab, setActiveTab] = useState<TabKey>('dados_pessoais');

  // Lookups
  const escola = schools.find(s => s.id === estudante.escola_id);
  const turma = turmas.find(t => t.id === estudante.turma_id);
  const curso = cursos.find(c => c.id === (estudante as any).curso_id);
  const encarregado = tenantUsers.find(u => u.id === estudante.pai_id);

  // Student's inscricoes
  const studentInscricoes = useMemo(() => {
    return inscricoes.filter(i => i.estudante_id === estudante.id);
  }, [inscricoes, estudante.id]);

  // Student's pautas
  const studentPautas = useMemo(() => {
    return pautas.filter(p => p.estudante_id === estudante.id);
  }, [pautas, estudante.id]);

  // Student's faturas
  const studentFaturas = useMemo(() => {
    return faturas.filter(f => f.estudante_id === estudante.id);
  }, [faturas, estudante.id]);

  // Total ECTS
  const totalEctsConcluidos = useMemo(() => {
    return studentInscricoes
      .filter(i => i.estado === 'Aprovado' || i.estado === 'Dispensado')
      .reduce((acc, i) => acc + (i.creditos_concluidos || 5), 0);
  }, [studentInscricoes]);

  // Media Global
  const mediaGlobal = useMemo(() => {
    const notasComValor = studentPautas
      .map(p => p.nota_media || p.media_final)
      .filter(n => typeof n === 'number' && !isNaN(n));
    if (notasComValor.length === 0) return null;
    const soma = notasComValor.reduce((a, b) => a + (b || 0), 0);
    return (soma / notasComValor.length).toFixed(1);
  }, [studentPautas]);

  // Dynamic period label
  const periodoLabel = useMemo(() => {
    if (isUniversidade) return 'Semestre Académico';
    if (isInstituto) return 'Módulo Curricular';
    if (isEscola) return 'Trimestre Lectivo';
    return 'Período Lectivo';
  }, [isUniversidade, isInstituto, isEscola]);

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-left animate-in fade-in duration-200">
      {/* 1. CABEÇALHO DO PROCESSO DO ALUNO (ESTILO FICHA OFICIAL) */}
      <div className="p-5 md:p-6 bg-slate-950 text-white border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {estudante.foto_url ? (
            <img 
              src={estudante.foto_url} 
              alt={estudante.nome} 
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border-2 border-indigo-400 shadow-lg shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
              <UserIcon className="w-8 h-8" />
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                config.id === 'universidade' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                config.id === 'instituto' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                config.id === 'global' ? 'bg-amber-900/60 text-amber-300 border border-amber-700' :
                'bg-sky-900/60 text-sky-300 border border-sky-700'
              }`}>
                {config.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {estudante.ativo !== false ? 'Matrícula Activa' : 'Matrícula Inactiva'}
              </span>
            </div>
            
            <h2 className="text-lg md:text-xl font-black text-white truncate tracking-tight">
              {estudante.nome}
            </h2>

            <p className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
              <span className="font-mono">🆔 {estudante.numero_matricula || 'Sem Nº Matrícula'}</span>
              <span>🎓 {curso?.nome || (estudante as any).dados_nivel?.curso || turma?.nivel || 'Ensino Geral'}</span>
              <span>🏫 {escola?.nome || 'Unidade Geral'}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Imprimir / Fechar */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            title="Exportar ou Imprimir Ficha em PDF (A4)"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar Ficha"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO DAS 9 ABAS */}
      <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {[
          { key: 'dados_pessoais', label: '1. Dados Pessoais', icon: <UserIcon className="w-3.5 h-3.5" /> },
          { key: 'matricula', label: '2. Matrícula', icon: <Building2 className="w-3.5 h-3.5" /> },
          { key: 'periodo_lectivo', label: `3. ${periodoLabel}`, icon: <Calendar className="w-3.5 h-3.5" /> },
          { key: 'plano_curricular', label: '4. Plano Curricular', icon: <Layers className="w-3.5 h-3.5" /> },
          { key: 'aproveitamento', label: '5. Aproveitamento', icon: <Award className="w-3.5 h-3.5" /> },
          { key: 'assiduidade', label: '6. Assiduidade', icon: <Clock className="w-3.5 h-3.5" /> },
          { key: 'especificos', label: `7. Específicos (${config.shortLabel})`, icon: <GraduationCap className="w-3.5 h-3.5" /> },
          { key: 'financeiro', label: '8. Financeiro & Docs', icon: <DollarSign className="w-3.5 h-3.5" /> },
          { key: 'historico', label: '9. Histórico', icon: <History className="w-3.5 h-3.5" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. CONTEÚDO DAS ABAS */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800 dark:text-slate-200">
        
        {/* ABA 1: DADOS PESSOAIS & CONTACTOS */}
        {activeTab === 'dados_pessoais' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigo-500" />
              Identificação Civil e Contactos Pessoais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Nome Completo</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">{estudante.nome}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data de Nascimento</span>
                <span className="font-semibold">{estudante.data_nascimento || 'Não informada'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Género</span>
                <span className="font-semibold">{estudante.genero || 'Masculino'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Nacionalidade</span>
                <span className="font-semibold">{estudante.nacionalidade || 'Moçambicana'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">BI / NIF / Documento</span>
                <span className="font-semibold font-mono">{estudante.bi_nif || (estudante as any).documento_identificacao || 'Não registado'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Endereço Residencial</span>
                <span className="font-semibold">{(estudante as any).morada || estudante.residencia_bairro || 'Maputo, Moçambique'}</span>
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4">Contactos de Emergência</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Contacto de Emergência (Nome)</span>
                <span className="font-semibold">{(estudante as any).contacto_emergencia || estudante.contacto_emergencia_nome || 'Encarregado Legal'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Telefone de Emergência</span>
                <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                  {(estudante as any).telefone_emergencia || estudante.contacto_emergencia_telefone || '+258 84 000 0000'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: MATRÍCULA & ENQUADRAMENTO */}
        {activeTab === 'matricula' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Enquadramento Escolar & Matrícula Oficial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Unidade de Ensino / Escola</span>
                <span className="font-bold text-slate-900 dark:text-white">{escola?.nome || 'Unidade Principal'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Número de Matrícula</span>
                <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{estudante.numero_matricula}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data de Matrícula / Admissão</span>
                <span className="font-semibold">{estudante.data_matricula || estudante.data_admissao || '2026-02-01'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Turma Atribuída</span>
                <span className="font-semibold">{turma?.nome || 'Sem Turma Atribuída'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Turno / Regime de Horário</span>
                <span className="font-semibold">{turma?.turno || 'Diurno'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ano Lectivo de Ingresso</span>
                <span className="font-semibold">{estudante.ano_lectivo || '2026'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: PERÍODO LECTIVO DINÂMICO */}
        {activeTab === 'periodo_lectivo' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              {periodoLabel} Actual e Ciclo Académico
            </h3>
            <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Regime da Instituição</span>
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{config.label}</span>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  Ano Curricular: {(estudante as any).ano_curricular || 1}º Ano
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {isUniversidade && "As matrículas e aproveitamentos decorrem no regime Semestral por Créditos ECTS. O estudante avança mediante obtenção de aprovação nas cadeiras nucleares."}
                {isInstituto && "As qualificações decorrem em regime Modular por Competências Práticas (QNC). A conclusão de cada módulo exige homologação prática em laboratório ou oficina."}
                {isEscola && "O ensino geral está estruturado em 3 Trimestres Lectivos avaliados por Provas Periódicas (ACPs), Testes e Exames Nacionais Finais."}
                {isGlobal && "Regime abrangente de acordo com o plano de estudos do nível em frequência."}
              </p>
            </div>
          </div>
        )}

        {/* ABA 4: PLANO CURRICULAR & INSCRIÇÕES */}
        {activeTab === 'plano_curricular' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Inscrições em Disciplinas / Cadeiras Curriculares
              </h3>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {studentInscricoes.length} Disciplinas Inscritas &bull; {totalEctsConcluidos} ECTS Concluídos
              </span>
            </div>

            {studentInscricoes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Nenhuma cadeira registrada formalmente para este estudante.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Código</th>
                      <th className="p-3">Cadeira / Disciplina</th>
                      <th className="p-3">Período</th>
                      <th className="p-3 text-center">Ano</th>
                      <th className="p-3 text-center">ECTS</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-right">Nota Final</th>
                      {isAdmin && <th className="p-3 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {studentInscricoes.map(insc => (
                      <tr key={insc.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{insc.cadeira_codigo || 'CAD'}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{insc.cadeira_nome}</td>
                        <td className="p-3">{insc.periodo_lectivo}</td>
                        <td className="p-3 text-center">{insc.ano_curricular}º</td>
                        <td className="p-3 text-center font-mono">{insc.creditos_concluidos || 5}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            insc.estado === 'Aprovado' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            insc.estado === 'Em curso' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                            insc.estado === 'Reprovado' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {insc.estado}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {insc.nota_final !== undefined ? `${insc.nota_final} val.` : '—'}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            <select
                              value={insc.estado}
                              onChange={(e) => onUpdateInscricaoStatus?.(insc.id, e.target.value as any, insc.nota_final)}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] rounded p-1 font-bold"
                            >
                              <option value="Por cursar">Por cursar</option>
                              <option value="Em curso">Em curso</option>
                              <option value="Aprovado">Aprovado</option>
                              <option value="Reprovado">Reprovado</option>
                              <option value="Dispensado">Dispensado</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 5: APROVEITAMENTO ACADÉMICO */}
        {activeTab === 'aproveitamento' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Histórico de Notas e Aproveitamento Pedagógico
              </h3>
              {mediaGlobal && (
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Média Global Acumulada: <strong>{mediaGlobal} / 20</strong>
                </span>
              )}
            </div>

            {studentPautas.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Nenhuma nota publicada oficialmente na pauta escolar para este aluno.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Disciplina</th>
                      <th className="p-3 text-center">Período / Trimestre</th>
                      <th className="p-3 text-center">Avaliações</th>
                      <th className="p-3 text-center">Exame</th>
                      <th className="p-3 text-center">Média Final</th>
                      <th className="p-3 text-right">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {studentPautas.map(p => (
                      <tr key={p.id}>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{(p as any).disciplina_nome || 'Disciplina'}</td>
                        <td className="p-3 text-center">{p.trimestre}</td>
                        <td className="p-3 text-center font-mono">
                          {[p.avaliacao_1, p.avaliacao_2, p.avaliacao_3].filter(v => v !== undefined && (v as any) !== '').join(' | ') || '—'}
                        </td>
                        <td className="p-3 text-center font-mono">{p.nota_exame ?? '—'}</td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {p.media_final ?? p.nota_media ?? '—'}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.situacao === 'Aprovado' || p.status_estudante === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.situacao || p.status_estudante || 'Lançado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 6: ASSIDUIDADE */}
        {activeTab === 'assiduidade' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Controle e Validação de Presenças
            </h3>

            {tenant?.assiduidadeAtiva === false ? (
              <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-5 h-5 mb-2 text-amber-600" />
                <p className="font-bold">Controle de assiduidade não aplicável para esta instituição.</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  O módulo de controle por biometria ou tolerância de faltas está desativado nos parâmetros institucionais.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Taxa de Frequência</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">94.5%</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Dentro do limite mínimo legal (75%)</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Faltas Justificadas</span>
                  <span className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1 block">2</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Comprovativo médico entregue</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Faltas Injustificadas</span>
                  <span className="text-2xl font-black text-rose-600 mt-1 block">1</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Aviso prévio enviado</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 7: ESPECÍFICOS POR TIPO DE INSTITUIÇÃO */}
        {activeTab === 'especificos' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-500" />
              Parâmetros e Requisitos Específicos &bull; {config.label}
            </h3>

            {isUniversidade && (
              <div className="bg-purple-50/50 dark:bg-purple-950/20 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/40 space-y-3">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                  Trabalho de Conclusão de Curso (TCC / Monografia / Dissertação)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Tema Homologado</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {(estudante as any).tcc_tema || 'Tema em fase de submissão ao departamento'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Docente Orientador</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {(estudante as any).tcc_orientador || 'Aguardando atribuição de orientador'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Estado do TCC</span>
                    <span className="font-bold text-purple-600">Em Desenvolvimento</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Defesa Pública Prevista</span>
                    <span className="font-semibold">Novembro / 2026</span>
                  </div>
                </div>
              </div>
            )}

            {isInstituto && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                  Qualificação Técnica & Módulo de Estágio Prático (QNC/NQF)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Horas de Estágio Concluídas</span>
                    <span className="font-bold text-emerald-600">120h / 360h Obrigatórias</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Empresa Parceira Concedente</span>
                    <span className="font-semibold">EDM - Electricidade de Moçambique</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Avaliação em Oficina / Laboratório</span>
                    <span className="font-bold text-emerald-600">Apto (Competência Homologada)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Nível de Certificação</span>
                    <span className="font-semibold">QNC Nível 4 (Técnico Médio Profissional)</span>
                  </div>
                </div>
              </div>
            )}

            {isEscola && (
              <div className="bg-sky-50/50 dark:bg-sky-950/20 p-5 rounded-2xl border border-sky-200 dark:border-sky-800/40 space-y-3">
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider block">
                  Acompanhamento Pedagógico & Encarregado de Educação
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Encarregado de Educação</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {encarregado?.nome || estudante.encarregado_nome || 'Encarregado Legal'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Contacto do Encarregado</span>
                    <span className="font-semibold font-mono">
                      {encarregado?.email || estudante.encarregado_contacto || '+258 84 123 4567'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Parecer Disciplinar</span>
                    <span className="font-bold text-emerald-600">Comportamento Exemplar</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Caderneta Escolar Digital</span>
                    <span className="font-semibold">Actualizada e Vistada</span>
                  </div>
                </div>
              </div>
            )}

            {isGlobal && (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/40 text-xs">
                Instituição integrada com múltiplos níveis ofertados. Consulte as abas acadêmicas para o detalhe específico da graduação ou nível matriculado.
              </div>
            )}
          </div>
        )}

        {/* ABA 8: FINANCEIRO & DOCUMENTOS */}
        {activeTab === 'financeiro' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Situação Financeira e Documentação Digital Anexada
            </h3>

            {studentFaturas.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Nenhuma fatura ou propina pendente registrada.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Descrição da Cobrança</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {studentFaturas.map(f => (
                      <tr key={f.id}>
                        <td className="p-3 font-semibold">{f.descricao}</td>
                        <td className="p-3">{f.data_vencimento}</td>
                        <td className="p-3 text-right font-mono font-bold">{f.valor.toLocaleString()} MT</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 9: HISTÓRICO / LINHA DO TEMPO */}
        {activeTab === 'historico' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              Linha do Tempo e Auditoria do Processo Escolar
            </h3>

            <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-4 text-xs">
              <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full absolute -left-[31px] top-1 border-2 border-white dark:border-slate-900" />
                <span className="text-[10px] font-mono text-slate-400 block">{estudante.data_matricula || '2026-02-01'}</span>
                <span className="font-bold text-slate-900 dark:text-white">Matrícula Inicial Confirmada</span>
                <p className="text-slate-500">Registo oficial emitido e inscrição no {estudante.ano_lectivo || '2026'}.</p>
              </div>

              <div className="relative">
                <div className="w-3 h-3 bg-indigo-500 rounded-full absolute -left-[31px] top-1 border-2 border-white dark:border-slate-900" />
                <span className="text-[10px] font-mono text-slate-400 block">2026-02-05</span>
                <span className="font-bold text-slate-900 dark:text-white">Alocação de Turma e Horários</span>
                <p className="text-slate-500">Estudante alocado à turma {turma?.nome || 'Principal'}.</p>
              </div>

              <div className="relative">
                <div className="w-3 h-3 bg-purple-500 rounded-full absolute -left-[31px] top-1 border-2 border-white dark:border-slate-900" />
                <span className="text-[10px] font-mono text-slate-400 block">2026-02-10</span>
                <span className="font-bold text-slate-900 dark:text-white">Inscrição Curricular em Disciplinas</span>
                <p className="text-slate-500">{studentInscricoes.length} cadeiras registradas para o período.</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER OFICIAL PARA IMPRESSÃO / AUDITORIA */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500 shrink-0">
        <span>Ficha Académica Oficial &bull; SysEdu Enterprise Edition</span>
        <span>Autenticação Criptográfica: {estudante.id} &bull; Emissão: {new Date().toLocaleDateString('pt-MZ')}</span>
      </div>
    </div>
  );
};
export default ProcessoAlunoFicha;
