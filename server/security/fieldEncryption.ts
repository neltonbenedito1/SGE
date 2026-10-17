/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Field-Level Encryption for Sensitive PII at Rest (AES-256-GCM)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.QR_SIGNING_SECRET || 'sysedu_pii_encryption_key_default_32byte_fallback!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a sensitive string field using AES-256-GCM.
 * Output format: "enc:gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptField(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `enc:gcm:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[fieldEncryption] Failed to encrypt field:', err);
    return plaintext;
  }
}

/**
 * Decrypts a field if it was encrypted with encryptField.
 * Returns original plaintext if not encrypted.
 */
export function decryptField(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith('enc:gcm:')) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) return ciphertext;

    const [, , ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[fieldEncryption] Failed to decrypt field (integrity check failure):', err);
    return '[DADO PROTEGIDO]';
  }
}
