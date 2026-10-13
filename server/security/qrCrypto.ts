/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminInstance, getFirestoreInstance } from '../middleware/auth';

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'sysedu_qr_hmac_secret_key_default_fallback_2026';
const QR_VALIDITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes validity

export interface QrTokenPayload {
  studentId: string;
  tenantId: string;
  matricula?: string;
  name?: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates an HMAC-SHA256 signed QR code token
 */
export function generateSignedStudentQrToken(params: {
  studentId: string;
  tenantId: string;
  matricula?: string;
  name?: string;
}): string {
  const payload: QrTokenPayload = {
    studentId: params.studentId,
    tenantId: params.tenantId,
    matricula: params.matricula || '',
    name: params.name || '',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', QR_SECRET).update(payloadStr).digest('hex');

  // Base64Url encode combined token
  const token = Buffer.from(JSON.stringify({ p: payload, s: signature })).toString('base64url');
  return token;
}

/**
 * Validates a signed student QR code token, checks expiration, and validates against replay
 */
export async function validateAndConsumeQrToken(params: {
  token: string;
  operatorUid: string;
  operatorTenantId: string;
  turmaId?: string;
  disciplinaId?: string;
  tipoPresenca?: string;
}) {
  const { token, operatorUid, operatorTenantId, turmaId, disciplinaId, tipoPresenca = 'presente' } = params;

  let decodedJson;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    decodedJson = JSON.parse(raw);
  } catch (e) {
    throw new Error('Formato de token do QR Code inválido.');
  }

  const { p: payload, s: signature } = decodedJson as { p: QrTokenPayload; s: string };

  if (!payload || !signature) {
    throw new Error('Payload ou assinatura ausente no token.');
  }

  // 1. Verify HMAC Signature
  const expectedSignature = crypto.createHmac('sha256', QR_SECRET).update(JSON.stringify(payload)).digest('hex');
  if (signature !== expectedSignature) {
    throw new Error('Assinatura digital do QR Code inválida ou violada.');
  }

  // 2. Multi-tenant Isolation Check
  if (operatorTenantId !== 'super_admin' && payload.tenantId !== operatorTenantId) {
    throw new Error('Este QR Code pertence a outra instituição de ensino.');
  }

  // 3. Time Window Expiration Check
  const now = Date.now();
  if (now - payload.timestamp > QR_VALIDITY_WINDOW_MS) {
    throw new Error('Este QR Code expirou. Por favor, gere um novo crachá digital atualizado.');
  }

  // 4. Anti-Replay Check (Nonce) via Firestore Admin
  const db = getFirestoreInstance();

  const existingNonceQuery = await db
    .collection('assiduidade_logs')
    .where('nonce', '==', payload.nonce)
    .limit(1)
    .get();

  if (!existingNonceQuery.empty) {
    throw new Error('Tentativa de reutilização detectada! Este QR Code já foi registrado anteriormente.');
  }

  // 5. Register Attendance Record Idempotently
  const recordId = `assid_${payload.studentId}_${Date.now()}`;
  const attendanceRecord = {
    id: recordId,
    estudante_id: payload.studentId,
    tenant_id: payload.tenantId,
    matricula: payload.matricula,
    nome: payload.name,
    turma_id: turmaId || null,
    disciplina_id: disciplinaId || null,
    tipo: tipoPresenca,
    registrado_por: operatorUid,
    nonce: payload.nonce,
    metodo: 'qr_scanner_signed',
    created_at: new Date().toISOString(),
    server_timestamp: FieldValue.serverTimestamp(),
  };

  await db.collection('assiduidade_logs').doc(recordId).set(attendanceRecord);

  return {
    valid: true,
    record: attendanceRecord,
    message: `Presença de ${payload.name || payload.studentId} validada com sucesso!`,
  };
}
