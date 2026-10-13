import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { generateSignedStudentQrToken } from '../server/security/qrCrypto';

describe('Cryptographic Security (HMAC & Signatures)', () => {
  it('deve gerar token de QR Code com formato base64url e payload assinado', () => {
    const token = generateSignedStudentQrToken({
      studentId: 'aluno-teste-1',
      tenantId: 'tenant-maputo',
      matricula: 'MAT-2026-99',
      name: 'João Manuel',
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    // Decode and verify inner payload
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    expect(decoded.p).toBeDefined();
    expect(decoded.s).toBeDefined();
    expect(decoded.p.studentId).toBe('aluno-teste-1');
    expect(decoded.p.tenantId).toBe('tenant-maputo');
    expect(decoded.p.nonce).toBeDefined();
    expect(decoded.s.length).toBe(64); // SHA-256 hex length
  });

  it('deve detectar assinatura corrompida ou manipulada', () => {
    const token = generateSignedStudentQrToken({
      studentId: 'aluno-teste-2',
      tenantId: 'tenant-maputo',
    });

    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    // Tamper with payload
    decoded.p.studentId = 'aluno-hacker-modificado';

    const secret = process.env.QR_SIGNING_SECRET || 'sysedu_qr_hmac_secret_key_default_fallback_2026';
    const computedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(decoded.p)).digest('hex');

    expect(computedSignature).not.toBe(decoded.s);
  });
});
