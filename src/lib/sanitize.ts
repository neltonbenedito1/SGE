/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * XSS Sanitization Utilities using DOMPurify
 */

import DOMPurify from 'dompurify';

/**
 * Sanitizes an untrusted HTML string to prevent Cross-Site Scripting (XSS).
 * Strips malicious scripts, event handlers, javascript: URIs and dangerous tags.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'span', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'title'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

/**
 * Sanitizes plain text by escaping HTML entities.
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
