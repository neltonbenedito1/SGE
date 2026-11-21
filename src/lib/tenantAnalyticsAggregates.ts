/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agregados pré-calculados para o módulo Análise Administrativa.
 * Evita recalcular métricas sobre todas as colecções a cada abertura do painel.
 * Documento principal: `/tenant_analytics/{tenantId}`
 */

import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CourseCapacityAggregate {
  curso_id: string;
  curso_nome: string;
  matriculados: number;
  capacidade_estimada: number;
  ocupacao_percent: number;
}

export interface RoomOccupancyAggregate {
  sala_id: string;
  nome: string;
  capacidade: number;
  turmas_alocadas: number;
  estudantes_alocados: number;
  ocupacao_percent: number;
}

export interface SchoolSummaryAggregate {
  escola_id: string;
  nome: string;
  estudantes: number;
  docentes: number;
  turmas: number;
  media_geral: number;
  taxa_aprovacao: number;
}

export interface TenantAnalyticsAggregate {
  tenant_id: string;
  schema_version: number;
  updated_at: string;
  totais: {
    escolas: number;
    docentes: number;
    estudantes_ativos: number;
    estudantes_inativos: number;
    turmas: number;
    salas: number;
    cursos: number;
    cadeiras: number;
    capacidade_total_salas: number;
    racio_aluno_docente: number;
  };
  aproveitamento: {
    total_pautas: number;
    aprovados: number;
    recuperacao: number;
    reprovados: number;
    soma_notas: number;
    media_geral: number;
    taxa_aprovacao: number;
  };
  assiduidade: {
    total_logs: number;
    presentes: number;
    faltas: number;
    justificadas: number;
    taxa_assiduidade: number;
  };
  modulos: {
    atividades_total: number;
    atividades_pendentes: number;
    atividades_concluidas: number;
    planos_aula_total: number;
    planos_aula_lecionados: number;
    capacidade_media_por_curso: number;
    capacidade_media_por_modulo: number;
    ocupacao_geral_percent: number;
  };
  capacidade_por_curso: Record<string, CourseCapacityAggregate>;
  ocupacao_por_sala: Record<string, RoomOccupancyAggregate>;
  por_escola: Record<string, SchoolSummaryAggregate>;
}

/**
 * Lê o documento agregado pré-calculado do tenant.
 */
export async function fetchTenantAnalyticsAggregate(
  tenantId: string
): Promise<TenantAnalyticsAggregate | null> {
  if (!tenantId || !tenantId.trim()) return null;
  try {
    const snap = await getDoc(doc(db, 'tenant_analytics', tenantId.trim()));
    if (!snap.exists()) return null;
    return snap.data() as TenantAnalyticsAggregate;
  } catch (err) {
    console.warn('[TenantAnalyticsAggregates] Aviso ao ler agregado:', err);
    return null;
  }
}

/**
 * Constrói o agregado completo a partir dos conjuntos de dados do tenant e persiste em `/tenant_analytics/{tenantId}`.
 */
