import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Check, X, ArrowRight, Lock } from 'lucide-react';
import { authSecurityService, validatePasswordComplexity, DEFAULT_PASSWORD_POLICY } from '../services/authSecurityService';

interface MandatoryPasswordResetModalProps {
  user: {
    id: string;
    email: string;
    nome?: string;
    role?: string;
    tipo?: string;
    tenant_id?: string;
  };
  onSuccess: () => void;
}

export function MandatoryPasswordResetModal({ user, onSuccess }: MandatoryPasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password rules validation states
  const hasMinLength = newPassword.length >= DEFAULT_PASSWORD_POLICY.minLength;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPolicySatisfied = hasMinLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      setErrorMsg(validation.reason || 'A senha não atende aos requisitos de segurança.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    setLoading(true);
    try {
      await authSecurityService.changePassword({
        targetUid: user.id,
        newPassword: newPassword,
        callerUid: user.id,
        callerRole: user.role || user.tipo || 'user',
        callerTenantId: user.tenant_id,
        email: user.email
      });

      onSuccess();
    } catch (err: any) {
      console.error('[MandatoryPasswordResetModal] Error:', err);
      setErrorMsg(err.message || 'Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 relative">
        {/* Header Badge */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              Ação de Segurança Obrigatória
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
              Definir Nova Senha de Acesso
            </h2>
          </div>
        </div>

        {/* Informative description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
          Olá, <strong className="text-white font-bold">{user.nome || user.email}</strong>. Por motivos de segurança ou definição administrativa, é obrigatório cadastrar uma nova senha pessoal forte antes de prosseguir para o sistema.
        </p>

        {errorMsg && (
          <div className="mb-5 bg-rose-950/50 border border-rose-800/80 text-rose-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Insira sua nova senha forte"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirmar Nova Senha
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              className={`w-full bg-slate-950 border ${
                confirmPassword && !passwordsMatch ? 'border-rose-500' : 'border-slate-700'
              } text-white rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                <X className="w-3.5 h-3.5" /> As senhas não coincidem.
              </p>
            )}
          </div>

          {/* Security Policy Checklist */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Requisitos de Segurança da Senha
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Mínimo de 8 caracteres</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {hasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Letra maiúscula (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {hasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Letra minúscula (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Número (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {hasSymbol ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Símbolo (!@#$%...)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                <span>Senhas idênticas</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isPolicySatisfied || !passwordsMatch}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Validando e Atualizando...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Salvar Senha e Acessar Sistema <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <span className="text-[11px] text-slate-500">
            A nova senha invalidará automaticamente sessões ativas em outros dispositivos.
          </span>
        </div>
      </div>
    </div>
  );
}
export default MandatoryPasswordResetModal;
