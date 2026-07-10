/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

    if (!plansSnapshot.empty) {
      // If already seeded, we still write the new planos and then commit to ensure they are available
      await batch.commit();
      console.log("Database plans updated/created successfully");
      return;
    }

    // 2. Tenants
    const tenants = [
      {
        id: "tenant-maputo",
        nome: "Colégio Central de Maputo",
        slug: "colegio-maputo",
        plano_id: "plano-pro",
        status: "ativo",
        data_vencimento: "2026-12-31",
        data_renovacao: "2026-06-28",
        created_at: "2025-01-15T10:00:00Z",
        email_admin: "admin@maputocentral.edu",
        telefone: "+258 84 123 4567",
        endereco: "Av. 24 de Julho, Maputo, Moçambique"
      },
      {
        id: "tenant-luanda",
        nome: "Instituto Académico de Luanda",
        slug: "instituto-luanda",
        plano_id: "plano-plus",
        status: "ativo",
        data_vencimento: "2026-08-15",
        data_renovacao: "2026-06-15",
        created_at: "2025-02-10T11:00:00Z",
        email_admin: "direcao@luanda-academy.ao",
        telefone: "+244 923 456 789",
        endereco: "Rua Direita de Luanda, Luanda, Angola"
      },
      {
        id: "tenant-suspenso",
        nome: "Escola Primária Sol Nascente",
        slug: "sol-nascente",
        plano_id: "plano-pro",
        status: "suspenso",
        data_vencimento: "2026-06-20", // Expired
        data_renovacao: "2026-05-20",
        created_at: "2025-03-01T09:00:00Z",
        email_admin: "financeiro@solnascente.edu",
        telefone: "+244 911 222 333",
        endereco: "Benguela, Angola"
      }
    ];

    for (const tenant of tenants) {
      batch.set(doc(db, "tenants", tenant.id), tenant);
    }

    // 3. Pagamentos
    const pagamentos = [
      {
        id: "pag-001",
        tenant_id: "tenant-maputo",
        tenant_nome: "Colégio Central de Maputo",
        valor: 599.00,
        data_vencimento: "2026-06-15",
        data_pagamento: "2026-06-14",
        status: "Pago",
        metodo: "Transferência Bancária"
      },
      {
        id: "pag-002",
        tenant_id: "tenant-luanda",
        tenant_nome: "Instituto Académico de Luanda",
        valor: 1299.00,
        data_vencimento: "2026-06-10",
        data_pagamento: "2026-06-10",
        status: "Pago",
        metodo: "Cartão de Crédito"
      },
      {
        id: "pag-003",
        tenant_id: "tenant-suspenso",
        tenant_nome: "Escola Primária Sol Nascente",
        valor: 299.00,
        data_vencimento: "2026-06-20",
        status: "Atrasado",
        metodo: "Nenhum"
      },
      {
        id: "pag-004",
        tenant_id: "tenant-maputo",
        tenant_nome: "Colégio Central de Maputo",
        valor: 599.00,
        data_vencimento: "2026-07-15",
        status: "Pendente",
        metodo: "Pendente"
      }
    ];

    for (const pag of pagamentos) {
      batch.set(doc(db, "pagamentos", pag.id), pag);
    }

    // 4. Admin Logs
    const logs = [
      {
        id: "log-001",
        admin_id: "superadmin-1",
        admin_nome: "Nelton Benedito",
        acao: "Aprovação de Conta",
        entidade: "Tenant",
        entidade_id: "tenant-luanda",
        timestamp: "2026-06-15T08:12:00Z",
        detalhes: "Upgrade para o Plano Elite realizado com sucesso."
      },
      {
        id: "log-002",
        admin_id: "superadmin-1",
        admin_nome: "Nelton Benedito",
        acao: "Suspensão de Conta",
        entidade: "Tenant",
        entidade_id: "tenant-suspenso",
        timestamp: "2026-06-21T00:05:00Z",
        detalhes: "Suspensão automática de conta devido a atraso no pagamento."
      }
    ];

    for (const log of logs) {
      batch.set(doc(db, "log_admins", log.id), log);
    }

    // 5. Tenant Maputo Specific Subcollections (Schools, Provinces, Docentes, Students, Turmas, Grades...)
    // Provinces (Províncias)
    const provsMaputo = [
      { id: "prov-maputo-cidade", tenant_id: "tenant-maputo", nome: "Maputo Cidade", codigo: "MPC" },
      { id: "prov-maputo-provincia", tenant_id: "tenant-maputo", nome: "Maputo Província", codigo: "MPP" }
    ];
    for (const prov of provsMaputo) {
      batch.set(doc(db, "provincias", prov.id), prov);
    }

    // Schools (Escolas)
    const escolasMaputo = [
      {
        id: "esc-maputo-primaria",
        tenant_id: "tenant-maputo",
        provincia_id: "prov-maputo-cidade",
        nome: "Escola Primária Completa Central",
        endereco: "Av. Vladimir Lenine, Moçambique",
        telefone: "+258 21 445 678",
        email: "primaria@maputocentral.edu",
        diretor_id: "dir-01",
        ativo: true
      },
      {
        id: "esc-maputo-secundaria",
        tenant_id: "tenant-maputo",
        provincia_id: "prov-maputo-cidade",
        nome: "Escola Secundária Central",
        endereco: "Av. Eduardo Mondlane, Moçambique",
        telefone: "+258 21 889 001",
        email: "secundaria@maputocentral.edu",
        diretor_id: "dir-02",
        ativo: true
      }
    ];
    for (const esc of escolasMaputo) {
      batch.set(doc(db, "escolas", esc.id), esc);
    }

    // Users
    const usersMaputo = [
      { id: "user-admin-maputo", tenant_id: "tenant-maputo", email: "admin@maputocentral.edu", nome: "Dr. João Bernardo", tipo: "admin", permissoes: ["R", "W", "D"], ativo: true, created_at: "2025-01-15T10:00:00Z" },
      { id: "user-teacher-pedro", tenant_id: "tenant-maputo", email: "pedro.santos@maputocentral.edu", nome: "Pedro Santos", tipo: "docente", permissoes: ["R", "W"], ativo: true, created_at: "2025-02-01T08:00:00Z" },
      { id: "user-teacher-ana", tenant_id: "tenant-maputo", email: "ana.goncalves@maputocentral.edu", nome: "Ana Gonçalves", tipo: "docente", permissoes: ["R", "W"], ativo: true, created_at: "2025-02-02T08:00:00Z" },
      { id: "user-student-mateus", tenant_id: "tenant-maputo", email: "mateus@colegio.edu", nome: "Mateus Bernardo dos Santos", tipo: "estudante", permissoes: ["R"], ativo: true, created_at: "2025-02-15T09:00:00Z" },
      { id: "user-student-lucia", tenant_id: "tenant-maputo", email: "lucia@colegio.edu", nome: "Lúcia Maria Chichava", tipo: "estudante", permissoes: ["R"], ativo: true, created_at: "2025-02-16T09:00:00Z" },
      { id: "user-parent-carlos", tenant_id: "tenant-maputo", email: "carlos.chichava@gmail.com", nome: "Carlos Chichava", tipo: "pai", permissoes: ["R"], ativo: true, created_at: "2025-02-16T09:30:00Z" }
    ];
    for (const usr of usersMaputo) {
      batch.set(doc(db, "users", usr.id), usr);
    }

    // Docentes Details
    const docentesMaputo = [
      { id: "doc-pedro", tenant_id: "tenant-maputo", user_id: "user-teacher-pedro", escola_id: "esc-maputo-primaria", especialidade: "Matemática & Ciências", numero_registro: "DOC-2025-081", data_contratacao: "2025-02-01" },
      { id: "doc-ana", tenant_id: "tenant-maputo", user_id: "user-teacher-ana", escola_id: "esc-maputo-secundaria", especialidade: "Língua Portuguesa & História", numero_registro: "DOC-2025-092", data_contratacao: "2025-02-02" }
    ];
    for (const docen of docentesMaputo) {
      batch.set(doc(db, "docentes", docen.id), docen);
    }

    // Parents (Pais) Details
    const paisMaputo = [
      { id: "pai-carlos", tenant_id: "tenant-maputo", user_id: "user-parent-carlos", telefone: "+258 82 444 5555", endereco: "Bairro Sommerschield, Maputo", estudantes_ids: ["est-lucia"] }
    ];
    for (const p of paisMaputo) {
      batch.set(doc(db, "pais", p.id), p);
    }

    // Turmas (School classes)
    const turmasMaputo = [
      { id: "tur-6a", tenant_id: "tenant-maputo", escola_id: "esc-maputo-primaria", nome: "6ª Classe - Turma A", ano_letivo: "2026", nivel: "Primário", docente_id: "doc-pedro", capacidade_max: 30 },
      { id: "tur-9b", tenant_id: "tenant-maputo", escola_id: "esc-maputo-secundaria", nome: "9ª Classe - Turma B", ano_letivo: "2026", nivel: "Secundário", docente_id: "doc-ana", capacidade_max: 35 }
    ];
    for (const tur of turmasMaputo) {
      batch.set(doc(db, "turmas", tur.id), tur);
    }

    // Students (Estudantes) Details
    const estudantesMaputo = [
      { id: "est-mateus", tenant_id: "tenant-maputo", user_id: "user-student-mateus", escola_id: "esc-maputo-primaria", numero_matricula: "MAT-2026-101", data_nascimento: "2015-05-14", genero: "Masculino", turma_id: "tur-6a", pai_id: "" },
      { id: "est-lucia", tenant_id: "tenant-maputo", user_id: "user-student-lucia", escola_id: "esc-maputo-secundaria", numero_matricula: "MAT-2026-202", data_nascimento: "2012-11-23", genero: "Feminino", turma_id: "tur-9b", pai_id: "pai-carlos" }
    ];
    for (const est of estudantesMaputo) {
      batch.set(doc(db, "estudantes", est.id), est);
    }

    // Classes (Subjects)
    const classesMaputo = [
      { id: "cls-mat-6a", tenant_id: "tenant-maputo", turma_id: "tur-6a", nome: "Matemática", docente_id: "doc-pedro", horario: "Seg/Qua 08:00 - 09:30", sala: "Sala 4" },
      { id: "cls-cie-6a", tenant_id: "tenant-maputo", turma_id: "tur-6a", nome: "Ciências Naturais", docente_id: "doc-pedro", horario: "Ter/Qui 09:45 - 11:15", sala: "Sala 4" },
      { id: "cls-port-9b", tenant_id: "tenant-maputo", turma_id: "tur-9b", nome: "Língua Portuguesa", docente_id: "doc-ana", horario: "Seg/Qua/Sex 10:00 - 11:30", sala: "Sala B-12" }
    ];
    for (const cls of classesMaputo) {
      batch.set(doc(db, "classes", cls.id), cls);
    }

    // Pautas (Grades / Records)
    const pautasMaputo = [
      { id: "pau-mateus-mat", tenant_id: "tenant-maputo", estudante_id: "est-mateus", classe_id: "cls-mat-6a", trimestre: "1º Trimestre", nota_prova: 15, nota_trabalho: 16, nota_participacao: 18, nota_exame: 14, nota_media: 15.6, situacao: "Aprovado", observacao: "Excelente desempenho geral.", data_lancamento: "2026-05-10" },
      { id: "pau-lucia-port", tenant_id: "tenant-maputo", estudante_id: "est-lucia", classe_id: "cls-port-9b", trimestre: "1º Trimestre", nota_prova: 11, nota_trabalho: 12, nota_participacao: 14, nota_exame: 10, nota_media: 11.5, situacao: "Aprovado", observacao: "Bom progresso. Requer maior atenção na leitura.", data_lancamento: "2026-05-12" }
    ];
    for (const pau of pautasMaputo) {
      batch.set(doc(db, "pautas", pau.id), pau);
    }

    // Processos do Aluno
    const processosMaputo = [
      { id: "prc-mateus-matricula", tenant_id: "tenant-maputo", estudante_id: "est-mateus", tipo: "Matrícula", data: "2026-01-15", documentos: ["boletim_matricula.pdf", "bi_document.pdf"], status: "Concluído", criador_nome: "Dr. João Bernardo", observacao: "Matrícula aceita. Documentos completos em anexo." },
      { id: "prc-lucia-transfer", tenant_id: "tenant-maputo", estudante_id: "est-lucia", tipo: "Transferência", data: "2026-02-15", documentos: ["guia_transferencia.pdf"], status: "Concluído", criador_nome: "Dr. João Bernardo", observacao: "Transferência vinda do Colégio Kitabu homologada." }
    ];
    for (const prc of processosMaputo) {
      batch.set(doc(db, "processos_aluno", prc.id), prc);
    }

    // Tenant Settings
    const configMaputo = {
      id: "cfg-maputo",
      tenant_id: "tenant-maputo",
      nome_instituicao: "Colégio Central de Maputo",
      endereco: "Av. 24 de Julho, Maputo, Moçambique",
      contacto: "+258 84 123 4567",
      ano_letivo_atual: "2026",
      escala_avaliacao: "0-20",
      notificacoes_email: true,
      logo_url: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200"
    };
    batch.set(doc(db, "configuracoes", configMaputo.id), configMaputo);


    // 6. Tenant Luanda Specific Data (Provincias, Escolas, Users, Docentes, Pais, Turmas, Estudantes, Classes, Pautas, Processos, Configuracao)
    const provsLuanda = [
      { id: "prov-luanda", tenant_id: "tenant-luanda", nome: "Luanda", codigo: "LUA" }
    ];
    for (const prov of provsLuanda) {
      batch.set(doc(db, "provincias", prov.id), prov);
    }

    const escolasLuanda = [
      {
        id: "esc-luanda-internato",
        tenant_id: "tenant-luanda",
        provincia_id: "prov-luanda",
        nome: "Internato Académico de Luanda",
        endereco: "Via Expresso, Talatona, Angola",
        telefone: "+244 222 345 678",
        email: "internato@luanda-academy.ao",
        diretor_id: "dir-03",
        ativo: true
      }
    ];
    for (const esc of escolasLuanda) {
      batch.set(doc(db, "escolas", esc.id), esc);
    }

    const usersLuanda = [
      { id: "user-admin-luanda", tenant_id: "tenant-luanda", email: "direcao@luanda-academy.ao", nome: "Dra. Elizabeth Mendes", tipo: "admin", permissoes: ["R", "W", "D"], ativo: true, created_at: "2025-02-10T11:00:00Z" },
      { id: "user-teacher-luis", tenant_id: "tenant-luanda", email: "luis.marques@luanda-academy.ao", nome: "Luís Marques", tipo: "docente", permissoes: ["R", "W"], ativo: true, created_at: "2025-02-20T08:00:00Z" },
      { id: "user-student-afonso", tenant_id: "tenant-luanda", email: "afonso@luanda-academy.ao", nome: "Afonso Mendes Neto", tipo: "estudante", permissoes: ["R"], ativo: true, created_at: "2025-03-01T09:00:00Z" }
    ];
    for (const usr of usersLuanda) {
      batch.set(doc(db, "users", usr.id), usr);
    }

    const docentesLuanda = [
      { id: "doc-luis", tenant_id: "tenant-luanda", user_id: "user-teacher-luis", escola_id: "esc-luanda-internato", especialidade: "Física & Química", numero_registro: "DOC-LUA-104", data_contratacao: "2025-02-20" }
    ];
    for (const docen of docentesLuanda) {
      batch.set(doc(db, "docentes", docen.id), docen);
    }

    const turmasLuanda = [
      { id: "tur-10a", tenant_id: "tenant-luanda", escola_id: "esc-luanda-internato", nome: "10ª Classe - Ciências", ano_letivo: "2026", nivel: "Médio", docente_id: "doc-luis", capacidade_max: 25 }
    ];
    for (const tur of turmasLuanda) {
      batch.set(doc(db, "turmas", tur.id), tur);
    }

    const estudantesLuanda = [
      { id: "est-afonso", tenant_id: "tenant-luanda", user_id: "user-student-afonso", escola_id: "esc-luanda-internato", numero_matricula: "MAT-LUA-502", data_nascimento: "2010-02-18", genero: "Masculino", turma_id: "tur-10a", pai_id: "" }
    ];
    for (const est of estudantesLuanda) {
      batch.set(doc(db, "estudantes", est.id), est);
    }

    const classesLuanda = [
      { id: "cls-fis-10a", tenant_id: "tenant-luanda", turma_id: "tur-10a", nome: "Física Geral", docente_id: "doc-luis", horario: "Ter/Qui 08:00 - 09:30", sala: "Laboratório A" }
    ];
    for (const cls of classesLuanda) {
      batch.set(doc(db, "classes", cls.id), cls);
    }

    const pautasLuanda = [
      { id: "pau-afonso-fis", tenant_id: "tenant-luanda", estudante_id: "est-afonso", classe_id: "cls-fis-10a", trimestre: "1º Trimestre", nota_prova: 17, nota_trabalho: 18, nota_participacao: 15, nota_exame: 16, nota_media: 16.8, situacao: "Aprovado", observacao: "Excelente raciocínio analítico.", data_lancamento: "2026-05-15" }
    ];
    for (const pau of pautasLuanda) {
      batch.set(doc(db, "pautas", pau.id), pau);
    }

    const processosLuanda = [
      { id: "prc-afonso-matricula", tenant_id: "tenant-luanda", estudante_id: "est-afonso", tipo: "Matrícula", data: "2026-02-10", documentos: ["registro_escolar.pdf"], status: "Concluído", criador_nome: "Dra. Elizabeth Mendes", observacao: "Admitido por bolsa de excelência." }
    ];
    for (const prc of processosLuanda) {
      batch.set(doc(db, "processos_aluno", prc.id), prc);
    }

    const configLuanda = {
      id: "cfg-luanda",
      tenant_id: "tenant-luanda",
      nome_instituicao: "Instituto Académico de Luanda",
      endereco: "Via Expresso, Talatona, Angola",
      contacto: "+244 923 456 789",
      ano_letivo_atual: "2026",
      escala_avaliacao: "0-20",
      notificacoes_email: true,
      logo_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=200"
    };
    batch.set(doc(db, "configuracoes", configLuanda.id), configLuanda);

    await batch.commit();
    console.log("Database seeded successfully!");
  } catch (err) {
    console.error("Error seeding database: ", err);
  }
}
