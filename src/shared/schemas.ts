/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { validatePasswordPolicy } from './passwordPolicy';

// ============================================================================
// SHARED VALIDATION SCHEMAS (ZOD - STRICT CYBERSECURITY HARDENING & GLOBAL PASSWORD POLICY)
// ============================================================================

export const PasswordComplexitySchema = z
  .string()
  .min(12, 'A palavra-passe deve ter no mínimo 12 caracteres.')
  .max(128, 'A palavra-passe deve ter no máximo 128 caracteres.')
  .superRefine((val, ctx) => {
    const result = validatePasswordPolicy(val);
    if (!result.valid) {
      result.errors.forEach((err) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err,
        });
      });
    }
  });

export const BootstrapInitializeSchema = z.object({
  email: z.string().email('E-mail institucional inválido.').max(120).toLowerCase().trim(),
  password: PasswordComplexitySchema,
  confirmPassword: z.string().min(1, 'A confirmação de palavra-passe é obrigatória.'),
  nome: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres.').max(120).trim().optional().default('Super Administrador'),
  uid: z.string().optional(),
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
}).passthrough().refine((data) => data.password === data.confirmPassword, {
  message: 'As palavras-passe não coincidem.',
  path: ['confirmPassword'],
}).refine((data) => {
  const result = validatePasswordPolicy(data.password, data.email);
  return result.requirements.notEmail;
}, {
  message: 'A palavra-passe não pode conter o seu endereço de e-mail.',
  path: ['password'],
});

export const TransferOwnershipSchema = z.object({
  newAdminEmail: z.string().email('E-mail do novo administrador inválido.').max(120).toLowerCase().trim(),
  newPassword: PasswordComplexitySchema,
  confirmPassword: z.string().min(1, 'A confirmação de palavra-passe é obrigatória.'),
  currentAdminPassword: z.string().max(128).optional(),
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
}).passthrough().refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As palavras-passe não coincidem.',
  path: ['confirmPassword'],
}).refine((data) => {
  const result = validatePasswordPolicy(data.newPassword, data.newAdminEmail);
  return result.requirements.notEmail;
}, {
  message: 'A palavra-passe não pode conter o endereço de e-mail do novo administrador.',
  path: ['newPassword'],
});

export const PasswordChangeSchema = z.object({
  targetUid: z.string().max(128).optional().default(''),
  newPassword: PasswordComplexitySchema,
  currentPassword: z.string().max(128).optional(),
  email: z.string().email('E-mail inválido.').max(120).optional().nullable(),
  callerUid: z.string().max(128).optional(),
  callerRole: z.string().max(50).optional(),
  callerTenantId: z.string().max(128).optional().nullable(),
}).strict();

export const UserCreateSchema = z.object({
  email: z.string().email('E-mail inválido.').max(120).toLowerCase().trim(),
  tempPassword: PasswordComplexitySchema,
  role: z.enum(['admin', 'director', 'docente', 'pai', 'estudante', 'finance', 'super_admin']).default('estudante'),
  targetTenantId: z.string().min(1, 'targetTenantId é obrigatório.').max(128),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.').max(120).trim(),
}).strict();

export const SessionCreateSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID Token é obrigatório para autenticar a sessão.').max(4096),
}).strict();

export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido.').max(120).toLowerCase().trim(),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.').max(128),
}).strict();

export const SendEmailSchema = z.object({
  to: z.string().email('Destinatário inválido.').max(120).toLowerCase().trim(),
  subject: z.string().min(1, 'Assunto não pode ser vazio.').max(200).trim(),
  body: z.string().min(1, 'Corpo da mensagem não pode ser vazio.').max(50000),
  smtpConfig: z.object({
    host: z.string().max(255).optional(),
    port: z.number().int().positive().max(65535).optional(),
    user: z.string().max(255).optional(),
    pass: z.string().max(255).optional(),
    secure: z.boolean().optional(),
    sender_email: z.string().email().max(120).optional(),
    sender_name: z.string().max(120).optional(),
    smtp_type: z.enum(['manual', 'gmail']).optional(),
  }).strict().optional(),
}).strict();

export const TranslateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.string().min(2).max(10),
}).strict();

export const SynopsisSchema = z.object({
  title: z.string().max(200).optional(),
  author: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  textSample: z.string().max(5000).optional(),
  fileName: z.string().max(255).optional(),
}).strict();

export const StripeCheckoutSessionSchema = z.object({
  planId: z.enum(['plano-basico', 'plano-pro', 'plano-enterprise', 'plano-plus']),
  mode: z.enum(['subscription', 'payment']).default('subscription'),
  successUrl: z.string().url().max(1024).optional(),
  cancelUrl: z.string().url().max(1024).optional(),
}).strict();

export const StripePortalSessionSchema = z.object({
  returnUrl: z.string().url().max(1024).optional(),
}).strict();

export const StripeCancelSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1).max(255),
  immediately: z.boolean().default(false),
}).strict();

export const StripeRefundSchema = z.object({
  paymentIntentId: z.string().min(1).max(255),
  amount: z.number().positive().max(1000000).optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
}).strict();

export const QrAttendanceValidateSchema = z.object({
  token: z.string().min(1, 'Token do QR Code é obrigatório.').max(2048),
  turmaId: z.string().max(128).optional(),
  disciplinaId: z.string().max(128).optional(),
  tipoPresenca: z.enum(['presente', 'atraso', 'ausente']).default('presente'),
}).strict();

export const CustomClaimsMigrationSchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(500).default(100),
  tenantId: z.string().max(128).optional(),
}).strict();

export const PdfAccessSchema = z.object({
  bookId: z.string().min(1, 'bookId é obrigatório.').max(128),
  bookTitle: z.string().max(255).optional(),
}).strict();

export const QrAttendanceGenerateSchema = z.object({
  studentId: z.string().max(128).optional(),
  matricula: z.string().max(64).optional(),
  name: z.string().max(128).optional(),
}).strict();

export const PdfAccessRequestSchema = z.object({
  bookId: z.string().min(1, 'bookId é obrigatório.').max(128),
  editionId: z.string().min(1, 'editionId é obrigatório.').max(128),
}).strict();

export const SessionRevokeSchema = z.object({
  targetUid: z.string().max(128).optional(),
}).strict();

export const BatchDeleteTenantsSchema = z.object({
  tenantIds: z.array(z.string().min(1).max(128)).min(1, 'Ao menos um ID de instituição é necessário.').max(100),
}).strict();
