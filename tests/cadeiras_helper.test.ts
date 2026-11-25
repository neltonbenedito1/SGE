import { describe, it, expect } from 'vitest';
import {
  buildAllCadeirasOptions,
  buildDistinctDisciplines,
  dedupeById,
  isBaseDisciplineItem,
  isHigherOrTechInstitution,
} from '../src/lib/cadeirasHelper';
import { Cadeira, Classe, Curso } from '../src/types';

describe('Unificação de Cadeiras para Agendamento de Aulas (Universidades e Institutos)', () => {
  it('identifica correctamente contas universitárias e institutos', () => {
    expect(isHigherOrTechInstitution('universidade')).toBe(true);
    expect(isHigherOrTechInstitution('Universidade')).toBe(true);
    expect(isHigherOrTechInstitution('instituto')).toBe(true);
    expect(isHigherOrTechInstitution('Instituto')).toBe(true);
    expect(isHigherOrTechInstitution('escola')).toBe(false);
    expect(isHigherOrTechInstitution('global')).toBe(false);
    expect(isHigherOrTechInstitution('')).toBe(false);
  });

  it('lista todas as cadeiras cadastradas tanto no módulo Cadeiras como no módulo Cursos sem perder registos', () => {
    const rawCursos: Curso[] = [
      {
        id: 'curso_eng',
        tenant_id: 't1',
        institutionId: 'esc_1',
        nome: 'Engenharia Informática',
        codigo: 'EI',
        tipo: 'graduacao',
        grau: 'Licenciatura',
        duracao_anos: 4,
        duracao_periodos: 8,
        regime: 'semestral',
        nivelEnsino: 'superior',
        ativo: true,
        created_at: '2026-01-01',
      },
    ];

    const rawClasses: Classe[] = [
      // Cadeira criada apenas no Módulo Cadeiras
      {
        id: 'cls_algoritmos',
        tenant_id: 't1',
        nome: 'Algoritmos e Estruturas',
        codigo: 'ALG101',
        docente_id: 'doc_1',
        turma_id: '',
        horario: '',
        sala: '',
        data: '',
        escola_id: 'esc_1',
      },
      // Agendamento já existente (NÃO deve entrar na lista de cadeiras)
      {
        id: 'agend_1',
        tenant_id: 't1',
        nome: 'Algoritmos e Estruturas',
        docente_id: 'doc_1',
        turma_id: 'turma_1',
        disciplina_id: 'cls_algoritmos',
        is_agendamento: true,
        tipo: 'agendamento',
        horario: '08:00 - 09:30',
        sala: 'Sala 01',
        data: '2026-11-21',
      } as Classe,
    ];

    const rawCadeiras: Cadeira[] = [
      // Cadeira criada apenas no Módulo Cursos (sem sincronização prévia em classes)
      {
        id: 'cad_bd',
        tenant_id: 't1',
        institutionId: 'esc_1',
        cursoId: 'curso_eng',
        nome: 'Bases de Dados',
        codigo: 'BD201',
        ano_curricular: 2,
        periodo_lectivo: '3º Semestre',
        regime_periodo: 'semestre',
        tipo_disciplina: 'obrigatoria',
        created_at: '2026-01-02',
      },
    ];

    expect(isBaseDisciplineItem(rawClasses[0])).toBe(true);
    expect(isBaseDisciplineItem(rawClasses[1])).toBe(false);

    const options = buildAllCadeirasOptions({ rawClasses, rawCadeiras, rawCursos });
    expect(options).toHaveLength(2);

    const nomes = options.map((o) => o.nome);
    expect(nomes).toEqual(['Algoritmos e Estruturas', 'Bases de Dados']);

    const bd = options.find((o) => o.id === 'cad_bd');
    expect(bd?.label).toBe('Bases de Dados [BD201] — Engenharia Informática');
  });

  it('deduplica cadeiras sincronizadas entre Módulo Cadeiras e Módulo Cursos preservando aliasedIds e nome do curso', () => {
    const rawCursos: Curso[] = [
      {
        id: 'curso_med',
        tenant_id: 't1',
        institutionId: 'esc_1',
        nome: 'Medicina Geral',
        codigo: 'MED',
        tipo: 'graduacao',
        grau: 'Licenciatura',
        duracao_anos: 6,
        duracao_periodos: 12,
        regime: 'semestral',
        nivelEnsino: 'superior',
        ativo: true,
        created_at: '2026-01-01',
      },
    ];

    const rawClasses: Classe[] = [
      {
        id: 'cls_anat_sync',
        nome: 'Anatomia Humana',
        codigo: 'ANA100',
        docente_id: '',
        turma_id: '',
        horario: '',
        sala: '',
        data: '',
        // Simula caso antigo onde curso_id não foi preenchido ao sincronizar
      } as Classe,
    ];

    const rawCadeiras: Cadeira[] = [
      {
        id: 'cad_anat_orig',
        tenant_id: 't1',
        institutionId: 'esc_1',
        cursoId: 'curso_med',
        nome: 'Anatomia Humana',
        codigo: 'ANA100',
        ano_curricular: 1,
        periodo_lectivo: '1º Semestre',
        regime_periodo: 'semestre',
        tipo_disciplina: 'obrigatoria',
        created_at: '2026-01-01',
      },
    ];

    const options = buildAllCadeirasOptions({ rawClasses, rawCadeiras, rawCursos });
    expect(options).toHaveLength(1);
    expect(options[0].nome).toBe('Anatomia Humana');
    expect(options[0].cursoNome).toBe('Medicina Geral');
    expect(options[0].aliasedIds).toContain('cls_anat_sync');
    expect(options[0].aliasedIds).toContain('cad_anat_orig');
  });
});

