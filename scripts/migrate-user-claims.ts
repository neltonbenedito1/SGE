/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de Migração de Custom Claims (SysEdu Security Suite)
 * Executa atribuição segura e idempotente de claims (role, tenant_id, must_reset_password)
 * nos usuários existentes do Firebase Authentication.
 * 
 * Uso via linha de comando:
 *   npx tsx scripts/migrate-user-claims.ts --dry-run
 *   npx tsx scripts/migrate-user-claims.ts --execute
 */

import { migrateExistingUsersClaims } from '../server/security/claims';

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const dryRun = !isExecute;

  console.log('===========================================================');
  console.log(`[SysEdu Security] Iniciando Migração de Custom Claims (Modo: ${dryRun ? 'DRY-RUN / SIMULAÇÃO' : 'EXECUÇÃO REAL'})`);
  console.log('===========================================================');

  try {
    const result = await migrateExistingUsersClaims({
      dryRun,
      limit: 500,
    });

    console.log(`\nResumo da Operação:`);
    console.log(`- Total de usuários verificados no Firestore: ${result.totalChecked}`);
    console.log(`- Usuários provisionados com Custom Claims: ${result.migratedCount}`);
    console.log(`- Usuários ignorados (sem registro no Auth): ${result.skippedCount}`);

    console.log('\nDetalhes por Usuário:');
    result.results.forEach((r, idx) => {
      console.log(` [${idx + 1}] ${r.email || r.uid} -> Role: "${r.role}", Tenant: "${r.tenant_id}", ResetObrigatório: ${r.must_reset} [Status: ${r.status}]`);
    });

    if (dryRun) {
      console.log('\n[AVISO] Para aplicar as alterações de forma definitiva no Firebase Auth, execute:');
      console.log('  npx tsx scripts/migrate-user-claims.ts --execute');
    } else {
      console.log('\n[SUCESSO] Migração de Custom Claims aplicada com sucesso no Firebase Auth.');
    }
    process.exit(0);
  } catch (error) {
    console.error('[ERRO] Falha durante a migração de claims:', error);
    process.exit(1);
  }
}

main();
