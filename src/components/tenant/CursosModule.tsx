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
  Info,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import { Curso, Cadeira, Escola, Docente, TipoInstituicao } from '../../types';
import { getInstitutionConfig } from '../../config/institutionTypes';

export interface CursosModuleProps {
  tenantId?: string;
  tipoInstituicao?: TipoInstituicao;
  tenantTipoInstituicao?: TipoInstituicao;
  schools: Escola[];
  teachers?: Docente[];
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
  const [isSavingCadeira, setIsSavingCadeira] = useState(false);

  // Form State - Curso
  const [cursoForm, setCursoForm] = useState({
    nome: '',
    codigo: '',
    institutionId: schools[0]?.id || '',
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
      alert(`Erro: O código "${cursoForm.codigo}" já está em uso por outro curso.`);
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCurso(false);
    }
  };

  const handleSaveCadeiraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCursoForCadeira || !cadeiraForm.nome.trim() || !cadeiraForm.codigo.trim()) return;

    setIsSavingCadeira(true);
    try {
      await onSaveCadeira({
        ...(editingCadeira || {}),
        ...cadeiraForm,
        tenant_id: tenantId,
        institutionId: targetCursoForCadeira.institutionId || schools[0]?.id || '',
        cursoId: targetCursoForCadeira.id
      });
      setIsCadeiraModalOpen(false);
    } catch (err) {
      console.error(err);
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
        (c.area_especializacao || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSchool = selectedSchoolFilter === 'todas' || c.institutionId === selectedSchoolFilter;
      const matchGrau = selectedGrauFilter === 'todos' || c.grau === selectedGrauFilter;

      return matchSearch && matchSchool && matchGrau;
    });
  }, [cursos, searchTerm, selectedSchoolFilter, selectedGrauFilter]);

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
            Gestão curricular estruturada com cadeiras, créditos ECTS, competências QNC/NQF e requisitos obrigatórios.
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
            placeholder="Pesquisar por nome, código ou área..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={selectedSchoolFilter}
          onChange={(e) => setSelectedSchoolFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="todas">Todas as Unidades ({schools.length})</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>

        <select
          value={selectedGrauFilter}
          onChange={(e) => setSelectedGrauFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="todos">Todos os Graus / Níveis</option>
          <option value="Licenciatura">Licenciatura</option>
          <option value="Mestrado">Mestrado</option>
          <option value="Doutoramento">Doutoramento</option>
          <option value="Técnico Médio">Técnico Médio (QNC)</option>
          <option value="Técnico Básico">Técnico Básico</option>
        </select>
      </div>

      {/* Cursos Accordion List */}
      {filteredCursos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300">Nenhum curso cadastrado</h3>
          <p className="text-xs mt-1">Clique em "Novo Curso" para configurar a grade curricular e disciplinas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCursos.map(curso => {
            const isExpanded = expandedCursoIds.includes(curso.id);
            const cursoCadeiras = cadeiras.filter(cad => cad.cursoId === curso.id);
            const totalCredits = cursoCadeiras.reduce((acc, c) => acc + (c.creditos_ects || 0), 0);
            const totalStudents = studentsCountByCurso[curso.id] || 0;
            const schoolName = schools.find(s => s.id === curso.institutionId)?.nome || 'Unidade Geral';

            // Group cadeiras by period
            const cadeirasByPeriod = cursoCadeiras.reduce((acc, cad) => {
              const p = cad.periodo_lectivo || 'Geral';
              if (!acc[p]) acc[p] = [];
              acc[p].push(cad);
              return acc;
            }, {} as Record<string, Cadeira[]>);

            return (
              <div 
                key={curso.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Course Header Bar */}
                <div 
                  onClick={() => toggleCursoAccordion(curso.id)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 transition-colors text-slate-900 dark:text-slate-100 group"
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
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>🏫 {schoolName}</span>
                        <span>⏱️ {curso.duracao_anos ? `${curso.duracao_anos} Anos` : `${curso.duracao_periodos || 4} Períodos`}</span>
                        <span>📚 {cursoCadeiras.length} Disciplinas / Módulos</span>
                        <span>🎓 {totalCredits} ECTS</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">👥 {totalStudents} Estudantes Matriculados</span>
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
                          if (confirm(`Tem a certeza que deseja eliminar o curso "${curso.nome}"?`)) {
                            onDeleteCurso(curso.id, curso.nome);
                          }
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
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
                          Plano Curricular Estruturado ({cursoCadeiras.length} Cadeiras)
                        </h4>
                        {hasPermission('classes', 'criar') && (
                          <button
                            onClick={() => openCadeiraModal(curso)}
                            className="bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {curso.tipo === 'tecnico' ? 'Adicionar Módulo' : 'Adicionar Cadeira'}
                          </button>
                        )}
                      </div>

                      {cursoCadeiras.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                          Nenhuma cadeira ou disciplina cadastrada neste plano curricular.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(cadeirasByPeriod).map(([period, list]) => (
                            <div key={period} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="bg-slate-100 dark:bg-slate-850 px-4 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                  {period} &bull; {list.length} {curso.tipo === 'tecnico' ? 'Módulos' : 'Cadeiras'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {list.reduce((acc, c) => acc + (c.creditos_ects || 0), 0)} ECTS
                                </span>
                              </div>

                              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {list.map(cad => {
                                  const teacherName = teachers.find(t => t.id === cad.docente_id)?.nome;
                                  return (
                                    <div key={cad.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                      <div className="space-y-1">
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
                                          {cad.creditos_ects && <span>⭐ {cad.creditos_ects} ECTS</span>}
                                          <span>⏱️ {cad.horas_teoricas || 0}h T / {cad.horas_praticas || 0}h P</span>
                                          {teacherName && <span>🧑‍🏫 Prof. {teacherName}</span>}
                                          {cad.nivel_qualificacao_qnc && <span>🏆 {cad.nivel_qualificacao_qnc}</span>}
                                          {cad.estagio_horas ? <span>🏭 Estágio: {cad.estagio_horas}h</span> : null}
                                          {cad.pre_requisitos && cad.pre_requisitos.length > 0 && (
                                            <span className="text-amber-600 font-semibold">
                                              🔒 Pré-req: {cad.pre_requisitos.length} cadeira(s)
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
                                            if (confirm(`Eliminar a cadeira "${cad.nome}"?`)) {
                                              onDeleteCadeira(cad.id, cad.nome);
                                            }
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingCurso ? 'Editar Curso / Qualificação' : 'Novo Curso / Qualificação'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsCursoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCursoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nome do Curso / Qualificação *
                </label>
                <input
                  type="text"
                  required
                  value={cursoForm.nome}
                  onChange={(e) => setCursoForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Engenharia Informática ou Técnico Médio em Contabilidade"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Código do Curso (Único) *
                  </label>
                  <input
                    type="text"
                    required
                    value={cursoForm.codigo}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: LEI-01 ou T-MEC-03"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Unidade / Escola Institucional *
                  </label>
                  <select
                    required
                    value={cursoForm.institutionId}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, institutionId: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Grau Académico
                  </label>
                  <select
                    value={cursoForm.grau}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, grau: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Licenciatura">Licenciatura</option>
                    <option value="Mestrado">Mestrado</option>
                    <option value="Doutoramento">Doutoramento</option>
                    <option value="Técnico Médio">Técnico Médio (QNC)</option>
                    <option value="Técnico Básico">Técnico Básico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Duração em Anos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={cursoForm.duracao_anos}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, duracao_anos: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Regime
                  </label>
                  <select
                    value={cursoForm.regime}
                    onChange={(e) => setCursoForm(prev => ({ ...prev, regime: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="semestral">Semestral / ECTS</option>
                    <option value="modular">Modular (Competências)</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Faculdade / Área de Especialização
                </label>
                <input
                  type="text"
                  value={cursoForm.faculdade_unidade}
                  onChange={(e) => setCursoForm(prev => ({ ...prev, faculdade_unidade: e.target.value }))}
                  placeholder="Ex: Faculdade de Ciências Tecnológicas ou Departamento de Gestão"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCursoModalOpen(false)}
                  className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCurso}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase">
                  {targetCursoForCadeira.nome} ({targetCursoForCadeira.codigo})
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                  {editingCadeira ? 'Editar Cadeira / Módulo' : 'Nova Cadeira / Módulo'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCadeiraModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCadeiraSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nome da Cadeira / Módulo *
                </label>
                <input
                  type="text"
                  required
                  value={cadeiraForm.nome}
                  onChange={(e) => setCadeiraForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Algoritmos e Estrutura de Dados ou Manutenção de Motores"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Código da Cadeira *
                  </label>
                  <input
                    type="text"
                    required
                    value={cadeiraForm.codigo}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: AED-101 ou MOD-MEC-01"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Período Lectivo Dinâmico *
                  </label>
                  <select
                    value={cadeiraForm.periodo_lectivo}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, periodo_lectivo: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold"
                  >
                    {targetCursoForCadeira.regime === 'modular' || isInstituto ? (
                      <>
                        <option value="Módulo 1">Módulo 1</option>
                        <option value="Módulo 2">Módulo 2</option>
                        <option value="Módulo 3">Módulo 3</option>
                        <option value="Módulo 4">Módulo 4</option>
                        <option value="Módulo 5">Módulo 5</option>
                        <option value="Módulo 6">Módulo 6</option>
                        <option value="Estágio Curricular">Estágio Curricular</option>
                      </>
                    ) : (
                      <>
                        <option value="1º Semestre">1º Semestre</option>
                        <option value="2º Semestre">2º Semestre</option>
                        <option value="3º Semestre">3º Semestre</option>
                        <option value="4º Semestre">4º Semestre</option>
                        <option value="5º Semestre">5º Semestre</option>
                        <option value="6º Semestre">6º Semestre</option>
                        <option value="7º Semestre">7º Semestre</option>
                        <option value="8º Semestre">8º Semestre</option>
                        <option value="1º Trimestre">1º Trimestre</option>
                        <option value="2º Trimestre">2º Trimestre</option>
                        <option value="3º Trimestre">3º Trimestre</option>
                        <option value="Ano Curricular">Ano Curricular Completo</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Ano Curricular
                  </label>
                  <select
                    value={cadeiraForm.ano_curricular}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, ano_curricular: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value={1}>1º Ano</option>
                    <option value={2}>2º Ano</option>
                    <option value={3}>3º Ano</option>
                    <option value={4}>4º Ano</option>
                    <option value={5}>5º Ano</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Créditos (ECTS)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={cadeiraForm.creditos_ects}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, creditos_ects: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tipo de Cadeira
                  </label>
                  <select
                    value={cadeiraForm.tipo_disciplina}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, tipo_disciplina: e.target.value as any }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="obrigatoria">Obrigatória (Nuclear)</option>
                    <option value="opcional">Opcional / Electiva</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Horas Teóricas
                  </label>
                  <input
                    type="number"
                    value={cadeiraForm.horas_teoricas}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, horas_teoricas: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Horas Práticas / Laboratório
                  </label>
                  <input
                    type="number"
                    value={cadeiraForm.horas_praticas}
                    onChange={(e) => setCadeiraForm(prev => ({ ...prev, horas_praticas: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Docente Responsável
                </label>
                <select
                  value={cadeiraForm.docente_id}
                  onChange={(e) => setCadeiraForm(prev => ({ ...prev, docente_id: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">-- Sem docente atribuído --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.especialidade || 'Docente'})</option>
                  ))}
                </select>
              </div>

              {/* Instituto Specific Fields */}
              {(isInstituto || targetCursoForCadeira.tipo === 'tecnico') && (
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                    Especificações Técnicas (QNC/NQF)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nível de Qualificação
                      </label>
                      <select
                        value={cadeiraForm.nivel_qualificacao_qnc}
                        onChange={(e) => setCadeiraForm(prev => ({ ...prev, nivel_qualificacao_qnc: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs"
                      >
                        <option value="Nível 3">Nível 3 (Básico)</option>
                        <option value="Nível 4">Nível 4 (Médio Técnico)</option>
                        <option value="Nível 5">Nível 5 (Pós-Médio Especializado)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Carga Horária de Estágio (Horas)
                      </label>
                      <input
                        type="number"
                        value={cadeiraForm.estagio_horas}
                        onChange={(e) => setCadeiraForm(prev => ({ ...prev, estagio_horas: Number(e.target.value) }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Competência Prática Esperada
                    </label>
                    <input
                      type="text"
                      value={cadeiraForm.competencia_pratica}
                      onChange={(e) => setCadeiraForm(prev => ({ ...prev, competencia_pratica: e.target.value }))}
                      placeholder="Ex: Executar montagem de painéis elétricos industriais"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCadeiraModalOpen(false)}
                  className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCadeira}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-indigo-600/20"
                >
                  {isSavingCadeira ? 'A gravar...' : 'Gravar Cadeira'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
