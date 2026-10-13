import { describe, it, expect } from 'vitest';
import { authenticateServerUser } from '../server/security/authManager';

describe('Server-Side Authentication Security (SuperAdmin)', () => {
  it('deve autenticar neltonbenedito1@gmail.com com a senha correta (Velocidade)', async () => {
    const user = await authenticateServerUser('neltonbenedito1@gmail.com', 'Velocidade');
    expect(user).not.toBeNull();
    expect(user?.email).toBe('neltonbenedito1@gmail.com');
    expect(user?.role).toBe('super_admin');
    expect(user?.tipo).toBe('super_admin');
    expect(user?.tenant_id).toBe('super-admin');
    expect(user?.nome).toBe('Administrador do Sistema');
    expect(user?.ativo).toBe(true);
  });

  it('deve rejeitar neltonbenedito1@gmail.com com senha incorreta', async () => {
    const user = await authenticateServerUser('neltonbenedito1@gmail.com', 'SenhaIncorreta123');
    expect(user).toBeNull();
  });

  it('deve rejeitar senhas vazias ou nulas', async () => {
    const user = await authenticateServerUser('neltonbenedito1@gmail.com', '');
    expect(user).toBeNull();
  });

  it('deve rejeitar usuários não cadastrados', async () => {
    const user = await authenticateServerUser('estranho@qualquer.com', 'QualquerSenha');
    expect(user).toBeNull();
  });

  it('deve ser tolerante a maiúsculas e espaços no e-mail (case-insensitive)', async () => {
    const user = await authenticateServerUser('  NELTONBENEDITO1@GMAIL.COM  ', 'Velocidade');
    expect(user).not.toBeNull();
    expect(user?.role).toBe('super_admin');
  });
});
