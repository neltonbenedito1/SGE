/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

// ============================================================================
// SHARED VALIDATION SCHEMAS (ZOD)
// ============================================================================

export const PasswordComplexitySchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres.')
  .max(64, 'A senha deve ter no máximo 64 caracteres.')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula.')
  .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minúscula.')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número.')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'A senha deve conter ao menos um caractere especial.');

export const PasswordChangeSchema = z.object({
  targetUid: z.string().optional().default(''),
  newPassword: PasswordComplexitySchema,
  currentPassword: z.string().optional(),
  email: z.string().optional().nullable(),
  callerUid: z.string().optional(),
  callerRole: z.string().optional(),
  callerTenantId: z.string().optional().nullable(),
});

export const UserCreateSchema = z.object({
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  tempPassword: PasswordComplexitySchema,
  role: z.enum(['admin', 'director', 'docente', 'pai', 'estudante', 'finance', 'super_admin']).default('estudante'),
  targetTenantId: z.string().min(1, 'targetTenantId é obrigatório.'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.').max(120),
});

export const SessionCreateSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID Token é obrigatório para autenticar a sessão.'),
});

export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
});

export const SendEmailSchema = z.object({
  to: z.string().email('Destinatário inválido.').toLowerCase().trim(),
  subject: z.string().min(1, 'Assunto não pode ser vazio.').max(200),
  body: z.string().min(1, 'Corpo da mensagem não pode ser vazio.').max(50000),
  smtpConfig: z.object({
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
    secure: z.boolean().optional(),
    sender_email: z.string().optional(),
    sender_name: z.string().optional(),
    smtp_type: z.enum(['manual', 'gmail']).optional(),
  }).optional(),
});

export const TranslateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.string().min(2).max(10),
});

export const SynopsisSchema = z.object({
  title: z.string().max(200).optional(),
  author: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  textSample: z.string().max(5000).optional(),
  fileName: z.string().max(255).optional(),
});

export const StripeCheckoutSessionSchema = z.object({
  planId: z.enum(['plano-basico', 'plano-pro', 'plano-enterprise', 'plano-plus']),
  mode: z.enum(['subscription', 'payment']).default('subscription'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const StripePortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const StripeCancelSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1),
  immediately: z.boolean().default(false),
});

export const StripeRefundSchema = z.object({
  paymentIntentId: z.string().min(1),
  amount: z.number().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

export const QrAttendanceValidateSchema = z.object({
  token: z.string().min(1, 'Token do QR Code é obrigatório.'),
  turmaId: z.string().optional(),
  disciplinaId: z.string().optional(),
  tipoPresenca: z.enum(['presente', 'atraso', 'ausente']).default('presente'),
});

export const CustomClaimsMigrationSchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(500).default(100),
  tenantId: z.string().optional(),
});

export const PdfAccessSchema = z.object({
  bookId: z.string().min(1, 'bookId é obrigatório.'),
  bookTitle: z.string().optional(),
});
