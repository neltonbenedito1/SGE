/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Script de Migração Idempotente de Dados do Sistema (SGE)
 * Padronização Global: Valores de Catálogo, Tipos de Dados e Níveis de Ensino
 */

import { db } from '../lib/firebase';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';

export interface MigrationOptions {
  tenantId?: string;
  dryRun: boolean; // Modo simulação: apenas reporta o que seria alterado
}

export interface MigrationReportItem {
  collection: string;
  docId: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'updated' | 'skipped' | 'normalized';
}

export interface MigrationResult {
  totalScanned: number;
  totalModified: number;
  dryRun: boolean;
  logs: MigrationReportItem[];
}

// Mapa de equivalências de estados de plano de aulas
const LESSON_STATUS_MAP: Record<string, string> = {
  'lecionado': 'taught',
  'lecionada': 'taught',
  'leccionado': 'taught',
  'leccionada': 'taught',
  'taught': 'taught',
  'planeada': 'planned',
  'planeado': 'planned',
  'planned': 'planned',
  'pendente': 'pending',
  'pending': 'pending',
  'cancelada': 'cancelled',
  'cancelado': 'cancelled',
  'cancelled': 'cancelled',
  'extraordinario': 'extraordinary',
  'extraordinaria': 'extraordinary',
  'extraordinary': 'extraordinary',
};

// Mapa de equivalências de estados genéricos
const GENERIC_STATUS_MAP: Record<string, string> = {
  'ativo': 'active',
  'activa': 'active',
  'activo': 'active',
  'active': 'active',
  'inativo': 'inactive',
  'inactivo': 'inactive',
  'inactive': 'inactive',
  'suspenso': 'suspended',
  'suspended': 'suspended',
};

// Mapa de inferência de nível de ensino para estudantes legados
export function inferEducationLevel(classeName?: string, escolaNome?: string): 'primario' | 'secundario' | 'superior' | 'profissional' {
  const c = (classeName || '').toLowerCase();
  const e = (escolaNome || '').toLowerCase();

  if (e.includes('faculdade') || e.includes('universidade') || e.includes('superior') || c.includes('ano')) {
    return 'superior';
  }
  if (e.includes('instituto') || e.includes('técnico') || e.includes('tecnico') || e.includes('profissional') || c.includes('básico') || c.includes('médio')) {
    return 'profissional';
  }
  if (c.includes('1ª') || c.includes('2ª') || c.includes('3ª') || c.includes('4ª') || c.includes('5ª') || c.includes('6ª') || c.includes('primári') || c.includes('primari')) {
    return 'primario';
  }
  return 'secundario'; // padrão mais comum
}

/**
 * Executa a migração de padronização global dos dados
 */
