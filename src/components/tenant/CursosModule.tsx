/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Módulo Cursos & Cadeiras Curriculares por Tipo de Instituição
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  BookOpen, 
  GraduationCap, 
  Building2, 
  Wrench, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Award, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Users, 
  User,
  Info,
  Calendar,
  X,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { Curso, Cadeira, Escola, Docente, TipoInstituicao } from '../../types';
import { getInstitutionConfig } from '../../config/institutionTypes';

export interface CursosModuleProps {
  tenantId?: string;
  tipoInstituicao?: TipoInstituicao;
  tenantTipoInstituicao?: TipoInstituicao;
  schools: Escola[];
  teachers?: Docente[];
  tenantUsers?: any[];
  cursos: Curso[];
  cadeiras: Cadeira[];
  studentsCountByCurso?: Record<string, number>;
  onSaveCurso: (curso: Partial<Curso>) => Promise<void>;
  onDeleteCurso: (cursoId: string, cursoNome?: string) => Promise<void>;
  onSaveCadeira: (cadeira: Partial<Cadeira>) => Promise<void>;
  onDeleteCadeira: (cadeiraId: string, cadeiraNome?: string) => Promise<void>;
  hasPermission?: (modulo: string, acao: string) => boolean;
}

export const CursosModule: React.FC<CursosModuleProps> = ({
  tenantId = '',
  tipoInstituicao,
  tenantTipoInstituicao,
  schools,
  teachers = [],
  tenantUsers = [],
  cursos,
  cadeiras,
  studentsCountByCurso = {},
  onSaveCurso,
  onDeleteCurso,
  onSaveCadeira,
  onDeleteCadeira,
  hasPermission = () => true
}) => {
  const resolvedTipoInstituicao: TipoInstituicao = tipoInstituicao || tenantTipoInstituicao || 'universidade';
  const config = getInstitutionConfig(resolvedTipoInstituicao);
  const isUniversidade = resolvedTipoInstituicao === 'universidade';
  const isInstituto = resolvedTipoInstituicao === 'instituto';
  const isGlobal = tipoInstituicao === 'global';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('todas');
  const [selectedGrauFilter, setSelectedGrauFilter] = useState('todos');

  // Expanded course accordions
  const [expandedCursoIds, setExpandedCursoIds] = useState<string[]>([]);

  // Modals
  const [isCursoModalOpen, setIsCursoModalOpen] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [isSavingCurso, setIsSavingCurso] = useState(false);

  const [isCadeiraModalOpen, setIsCadeiraModalOpen] = useState(false);
  const [editingCadeira, setEditingCadeira] = useState<Cadeira | null>(null);
  const [targetCursoForCadeira, setTargetCursoForCadeira] = useState<Curso | null>(null);
  const [selectedExistingCadeiraId, setSelectedExistingCadeiraId] = useState<string>('');
  const [isSavingCadeira, setIsSavingCadeira] = useState(false);

  // System Popups State (Replacing JS confirm and alert)
  const [systemAlert, setSystemAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning'
  });

  const [systemConfirm, setSystemConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Form State - Curso
  const [cursoForm, setCursoForm] = useState({
    nome: '',
    codigo: '',
    institutionId: schools[0]?.id || '',
    diretor_curso_id: '',
    diretor_curso_nome: '',
    tipo: isInstituto ? 'tecnico' : 'graduacao',
    grau: isInstituto ? 'Técnico Médio' : 'Licenciatura',
    duracao_anos: isInstituto ? 2 : 4,
    duracao_periodos: isInstituto ? 6 : 8,
    regime: isInstituto ? 'modular' : 'semestral',
    nivelEnsino: isInstituto ? 'profissional' : 'superior',
    area_especializacao: '',
    faculdade_unidade: '',
    descricao: ''
  });

  // Form State - Cadeira
  const [cadeiraForm, setCadeiraForm] = useState({
    nome: '',
    codigo: '',
    ano_curricular: 1,
    periodo_lectivo: isInstituto ? 'Módulo 1' : '1º Semestre',
    regime_periodo: isInstituto ? 'modulo' : 'semestre',
    creditos_ects: 5,
    horas_teoricas: 30,
    horas_praticas: 30,
    tipo_disciplina: 'obrigatoria' as 'obrigatoria' | 'opcional',
    pre_requisitos: [] as string[],
    tipo_trabalho_conclusao: 'Nenhum',
    docente_id: '',
    nivel_qualificacao_qnc: 'Nível 4',
    competencia_pratica: '',
    equipamentos_exigidos: '',
    estagio_horas: 0
  });

  const toggleCursoAccordion = (cursoId: string) => {
    setExpandedCursoIds(prev => 
      prev.includes(cursoId) ? prev.filter(id => id !== cursoId) : [...prev, cursoId]
    );
  };

  // Open Create/Edit Curso
  const openCursoModal = (c?: Curso) => {
    if (c) {
      setEditingCurso(c);
      setCursoForm({
        nome: c.nome,
        codigo: c.codigo,
        institutionId: c.institutionId || schools[0]?.id || '',
        diretor_curso_id: c.diretor_curso_id || '',
        diretor_curso_nome: c.diretor_curso_nome || '',
        tipo: c.tipo || (isInstituto ? 'tecnico' : 'graduacao'),
        grau: c.grau || (isInstituto ? 'Técnico Médio' : 'Licenciatura'),
        duracao_anos: c.duracao_anos || (isInstituto ? 2 : 4),
        duracao_periodos: c.duracao_periodos || (isInstituto ? 6 : 8),
        regime: c.regime || (isInstituto ? 'modular' : 'semestral'),
        nivelEnsino: c.nivelEnsino || (isInstituto ? 'profissional' : 'superior'),
        area_especializacao: c.area_especializacao || '',
        faculdade_unidade: c.faculdade_unidade || '',
        descricao: c.descricao || ''
      });
    } else {
      setEditingCurso(null);
      setCursoForm({
        nome: '',
        codigo: '',
        institutionId: schools[0]?.id || '',
        diretor_curso_id: '',
        diretor_curso_nome: '',
        tipo: isInstituto ? 'tecnico' : 'graduacao',
        grau: isInstituto ? 'Técnico Médio' : 'Licenciatura',
        duracao_anos: isInstituto ? 2 : 4,
        duracao_periodos: isInstituto ? 6 : 8,
        regime: isInstituto ? 'modular' : 'semestral',
        nivelEnsino: isInstituto ? 'profissional' : 'superior',
        area_especializacao: '',
        faculdade_unidade: '',
        descricao: ''
      });
    }
    setIsCursoModalOpen(true);
  };

  // Open Create/Edit Cadeira
  const openCadeiraModal = (curso: Curso, cad?: Cadeira) => {
    setTargetCursoForCadeira(curso);
    setSelectedExistingCadeiraId('');
    const isTech = curso.tipo === 'tecnico' || curso.nivelEnsino === 'profissional' || isInstituto;

    if (cad) {
      setEditingCadeira(cad);
      setCadeiraForm({
        nome: cad.nome,
        codigo: cad.codigo,
        ano_curricular: cad.ano_curricular || 1,
        periodo_lectivo: cad.periodo_lectivo || (isTech ? 'Módulo 1' : '1º Semestre'),
        regime_periodo: cad.regime_periodo || (isTech ? 'modulo' : 'semestre'),
        creditos_ects: cad.creditos_ects ?? 5,
        horas_teoricas: cad.horas_teoricas ?? 30,
        horas_praticas: cad.horas_praticas ?? 30,
        tipo_disciplina: cad.tipo_disciplina || 'obrigatoria',
        pre_requisitos: cad.pre_requisitos || [],
        tipo_trabalho_conclusao: cad.tipo_trabalho_conclusao || 'Nenhum',
        docente_id: cad.docente_id || '',
        nivel_qualificacao_qnc: cad.nivel_qualificacao_qnc || 'Nível 4',
        competencia_pratica: cad.competencia_pratica || '',
        equipamentos_exigidos: cad.equipamentos_exigidos || '',
        estagio_horas: cad.estagio_horas || 0
      });
    } else {
      setEditingCadeira(null);
      setCadeiraForm({
        nome: '',
        codigo: '',
        ano_curricular: 1,
        periodo_lectivo: isTech ? 'Módulo 1' : '1º Semestre',
        regime_periodo: isTech ? 'modulo' : 'semestre',
        creditos_ects: 5,
        horas_teoricas: 30,
        horas_praticas: 30,
        tipo_disciplina: 'obrigatoria',
        pre_requisitos: [],
        tipo_trabalho_conclusao: 'Nenhum',
        docente_id: '',
        nivel_qualificacao_qnc: 'Nível 4',
        competencia_pratica: '',
        equipamentos_exigidos: '',
        estagio_horas: 0
      });
    }
    setIsCadeiraModalOpen(true);
  };

  const handleSaveCursoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoForm.nome.trim() || !cursoForm.codigo.trim()) return;

    // Check duplicate code
    const isDup = cursos.some(c => 
      c.codigo.trim().toLowerCase() === cursoForm.codigo.trim().toLowerCase() && 
      c.id !== editingCurso?.id
    );
    if (isDup) {
      setSystemAlert({
        isOpen: true,
        title: 'Código de Curso Já em Uso',
        message: `O código "${cursoForm.codigo}" já está atribuído a outro curso cadastrado no sistema. Por favor, defina um código identificador único.`,
        type: 'warning'
      });
      return;
    }

    setIsSavingCurso(true);
    try {
      await onSaveCurso({
        ...(editingCurso || {}),
        ...cursoForm,
        tenant_id: tenantId,
        ativo: editingCurso ? editingCurso.ativo : true
      });
      setIsCursoModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setSystemAlert({
        isOpen: true,
        title: 'Erro ao Salvar Curso',
        message: err?.message || 'Ocorreu um erro ao gravar as alterações do curso.',
        type: 'error'
      });
    } finally {
      setIsSavingCurso(false);
    }
  };

  const handleSaveCadeiraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCursoForCadeira || !cadeiraForm.nome.trim() || !cadeiraForm.codigo.trim()) return;

    // Evitar cadastro duplicado de cadeiras se não estiver a vincular cadeira existente
    if (!selectedExistingCadeiraId) {
      const codeDuplicate = cadeiras.some(c => 
        c.codigo.trim().toLowerCase() === cadeiraForm.codigo.trim().toLowerCase() && 
        c.id !== editingCadeira?.id
      );
      if (codeDuplicate) {
        setSystemAlert({
          isOpen: true,
          title: 'Cadeira Já Cadastrada no Sistema',
          message: `A cadeira com o código "${cadeiraForm.codigo}" já existe no sistema. Utilize a opção "Selecionar cadeira existente" acima para associá-la a este curso, ou altere o código para criar uma nova.`,
          type: 'warning'
        });
        return;
      }
    }

    setIsSavingCadeira(true);
    try {
      const cadeiraIdToUse = selectedExistingCadeiraId || editingCadeira?.id;
      await onSaveCadeira({
        ...(editingCadeira || {}),
        ...cadeiraForm,
        ...(cadeiraIdToUse ? { id: cadeiraIdToUse } : {}),
        tenant_id: tenantId,
        institutionId: targetCursoForCadeira.institutionId || schools[0]?.id || '',
        cursoId: targetCursoForCadeira.id
      });
      setIsCadeiraModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setSystemAlert({
        isOpen: true,
        title: 'Erro ao Salvar Cadeira',
        message: err?.message || 'Ocorreu um erro ao gravar a disciplina/cadeira.',
        type: 'error'
      });
    } finally {
      setIsSavingCadeira(false);
    }
  };

  // Filtered Cursos
  const filteredCursos = useMemo(() => {
    return cursos.filter(c => {
      const matchSearch = searchTerm === '' || 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.area_especializacao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.diretor_curso_nome || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSchool = selectedSchoolFilter === 'todas' || c.institutionId === selectedSchoolFilter;
      const matchGrau = selectedGrauFilter === 'todos' || c.grau === selectedGrauFilter;

      return matchSearch && matchSchool && matchGrau;
    });
  }, [cursos, searchTerm, selectedSchoolFilter, selectedGrauFilter]);

  // Total de estudantes matriculados em tempo real
  const getCourseStudentCount = (cursoId: string) => {
    return studentsCountByCurso[cursoId] || 0;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {isInstituto ? <Wrench className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isInstituto ? 'Qualificações Técnicas & Módulos' : isUniversidade ? 'Cursos de Graduação & Cadeiras' : 'Cursos & Planos Curriculares'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão curricular com directores de curso, cadeiras curriculares, créditos ECTS e sincronização em tempo real de estudantes matriculados.
          </p>
        </div>

        {hasPermission('classes', 'criar') && (
          <button
            onClick={() => openCursoModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isInstituto ? 'Nova Qualificação Técnica' : 'Novo Curso'}
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome, código, área ou director..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={selectedSchoolFilter}
            onChange={(e) => setSelectedSchoolFilter(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todas">Todas as Unidades / Faculdades</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedGrauFilter}
            onChange={(e) => setSelectedGrauFilter(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todos os Graus Académicos</option>
            <option value="Licenciatura">Licenciatura</option>
            <option value="Mestrado">Mestrado</option>
            <option value="Doutoramento">Doutoramento</option>
            <option value="Técnico Médio">Técnico Médio (QNC)</option>
            <option value="Técnico Básico">Técnico Básico</option>
          </select>
        </div>
      </div>

      {/* Cursos List / Accordions */}
      {filteredCursos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto stroke-1" />
          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Nenhum curso cadastrado</h4>
          <p className="text-xs text-slate-400">Clique em "Novo Curso" para criar e estruturar a grade curricular da instituição.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCursos.map((curso) => {
            const isExpanded = expandedCursoIds.includes(curso.id);
            const cursoCadeiras = cadeiras.filter(c => c.cursoId === curso.id);
            const schoolName = schools.find(s => s.id === curso.institutionId)?.nome || 'Faculdade Geral';
            const totalCredits = cursoCadeiras.reduce((acc, c) => acc + (c.creditos_ects || 0), 0);
            const totalStudents = getCourseStudentCount(curso.id);

            // Group cadeiras by periodo_lectivo
            const cadeirasByPeriod = cursoCadeiras.reduce((acc, cad) => {
              const p = cad.periodo_lectivo || '1º Período';
              if (!acc[p]) acc[p] = [];
              acc[p].push(cad);
              return acc;
            }, {} as Record<string, Cadeira[]>);

            return (
              <div 
                key={curso.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-all"
              >
                {/* Course Header Bar */}
                <div 
                  onClick={() => toggleCursoAccordion(curso.id)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-slate-850/60 transition-colors text-slate-900 dark:text-slate-100 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-indigo-500" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                          {curso.codigo}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate">
                          {curso.nome}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {curso.grau || curso.tipo}
                        </span>
                        {curso.diretor_curso_nome && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            <User className="w-3 h-3 text-indigo-500" /> Dir: {curso.diretor_curso_nome}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {schoolName}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {curso.duracao_anos ? `${curso.duracao_anos} Anos` : `${curso.duracao_periodos || 4} Períodos`}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {cursoCadeiras.length} Cadeiras</span>
                        <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {totalCredits} ECTS</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {totalStudents} Estudantes Matriculados
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {hasPermission('classes', 'editar') && (
                      <button
                        onClick={() => openCursoModal(curso)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar Curso"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission('classes', 'excluir') && (
                      <button
                        onClick={() => {
                          setSystemConfirm({
                            isOpen: true,
                            title: 'Eliminar Curso',
                            message: `Tem a certeza que deseja eliminar o curso "${curso.nome}"? Todas as disciplinas e vínculos associados serão afetados.`,
                            confirmText: 'Sim, Eliminar Curso',
                            onConfirm: () => onDeleteCurso(curso.id, curso.nome)
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Eliminar Curso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Course Details & Curricular Grid (When Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-5 space-y-5">
                    {/* Course Extra Metadata Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Director do Curso</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {curso.diretor_curso_nome || (curso.diretor_curso_id ? (teachers.find(t => t.id === curso.diretor_curso_id)?.nome || 'Atribuído') : 'Não Atribuído')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Regime de Avaliação</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{curso.regime || 'Semestral / ECTS'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Área / Faculdade</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{curso.faculdade_unidade || curso.area_especializacao || 'Faculdade Geral'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Nível Académico</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{curso.nivelEnsino}</span>
                      </div>
                    </div>

                    {/* Curricular Accordion / Periods */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-500" />
                          Grade Curricular &bull; Cadeiras Estruturadas por Período
                        </h4>

                        {hasPermission('disciplinas', 'criar') && (
                          <button
                            onClick={() => openCadeiraModal(curso)}
                            className="bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Adicionar Cadeira ao Curso
                          </button>
                        )}
                      </div>

                      {cursoCadeiras.length === 0 ? (
                        <div className="p-5 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400">
                          Nenhuma cadeira ou módulo curricular associado a este curso ainda.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(cadeirasByPeriod).map(([periodName, cadList]) => (
                            <div key={periodName} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                              <div className="bg-slate-100/70 dark:bg-slate-850 p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {periodName} ({cadList.length} Cadeiras)
                                </span>
                                <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                  {cadList.reduce((acc, c) => acc + (c.creditos_ects || 0), 0)} ECTS Total
                                </span>
                              </div>

                              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {cadList.map((cad) => {
                                  const teacherName = teachers.find(t => t.id === cad.docente_id)?.nome;
                                  return (
                                    <div key={cad.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            {cad.codigo}
                                          </span>
                                          <span className="font-bold text-slate-900 dark:text-white">
                                            {cad.nome}
                                          </span>
                                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                            cad.tipo_disciplina === 'obrigatoria' 
                                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50' 
                                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                          }`}>
                                            {cad.tipo_disciplina === 'obrigatoria' ? 'Obrigatória' : 'Opcional'}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                                          {cad.creditos_ects && <span>{cad.creditos_ects} ECTS</span>}
                                          <span>{cad.horas_teoricas || 0}h T / {cad.horas_praticas || 0}h P</span>
                                          {teacherName && <span>Prof. {teacherName}</span>}
                                          {cad.nivel_qualificacao_qnc && <span>{cad.nivel_qualificacao_qnc}</span>}
                                          {cad.estagio_horas ? <span>Estágio: {cad.estagio_horas}h</span> : null}
                                          {cad.pre_requisitos && cad.pre_requisitos.length > 0 && (
                                            <span className="text-amber-600 font-semibold">
                                              Pré-req: {cad.pre_requisitos.length} cadeira(s)
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                        <button
                                          onClick={() => openCadeiraModal(curso, cad)}
                                          className="p-1 rounded text-slate-400 hover:text-indigo-600 cursor-pointer"
                                          title="Editar Cadeira"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSystemConfirm({
                                              isOpen: true,
                                              title: 'Eliminar Cadeira',
                                              message: `Tem a certeza que deseja eliminar a cadeira "${cad.nome}" deste curso?`,
                                              confirmText: 'Sim, Eliminar',
                                              onConfirm: () => onDeleteCadeira(cad.id, cad.nome)
                                            });
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                          title="Eliminar Cadeira"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR CURSO */}
      {isCursoModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#05070b]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b101b] rounded-2xl max-w-xl w-full p-6 border border-slate-800 shadow-2xl space-y-4 text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-base text-slate-100">
                {editingCurso ? 'Editar Curso Universitário' : 'Novo Curso Universitário'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsCursoModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCursoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Curso *
                </label>
                <input
                  type="text"
                  required
                  value={cursoForm.nome}
                  onChange={(e) => setCursoForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Engenharia Informática ou Medicina Geral"
                  className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Código do Curso (Único) *
                  </label>
                  <input
                    type="text"
                    required
                    value={cursoForm.codigo}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: LEI-01 ou MED-01"
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Faculdade / Unidade Orgânica *
                  </label>
                  <select
                    required
                    value={cursoForm.institutionId}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, institutionId: e.target.value }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  >
                    <option value="">Selecione...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dropdown: Director do Curso */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Director do Curso (Docente Responsável)
                </label>
                <select
                  value={cursoForm.diretor_curso_id}
                  onChange={(e) => {
                    const dId = e.target.value;
                    const docMatch = teachers.find(t => t.id === dId);
                    const usrMatch = tenantUsers.find(u => u.id === docMatch?.user_id);
                    const dName = usrMatch?.nome || docMatch?.nome || '';
                    setCursoForm(prev => ({
                      ...prev,
                      diretor_curso_id: dId,
                      diretor_curso_nome: dName
                    }));
                  }}
                  className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                >
                  <option value="">-- Selecione o Director do Curso --</option>
                  {teachers.map(t => {
                    const usr = tenantUsers.find(u => u.id === t.user_id);
                    const name = usr?.nome || t.nome || 'Docente';
                    return (
                      <option key={t.id} value={t.id}>
                        {name} {t.especialidade ? `(${t.especialidade})` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Atribua o docente responsável pela gestão pedagógica e direcção deste curso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Grau Académico
                  </label>
                  <select
                    value={cursoForm.grau}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, grau: e.target.value }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="Licenciatura">Licenciatura</option>
                    <option value="Mestrado">Mestrado</option>
                    <option value="Doutoramento">Doutoramento</option>
                    <option value="Técnico Médio">Técnico Médio (QNC)</option>
                    <option value="Técnico Básico">Técnico Básico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Duração em Anos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={cursoForm.duracao_anos}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, duracao_anos: Number(e.target.value) }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Regime
                  </label>
                  <select
                    value={cursoForm.regime}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, regime: e.target.value }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="semestral">Semestral / ECTS</option>
                    <option value="modular">Modular (Competências)</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Área de Especialização / Faculdade
                </label>
                <input
                  type="text"
                  value={cursoForm.faculdade_unidade}
                  onChange={(e) => setCursoForm(prev => ({ ...prev, faculdade_unidade: e.target.value }))}
                  placeholder="Ex: Faculdade de Engenharia e Tecnologias"
                  className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCursoModalOpen(false)}
                  className="w-1/3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium py-2.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCurso}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-xs shadow-sm shadow-indigo-600/30 transition cursor-pointer"
                >
                  {isSavingCurso ? 'A gravar...' : 'Gravar Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR CADEIRA */}
      {isCadeiraModalOpen && targetCursoForCadeira && (
        <div className="fixed inset-0 z-50 bg-[#05070b]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b101b] rounded-2xl max-w-xl w-full p-6 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">
                  {targetCursoForCadeira.nome} ({targetCursoForCadeira.codigo})
                </span>
                <h3 className="font-semibold text-base text-slate-100 mt-0.5">
                  {editingCadeira ? 'Editar Cadeira Curricular' : 'Adicionar Cadeira ao Curso'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCadeiraModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCadeiraSubmit} className="space-y-4">
              {/* Dropdown: Selecionar cadeira existente (Opcional) */}
              {!editingCadeira && (
                <div className="bg-[#0e1422] p-3.5 rounded-xl border border-indigo-900/40 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                    Selecionar Cadeira Existente (Opcional)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Selecione uma cadeira já cadastrada no sistema para vinculá-la a este curso, ou preencha o formulário abaixo para criar uma nova.
                  </p>
                  <select
                    value={selectedExistingCadeiraId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedExistingCadeiraId(cId);
                      if (cId) {
                        const existingCad = cadeiras.find(c => c.id === cId);
                        if (existingCad) {
                          setCadeiraForm(prev => ({
                            ...prev,
                            nome: existingCad.nome,
                            codigo: existingCad.codigo,
                            ano_curricular: existingCad.ano_curricular || 1,
                            periodo_lectivo: existingCad.periodo_lectivo || '1º Semestre',
                            regime_periodo: existingCad.regime_periodo || 'semestre',
                            creditos_ects: existingCad.creditos_ects ?? 5,
                            horas_teoricas: existingCad.horas_teoricas ?? 30,
                            horas_praticas: existingCad.horas_praticas ?? 30,
                            tipo_disciplina: existingCad.tipo_disciplina || 'obrigatoria',
                            docente_id: existingCad.docente_id || ''
                          }));
                        }
                      }
                    }}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Ou criar nova cadeira preenchendo abaixo --</option>
                    {cadeiras
                      .filter(c => c.cursoId !== targetCursoForCadeira.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.codigo}] {c.nome} ({c.creditos_ects || 0} ECTS)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome da Cadeira *
                </label>
                <input
                  type="text"
                  required
                  value={cadeiraForm.nome}
                  onChange={(e) => setCadeiraForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Algoritmos e Estruturas de Dados ou Cálculo Diferencial"
                  className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Código da Cadeira *
                  </label>
                  <input
                    type="text"
                    required
                    value={cadeiraForm.codigo}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: AED-101 ou CALC-01"
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Período Lectivo *
                  </label>
                  <select
                    value={cadeiraForm.periodo_lectivo}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, periodo_lectivo: e.target.value }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  >
                    <option value="1º Semestre">1º Semestre</option>
                    <option value="2º Semestre">2º Semestre</option>
                    <option value="3º Semestre">3º Semestre</option>
                    <option value="4º Semestre">4º Semestre</option>
                    <option value="5º Semestre">5º Semestre</option>
                    <option value="6º Semestre">6º Semestre</option>
                    <option value="7º Semestre">7º Semestre</option>
                    <option value="8º Semestre">8º Semestre</option>
                    <option value="Módulo 1">Módulo 1</option>
                    <option value="Módulo 2">Módulo 2</option>
                    <option value="Módulo 3">Módulo 3</option>
                    <option value="Ano Curricular">Ano Curricular Completo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Ano Curricular
                  </label>
                  <select
                    value={cadeiraForm.ano_curricular}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, ano_curricular: Number(e.target.value) }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value={1}>1º Ano</option>
                    <option value={2}>2º Ano</option>
                    <option value={3}>3º Ano</option>
                    <option value={4}>4º Ano</option>
                    <option value={5}>5º Ano</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Créditos (ECTS)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={cadeiraForm.creditos_ects}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, creditos_ects: Number(e.target.value) }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Cadeira
                  </label>
                  <select
                    value={cadeiraForm.tipo_disciplina}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, tipo_disciplina: e.target.value as any }))}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="obrigatoria">Obrigatória</option>
                    <option value="opcional">Opcional / Electiva</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Regente / Docente Responsável
                </label>
                <select
                  value={cadeiraForm.docente_id}
                  onChange={(e) => setCadeiraForm(prev => ({ ...prev, docente_id: e.target.value }))}
                  className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200"
                >
                  <option value="">-- Selecione o Docente --</option>
                  {teachers.map(t => {
                    const u = tenantUsers.find(usr => usr.id === t.user_id);
                    return (
                      <option key={t.id} value={t.id}>
                        {u?.nome || t.nome || 'Docente'} {t.especialidade ? `(${t.especialidade})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCadeiraModalOpen(false)}
                  className="w-1/3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium py-2.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCadeira}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-xs shadow-sm shadow-indigo-600/30 transition cursor-pointer"
                >
                  {isSavingCadeira ? 'A gravar...' : (selectedExistingCadeiraId ? 'Associar Cadeira' : 'Gravar Cadeira')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SYSTEM CONFIRM POPUP (MODAL) */}
      {systemConfirm.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#05070b]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101b] p-6 rounded-2xl max-w-md w-full border border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-semibold text-slate-100">{systemConfirm.title}</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{systemConfirm.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSystemConfirm(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  systemConfirm.onConfirm();
                  setSystemConfirm(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
              >
                {systemConfirm.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM ALERT POPUP (MODAL) */}
      {systemAlert.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#05070b]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101b] p-6 rounded-2xl max-w-md w-full border border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-semibold text-slate-100">{systemAlert.title}</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{systemAlert.message}</p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSystemAlert(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
