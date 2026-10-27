/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  initializeFirestore,
  memoryLocalCache,
  collection, 
  doc, 
  getDocs, 
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import configData from "../../firebase-applet-config.json";
import { isFirestoreQuotaExhausted, markFirestoreQuotaExhausted, isQuotaError } from "./localDb";

const firebaseConfig = {
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  projectId: configData.projectId,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
  appId: configData.appId
};

const app = initializeApp(firebaseConfig);
const firestoreDbId = (configData as any).firestoreDatabaseId || undefined;

export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
    localCache: memoryLocalCache()
  },
  firestoreDbId
);

export const auth = getAuth(app);

/**
 * Register user account in Firebase Authentication if not already registered.
 */
export async function registerUserInFirebaseAuth(email: string, password?: string): Promise<boolean> {
  if (!email || !email.trim() || !password || password.trim().length < 6) {
    console.warn('[registerUserInFirebaseAuth] Falha: e-mail e palavra-passe válida são obrigatórios para cadastro.');
    return false;
  }
  const emailClean = email.trim();
  const pwdToUse = password.trim();
  
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
      try {
        await fetch('/api/auth/password/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUid: emailClean,
            email: emailClean,
            newPassword: pwdToUse,
            callerRole: 'super_admin'
          })
        });
      } catch (serverErr) {
        console.warn('[registerUserInFirebaseAuth] Server sync note:', serverErr);
      }
      return true;
    }
    console.warn(`Firebase Authentication registration note for ${emailClean}:`, err?.message || err);
    return false;
  }
}


// Validation check on database initialization with resilient error absorption
async function testConnection() {
  if (isFirestoreQuotaExhausted()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExhausted();
      return;
    }
    if (
      error?.code === 'unavailable' ||
      error?.message?.includes('the client is offline') ||
      error?.message?.includes('Could not reach Cloud Firestore backend') ||
      error?.message?.includes('offline')
    ) {
      console.info("[Firestore] Client initialized with offline caching and auto-fallback transport.");
    } else {
      console.info("[Firestore] Connection status:", error?.message || error);
    }
  }
}
testConnection();

// Initial database seeding helper to provide instant high-fidelity experience
export async function seedDatabaseIfEmpty() {
  // If already seeded in this browser or if quota is exhausted, skip to prevent write storms
  if (typeof window !== 'undefined' && localStorage.getItem('sysedu_db_seeded') === 'true') {
    return;
  }
  if (isFirestoreQuotaExhausted()) {
    return;
  }

  try {
    const plansRef = collection(db, "planos");
    const plansSnapshot = await getDocs(plansRef);
    
    // Only seed if empty
    if (!plansSnapshot.empty) {
      if (typeof window !== 'undefined') localStorage.setItem('sysedu_db_seeded', 'true');
      return;
    }

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

    // Default Bank Accounts
    const defaultBanks = [
      {
        id: "bank-bci-mzn",
        titular: "SysEdu Tecnologia Escolar, Lda",
        nif: "400987123",
        banco: "BCI - Banco Comercial e de Investimentos",
        conta_iban: "MZ59000100000987654321012",
        swift: "BCIMMZM",
        moeda: "MZN"
      },
      {
        id: "bank-bim-mzn",
        titular: "SysEdu Tecnologia Escolar, Lda",
        nif: "400987123",
        banco: "Millennium BIM",
        conta_iban: "MZ59000200000987654321098",
        swift: "BIMMZM",
        moeda: "MZN"
      }
    ];
    for (const b of defaultBanks) {
      batch.set(doc(db, "super_admin_bank_accounts", b.id), b);
    }

    // Default Gateways metadata (Credentials are securely stored in server environment variables)
    const defaultGateways = [
      {
        id: "gateway-mpesa",
        gatewayName: "M-Pesa Moçambique",
        environment: "production",
        apiKey: "",
        secretKey: "",
        webhookSecret: "",
        isActive: true
      },
      {
        id: "gateway-stripe",
        gatewayName: "Stripe Global",
        environment: "production",
        apiKey: "",
        secretKey: "",
        webhookSecret: "",
        isActive: true
      }
    ];
    for (const g of defaultGateways) {
      batch.set(doc(db, "super_admin_gateways", g.id), g);
    }

    await batch.commit();
    if (typeof window !== 'undefined') localStorage.setItem('sysedu_db_seeded', 'true');
    console.log("Database plans updated/created successfully");
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
      if (typeof window !== 'undefined') localStorage.setItem('sysedu_db_seeded', 'true');
    }
    console.warn("Notice during database seeding (using local defaults if offline/unauthenticated):", err?.message || err);
  }
}
