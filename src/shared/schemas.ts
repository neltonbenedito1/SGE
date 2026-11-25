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
  async: z.boolean().optional(),
  idempotencyKey: z.string().max(180).optional(),
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
  async: z.boolean().optional(),
}).strict();

export const SynopsisSchema = z.object({
  title: z.string().max(200).optional(),
  author: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  textSample: z.string().max(5000).optional(),
  fileName: z.string().max(255).optional(),
  async: z.boolean().optional(),
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

export const AsyncJobTypeSchema = z.enum([
  'bulk_notification',
  'email_send',
  'report_generate',
  'pdf_generate',
  'ai_task',
  'stripe_webhook',
]);

export const EnqueueJobSchema = z.object({
  type: AsyncJobTypeSchema,
  title: z.string().min(2).max(180).trim().optional(),
  idempotencyKey: z.string().max(180).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  payload: z.record(z.string(), z.any()),
}).strict();

export const BulkNotificationSchema = z.object({
  action: z.enum(['notificar_aula_pendente', 'broadcast_recipients']).default('broadcast_recipients'),
  idempotencyKey: z.string().max(180).optional(),
  planoAulaId: z.string().max(128).optional(),
  docenteId: z.string().max(128).optional(),
  targetUserId: z.string().max(128).optional(),
  teacherName: z.string().max(160).optional(),
  teacherEmail: z.string().max(160).optional(),
  disciplinaId: z.string().max(128).optional(),
  disciplinaNome: z.string().max(160).optional(),
  topico: z.string().max(300).optional(),
  periodoLabel: z.string().max(80).optional(),
  dataPrevista: z.string().max(40).optional(),
  titulo: z.string().max(200).optional(),
  mensagem: z.string().max(2000).optional(),
  tipo: z.enum(['info', 'alerta', 'limite', 'sistema', 'sucesso', 'cadastro']).optional(),
  modulo: z.string().max(80).optional(),
  recipients: z.array(z.object({
    destinatario_id: z.string().min(1).max(160),
    destinatario_role: z.string().max(40).optional(),
    destinatario_email: z.string().max(160).optional(),
    estudante_id: z.string().max(128).optional(),
    docente_id: z.string().max(128).optional(),
    turma_id: z.string().max(128).optional(),
    titulo: z.string().max(200).optional(),
    mensagem: z.string().max(2000).optional(),
  })).max(2000).optional(),
}).strict();

export const ReportGenerateAsyncSchema = z.object({
  scope: z.enum(['analytics_recompute', 'monthly_report']).default('analytics_recompute'),
  tenantId: z.string().max(128).optional(),
  idempotencyKey: z.string().max(180).optional(),
  monthName: z.string().max(40).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  kpis: z.object({
    total_alunos: z.number(),
    media_geral: z.number(),
    taxa_aprovacao: z.number(),
    taxa_assiduidade: z.number(),
  }).optional(),
  resumoTexto: z.string().max(4000).optional(),
}).strict();

export const PdfExportAsyncSchema = z.object({
  reportType: z.enum(['bi_consolidado', 'relatorio_mensal']),
  reportId: z.string().max(128).optional(),
  title: z.string().min(2).max(200),
  idempotencyKey: z.string().max(180).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).strict();

// ============================================================================
// FAQ & BASE DE CONHECIMENTO SCHEMAS (FASE 1)
// ============================================================================

export const FaqEstadoSchema = z.enum(['rascunho', 'publicado', 'despublicado', 'arquivado']);
export const FaqTipoSchema = z.enum(['faq', 'artigo_tutorial']);
export const FaqVisibilidadeSchema = z.enum([
  'todos',
  'tenant_admin',
  'docentes',
  'estudantes',
  'encarregados',
  'super_admin',
]);

export const FaqAttachmentSchema = z.object({
  id: z.string().min(1).max(128),
  nome: z.string().min(1).max(180).trim(),
  tipo: z.enum(['image', 'pdf']),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  tamanho_bytes: z.number().int().min(1).max(750 * 1024),
  url: z
    .string()
    .min(1)
    .max(2048)
    .refine(
      (u) => u.startsWith('/api/faq/attachments/') || /^https:\/\/[^\s]+$/i.test(u),
      'URL de anexo inválido. Apenas links HTTPS ou anexos internos verificados são permitidos.'
    ),
  criado_em: z.string().max(64).optional(),
}).strict();

export const FaqAttachmentUploadSchema = z.object({
  nome: z.string().min(1, 'Nome do ficheiro é obrigatório.').max(180).trim(),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  dataBase64: z.string().min(8, 'Conteúdo do ficheiro inválido.').max(1_200_000, 'O ficheiro excede o limite de 700 KB.'),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const FaqCategoryCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  nome: z.string().min(2, 'O nome da categoria deve ter pelo menos 2 caracteres.').max(100).trim(),
  descricao: z.string().max(400).trim().optional().default(''),
  ordem: z.number().int().min(0).max(9999).default(0),
  ativo: z.boolean().default(true),
  visibilidade_padrao: FaqVisibilidadeSchema.default('todos'),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const FaqCategoryUpdateSchema = z.object({
  nome: z.string().min(2, 'O nome da categoria deve ter pelo menos 2 caracteres.').max(100).trim().optional(),
  descricao: z.string().max(400).trim().optional(),
  ordem: z.number().int().min(0).max(9999).optional(),
  ativo: z.boolean().optional(),
  visibilidade_padrao: FaqVisibilidadeSchema.optional(),
}).strict();

export const FaqArticleCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  tipo: FaqTipoSchema.default('faq'),
  titulo: z.string().min(3, 'O título/pergunta deve ter pelo menos 3 caracteres.').max(240).trim(),
  pergunta: z.string().max(300).trim().optional(),
  resposta_html: z.string().min(1, 'A resposta é obrigatória.').max(100_000),
  categoria_id: z.string().min(1, 'A categoria é obrigatória.').max(128),
  palavras_chave: z.array(z.string().min(1).max(60).trim()).max(20).default([]),
  anexos: z.array(FaqAttachmentSchema).max(5).default([]),
  estado: FaqEstadoSchema.default('rascunho'),
  prioridade: z.number().int().min(1).max(100).default(50),
  visibilidade: FaqVisibilidadeSchema.default('todos'),
  utilizavel_ia: z.boolean().default(true),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const FaqArticleUpdateSchema = z.object({
  tipo: FaqTipoSchema.optional(),
  titulo: z.string().min(3, 'O título/pergunta deve ter pelo menos 3 caracteres.').max(240).trim().optional(),
  pergunta: z.string().max(300).trim().optional(),
  resposta_html: z.string().min(1, 'A resposta não pode ficar vazia.').max(100_000).optional(),
  categoria_id: z.string().min(1).max(128).optional(),
  palavras_chave: z.array(z.string().min(1).max(60).trim()).max(20).optional(),
  anexos: z.array(FaqAttachmentSchema).max(5).optional(),
  estado: FaqEstadoSchema.optional(),
  prioridade: z.number().int().min(1).max(100).optional(),
  visibilidade: FaqVisibilidadeSchema.optional(),
  utilizavel_ia: z.boolean().optional(),
  nota_alteracao: z.string().max(300).trim().optional(),
}).strict();

export const FaqArticleStatusSchema = z.object({
  estado: FaqEstadoSchema,
  nota_alteracao: z.string().max(300).trim().optional(),
}).strict();

// ============================================================================
// ASSISTENTE & EQUIPA DE SUPORTE SCHEMAS (FASE 2)
// ============================================================================

export const SupportAgentRoleSchema = z.enum(['administrador', 'supervisor', 'assistente']);
export const SupportAgentStatusSchema = z.enum(['activo', 'inactivo', 'suspenso', 'arquivado']);
export const SupportAvailabilitySchema = z.enum(['online', 'offline', 'ocupado']);
export const SupportWeekdaySchema = z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
export const SupportHistoryScopeSchema = z.enum(['proprio', 'todos']);

const TimeHHMMRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const SupportScheduleDaySchema = z.object({
  dia: SupportWeekdaySchema,
  ativo: z.boolean(),
  inicio: z.string().regex(TimeHHMMRegex, 'Hora de início inválida (HH:MM).').default('08:00'),
  fim: z.string().regex(TimeHHMMRegex, 'Hora de fim inválida (HH:MM).').default('17:00'),
}).strict();

export const SupportWorkingHoursSchema = z.object({
  ativo: z.boolean().default(true),
  timezone: z.string().min(2).max(64).default('Africa/Maputo'),
  dias: z.array(SupportScheduleDaySchema).max(7).default([]),
}).strict();

export const SupportAssignmentRulesSchema = z.object({
  auto_atribuir: z.boolean().default(true),
  apenas_horario: z.boolean().default(true),
  prioridade_atribuicao: z.number().int().min(1).max(100).default(50),
  categorias_especialidade: z.array(z.string().min(1).max(128)).max(30).default([]),
}).strict();

export const SupportPermissionSetSchema = z.object({
  visualizar: z.boolean(),
  responder: z.boolean(),
  transferir: z.boolean(),
  encerrar: z.boolean(),
  consultar_historico: z.boolean(),
  historico_escopo: SupportHistoryScopeSchema,
  consultar_analytics: z.boolean(),
  gerir_funcionarios: z.boolean(),
  configurar_ia: z.boolean(),
  gerir_faq: z.boolean(),
}).strict();

export const SupportDepartmentCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  nome: z.string().min(2, 'O nome do departamento deve ter pelo menos 2 caracteres.').max(100).trim(),
  descricao: z.string().max(400).trim().optional().default(''),
  email_fila: z.string().email('E-mail de fila inválido.').max(160).optional().or(z.literal('')),
  sla_resposta_minutos: z.number().int().min(1).max(43200).default(60),
  sla_resolucao_horas: z.number().int().min(1).max(720).default(24),
  ordem: z.number().int().min(0).max(9999).default(0),
  ativo: z.boolean().default(true),
  padrao: z.boolean().default(false),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportDepartmentUpdateSchema = z.object({
  nome: z.string().min(2, 'O nome do departamento deve ter pelo menos 2 caracteres.').max(100).trim().optional(),
  descricao: z.string().max(400).trim().optional(),
  email_fila: z.string().email('E-mail de fila inválido.').max(160).optional().or(z.literal('')),
  sla_resposta_minutos: z.number().int().min(1).max(43200).optional(),
  sla_resolucao_horas: z.number().int().min(1).max(720).optional(),
  ordem: z.number().int().min(0).max(9999).optional(),
  ativo: z.boolean().optional(),
  padrao: z.boolean().optional(),
}).strict();

export const SupportAgentCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  nome: z.string().min(2, 'O nome do funcionário é obrigatório.').max(140).trim(),
  email: z.string().email('Endereço de e-mail inválido.').max(160).trim().toLowerCase(),
  departamento_id: z.string().min(1, 'O departamento principal é obrigatório.').max(128),
  departamentos_autorizados: z.array(z.string().min(1).max(128)).max(50).default([]),
  funcao: SupportAgentRoleSchema.default('assistente'),
  estado: SupportAgentStatusSchema.default('activo'),
  disponibilidade: SupportAvailabilitySchema.default('offline'),
  limite_simultaneo: z.number().int().min(1).max(200).default(10),
  horario_atendimento: SupportWorkingHoursSchema.optional(),
  regras_atribuicao: SupportAssignmentRulesSchema.optional(),
  permissoes: SupportPermissionSetSchema.optional(),
  initialPassword: z.string().min(8).max(128).optional().or(z.literal('')),
  mustResetPassword: z.boolean().default(true),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportAgentUpdateSchema = z.object({
  nome: z.string().min(2).max(140).trim().optional(),
  email: z.string().email('Endereço de e-mail inválido.').max(160).trim().toLowerCase().optional(),
  departamento_id: z.string().min(1).max(128).optional(),
  departamentos_autorizados: z.array(z.string().min(1).max(128)).max(50).optional(),
  funcao: SupportAgentRoleSchema.optional(),
  estado: SupportAgentStatusSchema.optional(),
  disponibilidade: SupportAvailabilitySchema.optional(),
  limite_simultaneo: z.number().int().min(1).max(200).optional(),
  horario_atendimento: SupportWorkingHoursSchema.optional(),
  regras_atribuicao: SupportAssignmentRulesSchema.optional(),
}).strict();

export const SupportAgentStatusPatchSchema = z.object({
  estado: SupportAgentStatusSchema,
}).strict();

export const SupportAgentAvailabilityPatchSchema = z.object({
  disponibilidade: SupportAvailabilitySchema,
}).strict();

export const SupportPermissionsUpdateSchema = z.object({
  funcao: SupportAgentRoleSchema.optional(),
  permissoes: SupportPermissionSetSchema,
}).strict();

export const SupportCredentialResetSchema = z.object({
  newPassword: z.string().min(12, 'A palavra-passe deve conter no mínimo 12 caracteres.').max(128),
  confirmPassword: z.string().min(12).max(128),
  mustResetPassword: z.boolean().default(true),
  revokeActiveSessions: z.boolean().default(true),
}).strict().refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As palavras-passe não coincidem.',
  path: ['confirmPassword'],
});

// ============================================================================
// TICKETS, CONVERSAS & AVALIAÇÕES DE ATENDIMENTO (FASE 3)
// ============================================================================

export const SupportTicketPrioritySchema = z.enum(['baixa', 'normal', 'alta', 'urgente']);
export const SupportTicketStatusSchema = z.enum(['aberto', 'em_atendimento', 'pendente', 'resolvido', 'reaberto']);
export const SupportMessageTypeSchema = z.enum(['mensagem', 'nota_interna']);

export const SupportAttachmentRefSchema = z.object({
  id: z.string().min(1).max(128),
  nome: z.string().min(1).max(200),
  tipo: z.enum(['image', 'pdf']),
  mime_type: z.string().min(3).max(120),
  tamanho_bytes: z.number().int().min(1).max(800_000),
  url: z.string().min(1).max(512),
});

export const SupportAttachmentUploadSchema = z.object({
  fileName: z.string().min(1, 'Nome do ficheiro obrigatório.').max(200),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  base64Data: z.string().min(10, 'Ficheiro inválido ou vazio.').max(1_150_000, 'Ficheiro excede o tamanho máximo permitido.'),
  ticketId: z.string().max(128).optional(),
}).strict();

export const SupportTicketCreatePortalSchema = z.object({
  assunto: z.string().min(4, 'O assunto deve ter pelo menos 4 caracteres.').max(180).trim(),
  categoria: z.string().min(2, 'Seleccione uma categoria.').max(100).trim().default('Geral'),
  departamento_id: z.string().max(128).optional().default(''),
  prioridade: SupportTicketPrioritySchema.default('normal'),
  mensagem: z.string().min(8, 'Descreva a sua solicitação com pelo menos 8 caracteres.').max(8000).trim(),
  anexos: z.array(SupportAttachmentRefSchema).max(5).default([]),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportTicketCreateAdminSchema = SupportTicketCreatePortalSchema.extend({
  tenant_id: z.string().min(1, 'A instituição é obrigatória.').max(128),
  solicitante_id: z.string().max(128).optional(),
  solicitante_nome: z.string().min(2).max(140).trim().optional(),
  solicitante_email: z.string().email('E-mail do solicitante inválido.').max(160).trim().optional(),
  responsavel_id: z.string().max(128).optional().nullable(),
}).strict();

export const SupportTicketReplySchema = z.object({
  tipo: SupportMessageTypeSchema.default('mensagem'),
  conteudo: z.string().min(1, 'A mensagem não pode estar vazia.').max(8000).trim(),
  anexos: z.array(SupportAttachmentRefSchema).max(5).default([]),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportTicketTransferSchema = z.object({
  departamento_id: z.string().min(1, 'Seleccione o departamento de destino.').max(128),
  responsavel_id: z.string().max(128).optional().nullable(),
  motivo: z.string().max(500).trim().optional().default(''),
}).strict();

export const SupportTicketStatusUpdateSchema = z.object({
  estado: SupportTicketStatusSchema,
  motivo: z.string().max(500).trim().optional().default(''),
}).strict();

export const SupportTicketRatingSchema = z.object({
  nota: z.number().int().min(1, 'A avaliação mínima é 1.').max(5, 'A avaliação máxima é 5.'),
  comentario: z.string().max(1000).trim().optional().default(''),
}).strict();

// ============================================================================
// AGENTES DE IA & MOTOR AUTOMATIZADO (FASE 4)
// ============================================================================

export const SupportAiExecutionModeSchema = z.enum(['gemini_direct', 'n8n_webhook', 'hibrido']);
export const SupportAiModelSchema = z.enum(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

export const SupportAiAgentCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  nome: z.string().min(2, 'O nome do agente IA deve ter pelo menos 2 caracteres.').max(140).trim(),
  email: z.string().email('Identificador de e-mail inválido.').max(160).trim().toLowerCase().optional(),
  departamento_id: z.string().min(1, 'Seleccione o departamento principal.').max(128),
  departamentos_autorizados: z.array(z.string().min(1).max(128)).max(50).default([]),
  estado: SupportAgentStatusSchema.default('activo'),
  limite_simultaneo: z.number().int().min(1).max(1000).default(100),
  modelo: SupportAiModelSchema.default('gemini-4-hydrogen'),
  modo_execucao: SupportAiExecutionModeSchema.default('gemini_direct'),
  prompt_sistema: z.string().min(10, 'Defina as instruções do agente IA (mínimo 10 caracteres).').max(8000).trim(),
  personalidade: z.string().max(500).trim().default('Profissional, objectivo e claro'),
  idioma_padrao: z.string().min(2).max(20).trim().default('pt'),
  limiar_confianca: z.number().min(0.1).max(0.99).default(0.7),
  usar_apenas_faq_autorizada: z.boolean().default(true),
  max_turnos_ia: z.number().int().min(1).max(20).default(4),
  auto_responder_tickets: z.boolean().default(false),
  palavras_chave_escalonamento: z.array(z.string().min(1).max(80).trim()).max(40).default(['humano', 'urgente', 'reclamação', 'falar com atendente']),
  n8n_webhook_url: z.string().max(512).trim().optional().default(''),
  fallback_departamento_id: z.string().max(128).optional().default(''),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportAiAgentUpdateSchema = z.object({
  nome: z.string().min(2).max(140).trim().optional(),
  email: z.string().email('Identificador de e-mail inválido.').max(160).trim().toLowerCase().optional(),
  departamento_id: z.string().min(1).max(128).optional(),
  departamentos_autorizados: z.array(z.string().min(1).max(128)).max(50).optional(),
  estado: SupportAgentStatusSchema.optional(),
  limite_simultaneo: z.number().int().min(1).max(1000).optional(),
  modelo: SupportAiModelSchema.optional(),
  modo_execucao: SupportAiExecutionModeSchema.optional(),
  prompt_sistema: z.string().min(10).max(8000).trim().optional(),
  personalidade: z.string().max(500).trim().optional(),
  idioma_padrao: z.string().min(2).max(20).trim().optional(),
  limiar_confianca: z.number().min(0.1).max(0.99).optional(),
  usar_apenas_faq_autorizada: z.boolean().optional(),
  max_turnos_ia: z.number().int().min(1).max(20).optional(),
  auto_responder_tickets: z.boolean().optional(),
  palavras_chave_escalonamento: z.array(z.string().min(1).max(80).trim()).max(40).optional(),
  n8n_webhook_url: z.string().max(512).trim().optional(),
  fallback_departamento_id: z.string().max(128).optional(),
}).strict();

export const SupportAiSandboxTestSchema = z.object({
  mensagem: z.string().min(2, 'Escreva uma pergunta de teste.').max(4000).trim(),
  assunto: z.string().max(180).trim().optional().default('Consulta de teste'),
  tenant_id: z.string().min(1).max(128).optional().default('global'),
  role: z.string().min(1).max(60).optional().default('tenant_admin'),
}).strict();

export const SupportAiTicketRespondSchema = z.object({
  agent_id: z.string().max(128).optional(),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const N8nInboundSupportReplySchema = z.object({
  ticket_id: z.string().min(1).max(128),
  agent_id: z.string().min(1).max(128),
  resposta: z.string().max(8000).trim().optional().default(''),
  confianca: z.number().min(0).max(1).default(0.85),
  escalonar_humano: z.boolean().default(false),
  motivo_escalonamento: z.string().max(500).trim().optional().default(''),
  artigos_referenciados: z.array(z.string().max(200)).max(10).optional().default([]),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

// ============================================================================
// DISTRIBUIÇÃO AUTOMÁTICA E REENCAMINHAMENTO (FASE 5)
// ============================================================================

export const SupportDistributionStrategySchema = z.enum([
  'ia_primeiro',
  'round_robin',
  'menor_carga',
  'especialidade',
  'fila_departamento',
]);

export const SupportDistributionConditionsSchema = z.object({
  categorias: z.array(z.string().min(1).max(100).trim()).max(30).default([]),
  prioridades: z.array(SupportTicketPrioritySchema).max(4).default([]),
  canais: z.array(z.enum(['portal', 'superadmin', 'ia'])).max(3).default([]),
  departamentos_origem: z.array(z.string().min(1).max(128)).max(30).default([]),
  palavras_chave: z.array(z.string().min(1).max(80).trim()).max(40).default([]),
}).strict();

export const SupportDistributionRuleCreateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  nome: z.string().min(2, 'O nome da regra deve ter pelo menos 2 caracteres.').max(140).trim(),
  descricao: z.string().max(500).trim().optional().default(''),
  ativo: z.boolean().default(true),
  ordem: z.number().int().min(0).max(9999).default(10),
  condicoes: SupportDistributionConditionsSchema.default({
    categorias: [],
    prioridades: [],
    canais: [],
    departamentos_origem: [],
    palavras_chave: [],
  }),
  metodo: SupportDistributionStrategySchema.default('menor_carga'),
  destino_departamento_id: z.string().min(1, 'Seleccione o departamento de destino.').max(128),
  destino_agent_id: z.string().max(128).optional().nullable().default(null),
  auto_executar_ia: z.boolean().default(true),
  escalonar_para_humano_se_ia_falhar: z.boolean().default(true),
  respeitar_horario_atendimento: z.boolean().default(true),
  exigir_disponibilidade_online: z.boolean().default(true),
  permitir_ocupado_se_sem_online: z.boolean().default(false),
  idempotencyKey: z.string().max(180).optional(),
}).strict();

export const SupportDistributionRuleUpdateSchema = z.object({
  nome: z.string().min(2).max(140).trim().optional(),
  descricao: z.string().max(500).trim().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).max(9999).optional(),
  condicoes: SupportDistributionConditionsSchema.optional(),
  metodo: SupportDistributionStrategySchema.optional(),
  destino_departamento_id: z.string().min(1).max(128).optional(),
  destino_agent_id: z.string().max(128).optional().nullable(),
  auto_executar_ia: z.boolean().optional(),
  escalonar_para_humano_se_ia_falhar: z.boolean().optional(),
  respeitar_horario_atendimento: z.boolean().optional(),
  exigir_disponibilidade_online: z.boolean().optional(),
  permitir_ocupado_se_sem_online: z.boolean().optional(),
}).strict();

export const SupportDistributionSimulateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('global'),
  categoria: z.string().max(100).trim().default('Geral'),
  prioridade: SupportTicketPrioritySchema.default('normal'),
  canal: z.enum(['portal', 'superadmin', 'ia']).default('portal'),
  departamento_id: z.string().max(128).optional().default(''),
  assunto: z.string().min(2, 'Informe um assunto para simulação.').max(180).trim(),
  mensagem: z.string().max(4000).trim().optional().default(''),
}).strict();

export const SupportDistributionRebalanceSchema = z.object({
  tenant_id: z.string().max(128).optional(),
  departamento_id: z.string().max(128).optional(),
  incluir_alertas_sla: z.boolean().default(true),
  reatribuir_offline: z.boolean().default(false),
  dry_run: z.boolean().default(false),
  limite: z.number().int().min(1).max(100).default(50),
}).strict();

export const SupportTicketAutoDistributeSchema = z.object({
  rule_id: z.string().max(128).optional(),
  metodo_alternativo: SupportDistributionStrategySchema.optional(),
}).strict();

// ============================================================================
// ANALYTICS & MÉTRICAS DE SUPORTE (FASE 6)
// ============================================================================

export const SupportAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  start_date: z.string().max(40).optional(),
  end_date: z.string().max(40).optional(),
  tenant_id: z.string().max(128).optional().default('todos'),
  departamento_id: z.string().max(128).optional().default('todos'),
  canal: z.enum(['todos', 'portal', 'superadmin', 'ia']).optional().default('todos'),
}).strict();


