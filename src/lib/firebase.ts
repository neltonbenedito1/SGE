/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import configData from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  projectId: configData.projectId,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
  appId: configData.appId
};

const app = initializeApp(firebaseConfig);
export const db = (configData as any).firestoreDatabaseId 
  ? getFirestore(app, (configData as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

/**
 * Register user account in Firebase Authentication if not already registered.
 */
export async function registerUserInFirebaseAuth(email: string, password?: string): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const emailClean = email.trim();
  const pwdToUse = (password && password.trim().length >= 6) ? password.trim() : "12345678";
  
  try {
    const secondaryAppName = "secondaryAuthApp";
    let secondaryApp = getApps().find(a => a.name === secondaryAppName);
    if (!secondaryApp) {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    }
    const secondaryAuth = getAuth(secondaryApp);
    await createUserWithEmailAndPassword(secondaryAuth, emailClean, pwdToUse);
    await signOut(secondaryAuth);
    console.log(`User ${emailClean} registered successfully in Firebase Authentication.`);
    return true;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      console.log(`User ${emailClean} already registered in Firebase Authentication.`);
      return true;
    }
    console.warn(`Firebase Authentication registration note for ${emailClean}:`, err?.message || err);
    return false;
  }
}

// Validation check on database initialization as requested by guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info("Firebase client is currently offline or initial connection is pending.");
    }
  }
}
testConnection();

// Initial database seeding helper to provide instant high-fidelity experience
export async function seedDatabaseIfEmpty() {
  try {
    const plansRef = collection(db, "planos");
    const plansSnapshot = await getDocs(plansRef);
    
    console.log("Seeding/updating database with high-fidelity SaaS structures...");
    const batch = writeBatch(db);

    // 1. Planos
    const planos = [
      {
        id: "plano-basico",
        nome: "Plano Básico",
        descricao: "Plano essencial com limites de 1 escola ativa, 10 turmas, 10 docentes, 250 estudantes, 15 disciplinas e 7 classes.",
        preco: 299.00,
        periodicidade: "mensal",
        modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao"],
        limits: {
          max_escolas: 1,
          max_docentes: 10,
          max_estudantes: 250,
          max_turmas: 10,
          max_disciplinas: 15,
          max_classes: 7,
          max_usuarios: 15
        }
      },
      {
        id: "plano-pro",
        nome: "Plano Pro",
        descricao: "Plano ideal com limites de 3 escolas, 10 turmas, 10 docentes, 250 estudantes, 15 disciplinas e 7 classes.",
        preco: 499.00,
        periodicidade: "mensal",
        modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao"],
        limits: {
          max_escolas: 3,
          max_docentes: 10,
          max_estudantes: 250,
          max_turmas: 10,
          max_disciplinas: 15,
          max_classes: 7,
          max_usuarios: 15
        }
      },
      {
        id: "plano-plus",
        nome: "Plano Plus",
        descricao: "Acesso ilimitado com suporte ao módulo de Processo do Aluno e criação ilimitada de usuários.",
        preco: 899.00,
        periodicidade: "mensal",
        modulos_permitidos: ["provincias", "escolas", "docentes", "estudantes", "turmas", "pauta", "calendario", "pautageral", "disciplinas", "classes_escolares", "configuracao", "processo"],
        limits: {
          max_escolas: 9999,
          max_docentes: 9999,
          max_estudantes: 9999,
          max_turmas: 9999,
          max_disciplinas: 9999,
          max_classes: 9999,
          max_usuarios: 9999
        }
      }
    ];

    for (const plano of planos) {
      batch.set(doc(db, "planos", plano.id), plano);
    }

    await batch.commit();
    console.log("Database plans updated/created successfully");
  } catch (err: any) {
    console.warn("Notice during database seeding (using local defaults if offline/unauthenticated):", err?.message || err);
  }
}