export function buildTenantAnalyticsAggregate(params: {
  tenantId: string;
  schools: any[];
  teachers: any[];
  students: any[];
  turmas: any[];
  classes: any[];
  salas: any[];
  cursos: any[];
  cadeiras: any[];
  pautas: any[];
  assiduidadeLogs: any[];
  atividades: any[];
  planoAulas: any[];
}): TenantAnalyticsAggregate {
  const {
    tenantId,
    schools = [],
    teachers = [],
    students = [],
    turmas = [],
    classes = [],
    salas = [],
    cursos = [],
    cadeiras = [],
    pautas = [],
    assiduidadeLogs = [],
    atividades = [],
    planoAulas = [],
  } = params;

  const activeStudents = students.filter((s) => s.ativo !== false);
  const inactiveStudents = students.length - activeStudents.length;
  const totalSalasCapacidade = salas.reduce((acc, s) => acc + (Number(s.capacidade) || 30), 0);
  const racioAlunoDocente = teachers.length > 0 ? Number((activeStudents.length / teachers.length).toFixed(1)) : 0;

  let aprovados = 0;
  let recuperacao = 0;
  let reprovados = 0;
  let somaNotas = 0;

  const pautasByStudent = new Map<string, any[]>();
  for (const p of pautas) {
    const media = Number(p.nota_media) || 0;
    somaNotas += media;
    if (p.situacao === 'Aprovado') aprovados++;
    else if (p.situacao === 'Recuperação') recuperacao++;
    else if (p.situacao === 'Reprovado') reprovados++;

    if (p.estudante_id) {
      const list = pautasByStudent.get(p.estudante_id) || [];
      list.push(p);
      pautasByStudent.set(p.estudante_id, list);
    }
  }

  const mediaGeral = pautas.length > 0 ? Number((somaNotas / pautas.length).toFixed(1)) : 0;
  const taxaAprovacao = pautas.length > 0 ? Math.round((aprovados / pautas.length) * 100) : 0;

  let presentes = 0;
  let faltas = 0;
  let justificadas = 0;
  for (const log of assiduidadeLogs) {
    const tipo = (log.tipo || log.status || '').toLowerCase();
    if (tipo === 'presente') presentes++;
    else if (tipo === 'justificada' || log.justificado) justificadas++;
    else if (tipo === 'falta' || tipo === 'ausente') faltas++;
  }
  const totalAssid = assiduidadeLogs.length;
  const taxaAssiduidade = totalAssid > 0 ? Number((((presentes + justificadas) / totalAssid) * 100).toFixed(1)) : 100;

  const ativConcluidas = atividades.filter((a) => a.estado === 'Concluído' || a.status === 'concluido').length;
  const ativPendentes = atividades.length - ativConcluidas;
  const planosLecionados = planoAulas.filter((p) => p.status === 'lecionado').length;

  const modulesCount = classes.length > 0 ? classes.length : cadeiras.length;
  const capPorCurso = cursos.length > 0 ? Math.floor(totalSalasCapacidade / cursos.length) : 0;
  const capPorModulo = modulesCount > 0 ? Math.floor(totalSalasCapacidade / modulesCount) : 0;
  const ocupacaoGeral = totalSalasCapacidade > 0 ? Math.min(100, Math.round((activeStudents.length / totalSalasCapacidade) * 100)) : 0;

  const capacidadePorCurso: Record<string, CourseCapacityAggregate> = {};
  for (const c of cursos) {
    const cId = c.id;
    const countMatriculados = activeStudents.filter((s) => s.curso_id === cId || s.curso === c.nome).length;
    const capEstimada = Number(c.capacidade) || capPorCurso || 40;
    capacidadePorCurso[cId] = {
      curso_id: cId,
      curso_nome: c.nome || cId,
      matriculados: countMatriculados,
      capacidade_estimada: capEstimada,
      ocupacao_percent: capEstimada > 0 ? Math.min(100, Math.round((countMatriculados / capEstimada) * 100)) : 0,
    };
  }

  const ocupacaoPorSala: Record<string, RoomOccupancyAggregate> = {};
  for (const sala of salas) {
    const sId = sala.id;
    const cap = Number(sala.capacidade) || 30;
    const turmasSala = turmas.filter((t) => t.sala_id === sId || t.sala === sala.nome);
    const turmaIdSet = new Set(turmasSala.map((t) => t.id));
    const studsSala = activeStudents.filter((st) => turmaIdSet.has(st.turma_id)).length;
    ocupacaoPorSala[sId] = {
      sala_id: sId,
      nome: sala.nome || sId,
      capacidade: cap,
      turmas_alocadas: turmasSala.length,
      estudantes_alocados: studsSala,
      ocupacao_percent: cap > 0 ? Math.min(100, Math.round((studsSala / cap) * 100)) : 0,
    };
  }

  const porEscola: Record<string, SchoolSummaryAggregate> = {};
  for (const sch of schools) {
    const schStudents = activeStudents.filter((s) => s.escola_id === sch.id);
    const schTeachers = teachers.filter((t) => t.escola_id === sch.id);
    const schTurmas = turmas.filter((t) => t.escola_id === sch.id);
    let schSoma = 0;
    let schPautasCount = 0;
    let schAprov = 0;
    for (const st of schStudents) {
      const stPautas = pautasByStudent.get(st.id) || [];
      for (const p of stPautas) {
        schSoma += Number(p.nota_media) || 0;
        schPautasCount++;
        if (p.situacao === 'Aprovado') schAprov++;
      }
    }
    porEscola[sch.id] = {
      escola_id: sch.id,
      nome: sch.nome,
      estudantes: schStudents.length,
      docentes: schTeachers.length,
      turmas: schTurmas.length,
      media_geral: schPautasCount > 0 ? Number((schSoma / schPautasCount).toFixed(1)) : 0,
      taxa_aprovacao: schPautasCount > 0 ? Math.round((schAprov / schPautasCount) * 100) : 0,
    };
  }

  return {
    tenant_id: tenantId,
    schema_version: 1,
    updated_at: new Date().toISOString(),
    totais: {
      escolas: schools.length,
      docentes: teachers.length,
      estudantes_ativos: activeStudents.length,
      estudantes_inativos: inactiveStudents,
      turmas: turmas.length,
      salas: salas.length,
      cursos: cursos.length,
      cadeiras: cadeiras.length,
      capacidade_total_salas: totalSalasCapacidade,
      racio_aluno_docente: racioAlunoDocente,
    },
    aproveitamento: {
      total_pautas: pautas.length,
      aprovados,
      recuperacao,
      reprovados,
      soma_notas: Number(somaNotas.toFixed(2)),
      media_geral: mediaGeral,
      taxa_aprovacao: taxaAprovacao,
    },
    assiduidade: {
      total_logs: totalAssid,
      presentes,
      faltas,
      justificadas,
      taxa_assiduidade: taxaAssiduidade,
    },
    modulos: {
      atividades_total: atividades.length,
      atividades_pendentes: ativPendentes,
      atividades_concluidas: ativConcluidas,
      planos_aula_total: planoAulas.length,
      planos_aula_lecionados: planosLecionados,
      capacidade_media_por_curso: capPorCurso,
      capacidade_media_por_modulo: capPorModulo,
      ocupacao_geral_percent: ocupacaoGeral,
    },
    capacidade_por_curso: capacidadePorCurso,
    ocupacao_por_sala: ocupacaoPorSala,
    por_escola: porEscola,
  };
}