describe('Deduplicação de Disciplinas e Registos (Prevenção de chaves React duplicadas)', () => {
  it('buildDistinctDisciplines nunca emite ids duplicados quando disciplina base e agendamentos coexistem (ordem base -> agendamento)', () => {
    const docId = '1H5xQbSLTSqrVC9tsJI3';
    const baseDoc: Classe = {
      id: docId,
      tenant_id: 't1',
      nome: 'Matemática Aplicada',
      docente_id: 'doc_1',
      turma_id: '',
      horario: '',
      sala: '',
      data: '',
    };
    const scheduledDoc1 = {
      id: 'sched_1',
      tenant_id: 't1',
      disciplina_id: docId,
      nome: 'Matemática Aplicada',
      docente_id: 'doc_1',
      turma_id: 'turma_1',
      is_agendamento: true,
      tipo: 'agendamento',
      horario: '08:00 - 09:30',
      sala: 'Sala 01',
      data: '2026-11-21',
    } as Classe;
    const scheduledDoc2 = {
      id: 'sched_2',
      tenant_id: 't1',
      disciplina_id: docId,
      nome: 'Matemática Aplicada',
      docente_id: 'doc_1',
      turma_id: 'turma_2',
      is_agendamento: true,
      tipo: 'agendamento',
      horario: '10:00 - 11:30',
      sala: 'Sala 02',
      data: '2026-11-22',
    } as Classe;

    const resultBaseFirst = buildDistinctDisciplines([baseDoc, scheduledDoc1, scheduledDoc2]);
    expect(resultBaseFirst).toEqual([{ id: docId, nome: 'Matemática Aplicada' }]);

    const resultSchedFirst = buildDistinctDisciplines([scheduledDoc1, baseDoc, scheduledDoc2]);
    expect(resultSchedFirst).toEqual([{ id: docId, nome: 'Matemática Aplicada' }]);
  });

  it('buildDistinctDisciplines preserva múltiplas disciplinas distintas e evita duplicação por nome sem disciplina_id', () => {
    const items: Classe[] = [
      {
        id: 'disc_a',
        tenant_id: 't1',
        nome: 'Física I',
        docente_id: 'doc_1',
        turma_id: '',
        horario: '',
        sala: '',
        data: '',
      },
      {
        id: 'sched_unlinked',
        tenant_id: 't1',
        nome: 'Física I',
        docente_id: 'doc_1',
        turma_id: 'turma_1',
        horario: '08:00 - 09:30',
        sala: 'Sala 1',
        data: '2026-11-21',
      },
      {
        id: 'disc_b',
        tenant_id: 't1',
        nome: 'Química Orgânica',
        docente_id: 'doc_2',
        turma_id: '',
        horario: '',
        sala: '',
        data: '',
      },
    ];

    const result = buildDistinctDisciplines(items);
    expect(result.map((r) => r.id)).toEqual(['disc_a', 'disc_b']);
  });

  it('dedupeById preserva ordem e remove duplicados por id em atualizações otimistas', () => {
    const list = [
      { id: '1H5xQbSLTSqrVC9tsJI3', nome: 'Novo Registo' },
      { id: 'abc', nome: 'Outro' },
      { id: '1H5xQbSLTSqrVC9tsJI3', nome: 'Antigo Duplicado' },
      { id: 'def', nome: 'Terceiro' },
    ];
    const deduped = dedupeById(list);
    expect(deduped).toEqual([
      { id: '1H5xQbSLTSqrVC9tsJI3', nome: 'Novo Registo' },
      { id: 'abc', nome: 'Outro' },
      { id: 'def', nome: 'Terceiro' },
    ]);
  });
});
