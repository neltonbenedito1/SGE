import React, { useState, useMemo } from 'react';
import { 
  FolderOpen, 
  User, 
  GraduationCap, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus, 
  Download, 
  Bell, 
  Search, 
  Filter, 
  Edit3, 
  Eye, 
  Trash2, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Award, 
  ShieldCheck, 
  RefreshCw,
  Building2,
  Paperclip,
  Check,
  AlertTriangle
} from 'lucide-react';
import { 
  Estudante, 
  Docente, 
  ProcessoAluno, 
  ProcessoDocente, 
  ProcessoTipo, 
  ProcessoDocenteTipo, 
  User as UserType, 
  Turma, 
  Escola, 
  FormacaoAcademica 
} from '../types';

interface ProcessoIndividualModuleProps {
  students: Estudante[];
  teachers: Docente[];
  processosAlunos: ProcessoAluno[];
  processosDocentes: ProcessoDocente[];
  tenantUsers: UserType[];
  turmas: Turma[];
  schools: Escola[];
  currentUserRole: string;
  loggedInUser: UserType | null;
  hasPermission: (module: string, action?: string) => boolean;
  onOpenStudentDossier: (student: Estudante) => void;
  onNotifyStudentMissingData: (student: Estudante) => void;
  onOpenStudentProcessModal: (processo?: ProcessoAluno | null) => void;
  onSaveProcessoDocente: (processo: Partial<ProcessoDocente>) => Promise<void>;
  onUpdateDocenteDossier: (docenteId: string, updatedFields: Partial<Docente>) => Promise<void>;
  onNotifyTeacherMissingData: (docente: Docente) => void;
  onRefreshData?: () => void;
}

const PROCESSO_DOCENTE_TIPOS: ProcessoDocenteTipo[] = [
  'Admissão',
  'Progressão na Carreira',
  'Avaliação de Desempenho',
  'Licença / Dispensa',
  'Transferência de Escola',
  'Dossiê Individual',
  'Rescisão Contratual'
];

