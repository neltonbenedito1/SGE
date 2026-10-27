/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de Administração: Configuração de Super Administrador (Admin SDK)
 * Define Custom Claims ({ role: 'super_admin', super_admin: true, tenant_id: 'super-admin' })
 * e redefine/cria a palavra-passe no Firebase Authentication.
 * 
 * Uso:
 *   npx tsx scripts/set-superadmin.ts [email] [password]
 * Exemplo:
 *   npx tsx scripts/set-superadmin.ts neltonbenedito1@gmail.com MinhaNovaSenhaForte2026!
 */

import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminInstance, getFirestoreInstance } from '../server/middleware/auth';
import { validatePasswordPolicy } from '../src/shared/passwordPolicy';

async function main() {
  const args = process.argv.slice(2);
  const emailInput = args[0] || 'neltonbenedito1@gmail.com';
  const passwordInput = args[1];

  const emailClean = emailInput.trim().toLowerCase();

  console.log('===========================================================');
  console.log(`[SysEdu Admin] Configurando Super Administrador: ${emailClean}`);
  console.log('===========================================================');

  if (!emailClean || !emailClean.includes('@')) {
    console.error('ERRO: E-mail inválido fornecido.');
    process.exit(1);
  }

  const adminApp = getFirebaseAdminInstance();
  const auth = getAuth(adminApp);
  const db = getFirestoreInstance();

  try {
    let userRecord: any;
    try {
      userRecord = await auth.getUserByEmail(emailClean);
      console.log(`✓ Usuário encontrado no Firebase Auth (UID: ${userRecord.uid})`);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        console.log(`- Usuário não encontrado no Firebase Auth. Criando novo usuário...`);
        if (!passwordInput) {
          console.error('ERRO: Usuário não existe. É obrigatório fornecer uma palavra-passe: npx tsx scripts/set-superadmin.ts <email> <password>');
          process.exit(1);
        }
        const policy = validatePasswordPolicy(passwordInput, emailClean);
        if (!policy.valid) {
          console.error(`ERRO de Política de Senha: ${policy.errors.join(', ')}`);
          process.exit(1);
        }
        userRecord = await auth.createUser({
          email: emailClean,
          password: passwordInput,
          displayName: 'Super Administrador',
          emailVerified: true,
        });
        console.log(`✓ Usuário criado com sucesso no Firebase Auth (UID: ${userRecord.uid})`);
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;

    // Se fornecida nova palavra-passe, atualizar
    if (passwordInput) {
      const policy = validatePasswordPolicy(passwordInput, emailClean);
      if (!policy.valid) {
        console.error(`ERRO de Política de Senha: ${policy.errors.join(', ')}`);
        process.exit(1);
      }
      await auth.updateUser(uid, {
        password: passwordInput,
        emailVerified: true,
      });
      console.log(`✓ Palavra-passe atualizada com sucesso para ${emailClean}`);
    } else {
      console.log(`ℹ Nenhuma nova palavra-passe fornecida. Mantendo a palavra-passe atual.`);
    }

    // Definir Custom Claims estritas
    const claims = {
      role: 'super_admin',
      super_admin: true,
      tenant_id: 'super-admin',
    };
    await auth.setCustomUserClaims(uid, claims);
    console.log(`✓ Custom claims atribuídas no Firebase Auth:`, JSON.stringify(claims));

    // Sincronizar documentos no Firestore
    const nowIso = new Date().toISOString();
    await db.collection('superusers').doc(uid).set({
      uid,
      email: emailClean,
      nome: userRecord.displayName || 'Super Administrador',
      role: 'super_admin',
      tipo: 'super_admin',
      tenant_id: 'super-admin',
      ativo: true,
      updatedAt: nowIso,
    }, { merge: true });
    console.log(`✓ Documento atualizado em 'superusers/${uid}'`);

    await db.collection('users').doc(uid).set({
      id: uid,
      uid,
      email: emailClean,
      nome: userRecord.displayName || 'Super Administrador',
      role: 'super_admin',
      tipo: 'super_admin',
      tenant_id: 'super-admin',
      ativo: true,
      updatedAt: nowIso,
    }, { merge: true });
    console.log(`✓ Documento atualizado em 'users/${uid}'`);

    // Atualizar bootstrap status
    await db.collection('system_config').doc('bootstrap').set({
      initialized: true,
      allowsBootstrap: false,
      primarySuperadminEmail: emailClean,
      primarySuperadminUid: uid,
      updatedAt: nowIso,
    }, { merge: true });
    console.log(`✓ Status do sistema atualizado (initialized=true, allowsBootstrap=false)`);

    console.log('\n===========================================================');
    console.log(`[SUCESSO] Super Administrador configurado com sucesso!`);
    console.log(`E-mail: ${emailClean}`);
    console.log(`Role: super_admin (Custom Claims ativas)`);
    console.log(`===========================================================`);
    process.exit(0);
  } catch (error: any) {
    console.error('ERRO ao configurar super administrador:', error?.message || error);
    process.exit(1);
  }
}

main();
