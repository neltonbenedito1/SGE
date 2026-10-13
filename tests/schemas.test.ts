import { describe, it, expect } from 'vitest';
import { 
  SendEmailSchema, 
  PasswordChangeSchema, 
  UserCreateSchema, 
  TranslateSchema, 
  QrAttendanceValidateSchema,
  PdfAccessSchema,
  StripeCheckoutSessionSchema
} from '../src/shared/schemas';

describe('Shared Zod Schemas Validation', () => {
  describe('SendEmailSchema', () => {
    it('deve aceitar payload válido com endereço e assunto', () => {
      const result = SendEmailSchema.safeParse({
        to: 'aluno@escola.mz',
        subject: 'Aviso Escolar',
        body: 'Texto da notificação',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar e-mail malformado', () => {
      const result = SendEmailSchema.safeParse({
        to: 'nao-e-um-email',
        subject: 'Aviso',
        body: 'Texto',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PasswordChangeSchema', () => {
    it('deve rejeitar senhas curtas com menos de 8 caracteres', () => {
      const result = PasswordChangeSchema.safeParse({
        targetUid: 'user-1',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar senha forte com mais de 8 caracteres', () => {
      const result = PasswordChangeSchema.safeParse({
        targetUid: 'user-1',
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword2026@',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('UserCreateSchema', () => {
    it('deve exigir email, nome, role e tenant_id válidos', () => {
      const result = UserCreateSchema.safeParse({
        email: 'diretor@escola.mz',
        nome: 'Diretor Silva',
        role: 'director',
        targetTenantId: 'tenant-maputo',
        tempPassword: 'InitialSecurePass2026!',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar papéis inválidos ou não reconhecidos', () => {
      const result = UserCreateSchema.safeParse({
        email: 'hacker@mal.com',
        nome: 'Hacker',
        role: 'god_mode_unauthorized',
        targetTenantId: 'tenant-a',
        tempPassword: 'InitialSecurePass2026!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('QrAttendanceValidateSchema', () => {
    it('deve validar token de presença de QR Code', () => {
      const result = QrAttendanceValidateSchema.safeParse({
        token: 'signed_qr_base64_token_sample',
        tipoPresenca: 'presente',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PdfAccessSchema', () => {
    it('deve validar requisição de token de leitura para livro válido', () => {
      const result = PdfAccessSchema.safeParse({
        bookId: 'livro-matematica-7',
        bookTitle: 'Matemática 7ª Classe',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('StripeCheckoutSessionSchema', () => {
    it('deve rejeitar planos desconhecidos fora da matriz oficial', () => {
      const result = StripeCheckoutSessionSchema.safeParse({
        planId: 'plano-gratis-fake-ilimitado',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar planos oficiais do SaaS (plano-basico, plano-pro, plano-enterprise)', () => {
      const result = StripeCheckoutSessionSchema.safeParse({
        planId: 'plano-pro',
      });
      expect(result.success).toBe(true);
    });
  });
});