/**
 * Recalcula e persiste o documento agregado em `/tenant_analytics/{tenantId}`.
 */
export async function recomputeAndPersistTenantAnalytics(
  params: Parameters<typeof buildTenantAnalyticsAggregate>[0]
): Promise<TenantAnalyticsAggregate | null> {
  if (!params.tenantId || !params.tenantId.trim()) return null;
  try {
    const aggregate = buildTenantAnalyticsAggregate(params);
    await setDoc(doc(db, 'tenant_analytics', params.tenantId.trim()), aggregate, { merge: true });
    return aggregate;
  } catch (err) {
    console.warn('[TenantAnalyticsAggregates] Falha ao gravar agregado:', err);
    return null;
  }
}

export type AnalyticsEventType =
  | 'student_created'
  | 'student_deactivated'
  | 'teacher_created'
  | 'grade_recorded'
  | 'attendance_recorded'
  | 'lesson_plan_completed';

/**
 * Aplica actualização incremental atómica por evento ao documento `/tenant_analytics/{tenantId}`.
 */
export async function applyAnalyticsDelta(
  tenantId: string,
  event: AnalyticsEventType,
  payload?: { nota?: number; situacao?: string; tipoPresenca?: string; count?: number }
): Promise<void> {
  if (!tenantId || !tenantId.trim()) return;
  const ref = doc(db, 'tenant_analytics', tenantId.trim());
  const nowIso = new Date().toISOString();
  const deltaCount = typeof payload?.count === 'number' && payload.count > 0 ? payload.count : 1;

  try {
    switch (event) {
      case 'student_created':
        await setDoc(
          ref,
          { tenant_id: tenantId, updated_at: nowIso, totais: { estudantes_ativos: increment(deltaCount) } },
          { merge: true }
        );
        break;
      case 'student_deactivated':
        await setDoc(
          ref,
          {
            tenant_id: tenantId,
            updated_at: nowIso,
            totais: { estudantes_ativos: increment(-1), estudantes_inativos: increment(1) },
          },
          { merge: true }
        );
        break;
      case 'teacher_created':
        await setDoc(
          ref,
          { tenant_id: tenantId, updated_at: nowIso, totais: { docentes: increment(1) } },
          { merge: true }
        );
        break;
      case 'grade_recorded': {
        const sit = payload?.situacao || '';
        const nota = Number(payload?.nota) || 0;
        await setDoc(
          ref,
          {
            tenant_id: tenantId,
            updated_at: nowIso,
            aproveitamento: {
              total_pautas: increment(1),
              soma_notas: increment(nota),
              ...(sit === 'Aprovado' ? { aprovados: increment(1) } : {}),
              ...(sit === 'Recuperação' ? { recuperacao: increment(1) } : {}),
              ...(sit === 'Reprovado' ? { reprovados: increment(1) } : {}),
            },
          },
          { merge: true }
        );
        break;
      }
      case 'attendance_recorded': {
        const tipo = (payload?.tipoPresenca || '').toLowerCase();
        await setDoc(
          ref,
          {
            tenant_id: tenantId,
            updated_at: nowIso,
            assiduidade: {
              total_logs: increment(1),
              ...(tipo === 'presente' ? { presentes: increment(1) } : {}),
              ...(tipo === 'falta' || tipo === 'ausente' ? { faltas: increment(1) } : {}),
              ...(tipo === 'justificada' ? { justificadas: increment(1) } : {}),
            },
          },
          { merge: true }
        );
        break;
      }
      case 'lesson_plan_completed':
        await setDoc(
          ref,
          {
            tenant_id: tenantId,
            updated_at: nowIso,
            modulos: { planos_aula_lecionados: increment(1) },
          },
          { merge: true }
        );
        break;
    }
  } catch (err) {
    console.warn(`[TenantAnalyticsAggregates] Aviso no delta (${event}):`, err);
  }
}
