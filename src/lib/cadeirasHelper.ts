/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Auxiliar para unificação de cadeiras cadastradas (Módulo Cadeiras + Módulo Cursos)
 */

import { Cadeira, Classe, Curso } from '../types';

export interface UnifiedCadeiraOption {
  id: string;
  value: string;
  label: string;
  nome: string;
  codigo: string;
  cursoNome: string;
  source: 'cadeiras' | 'classes';
  aliasedIds: string[];
}

export function isBaseDisciplineItem(c: any): boolean {
  if (!c) return false;
  if (c.is_agendamento === true || c.tipo === 'agendamento') return false;
  if (c.disciplina_id && String(c.disciplina_id).trim() !== '') return false;
  if (c.turma_id && c.data && c.horario) return false;
  return true;
}

export function dedupeById<T extends { id?: string | null }>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const rawId = item.id != null ? String(item.id).trim() : '';
    if (rawId) {
      if (seen.has(rawId)) continue;
      seen.add(rawId);
    }
    result.push(item);
  }
  return result;
}

export function buildDistinctDisciplines(classes: Classe[]): { id: string; nome: string }[] {
  if (!Array.isArray(classes) || classes.length === 0) return [];
  const seenIds = new Set<string>();
  const seenNormNames = new Set<string>();
  const list: { id: string; nome: string }[] = [];

  // 1. Priorizar disciplinas/cadeiras base para preservar o id canónico e evitar duplicação
  for (const c of classes) {
    if (!c || !isBaseDisciplineItem(c)) continue;
    const resolvedId = String(c.id || '').trim();
    if (!resolvedId || seenIds.has(resolvedId)) continue;
    seenIds.add(resolvedId);
    const normName = String(c.nome || '').trim().toLowerCase();
    if (normName) seenNormNames.add(normName);
    list.push({ id: resolvedId, nome: c.nome || 'Disciplina' });
  }

  // 2. Completar com agendamentos cuja disciplina ainda não consta na lista pelo mesmo id (ou mesmo nome sem vínculo)
  for (const c of classes) {
    if (!c || isBaseDisciplineItem(c)) continue;
    const discId = String((c as any).disciplina_id || '').trim();
    const resolvedId = discId || String(c.id || '').trim();
    if (!resolvedId || seenIds.has(resolvedId)) continue;
    const normName = String(c.nome || '').trim().toLowerCase();
    if (!discId && normName && seenNormNames.has(normName)) continue;
    seenIds.add(resolvedId);
    if (normName) seenNormNames.add(normName);
    list.push({ id: resolvedId, nome: c.nome || 'Disciplina' });
  }

  return list;
}

export function isHigherOrTechInstitution(tipoInstituicao?: string | null): boolean {
  const norm = (tipoInstituicao || '').trim().toLowerCase();
  return norm === 'universidade' || norm === 'instituto';
}

export function buildAllCadeirasOptions(params: {
  rawClasses: Classe[];
  rawCadeiras: Cadeira[];
  rawCursos: Curso[];
}): UnifiedCadeiraOption[] {
  const { rawClasses = [], rawCadeiras = [], rawCursos = [] } = params;

  const cursoNameById = new Map<string, string>();
  for (const curso of rawCursos) {
    if (curso?.id && curso?.nome) {
      cursoNameById.set(curso.id, curso.nome.trim());
    }
  }

  const entries: UnifiedCadeiraOption[] = [];
  const byDocId = new Map<string, UnifiedCadeiraOption>();

  const findMergeTarget = (
    docId: string,
    normName: string,
    normCode: string,
    cursoId: string
  ): UnifiedCadeiraOption | undefined => {
    if (docId && byDocId.has(docId)) {
      return byDocId.get(docId);
    }
    return entries.find((existing) => {
      const existingNormName = existing.nome.trim().toLowerCase();
      const existingNormCode = existing.codigo.trim().toLowerCase();
      if (normCode && existingNormCode) {
        if (normCode === existingNormCode && normName === existingNormName) {
          // Quando sincronizada entre módulos, `classes` pode estar sem `curso_id`
          return true;
        }
        return false;
      }
      if (!normCode && !existingNormCode && normName === existingNormName) {
        if (!cursoId) return true;
        const resolvedCursoName = cursoNameById.get(cursoId) || '';
        return !existing.cursoNome || existing.cursoNome === resolvedCursoName;
      }
      return false;
    });
  };

  const formatLabel = (nome: string, codigo: string, cursoNome: string): string => {
    const codePart = codigo ? ` [${codigo}]` : '';
    const cursoPart = cursoNome ? ` — ${cursoNome}` : '';
    return `${nome}${codePart}${cursoPart}`;
  };

  const addOrMergeItem = (raw: {
    id: string;
    nome: string;
    codigo: string;
    cursoId: string;
    cursoNome: string;
    source: 'cadeiras' | 'classes';
  }) => {
    const nome = (raw.nome || '').trim();
    if (!raw.id || !nome) return;

    const codigo = (raw.codigo || '').trim();
    const resolvedCursoNome =
      (raw.cursoNome || '').trim() ||
      (raw.cursoId ? cursoNameById.get(raw.cursoId) || '' : '');

    const normName = nome.toLowerCase();
    const normCode = codigo.toLowerCase();
    const target = findMergeTarget(raw.id, normName, normCode, raw.cursoId);

    if (target) {
      if (!target.aliasedIds.includes(raw.id)) {
        target.aliasedIds.push(raw.id);
      }
      if (!target.codigo && codigo) {
        target.codigo = codigo;
      }
      if (!target.cursoNome && resolvedCursoNome) {
        target.cursoNome = resolvedCursoNome;
      }
      target.label = formatLabel(target.nome, target.codigo, target.cursoNome);
      byDocId.set(raw.id, target);
      return;
    }

    const option: UnifiedCadeiraOption = {
      id: raw.id,
      value: raw.id,
      label: formatLabel(nome, codigo, resolvedCursoNome),
      nome,
      codigo,
      cursoNome: resolvedCursoNome,
      source: raw.source,
      aliasedIds: [raw.id],
    };
    entries.push(option);
    byDocId.set(raw.id, option);
  };

  // 1. Todas as cadeiras cadastradas pelo Módulo Cadeiras (`classes` base)
  for (const cls of rawClasses) {
    if (!isBaseDisciplineItem(cls)) continue;
    const anyCls = cls as any;
    addOrMergeItem({
      id: cls.id,
      nome: cls.nome,
      codigo: cls.codigo || '',
      cursoId: anyCls.curso_id || anyCls.cursoId || '',
      cursoNome: anyCls.curso_nome || '',
      source: 'classes',
    });
  }

  // 2. Todas as cadeiras cadastradas pelo Módulo Cursos (`cadeiras`)
  for (const cad of rawCadeiras) {
    if (!cad) continue;
    const anyCad = cad as any;
    addOrMergeItem({
      id: cad.id,
      nome: cad.nome,
      codigo: cad.codigo || '',
      cursoId: cad.cursoId || cad.curso_id || '',
      cursoNome: cad.curso_nome || anyCad.cursoNome || '',
      source: 'cadeiras',
    });
  }

  return entries.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}
