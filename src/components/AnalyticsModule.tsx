import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, Award, Users, BookOpen, GraduationCap, School, 
  Percent, ShieldAlert, BarChart3, ListChecks, ArrowUpRight 
} from 'lucide-react';

interface School {
  id: string;
  nome: string;
  provincia_id: string;
  ativo: boolean;
}

interface Teacher {
  id: string;
  escola_id: string;
  especialidade: string;
}

interface Student {
  id: string;
  escola_id: string;
  genero: 'Masculino' | 'Feminino';
  turma_id: string;
}

interface Turma {
  id: string;
  escola_id: string;
  nome: string;
  nivel: string;
}

interface Classe {
  id: string;
  turma_id: string;
  nome: string;
  docente_id: string;
}

interface Pauta {
  id: string;
  estudante_id: string;
  classe_id: string;
  nota_media: number;
  situacao: 'Aprovado' | 'Reprovado' | 'Recuperação';
}

interface TenantUser {
  id: string;
  nome: string;
  tipo: string;
}

interface AnalyticsModuleProps {
  role: 'admin' | 'director' | 'docente' | 'estudante' | 'pai';
  schools: School[];
  teachers: Teacher[];
  students: Student[];
  turmas: Turma[];
  classes: Classe[];
  pautas: Pauta[];
  tenantUsers: TenantUser[];
  currentTeacher?: Teacher | null;
  loggedInUser?: any;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function AnalyticsModule({
  role,
  schools,
  teachers,
  students,
  turmas,
  classes,
  pautas,
  tenantUsers,
  currentTeacher,
  loggedInUser
}: AnalyticsModuleProps) {

  // --- 1. FILTER DATA BY ROLE AND USER SCOPE ---
  // If teacher/docente, restrict records to their assigned classes/students
  const isDocente = role === 'docente' || loggedInUser?.tipo === 'docente';
  const isDirector = role === 'director' || loggedInUser?.tipo === 'director';
  const isAdmin = role === 'admin' || loggedInUser?.tipo === 'admin';

  let filteredSchools = [...schools];
  let filteredTeachers = [...teachers];
  let filteredStudents = [...students];
  let filteredTurmas = [...turmas];
  let filteredClasses = [...classes];
  let filteredPautas = [...pautas];

  if (isDirector) {
    // A Director is bound to their school. Let's find their school.
    const schoolId = currentTeacher?.escola_id || schools[0]?.id; // Default fallback to first school if needed
    filteredSchools = schools.filter(s => s.id === schoolId);
    filteredTeachers = teachers.filter(t => t.escola_id === schoolId);
    filteredStudents = students.filter(s => s.escola_id === schoolId);
    filteredTurmas = turmas.filter(t => t.escola_id === schoolId);
    
    const schoolTurmaIds = filteredTurmas.map(t => t.id);
    filteredClasses = classes.filter(c => schoolTurmaIds.includes(c.turma_id));
    
    const schoolStudentIds = filteredStudents.map(s => s.id);
    filteredPautas = pautas.filter(p => schoolStudentIds.includes(p.estudante_id));
  } else if (isDocente) {
    // A Docente sees classes they teach and associated students/pautas
    const docenteId = currentTeacher?.id || '';
    filteredClasses = classes.filter(c => c.docente_id === docenteId);
    const docenteTurmaIds = filteredClasses.map(c => c.turma_id);
    
    filteredTurmas = turmas.filter(t => docenteTurmaIds.includes(t.id));
    filteredStudents = students.filter(s => docenteTurmaIds.includes(s.turma_id));
    
    const docenteStudentIds = filteredStudents.map(s => s.id);
    filteredPautas = pautas.filter(p => docenteStudentIds.includes(p.estudante_id));
    
    // Schools that own these turmas
    const schoolIds = filteredTurmas.map(t => t.escola_id);
    filteredSchools = schools.filter(s => schoolIds.includes(s.id));
  }

  // --- 2. CALCULATE COMMON METRICS ---
  const totalSchools = filteredSchools.length;
  const totalTeachers = filteredTeachers.length;
  const totalStudents = filteredStudents.length;
  const totalTurmas = filteredTurmas.length;
  const totalClasses = filteredClasses.length;
  const totalUsers = tenantUsers.length;

  const avgGrade = filteredPautas.length > 0
    ? (filteredPautas.reduce((acc, curr) => acc + (curr.nota_media || 0), 0) / filteredPautas.length).toFixed(1)
    : '0.0';

  const approvedCount = filteredPautas.filter(p => p.situacao === 'Aprovado').length;
  const recoveryCount = filteredPautas.filter(p => p.situacao === 'Recuperação').length;
  const reprovedCount = filteredPautas.filter(p => p.situacao === 'Reprovado').length;
  const totalGrades = filteredPautas.length;

  const approvalRate = totalGrades > 0
    ? ((approvedCount / totalGrades) * 100).toFixed(0)
    : '0';

  // --- 3. CHART DATA PREPARATION ---

  // Chart A: Status Distribution (Pie Chart)
  const statusData = [
    { name: 'Aprovado', value: approvedCount },
    { name: 'Recuperação', value: recoveryCount },
    { name: 'Reprovado', value: reprovedCount }
  ].filter(item => item.value > 0);

  // Chart B: Gender Distribution
  const maleCount = filteredStudents.filter(s => s.genero === 'Masculino').length;
  const femaleCount = filteredStudents.filter(s => s.genero === 'Feminino').length;
  const genderData = [
    { name: 'Masculino', value: maleCount },
    { name: 'Feminino', value: femaleCount }
  ].filter(item => item.value > 0);

  // Chart C: School Density (For Admin/Director) - Students & Teachers per School
  const schoolDensityData = filteredSchools.map(sch => {
    const schStudents = filteredStudents.filter(s => s.escola_id === sch.id).length;
    const schTeachers = filteredTeachers.filter(t => t.escola_id === sch.id).length;
    return {
      name: sch.nome.length > 18 ? sch.nome.substring(0, 15) + '...' : sch.nome,
      Estudantes: schStudents,
      Docentes: schTeachers
    };
  });

  // Chart D: Subject Average Grades
  const subjectAverages = filteredClasses.map(cls => {
    const clsGrades = filteredPautas.filter(p => p.classe_id === cls.id);
    const avg = clsGrades.length > 0
      ? (clsGrades.reduce((sum, g) => sum + g.nota_media, 0) / clsGrades.length)
      : 0;
    return {
      name: cls.nome,
      Media: parseFloat(avg.toFixed(1))
    };
  }).filter(item => item.Media > 0);

  // Chart E: Class-wise student performance (Top Turmas)
  const turmaPerformance = filteredTurmas.map(t => {
    const tStudents = filteredStudents.filter(s => s.turma_id === t.id).map(s => s.id);
    const tGrades = filteredPautas.filter(p => tStudents.includes(p.estudante_id));
    const avg = tGrades.length > 0
      ? (tGrades.reduce((sum, g) => sum + g.nota_media, 0) / tGrades.length)
      : 0;
    return {
      name: t.nome,
      Media: parseFloat(avg.toFixed(1)),
      Alunos: tStudents.length
    };
  }).filter(item => item.Alunos > 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Overview Intro Card */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-indigo-900 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/30">
            Análises e Estatísticas Acadêmicas
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight font-sans">
            {isAdmin ? 'Painel Consolidado de Gestão' : isDirector ? `Estatísticas da Escola: ${schools[0]?.nome || ''}` : 'Estatísticas das Minhas Turmas'}
          </h2>
          <p className="text-indigo-200 text-sm max-w-2xl leading-relaxed">
            Consulte métricas fundamentais de desempenho acadêmico, distribuição populacional, aprovações e tendências gerais configuradas para o seu nível de acesso.
          </p>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Estudantes</span>
            <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 font-sans">{totalStudents}</h3>
            <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-1">
              <TrendingUp className="w-3 h-3" /> Ativos
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Média de Notas</span>
            <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 font-sans">{avgGrade}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Escala 0 a 20 valores</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Taxa de Aprovação</span>
            <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 font-sans">{approvalRate}%</h3>
            <p className="text-[10px] font-bold text-indigo-500 mt-1">Média maior que 10</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Turmas e Matérias</span>
            <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 font-sans">{totalTurmas} / {totalClasses}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Unidades curriculares</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card: Status Distribution (Left Pie Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-600" />
              Rendimento Escolar (Pautas)
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Situação dos alunos nas pautas trimestrais</p>
          </div>

          <div className="h-56 flex items-center justify-center relative">
            {statusData.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Nenhuma nota lançada para renderizar o gráfico.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Aprovado' ? '#10b981' : entry.name === 'Recuperação' ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} lançamentos`]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Inner Center Label */}
            {statusData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Aprovados</span>
                <span className="text-xl font-black text-slate-800">{approvedCount}</span>
              </div>
            )}
          </div>

          {/* Custom Legends */}
          {statusData.length > 0 && (
            <div className="grid grid-cols-3 gap-1 pt-2 text-center text-[10px] font-bold">
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-150 p-1.5 rounded-lg">
                <p>Aprovados</p>
                <p className="text-xs mt-0.5">{approvedCount}</p>
              </div>
              <div className="bg-amber-50 text-amber-700 border border-amber-150 p-1.5 rounded-lg">
                <p>Recuperação</p>
                <p className="text-xs mt-0.5">{recoveryCount}</p>
              </div>
              <div className="bg-rose-50 text-rose-700 border border-rose-150 p-1.5 rounded-lg">
                <p>Reprovados</p>
                <p className="text-xs mt-0.5">{reprovedCount}</p>
              </div>
            </div>
          )}
        </div>

        {/* Card: Subject Average Performance (Center Bar Chart) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-emerald-600" />
              Média por Disciplina / Matéria
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Nota média atingida em cada unidade curricular</p>
          </div>

          <div className="h-60">
            {subjectAverages.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-16">
                Não há notas suficientes para exibir as médias por disciplina.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAverages} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 20]} />
                  <Tooltip formatter={(value) => [`${value} valores`, 'Média']} />
                  <Bar dataKey="Media" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={28}>
                    {subjectAverages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.Media >= 10 ? '#4f46e5' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-[10px] font-medium text-slate-400 flex items-center justify-between border-t border-slate-100 pt-3">
            <span>Legenda: barras em <span className="font-bold text-red-500">vermelho</span> indicam médias abaixo da linha de corte (10 valores)</span>
            <span className="font-mono font-bold text-indigo-600 uppercase">Média Geral: {avgGrade}</span>
          </div>
        </div>

      </div>

      {/* Lower Row depending on role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Dynamic performance list */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ListChecks className="w-4.5 h-4.5 text-indigo-600" />
              {isAdmin ? 'Estatística de Densidade Escolar' : 'Desempenho por Turma'}
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
              {isAdmin ? 'Volume de alunos e corpo docente por instituição' : 'Análise comparativa de médias por turma'}
            </p>
          </div>

          {isAdmin ? (
            schools.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">Nenhuma escola cadastrada.</div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {schools.map((sch) => {
                  const sCount = students.filter(s => s.escola_id === sch.id).length;
                  const tCount = teachers.filter(t => t.escola_id === sch.id).length;
                  return (
                    <div key={sch.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-800 text-xs truncate max-w-[200px]">{sch.nome}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">ID: {sch.id}</p>
                      </div>
                      <div className="flex gap-2 text-[10px] font-bold">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
                          🎓 {sCount} Alunos
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                          🧑‍🏫 {tCount} Docentes
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            turmaPerformance.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">Nenhuma turma com notas suficiente.</div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {turmaPerformance.map((tp, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{tp.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Estudantes matriculados: {tp.Alunos}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg ${tp.Media >= 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'}`}>
                        {tp.Media} Val
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Section 2: Gender and distribution metrics */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-amber-600" />
              Equilíbrio Demográfico / Gênero
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Proporção de estudantes masculinos e femininos</p>
          </div>

          <div className="h-44 flex items-center justify-center relative">
            {genderData.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold">Sem dados de estudantes para renderizar proporção de gênero.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell key="cell-0" fill="#4f46e5" />
                    <Cell key="cell-1" fill="#ec4899" />
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} estudantes`]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {genderData.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-1 text-center text-xs font-bold">
              <div className="bg-indigo-50/50 text-indigo-700 border border-indigo-100 p-2.5 rounded-xl">
                <p className="text-[10px] text-indigo-400 uppercase">Estudantes Homens</p>
                <p className="text-base font-black mt-1 font-mono">{maleCount}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">({((maleCount / totalStudents) * 100).toFixed(0)}%)</p>
              </div>
              <div className="bg-pink-50/50 text-pink-700 border border-pink-100 p-2.5 rounded-xl">
                <p className="text-[10px] text-pink-400 uppercase">Estudantes Mulheres</p>
                <p className="text-base font-black mt-1 font-mono">{femaleCount}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">({((femaleCount / totalStudents) * 100).toFixed(0)}%)</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
