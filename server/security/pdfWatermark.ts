/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

const PDF_SIGNING_SECRET = process.env.PDF_SIGNING_SECRET || 'sysedu_pdf_signing_secret_2026';
const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export interface PdfAccessTokenPayload {
  bookId: string;
  editionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  tenantId: string;
  expiresAt: number;
}

/**
 * Creates a short-lived signed token to stream/view a PDF with user identification
 */
export function generatePdfAccessToken(params: {
  bookId: string;
  editionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  tenantId: string;
}): { token: string; expiresAt: number; watermarkText: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const watermarkText = `SysEdu Licenciado para: ${params.userName} (${params.userEmail}) • ID: ${params.userId} • ${new Date().toISOString().split('T')[0]}`;

  const payload: PdfAccessTokenPayload = {
    bookId: params.bookId,
    editionId: params.editionId,
    userId: params.userId,
    userEmail: params.userEmail,
    userName: params.userName,
    tenantId: params.tenantId,
    expiresAt,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', PDF_SIGNING_SECRET).update(payloadBase64).digest('hex');

  const token = `${payloadBase64}.${signature}`;
  return { token, expiresAt, watermarkText };
}

/**
 * Verifies a short-lived signed PDF access token
 */
export function verifyPdfAccessToken(token: string): PdfAccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Token de acesso a PDF malformado.');
  }

  const [payloadBase64, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', PDF_SIGNING_SECRET).update(payloadBase64).digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Assinatura do token de acesso ao PDF inválida.');
  }

  const payload: PdfAccessTokenPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));

  if (Math.floor(Date.now() / 1000) > payload.expiresAt) {
    throw new Error('O link temporário de acesso ao PDF expirou. Por favor, solicite a visualização novamente.');
  }

  return payload;
}