export async function runGlobalDataMigration(options: MigrationOptions): Promise<MigrationResult> {
  const { tenantId, dryRun } = options;
  const logs: MigrationReportItem[] = [];
  let totalScanned = 0;
  let totalModified = 0;

  const batch = writeBatch(db);
  let batchOpsCount = 0;

  // 1. Padronizar Estudantes (preencher nivelEnsino em falta e normalizar campos)
  try {
    const studentQuery = tenantId 
      ? query(collection(db, 'estudantes'), where('tenant_id', '==', tenantId))
      : collection(db, 'estudantes');
    
    const studentSnap = await getDocs(studentQuery);
    totalScanned += studentSnap.size;

    studentSnap.forEach(d => {
      const data = d.data();
      const updates: Record<string, any> = {};

      // Atribuir nivelEnsino se ausente
      if (!data.nivelEnsino) {
        const inferred = inferEducationLevel(data.classe_nome || data.classe, data.escola_nome);
        updates.nivelEnsino = inferred;
        logs.push({
          collection: 'estudantes',
          docId: d.id,
          field: 'nivelEnsino',
          oldValue: undefined,
          newValue: inferred,
          action: 'normalized'
        });
      }

      // Normalizar gênero para formato padrão
      if (data.genero === 'M' || data.genero === 'male') {
        updates.genero = 'Masculino';
        logs.push({
          collection: 'estudantes',
          docId: d.id,
          field: 'genero',
          oldValue: data.genero,
          newValue: 'Masculino',
          action: 'normalized'
        });
      } else if (data.genero === 'F' || data.genero === 'female') {
        updates.genero = 'Feminino';
        logs.push({
          collection: 'estudantes',
          docId: d.id,
          field: 'genero',
          oldValue: data.genero,
          newValue: 'Feminino',
          action: 'normalized'
        });
      }

      if (Object.keys(updates).length > 0) {
        totalModified++;
        if (!dryRun) {
          batch.update(doc(db, 'estudantes', d.id), updates);
          batchOpsCount++;
        }
      }
    });
  } catch (err) {
    console.warn('[Migration Warning] Estudantes scan:', err);
  }

  // 2. Padronizar Plano de Aulas (normalizar status)
  try {
    const planoQuery = tenantId
      ? query(collection(db, 'plano_aulas'), where('tenant_id', '==', tenantId))
      : collection(db, 'plano_aulas');
    
    const planoSnap = await getDocs(planoQuery);
    totalScanned += planoSnap.size;

    planoSnap.forEach(d => {
      const data = d.data();
      const currentStatus = String(data.status || '').toLowerCase().trim();
      const mapped = LESSON_STATUS_MAP[currentStatus];

      if (mapped && mapped !== data.status) {
        logs.push({
          collection: 'plano_aulas',
          docId: d.id,
          field: 'status',
          oldValue: data.status,
          newValue: mapped,
          action: 'normalized'
        });
        totalModified++;
        if (!dryRun) {
          batch.update(doc(db, 'plano_aulas', d.id), { status: mapped });
          batchOpsCount++;
        }
      }
    });
  } catch (err) {
    console.warn('[Migration Warning] Plano de Aulas scan:', err);
  }

  // 3. Padronizar Escolas (definir tipo_instituicao e regimes padrão se ausentes)
  try {
    const escolaQuery = tenantId
      ? query(collection(db, 'escolas'), where('tenant_id', '==', tenantId))
      : collection(db, 'escolas');
    
    const escolaSnap = await getDocs(escolaQuery);
    totalScanned += escolaSnap.size;

    escolaSnap.forEach(d => {
      const data = d.data();
      const updates: Record<string, any> = {};

      if (!data.tipo_instituicao) {
        const name = (data.nome || '').toLowerCase();
        let tipo = 'Escola';
        if (name.includes('faculdade') || name.includes('universidade')) tipo = 'Faculdade';
        else if (name.includes('instituto')) tipo = 'Instituto';
        updates.tipo_instituicao = tipo;
        logs.push({
          collection: 'escolas',
          docId: d.id,
          field: 'tipo_instituicao',
          oldValue: undefined,
          newValue: tipo,
          action: 'normalized'
        });
      }

      if (data.regime_manha === undefined) updates.regime_manha = true;
      if (data.regime_tarde === undefined) updates.regime_tarde = true;
      if (data.regime_noite === undefined) updates.regime_noite = true;

      if (Object.keys(updates).length > 0) {
        totalModified++;
        if (!dryRun) {
          batch.update(doc(db, 'escolas', d.id), updates);
          batchOpsCount++;
        }
      }
    });
  } catch (err) {
    console.warn('[Migration Warning] Escolas scan:', err);
  }

  // Se não for dry-run e houver operações, commitar o batch
  if (!dryRun && batchOpsCount > 0) {
    await batch.commit();
  }

  return {
    totalScanned,
    totalModified,
    dryRun,
    logs
  };
}

/**
 * Migração Idempotente Específica para Tipo de Instituição (Regras Gerais - Secção 1.1 & 8.2)
 * 1. Tenants existentes sem tipoInstituicao recebem 'escola' por defeito.
 * 2. Disciplinas / Classes existentes recebem institutionId baseado no escola_id ou tenant_id.
 */
export async function migrateInstitutionTypes(): Promise<{
  tenantsUpdated: number;
  classesUpdated: number;
}> {
  let tenantsUpdated = 0;
  let classesUpdated = 0;

  try {
    // 1. Atualizar Tenants
    const tenantsSnap = await getDocs(collection(db, 'tenants'));
    const tenantBatch = writeBatch(db);
    let tCount = 0;

    tenantsSnap.forEach(d => {
      const data = d.data();
      if (!data.tipoInstituicao) {
        tenantBatch.update(doc(db, 'tenants', d.id), {
          tipoInstituicao: 'escola',
          regime_funcionamento: data.regime_funcionamento || 'Ambos',
          updated_at: new Date().toISOString()
        });
        tCount++;
        tenantsUpdated++;
      }
    });

    if (tCount > 0) {
      await tenantBatch.commit();
    }
  } catch (err) {
    console.warn('[Migration Warning] migrateInstitutionTypes (tenants):', err);
  }

  try {
    // 2. Atualizar Classes / Disciplinas (institutionId)
    const classesSnap = await getDocs(collection(db, 'classes'));
    const classBatch = writeBatch(db);
    let cCount = 0;

    classesSnap.forEach(d => {
      const data = d.data();
      if (!data.institutionId) {
        const instId = data.escola_id || data.tenant_id;
        if (instId) {
          classBatch.update(doc(db, 'classes', d.id), {
            institutionId: instId,
            periodo_lectivo: data.periodo_lectivo || '1º Trimestre',
            ano_curricular: data.ano_curricular || 1
          });
          cCount++;
          classesUpdated++;
        }
      }
    });

    if (cCount > 0) {
      await classBatch.commit();
    }
  } catch (err) {
    console.warn('[Migration Warning] migrateInstitutionTypes (classes):', err);
  }

  return { tenantsUpdated, classesUpdated };
}