export default function ProcessoIndividualModule({
  students,
  teachers,
  processosAlunos,
  processosDocentes,
  tenantUsers,
  turmas,
  schools,
  currentUserRole,
  loggedInUser,
  hasPermission,
  onOpenStudentDossier,
  onNotifyStudentMissingData,
  onOpenStudentProcessModal,
  onSaveProcessoDocente,
  onUpdateDocenteDossier,
  onNotifyTeacherMissingData,
  onRefreshData
}: ProcessoIndividualModuleProps) {
  // Main Category Tab: 'alunos' | 'docentes'
  const [mainTab, setMainTab] = useState<'alunos' | 'docentes'>('alunos');
  // Segment: 'dossiers' | 'workflow'
  const [segment, setSegment] = useState<'dossiers' | 'workflow'>('dossiers');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'completo' | 'incompleto'>('todos');
  const [escolaFilter, setEscolaFilter] = useState<string>('todos');

  // Docente Dossier Modal
  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  const [isDocenteDossierOpen, setIsDocenteDossierOpen] = useState(false);
  const [docenteDossierTab, setDocenteDossierTab] = useState<'dados' | 'formacao' | 'documentos' | 'processos'>('dados');
  const [newDocumentName, setNewDocumentName] = useState('');

  // Processo Docente Workflow Modal
  const [isProcessoDocenteModalOpen, setIsProcessoDocenteModalOpen] = useState(false);
  const [editingProcessoDocente, setEditingProcessoDocente] = useState<ProcessoDocente | null>(null);
  const [processoDocenteForm, setProcessoDocenteForm] = useState({
    docente_id: '',
    tipo: PROCESSO_DOCENTE_TIPOS[0],
    status: 'Solicitação' as any,
    observacao: '',
    documentos: ['requerimento_oficial.pdf']
  });

  const isAdminOrDirector = currentUserRole === 'admin' || currentUserRole === 'director';

  // --- FILTERED ALUNOS DOSSIERS ---
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const usr = tenantUsers.find(u => u.id === s.user_id);
      const studentName = (usr?.nome || s.nome || '').toLowerCase();
      const studentMat = (s.numero_matricula || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || studentName.includes(q) || studentMat.includes(q);
      const matchesEscola = escolaFilter === 'todos' || s.escola_id === escolaFilter;

      const hasBI = !!s.documento_identificacao;
      const hasPai = !!s.nome_pai;
      const hasMae = !!s.nome_mae;
      const hasMorada = !!s.morada;
      const isComplete = hasBI && hasPai && hasMae && hasMorada;

      const matchesStatus = statusFilter === 'todos' || 
        (statusFilter === 'completo' && isComplete) || 
        (statusFilter === 'incompleto' && !isComplete);

      return matchesSearch && matchesEscola && matchesStatus;
    });
  }, [students, tenantUsers, searchQuery, escolaFilter, statusFilter]);

  // --- FILTERED DOCENTES DOSSIERS ---
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const usr = tenantUsers.find(u => u.id === t.user_id);
      const teacherName = (usr?.nome || t.nome || '').toLowerCase();
      const teacherCode = (t.codigo_docente || t.numero_registro || '').toLowerCase();
      const teacherEsp = (t.especialidade || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || teacherName.includes(q) || teacherCode.includes(q) || teacherEsp.includes(q);
      const matchesEscola = escolaFilter === 'todos' || t.escola_id === escolaFilter;

      // Check completeness for teacher
      const hasBI = !!t.documento_identificacao;
      const hasNuit = !!t.nuit;
      const hasEmail = !!t.email || !!usr?.email;
      const hasTelefone = !!t.telefone;
      const hasFormacao = !!(t.formacoes_academicas && t.formacoes_academicas.length > 0 && t.formacoes_academicas.some(f => f.curso));
      const isComplete = hasBI && hasNuit && hasEmail && hasTelefone && hasFormacao;

      const matchesStatus = statusFilter === 'todos' || 
        (statusFilter === 'completo' && isComplete) || 
        (statusFilter === 'incompleto' && !isComplete);

      return matchesSearch && matchesEscola && matchesStatus;
    });
  }, [teachers, tenantUsers, searchQuery, escolaFilter, statusFilter]);

  // Teacher completeness helper
  const checkTeacherCompleteness = (t: Docente) => {
    const usr = tenantUsers.find(u => u.id === t.user_id);
    const missing: string[] = [];
    if (!t.nome && !usr?.nome) missing.push('Nome Completo');
    if (!t.documento_identificacao) missing.push('Documento de Identificação (BI/DIRE)');
    if (!t.nuit) missing.push('NUIT');
    if (!t.telefone) missing.push('Contacto Telefónico');
    if (!t.email && !usr?.email) missing.push('E-mail');
    if (!t.endereco) missing.push('Endereço');
    if (!t.data_nascimento) missing.push('Data de Nascimento');
    if (!t.formacoes_academicas || t.formacoes_academicas.length === 0 || !t.formacoes_academicas.some(f => f.curso)) {
      missing.push('Formação Académica');
    }
    return {
      isComplete: missing.length === 0,
      missing
    };
  };

  // Open Docente Dossier
  const handleOpenDocenteDossier = (docente: Docente) => {
    setSelectedDocente(docente);
    setIsDocenteDossierOpen(true);
    setDocenteDossierTab('dados');
  };

  // Open Processo Docente Modal
  const handleOpenCreateProcessoDocente = () => {
    setEditingProcessoDocente(null);
    setProcessoDocenteForm({
      docente_id: teachers[0]?.id || '',
      tipo: PROCESSO_DOCENTE_TIPOS[0],
      status: 'Solicitação',
      observacao: '',
      documentos: ['requerimento_admissao.pdf']
    });
    setIsProcessoDocenteModalOpen(true);
  };

  const handleOpenEditProcessoDocente = (prc: ProcessoDocente) => {
    setEditingProcessoDocente(prc);
    setProcessoDocenteForm({
      docente_id: prc.docente_id,
      tipo: prc.tipo,
      status: prc.status,
      observacao: prc.observacao || '',
      documentos: prc.documentos || ['documento.pdf']
    });
    setIsProcessoDocenteModalOpen(true);
  };

  const handleSaveProcessoDocenteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processoDocenteForm.docente_id) return;

    await onSaveProcessoDocente({
      id: editingProcessoDocente?.id,
      docente_id: processoDocenteForm.docente_id,
      tipo: processoDocenteForm.tipo,
      status: processoDocenteForm.status,
      observacao: processoDocenteForm.observacao,
      documentos: processoDocenteForm.documentos,
      data: editingProcessoDocente?.data || new Date().toISOString().split('T')[0],
      criador_nome: loggedInUser?.nome || 'Administração'
    });

    setIsProcessoDocenteModalOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in duration-200">
      
      {/* Module Header & Sub-Modules Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xl font-sans">
                Processo Individual
              </h3>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                Alunos & Docentes
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gestão integrada de dossiers individuais, documentação comprobatória e fluxos processuais institucionais.
            </p>
          </div>
        </div>

        {/* Main Tab Toggle: Processo do Aluno vs Processo do Docente */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1.5">
          <button
            onClick={() => setMainTab('alunos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'alunos'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Processo do Aluno ({students.length})
          </button>

          <button
            onClick={() => setMainTab('docentes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'docentes'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Processo do Docente ({teachers.length})
          </button>
        </div>
      </div>

      {/* Secondary Bar: Segment Control (Dossiers vs Workflow) & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSegment('dossiers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              segment === 'dossiers'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Dossiers e Fichas Individuais
          </button>

          <button
            onClick={() => setSegment('workflow')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              segment === 'workflow'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Workflow de Processos ({mainTab === 'alunos' ? processosAlunos.length : processosDocentes.length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={mainTab === 'alunos' ? 'Buscar aluno por nome ou matrícula...' : 'Buscar docente por nome, código ou área...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="todos">Todos os Estados</option>
            <option value="completo">✅ Apenas Completos</option>
            <option value="incompleto">⚠️ Com Dados em Falta</option>
          </select>

          {schools.length > 1 && (
            <select
              value={escolaFilter}
              onChange={(e) => setEscolaFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="todos">Todas as Escolas</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SEÇÃO PROCESSO DO ALUNO */}
      {/* ========================================================================= */}
      {mainTab === 'alunos' && (
        <div className="space-y-6">
          {segment === 'dossiers' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-800">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase font-black text-[10px]">
                  <tr className="border-b border-slate-150 dark:border-slate-800">
                    <th className="px-6 py-4">Estudante / Matrícula</th>
                    <th className="px-6 py-4">Turma / Escola</th>
                    <th className="px-6 py-4">Filiação e Morada</th>
                    <th className="px-6 py-4 text-center">Estado do Dossier</th>
                    <th className="px-6 py-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-850 z-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredStudents.map((s) => {
                    const usr = tenantUsers.find((u) => u.id === s.user_id);
                    const trm = turmas.find((t) => t.id === s.turma_id);
                    const esc = schools.find((sc) => sc.id === s.escola_id);

                    const hasBI = !!s.documento_identificacao;
                    const hasPai = !!s.nome_pai;
                    const hasMae = !!s.nome_mae;
                    const hasMorada = !!s.morada;
                    const isComplete = hasBI && hasPai && hasMae && hasMorada;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-extrabold text-slate-900 dark:text-white">{usr?.nome || s.nome || 'Aluno Sem Nome'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Matrícula: {s.numero_matricula}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{trm?.nome || 'Não Alocado'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{esc?.nome || 'Escola Geral'}</p>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-slate-600 dark:text-slate-400 truncate">
                            <span className="font-bold">Filiação: </span>
                            {s.nome_pai || '—'} / {s.nome_mae || '—'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            <span className="font-semibold">Morada: </span>
                            {s.morada || 'Não informada'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                            isComplete 
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                          }`}>
                            {isComplete ? '✅ Completo' : '⚠️ Dados em Falta'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right sticky right-0 bg-white dark:bg-slate-900 z-10">
                          <div className="flex gap-2 justify-end">
                            {!isComplete && (
                              <button
                                onClick={() => onNotifyStudentMissingData(s)}
                                className="bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer border border-amber-200 dark:border-amber-800 transition-all"
                                title="Enviar notificação para Diretor de Turma / Secretaria"
                              >
                                <Bell className="w-3.5 h-3.5" /> Notificar DT
                              </button>
                            )}
                            <button
                              onClick={() => onOpenStudentDossier(s)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                              <FolderOpen className="w-3.5 h-3.5" /> Abrir Dossier
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Nenhum estudante encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {segment === 'workflow' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 font-medium">
                  Fluxo de aprovação e solicitações de matrículas, transferências e ocorrências académicas.
                </p>
                {hasPermission('processos', 'criar') && (
                  <button 
                    onClick={() => onOpenStudentProcessModal(null)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Abrir Processo do Aluno
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {processosAlunos.map(p => {
                  const est = students.find(s => s.id === p.estudante_id);
                  const estUsr = tenantUsers.find(u => u.id === est?.user_id);
                  return (
                    <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {p.tipo}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Estudante: {estUsr?.nome || est?.nome || 'Aluno'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          📝 {p.observacao || 'Nenhuma observação informada.'}
                        </p>
                        <div className="flex gap-2 flex-wrap mt-3">
                          {p.documentos && p.documentos.map(docu => (
                            <span key={docu} className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 flex items-center gap-1">
                              <Download className="w-3 h-3" /> {docu}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-between border-t md:border-none pt-3 md:pt-0">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono">Estado</p>
                          <span className={`inline-block text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full ${
                            p.status === 'Concluído' || p.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            p.status === 'Rejeitado' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {p.status}
                          </span>
                        </div>

                        {hasPermission('processos', 'editar') && (
                          <button 
                            onClick={() => onOpenStudentProcessModal(p)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            Analisar Workflow
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {processosAlunos.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    Nenhum processo de aluno registado no momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEÇÃO PROCESSO DO DOCENTE */}
      {/* ========================================================================= */}
      {mainTab === 'docentes' && (
        <div className="space-y-6">
          {segment === 'dossiers' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-800">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase font-black text-[10px]">
                  <tr className="border-b border-slate-150 dark:border-slate-800">
                    <th className="px-6 py-4">Docente / Código</th>
                    <th className="px-6 py-4">Vínculo & Escola</th>
                    <th className="px-6 py-4">Formação Académica Principal</th>
                    <th className="px-6 py-4 text-center">Estado do Dossier</th>
                    <th className="px-6 py-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-850 z-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredTeachers.map((t) => {
                    const usr = tenantUsers.find((u) => u.id === t.user_id);
                    const esc = schools.find((sc) => sc.id === t.escola_id);
                    const completeness = checkTeacherCompleteness(t);
                    const mainFormacao = t.formacoes_academicas && t.formacoes_academicas[0];

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 overflow-hidden flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                              {t.foto_url ? (
                                <img src={t.foto_url} alt="Docente" className="w-full h-full object-cover" />
                              ) : (
                                (t.nome || usr?.nome || 'D').charAt(0)
                              )}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {t.nome || usr?.nome || 'Docente Sem Nome'}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {t.codigo_docente || t.numero_registro || `ID: ${t.id.substring(0, 8)}`} • {t.categoria_profissional || 'Docente'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.cargo || 'Professor / Docente'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {esc?.nome || 'Escola Geral'} • <span className="font-medium">{t.tipo_vinculo || 'Efetivo'}</span>
                          </p>
                        </td>

                        <td className="px-6 py-4 max-w-xs">
                          {mainFormacao ? (
                            <div>
                              <p className="text-slate-800 dark:text-slate-200 font-bold truncate">
                                {mainFormacao.grau} em {mainFormacao.curso}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {mainFormacao.instituicao} ({mainFormacao.ano_conclusao})
                              </p>
                            </div>
                          ) : (
                            <p className="text-amber-600 dark:text-amber-400 font-medium italic">
                              ⚠️ Nenhuma formação registada
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                            completeness.isComplete
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                          }`}>
                            {completeness.isComplete ? '✅ Completo' : `⚠️ ${completeness.missing.length} Pendências`}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right sticky right-0 bg-white dark:bg-slate-900 z-10">
                          <div className="flex gap-2 justify-end">
                            {!completeness.isComplete && (
                              <button
                                onClick={() => onNotifyTeacherMissingData(t)}
                                className="bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer border border-amber-200 dark:border-amber-800 transition-all"
                                title="Gerar notificação e pendência de atualização documental"
                              >
                                <Bell className="w-3.5 h-3.5" /> Notificar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDocenteDossier(t)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                              <FolderOpen className="w-3.5 h-3.5" /> Abrir Dossier
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Nenhum docente encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {segment === 'workflow' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Fluxo de admissão, progressão na carreira, licenças, dispensas e ocorrências de docentes.
                  </p>
                </div>
                {isAdminOrDirector && (
                  <button 
                    onClick={handleOpenCreateProcessoDocente}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Abrir Processo do Docente
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {processosDocentes.map(p => {
                  const docen = teachers.find(t => t.id === p.docente_id);
                  const docUsr = tenantUsers.find(u => u.id === docen?.user_id);
                  return (
                    <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {p.tipo}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Docente: {docen?.nome || docUsr?.nome || 'Docente'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Data: {p.data}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          📝 {p.observacao || 'Nenhuma observação informada.'}
                        </p>
                        <div className="flex gap-2 flex-wrap mt-3">
                          {p.documentos && p.documentos.map(docu => (
                            <span key={docu} className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 flex items-center gap-1">
                              <Download className="w-3 h-3" /> {docu}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-between border-t md:border-none pt-3 md:pt-0">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono">Estado do Processo</p>
                          <span className={`inline-block text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full ${
                            p.status === 'Concluído' || p.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            p.status === 'Rejeitado' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {p.status}
                          </span>
                        </div>

                        {isAdminOrDirector && (
                          <button 
                            onClick={() => handleOpenEditProcessoDocente(p)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            Analisar Workflow
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {processosDocentes.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    Nenhum processo funcional de docente registrado no momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DOSSIER DO DOCENTE (VISUALIZAÇÃO & COMPLEMENTAÇÃO RICA) */}
      {/* ========================================================================= */}
      {isDocenteDossierOpen && selectedDocente && (
        <div className="fixed inset-0 z-[160000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto">
            
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center font-bold text-lg text-indigo-300 overflow-hidden shrink-0">
                  {selectedDocente.foto_url ? (
                    <img src={selectedDocente.foto_url} alt="Docente" className="w-full h-full object-cover" />
                  ) : (
                    (selectedDocente.nome || 'D').charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white font-sans">
                      Dossier Individual: {selectedDocente.nome}
                    </h3>
                    <span className="text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                      {selectedDocente.codigo_docente || 'ID DOCENTE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedDocente.categoria_profissional || 'Docente'} • {schools.find(s => s.id === selectedDocente.escola_id)?.nome || 'Escola Alocada'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDocenteDossierOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-6 pt-3 gap-3">
              <button
                onClick={() => setDocenteDossierTab('dados')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  docenteDossierTab === 'dados'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                1. Identificação & Contratos
              </button>
              <button
                onClick={() => setDocenteDossierTab('formacao')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  docenteDossierTab === 'formacao'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                2. Formação Académica ({selectedDocente.formacoes_academicas?.length || 0})
              </button>
              <button
                onClick={() => setDocenteDossierTab('processos')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  docenteDossierTab === 'processos'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                3. Histórico de Processos ({processosDocentes.filter(p => p.docente_id === selectedDocente.id).length})
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {docenteDossierTab === 'dados' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  {(() => {
                    const comp = checkTeacherCompleteness(selectedDocente);
                    return (
                      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                        comp.isComplete 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200' 
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                      }`}>
                        {comp.isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <p className="font-bold">
                            {comp.isComplete ? 'Dossier Individual Completo e Verificado' : 'Dossier com Informações Pendentes'}
                          </p>
                          {!comp.isComplete && (
                            <p className="text-[11px] mt-0.5">
                              Faltam os seguintes dados para regularização: <span className="font-semibold">{comp.missing.join(', ')}</span>.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Informações Pessoais */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <User className="w-4 h-4 text-indigo-600" /> Informações Pessoais
                      </h4>
                      <div className="space-y-2 text-slate-700 dark:text-slate-300">
                        <p><strong className="text-slate-500">Nome:</strong> {selectedDocente.nome || '—'}</p>
                        <p><strong className="text-slate-500">Data de Nascimento:</strong> {selectedDocente.data_nascimento || '—'}</p>
                        <p><strong className="text-slate-500">Sexo:</strong> {selectedDocente.genero || '—'}</p>
                        <p><strong className="text-slate-500">Nacionalidade:</strong> {selectedDocente.nacionalidade || '—'}</p>
                        <p><strong className="text-slate-500">Estado Civil:</strong> {selectedDocente.estado_civil || '—'}</p>
                        <p><strong className="text-slate-500">Doc. Identificação:</strong> {selectedDocente.documento_identificacao || '⚠️ Em Falta'}</p>
                        <p><strong className="text-slate-500">NUIT:</strong> {selectedDocente.nuit || '⚠️ Em Falta'}</p>
                        <p><strong className="text-slate-500">Telefone:</strong> {selectedDocente.telefone || '—'}</p>
                        <p><strong className="text-slate-500">E-mail:</strong> {selectedDocente.email || '—'}</p>
                        <p><strong className="text-slate-500">Endereço:</strong> {selectedDocente.endereco || '—'} ({selectedDocente.cidade_provincia || '—'})</p>
                      </div>
                    </div>

                    {/* Informações Profissionais */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-indigo-600" /> Vínculos & Carreira
                      </h4>
                      <div className="space-y-2 text-slate-700 dark:text-slate-300">
                        <p><strong className="text-slate-500">Código Docente:</strong> {selectedDocente.codigo_docente || selectedDocente.id}</p>
                        <p><strong className="text-slate-500">Categoria Profissional:</strong> {selectedDocente.categoria_profissional || 'Docente'}</p>
                        <p><strong className="text-slate-500">Cargo / Função:</strong> {selectedDocente.cargo || 'Docente'}</p>
                        <p><strong className="text-slate-500">Departamento:</strong> {selectedDocente.departamento || '—'}</p>
                        <p><strong className="text-slate-500">Especialidade:</strong> {selectedDocente.especialidade || '—'}</p>
                        <p><strong className="text-slate-500">Nº Registro:</strong> {selectedDocente.numero_registro || '—'}</p>
                        <p><strong className="text-slate-500">Data de Admissão:</strong> {selectedDocente.data_admissao || selectedDocente.data_contratacao || '—'}</p>
                        <p><strong className="text-slate-500">Tipo de Vínculo:</strong> {selectedDocente.tipo_vinculo || 'Efetivo'}</p>
                        <p><strong className="text-slate-500">Regime de Trabalho:</strong> {selectedDocente.regime_trabalho || 'Tempo Integral'}</p>
                        <p><strong className="text-slate-500">Cursos Lecionados:</strong> {selectedDocente.cursos_lecionados?.join(', ') || 'Geral'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {docenteDossierTab === 'formacao' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Titulações e Formação Académica Registada
                  </h4>
                  {selectedDocente.formacoes_academicas && selectedDocente.formacoes_academicas.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDocente.formacoes_academicas.map((f, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">
                                {f.grau}
                              </span>
                              <h5 className="font-extrabold text-slate-900 dark:text-white text-sm">
                                {f.curso}
                              </h5>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300">
                              Instituição: <strong className="text-slate-900 dark:text-white">{f.instituicao}</strong>
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              Ano de Conclusão: {f.ano_conclusao} • País: {f.pais || 'Moçambique'}
                            </p>
                          </div>
                          <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Validado
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl text-slate-400">
                      Nenhuma titulação académica registada para este docente.
                    </div>
                  )}
                </div>
              )}

              {docenteDossierTab === 'processos' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Histórico de Processos Funcionais & Requerimentos
                  </h4>
                  {processosDocentes.filter(p => p.docente_id === selectedDocente.id).length > 0 ? (
                    <div className="space-y-3">
                      {processosDocentes
                        .filter(p => p.docente_id === selectedDocente.id)
                        .map(prc => (
                          <div key={prc.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">
                                  {prc.tipo}
                                </span>
                                <span className="font-mono text-slate-400 text-[10px]">
                                  Data: {prc.data}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1">
                                {prc.observacao || 'Sem observações adicionais.'}
                              </p>
                            </div>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              {prc.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl text-slate-400">
                      Nenhum processo funcional registado para este docente.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-between items-center">
              <button
                type="button"
                onClick={() => onNotifyTeacherMissingData(selectedDocente)}
                className="bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 cursor-pointer"
              >
                <Bell className="w-4 h-4" /> Emitir Notificação de Pendência
              </button>

              <button
                type="button"
                onClick={() => setIsDocenteDossierOpen(false)}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Fechar Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR PROCESSO DO DOCENTE */}
      {/* ========================================================================= */}
      {isProcessoDocenteModalOpen && (
        <div className="fixed inset-0 z-[170000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
            
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingProcessoDocente ? 'Analisar Processo do Docente' : 'Novo Processo Funcional do Docente'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Abertura e tramitação de processos e ocorrências de docentes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProcessoDocenteModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProcessoDocenteSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Docente Referente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={processoDocenteForm.docente_id}
                  onChange={(e) => setProcessoDocenteForm({ ...processoDocenteForm, docente_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Selecionar Docente --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome || 'Docente'} ({t.codigo_docente || t.numero_registro || t.id.substring(0, 6)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Processo <span className="text-red-500">*</span>
                </label>
                <select
                  value={processoDocenteForm.tipo}
                  onChange={(e) => setProcessoDocenteForm({ ...processoDocenteForm, tipo: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                >
                  {PROCESSO_DOCENTE_TIPOS.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Status / Parecer do Processo
                </label>
                <select
                  value={processoDocenteForm.status}
                  onChange={(e) => setProcessoDocenteForm({ ...processoDocenteForm, status: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="Solicitação">Solicitação (Pendente de Análise)</option>
                  <option value="Análise">Em Análise Técnica / Direção</option>
                  <option value="Aprovado">Aprovado e Deferido</option>
                  <option value="Rejeitado">Indeferido / Rejeitado</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Observações / Justificativa / Parecer
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva os detalhes do processo, parecer da direção ou despacho..."
                  value={processoDocenteForm.observacao}
                  onChange={(e) => setProcessoDocenteForm({ ...processoDocenteForm, observacao: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProcessoDocenteModalOpen(false)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Salvar Processo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
