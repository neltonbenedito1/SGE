import React from 'react';
import { Check, X, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { validatePasswordPolicy, PasswordPolicyCheckResult } from '../shared/passwordPolicy';

interface PasswordPolicyIndicatorProps {
  password: string;
  userEmail?: string;
  showStrengthBar?: boolean;
}

export function PasswordPolicyIndicator({
  password,
  userEmail,
  showStrengthBar = true,
}: PasswordPolicyIndicatorProps) {
  const result: PasswordPolicyCheckResult = validatePasswordPolicy(password, userEmail);
  const reqs = result.requirements;

  // Strength score
  const score = result.score;
  const strengthLevels = [
    { label: 'Muito Fraca', color: 'bg-rose-500', text: 'text-rose-400' },
    { label: 'Fraca', color: 'bg-amber-500', text: 'text-amber-400' },
    { label: 'Média', color: 'bg-yellow-500', text: 'text-yellow-400' },
    { label: 'Boa', color: 'bg-blue-500', text: 'text-blue-400' },
    { label: 'Forte', color: 'bg-emerald-500', text: 'text-emerald-400' },
    { label: 'Excelente', color: 'bg-emerald-400', text: 'text-emerald-300' },
  ];

  const currentStrength = strengthLevels[Math.min(score, strengthLevels.length - 1)] || strengthLevels[0];

  const items = [
    { label: 'Mínimo de 12 caracteres', satisfied: reqs.minLength },
    { label: 'Pelo menos uma letra maiúscula (A-Z)', satisfied: reqs.hasUppercase },
    { label: 'Pelo menos uma letra minúscula (a-z)', satisfied: reqs.hasLowercase },
    { label: 'Pelo menos um número (0-9)', satisfied: reqs.hasNumber },
    { label: 'Pelo menos um caractere especial (!@#$%^&*)', satisfied: reqs.hasSpecial },
    { label: 'Não conter o endereço de e-mail', satisfied: reqs.notEmail },
    { label: 'Não ser uma senha fraca comum', satisfied: reqs.notCommon },
  ];

  return (
    <div className="space-y-3 pt-1">
      {showStrengthBar && password.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400 flex items-center gap-1.5">
              {score >= 5 ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Shield className="w-3.5 h-3.5 text-slate-400" />
              )}
              Força da Senha
            </span>
            <span className={currentStrength.text}>{currentStrength.label}</span>
          </div>
          <div className="grid grid-cols-6 gap-1 h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
            {[0, 1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-full rounded-full transition-all duration-300 ${
                  step <= score ? currentStrength.color : 'bg-slate-700/50'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors ${
              item.satisfied
                ? 'text-emerald-300 bg-emerald-950/20 border border-emerald-900/30'
                : 'text-slate-400 bg-slate-900/40 border border-slate-800/40'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                item.satisfied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {item.satisfied ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              )}
            </div>
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
