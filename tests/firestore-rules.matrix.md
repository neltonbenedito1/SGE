# Matriz de Testes de Segurança: Firestore Rules (SysEdu)

Esta matriz documenta o controle de acesso baseado em atributos e papéis (**ABAC / RBAC**) com isolamento multi-tenant estrito garantido pelo arquivo `firestore.rules`.

### Legenda:
*   **ALLOW**: Operação permitida pela regra de segurança.
*   **DENY**: Operação rejeitada pelo motor de regras do Firestore.
*   **OWN**: Permitido apenas se o ID do documento corresponder ao `request.auth.uid` ou vínculo direto de aluno/filho.
*   **TENANT**: Permitido apenas se o `resource.data.tenant_id == request.auth.token.tenant_id`.

---

| Coleção | Operação | Visitante (Não Autenticado) | Aluno / Estudante | Docente / Professor | Tenant Admin / Diretor | Super Admin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`users/{uid}`** | Read | DENY | OWN | TENANT (Listagem básica) | TENANT | ALLOW |
| | Create | DENY | DENY | DENY | TENANT | ALLOW |
| | Update (Campos Próprios: nome, foto) | DENY | OWN | OWN | TENANT | ALLOW |
| | Update (Campos Críticos: role, tenant, plano) | DENY | **DENY (Imutável)** | **DENY (Imutável)** | **DENY (Imutável)** | ALLOW |
| | Delete | DENY | DENY | DENY | DENY | ALLOW |
| **`tenants/{id}`** | Read | ALLOW (Público) | ALLOW | ALLOW | ALLOW | ALLOW |
| | Create | DENY | DENY | DENY | DENY (Apenas Servidor/Super) | ALLOW |
| | Update (Status / Plano) | DENY | DENY | DENY | **DENY (Protegido)** | ALLOW |
| | Delete | DENY | DENY | DENY | DENY | ALLOW |
| **`planos/{id}`** | Read | ALLOW (Público) | ALLOW | ALLOW | ALLOW | ALLOW |
| | Write | DENY | DENY | DENY | DENY | ALLOW |
| **`pagamentos/{id}`** | Read | DENY | DENY | DENY | TENANT | ALLOW |
| | Write (Criar/Modificar Fatura SaaS) | DENY | DENY | DENY | **DENY (Apenas Backend)** | ALLOW |
| **`escolas/{id}`** | Read | DENY | TENANT | TENANT | TENANT | ALLOW |
| | Write | DENY | DENY | DENY | TENANT | ALLOW |
| **`turmas/{id}`** | Read | DENY | TENANT | TENANT | TENANT | ALLOW |
| | Write | DENY | DENY | DENY | TENANT | ALLOW |
| **`pautas/{id}`** | Read | DENY | OWN (Apenas suas notas) | TENANT | TENANT | ALLOW |
| | Create / Update | DENY | **DENY (Anti-Fraude)** | TENANT | TENANT | ALLOW |
| | Delete | DENY | DENY | DENY | TENANT | ALLOW |
| **`faturas_estudantes/{id}`** | Read | DENY | OWN (Apenas suas faturas) | DENY | TENANT | ALLOW |
| | Create / Update (Marcar como Pago) | DENY | **DENY (Anti-Fraude)** | DENY | TENANT | ALLOW |
| **`assiduidade_logs/{id}`** | Read | DENY | DENY | TENANT | TENANT | ALLOW |
| | Create | DENY | DENY | TENANT | TENANT | ALLOW |
| **`audit_logs/{id}`** | Read | DENY | DENY | DENY | TENANT | ALLOW |
| | Create | DENY | OWN (Append-Only) | OWN (Append-Only) | OWN (Append-Only) | ALLOW |
| | Update / Delete | **DENY** | **DENY (Imutável)** | **DENY (Imutável)** | **DENY (Imutável)** | **DENY (Imutável)** |
| **`logs_erros/{id}`** | Read | DENY | DENY | DENY | DENY | ALLOW |
| | Create | ALLOW (Reporte) | ALLOW (Reporte) | ALLOW (Reporte) | ALLOW (Reporte) | ALLOW |
| | Update / Delete | DENY | DENY | DENY | DENY | ALLOW |
| **`smtp_configs/{id}`** | Read | DENY | DENY | DENY | TENANT | ALLOW |
| | Write | DENY | DENY | DENY | TENANT | ALLOW |

---

### Casos de Teste Críticos Validados:
1. **Auto-Elevação Bloqueada**: Estudante autenticado tenta `updateDoc(doc(db, 'users', uid), { tipo: 'super_admin' })` -> **DENY**.
2. **Isolamento de Escolas (Cross-Tenant)**: Usuário da `Escola A` tenta `getDoc(doc(db, 'turmas', idTurmaEscolaB))` -> **DENY**.
3. **Fraude em Pautas**: Estudante tenta alterar campo `nota_prova` no documento de sua pauta -> **DENY**.
4. **Fraude Financeira Estudantil**: Estudante tenta alterar status da fatura de `Pendente` para `Pago` -> **DENY**.
5. **Imutabilidade de Auditoria**: Qualquer usuário tenta `updateDoc` ou `deleteDoc` na coleção `audit_logs` -> **DENY**.
