import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy, COMMON_WEAK_PASSWORDS } from '../src/shared/passwordPolicy';
import { BootstrapInitializeSchema, TransferOwnershipSchema } from '../src/shared/schemas';

describe('Global Password Policy & Security Schemas (SGE)', () => {
  describe('validatePasswordPolicy', () => {
    it('deve aceitar senha forte com mais de 12 caracteres e todos os requisitos', () => {
      const res = validatePasswordPolicy('SysEdu#Security2026!');
      expect(res.valid).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(5);
      expect(res.errors.length).toBe(0);
    });

    it('deve rejeitar senha com menos de 12 caracteres', () => {
      const res = validatePasswordPolicy('Ab1!cd2#');
      expect(res.valid).toBe(false);
      expect(res.requirements.minLength).toBe(false);
      expect(res.errors).toContain('A palavra-passe deve conter no mínimo 12 caracteres.');
    });

    it('deve rejeitar senha sem maiúscula', () => {
      const res = validatePasswordPolicy('sysedu#security2026!');
      expect(res.valid).toBe(false);
      expect(res.requirements.hasUppercase).toBe(false);
    });

    it('deve rejeitar senha sem minúscula', () => {
      const res = validatePasswordPolicy('SYSEDU#SECURITY2026!');
      expect(res.valid).toBe(false);
      expect(res.requirements.hasLowercase).toBe(false);
    });

    it('deve rejeitar senha sem número', () => {
      const res = validatePasswordPolicy('SysEdu#SecurityPass!');
      expect(res.valid).toBe(false);
      expect(res.requirements.hasNumber).toBe(false);
    });

    it('deve rejeitar senha sem caractere especial', () => {
      const res = validatePasswordPolicy('SysEduSecurity2026');
      expect(res.valid).toBe(false);
      expect(res.requirements.hasSpecial).toBe(false);
    });

    it('deve rejeitar senha que contenha o e-mail do utilizador', () => {
      const res = validatePasswordPolicy('admin@escola.mz2026!A', 'admin@escola.mz');
      expect(res.valid).toBe(false);
      expect(res.requirements.notEmail).toBe(false);
    });

    it('deve rejeitar senhas fracas comuns', () => {
      for (const weak of Array.from(COMMON_WEAK_PASSWORDS).slice(0, 5)) {
        const res = validatePasswordPolicy(weak);
        expect(res.valid).toBe(false);
      }
    });

    it('deve aceitar espaços internos e caracteres Unicode', () => {
      const res = validatePasswordPolicy('Palavra Passe Segura 2026! ção');
      expect(res.valid).toBe(true);
      expect(res.requirements.minLength).toBe(true);
    });
  });

  describe('BootstrapInitializeSchema', () => {
    it('deve aceitar payload válido para o primeiro superadministrador', () => {
      const result = BootstrapInitializeSchema.safeParse({
        email: 'primeiro.superadmin@escola.edu.mz',
        password: 'SysEdu#MasterAdmin2026!',
        confirmPassword: 'SysEdu#MasterAdmin2026!',
        nome: 'Super Administrador Geral',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar se a confirmação de senha não coincidir', () => {
      const result = BootstrapInitializeSchema.safeParse({
        email: 'primeiro.superadmin@escola.edu.mz',
        password: 'SysEdu#MasterAdmin2026!',
        confirmPassword: 'OutraSenhaCompletamenteDiferente123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('As palavras-passe não coincidem.');
      }
    });

    it('deve rejeitar se a senha contiver o e-mail do superadministrador', () => {
      const result = BootstrapInitializeSchema.safeParse({
        email: 'superadmin@escola.edu.mz',
        password: 'superadmin@escola.edu.mz#2026!A',
        confirmPassword: 'superadmin@escola.edu.mz#2026!A',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar payload com metadados clientIp e userAgent', () => {
      const result = BootstrapInitializeSchema.safeParse({
        email: 'primeiro.superadmin@escola.edu.mz',
        password: 'SysEdu#MasterAdmin2026!',
        confirmPassword: 'SysEdu#MasterAdmin2026!',
        nome: 'Super Administrador Geral',
        clientIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TransferOwnershipSchema ("Seder Administracao")', () => {
    it('deve aceitar payload válido para transferência de administração', () => {
      const result = TransferOwnershipSchema.safeParse({
        newAdminEmail: 'novo.superadmin@escola.edu.mz',
        newPassword: 'NovoSuperAdmin@2026#Sec',
        confirmPassword: 'NovoSuperAdmin@2026#Sec',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar confirmação diferente na transferência de administração', () => {
      const result = TransferOwnershipSchema.safeParse({
        newAdminEmail: 'novo.superadmin@escola.edu.mz',
        newPassword: 'NovoSuperAdmin@2026#Sec',
        confirmPassword: 'SenhaIncorretaConfirmacao2026!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('As palavras-passe não coincidem.');
      }
    });

    it('deve rejeitar e-mail inválido', () => {
      const result = TransferOwnershipSchema.safeParse({
        newAdminEmail: 'email-invalido-sem-dominio',
        newPassword: 'NovoSuperAdmin@2026#Sec',
        confirmPassword: 'NovoSuperAdmin@2026#Sec',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar payload com metadados clientIp e userAgent', () => {
      const result = TransferOwnershipSchema.safeParse({
        newAdminEmail: 'novo.superadmin@escola.edu.mz',
        newPassword: 'NovoSuperAdmin@2026#Sec',
        confirmPassword: 'NovoSuperAdmin@2026#Sec',
        clientIp: '127.0.0.1',
        userAgent: 'Vitest/Test-Agent',
      });
      expect(result.success).toBe(true);
    });
  });
});
