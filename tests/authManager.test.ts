import { describe, it, expect } from 'vitest';
import { 
  hashPasswordPBKDF2, 
  verifyPasswordHash, 
  timingSafeCompare, 
  canManageUserPassword, 
  authenticateServerUser 
} from '../server/security/authManager';

describe('Server-Side Authentication Security & Cryptography', () => {
  it('deve gerar e verificar hashes PBKDF2 com salt de forma segura', () => {
    const salt = 'sysedu_test_salt_random_123';
    const password = 'SuperSenhaForte2026!';
    const hash = hashPasswordPBKDF2(password, salt);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(128); // 64 bytes em hex

    // Verificação positiva
    const isValid = verifyPasswordHash(password, salt, hash);
    expect(isValid).toBe(true);

    // Rejeição de senha errada
    const isInvalid = verifyPasswordHash('SenhaErrada123', salt, hash);
    expect(isInvalid).toBe(false);
  });

  it('deve executar comparação segura em tempo constante (anti-timing attacks)', () => {
    expect(timingSafeCompare('token_secreto_abc', 'token_secreto_abc')).toBe(true);
    expect(timingSafeCompare('token_secreto_abc', 'token_secreto_xyz')).toBe(false);
    expect(timingSafeCompare('token_secreto_abc', '')).toBe(false);
  });

  it('deve validar permissões hierárquicas de gestão de palavras-passe (RBAC)', () => {
    // 1. Auto-gestão permitida para qualquer utilizador
    expect(canManageUserPassword(
      { uid: 'u1', role: 'estudante', tenant_id: 't1' },
      { uid: 'u1', role: 'estudante', tenant_id: 't1' }
    )).toBe(true);

    // 2. Super Admin pode gerir qualquer utilizador em qualquer tenant
    expect(canManageUserPassword(
      { uid: 'super1', role: 'super_admin', tenant_id: 'super-admin' },
      { uid: 'any_user', role: 'admin', tenant_id: 'tenant-qualquer' }
    )).toBe(true);

    // 3. Admin pode gerir professor no mesmo tenant
    expect(canManageUserPassword(
      { uid: 'adm1', role: 'admin', tenant_id: 'escola-1' },
      { uid: 'prof1', role: 'docente', tenant_id: 'escola-1' }
    )).toBe(true);

    // 4. Admin NÃO pode gerir utilizador em tenant diferente (isolamento multi-tenant)
    expect(canManageUserPassword(
      { uid: 'adm1', role: 'admin', tenant_id: 'escola-1' },
      { uid: 'prof2', role: 'docente', tenant_id: 'escola-2' }
    )).toBe(false);

    // 5. Docente ou Estudante NÃO pode alterar a senha de outro utilizador
    expect(canManageUserPassword(
      { uid: 'prof1', role: 'docente', tenant_id: 'escola-1' },
      { uid: 'prof2', role: 'docente', tenant_id: 'escola-1' }
    )).toBe(false);
  });

  it('deve rejeitar senhas vazias ou nulas na autenticação do servidor', async () => {
    const user = await authenticateServerUser('admin@escola.mz', '');
    expect(user).toBeNull();
  });

  it('deve rejeitar utilizadores não registados', async () => {
    const user = await authenticateServerUser('nao_existe_' + Date.now() + '@escola.com', 'QualquerSenhaForte123!');
    expect(user).toBeNull();
  });
});
