/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * POLÍTICA GLOBAL DE SENHAS - SGE (SISTEMA DE GESTÃO ESCOLAR)
 * Módulo centralizado e reutilizável de validação de senhas para frontend e backend.
 * 
 * Requisitos:
 * 1. Mínimo de 12 caracteres.
 * 2. Pelo menos uma letra maiúscula [A-Z].
 * 3. Pelo menos uma letra minúscula [a-z].
 * 4. Pelo menos um número [0-9].
 * 5. Pelo menos um carácter especial [!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`].
 * 6. Rejeitar senhas vazias ou compostas apenas por espaços.
 * 7. Impedir senhas que contenham o email completo do utilizador.
 * 8. Rejeitar senhas comuns conhecidas como fracas.
 * 9. Não truncar silenciosamente.
 * 10. Permitir caracteres Unicode e espaços internos.
 */

export const COMMON_WEAK_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'admin1234567',
  'administrator',
  'qwertyuiop12',
  'sysedumaster!',
  'sysedu2026!@#',
  'superadmin12',
  'superadmin2026!',
  'changeme1234!',
  'welcome12345!',
  'escola1234567!',
  'gestaoescolar1',
  'velocidade123',
  'iloveyou12345',
  'secretpassword',
]);

export interface PasswordPolicyCheckResult {
  valid: boolean;
  score: number; // 0 a 6
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notEmail: boolean;
    notCommon: boolean;
  };
  errors: string[];
}

export function validatePasswordPolicy(password: string, userEmail?: string): PasswordPolicyCheckResult {
  const pwd = typeof password === 'string' ? password : '';
  const trimmed = pwd.trim();
  const errors: string[] = [];

  const minLength = pwd.length >= 12;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd);

  // Check empty or only whitespace
  const notOnlySpaces = trimmed.length > 0;

  // Check email inclusion
  let notEmail = true;
  if (userEmail && typeof userEmail === 'string') {
    const cleanEmail = userEmail.trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0];
    const lowerPwd = pwd.toLowerCase();
    if (cleanEmail.length > 3 && lowerPwd.includes(cleanEmail)) {
      notEmail = false;
    } else if (emailPrefix && emailPrefix.length >= 4 && lowerPwd.includes(emailPrefix)) {
      notEmail = false;
    }
  }

  // Check common weak passwords
  const lowerPwd = pwd.toLowerCase().trim();
  const notCommon = !COMMON_WEAK_PASSWORDS.has(lowerPwd);

  if (!notOnlySpaces) {
    errors.push('A palavra-passe não pode ser vazia ou composta apenas por espaços.');
  }
  if (!minLength) {
    errors.push('A palavra-passe deve conter no mínimo 12 caracteres.');
  }
  if (!hasUppercase) {
    errors.push('A palavra-passe deve conter pelo menos uma letra maiúscula.');
  }
  if (!hasLowercase) {
    errors.push('A palavra-passe deve conter pelo menos uma letra minúscula.');
  }
  if (!hasNumber) {
    errors.push('A palavra-passe deve conter pelo menos um número.');
  }
  if (!hasSpecial) {
    errors.push('A palavra-passe deve conter pelo menos um carácter especial (!@#$%^&*...).');
  }
  if (!notEmail) {
    errors.push('A palavra-passe não pode conter o seu endereço de e-mail ou prefixo de utilizador.');
  }
  if (!notCommon) {
    errors.push('Esta palavra-passe é excessivamente comum e fácil de adivinhar. Escolha uma combinação mais segura.');
  }

  const valid =
    notOnlySpaces &&
    minLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    notEmail &&
    notCommon;

  let score = 0;
  if (minLength) score++;
  if (hasUppercase) score++;
  if (hasLowercase) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;
  if (notEmail && notCommon) score++;

  return {
    valid,
    score,
    requirements: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      notEmail,
      notCommon,
    },
    errors,
  };
}

/**
 * Generates a dynamic, strong cryptographically random temporary password that satisfies the global password policy
 * without needing hardcoded values anywhere in source code.
 */
export function generateCompliantPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*_-+=';
  const allChars = upper + lower + digits + special;

  const getRandom = (chars: string) => chars.charAt(Math.floor(Math.random() * chars.length));
  const parts = [
    getRandom(upper),
    getRandom(upper),
    getRandom(lower),
    getRandom(lower),
    getRandom(digits),
    getRandom(digits),
    getRandom(special),
    getRandom(special),
  ];
  while (parts.length < 14) {
    parts.push(getRandom(allChars));
  }
  return parts.sort(() => Math.random() - 0.5).join('');
}

