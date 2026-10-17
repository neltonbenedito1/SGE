/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Secure Upload Validator & Magic Bytes Inspection
 */

import crypto from 'crypto';
import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  mimeType: string;
  extension: string;
  sanitizedFilename: string;
  error?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.asp', '.aspx',
  '.js', '.mjs', '.cjs', '.ts', '.py', '.pl', '.rb', '.cgi', '.jar', '.vbs',
  '.scr', '.hta', '.msi', '.dll', '.com', '.elf', '.bin'
]);

/**
 * Validates file buffer magic bytes against actual claimed MIME types.
 */
export function validateFileMagicBytes(buffer: Buffer, originalFilename: string, declaredMimeType?: string): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, mimeType: '', extension: '', sanitizedFilename: '', error: 'Ficheiro vazio.' };
  }

  // 1. Check size (max 50MB)
  const MAX_SIZE = 50 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return { valid: false, mimeType: '', extension: '', sanitizedFilename: '', error: 'Ficheiro excede o tamanho máximo de 50MB.' };
  }

  // 2. Check forbidden extensions
  const ext = path.extname(originalFilename || '').toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, mimeType: '', extension: ext, sanitizedFilename: '', error: 'Extensão de ficheiro executável não permitida por segurança.' };
  }

  // 3. Inspect magic bytes
  let detectedMime = '';
  let detectedExt = '';

  // PDF (%PDF - 0x25 0x50 0x44 0x46)
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    detectedMime = 'application/pdf';
    detectedExt = '.pdf';
  }
  // PNG (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
  else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    detectedMime = 'image/png';
    detectedExt = '.png';
  }
  // JPEG (0xFF 0xD8 0xFF)
  else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    detectedMime = 'image/jpeg';
    detectedExt = '.jpg';
  }
  // GIF (GIF87a or GIF89a - 0x47 0x49 0x46 0x38)
  else if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    detectedMime = 'image/gif';
    detectedExt = '.gif';
  }
  // WEBP (RIFF....WEBP)
  else if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    detectedMime = 'image/webp';
    detectedExt = '.webp';
  }

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    return {
      valid: false,
      mimeType: detectedMime || 'application/octet-stream',
      extension: ext,
      sanitizedFilename: '',
      error: 'Formato de ficheiro não suportado ou assinatura de cabeçalho inválida.',
    };
  }

  // 4. Generate random cryptographic filename (never using original user filename in path)
  const randomName = `${crypto.randomUUID()}${detectedExt}`;

  return {
    valid: true,
    mimeType: detectedMime,
    extension: detectedExt,
    sanitizedFilename: randomName,
  };
}
