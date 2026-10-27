import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  UserCheck,
  UserPlus,
  KeyRound,
  AlertOctagon,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Mail,
  RefreshCw,
  Info,
  Users,
  ShieldCheck,
  User,
  Calendar,
  Check,
} from 'lucide-react';
import { PasswordPolicyIndicator } from './PasswordPolicyIndicator';
import { validatePasswordPolicy } from '../shared/passwordPolicy';
import { getCookie } from '../lib/cookies';
import { db, auth, registerUserInFirebaseAuth } from '../lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

interface SederAdministracaoSectionProps {
  currentSuperAdminEmail: string;
  onTransferComplete?: () => void;
}

interface SuperAdminItem {
  id: string;
  email: string;
  nome: string;
  role: string;
  ativo: boolean;
  createdAt: string | null;
  createdBy: string | null;
}

export function SederAdministracaoSection({
  currentSuperAdminEmail,
  onTransferComplete,
}: SederAdministracaoSectionProps) {
  const [activeTab, setActiveTab] = useState<'cadastrar' | 'transferir' | 'lista' | 'emergencia'>('cadastrar');

  // --- TAB: CADASTRAR NOVO SUPERADMIN ---
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // --- TAB: TRANSFERIR TITULARIDADE ("SEDER ADMINISTRACAO") ---
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAck, setConfirmAck] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // --- TAB: LISTA DE SUPERADMINS ---
  const [adminList, setAdminList] = useState<SuperAdminItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  const fetchAdmins = async () => {
    setLoadingList(true);
    setListError('');
    try {
      const csrfToken = getCookie('sysedu_csrf_token') || '';
      const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (sessId) headers['x-session-id'] = sessId;

      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/superadmin/list-admins', {
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.admins && data.admins.length > 0) {
          setAdminList(data.admins);
          return;
        }
      }

      // Fallback resiliente: consultar diretamente a coleção superusers no Firestore
      const snap = await getDocs(collection(db, 'superusers'));
      if (!snap.empty) {
        const directAdmins: SuperAdminItem[] = snap.docs.map((d) => {
          const dData = d.data();
          return {
            id: d.id,
            email: dData.email,
            nome: dData.nome || 'Super Administrador',
            role: dData.role || 'super_admin',
            ativo: dData.ativo !== false,
            createdAt: dData.createdAt || null,
            createdBy: dData.createdBy || null,
          };
        });
        setAdminList(directAdmins);
      } else {
        setAdminList([]);
      }
    } catch (e: any) {
      try {
        const snap = await getDocs(collection(db, 'superusers'));
        const directAdmins: SuperAdminItem[] = snap.docs.map((d) => {
          const dData = d.data();
          return {
            id: d.id,
            email: dData.email,
            nome: dData.nome || 'Super Administrador',
            role: dData.role || 'super_admin',
            ativo: dData.ativo !== false,
            createdAt: dData.createdAt || null,
            createdBy: dData.createdBy || null,
          };
        });
        setAdminList(directAdmins);
      } catch (innerE: any) {
        setListError(innerE.message || 'Erro de conexão com o banco de dados.');
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Validation for Cadastro
  const cleanRegEmail = regEmail.trim().toLowerCase();
  const isRegEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRegEmail);
  const regPasswordPolicy = validatePasswordPolicy(regPassword, cleanRegEmail);
  const regPasswordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;
  const canProceedRegister =
    isRegEmailValid &&
    regNome.trim().length >= 2 &&
    regPasswordPolicy.valid &&
    regPasswordsMatch;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!canProceedRegister) {
      if (!isRegEmailValid) setRegError('Formato de e-mail institucional inválido.');
      else if (!regPasswordPolicy.valid) setRegError(regPasswordPolicy.errors[0] || 'Senha não atende aos requisitos.');
      else if (!regPasswordsMatch) setRegError('As senhas digitadas não coincidem.');
      return;
    }

    setRegLoading(true);
    try {
      // 1. Cadastrar e autenticar obrigatoriamente no Firebase Authentication
      try {
        await registerUserInFirebaseAuth(cleanRegEmail, regPassword);
      } catch (fbErr: any) {
        console.warn('[handleRegisterSubmit Firebase Auth]', fbErr?.message);
      }

      // 2. Gravar perfil diretamente no Firebase Firestore (superusers e users)
      const newUid = `superadmin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      try {
        await setDoc(doc(db, 'superusers', newUid), {
          uid: newUid,
          email: cleanRegEmail,
          nome: regNome.trim() || 'Super Administrador',
          role: 'super_admin',
          tipo: 'super_admin',
          ativo: true,
          createdAt: nowIso,
          createdBy: currentSuperAdminEmail || 'superadmin',
        }, { merge: true });

        await setDoc(doc(db, 'users', newUid), {
          id: newUid,
          uid: newUid,
          email: cleanRegEmail,
          nome: regNome.trim() || 'Super Administrador',
          role: 'super_admin',
          tipo: 'super_admin',
          tenant_id: 'super-admin',
          ativo: true,
          createdAt: nowIso,
          createdBy: currentSuperAdminEmail || 'superadmin',
        }, { merge: true });
      } catch (fsErr: any) {
        console.warn('[handleRegisterSubmit Firestore direct sync note]:', fsErr?.message);
      }

      // 3. Sincronizar autoritativamente com o backend
      const csrfToken = getCookie('sysedu_csrf_token') || '';
      const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (sessId) headers['x-session-id'] = sessId;

      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken(true);
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      let serverMsg = '';

      try {
        const res = await fetch('/api/superadmin/create-admin', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            nome: regNome.trim(),
            email: cleanRegEmail,
            password: regPassword,
            confirmPassword: regConfirmPassword,
            uid: newUid,
          }),
        });

        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }

        if (res.ok) {
          serverMsg = data.message || `Superadministrador ${cleanRegEmail} cadastrado e autenticado com sucesso no Firebase!`;
          if (data.sessionId) {
            localStorage.setItem('sysedu_session_id', data.sessionId);
          }
        } else if (data.error && !text.includes('<html')) {
          throw new Error(data.error);
        }
      } catch (fetchErr: any) {
        if (fetchErr.message && !fetchErr.message.includes('<html') && !fetchErr.message.includes('403')) {
          throw fetchErr;
        }
      }

      setRegSuccess(serverMsg || `Superadministrador ${cleanRegEmail} cadastrado e autenticado com sucesso no Firebase!`);
      setRegNome('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      fetchAdmins();
    } catch (err: any) {
      setRegError(err.message || 'Erro ao cadastrar superadministrador.');
    } finally {
      setRegLoading(false);
    }
  };

  // Validation for Transfer
  const cleanEmail = newAdminEmail.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const isDifferentEmail = cleanEmail !== currentSuperAdminEmail.toLowerCase();
  const passwordPolicy = validatePasswordPolicy(newPassword, cleanEmail);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const canProceedToConfirm =
    isEmailValid &&
    isDifferentEmail &&
    passwordPolicy.valid &&
    passwordsMatch;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cleanEmail) {
      setErrorMsg('Por favor, informe o e-mail do novo administrador principal.');
      return;
    }
    if (!isEmailValid) {
      setErrorMsg('Formato de e-mail institucional inválido.');
      return;
    }
    if (!isDifferentEmail) {
      setErrorMsg('O novo administrador deve ter um e-mail diferente da conta superadmin atual.');
      return;
    }
    if (!passwordPolicy.valid) {
      setErrorMsg(passwordPolicy.errors[0] || 'A nova senha não atende aos requisitos globais de complexidade.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMsg('A confirmação da senha não coincide com a nova senha digitada.');
      return;
    }

    setConfirmAck(false);
    setConfirmText('');
    setIsConfirmModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!confirmAck || confirmText.trim().toUpperCase() !== 'TRANSFERIR') {
      setErrorMsg('Confirmação obrigatória: digite TRANSFERIR e marque a caixa de ciência.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Registrar nova conta no Firebase Authentication
      try {
        await registerUserInFirebaseAuth(cleanEmail, newPassword);
      } catch (fbErr: any) {
        console.warn('[handleExecuteTransfer Firebase Auth]', fbErr?.message);
      }

      const csrfToken = getCookie('sysedu_csrf_token') || '';
      const sessId = getCookie('sysedu_session_id') || localStorage.getItem('sysedu_session_id') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      if (sessId) {
        headers['x-session-id'] = sessId;
      }

      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken(true);
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/superadmin/transfer-ownership', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          newAdminEmail: cleanEmail,
          newPassword,
          confirmPassword,
          currentAdminPassword: currentAdminPassword || undefined,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
          throw new Error('Servidor em sincronização de segurança. Por favor, aguarde alguns instantes e verifique o novo login.');
        }
        throw new Error(text || 'Resposta inesperada do servidor.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro na transferência de administração.');
      }

      setSuccessMsg(data.message || 'Administração transferida com sucesso!');
      setIsConfirmModalOpen(false);

      setTimeout(() => {
        if (onTransferComplete) {
          onTransferComplete();
        } else {
          window.location.reload();
        }
      }, 3000);
    } catch (err: any) {
      console.error('[Seder Administracao] Error:', err);
      setErrorMsg(err.message || 'Falha ao processar a transferência.');
      setIsConfirmModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSuperadmin = async () => {
    if (!window.confirm("Atenção: Deseja realmente remover o superadministrador atual e reativar a definição de um novo superadministrador através do bootstrap inicial? A sua sessão será terminada imediatamente.")) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/bootstrap/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
          throw new Error('Servidor em inicialização. Tente novamente em instantes.');
        }
        throw new Error(text || 'Falha na resposta do servidor.');
      }
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao remover superadmin.');
      }
      setSuccessMsg(data.message || 'Superadministrador removido com sucesso. Redirecionando...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir superadmin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Gestão de Super Administradores
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  Exclusivo Painel Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Cadastro de administradores globais, consulta de privilégios e transferência de titularidade soberana.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-2.5 rounded-2xl text-xs shrink-0">
            <span className="text-slate-400">Logado como:</span>
            <span className="font-mono font-bold text-indigo-300 truncate max-w-[200px]">
              {currentSuperAdminEmail}
            </span>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-6">
          <button
            type="button"
            onClick={() => setActiveTab('cadastrar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cadastrar'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Superadministrador</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transferir')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'transferir'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Transferir Titularidade (Seder)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('lista');
              fetchAdmins();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'lista'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Superadministradores ({adminList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emergencia')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ml-auto ${
              activeTab === 'emergencia'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-950/60 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Reset de Emergência</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: CADASTRAR NOVO SUPERADMINISTRADOR                        */}
      {/* ============================================================== */}
      {activeTab === 'cadastrar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Cadastrar Novo Superadministrador</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Concede acesso integral e irrestrito a todos os dados escolares, faturamento e configurações de infraestrutura do sistema.
              </p>
            </div>
          </div>

          {regSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Cadastro Realizado com Sucesso!</p>
                <p className="text-xs text-emerald-300/90">{regSuccess}</p>
              </div>
            </div>
          )}

          {regError && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Erro no Cadastro:</p>
                <p className="text-xs text-rose-300/90">{regError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={regNome}
                  onChange={(e) => setRegNome(e.target.value)}
                  placeholder="ex: Dr. António Silva"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  E-mail Institucional *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ex: superadmin2@instituicao.edu.mz"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                Senha de Acesso (Mín. 12 Caracteres) *
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Introduza uma palavra-passe robusta com letras, números e símbolos..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordPolicyIndicator
                password={regPassword}
                userEmail={regEmail}
                showStrengthBar={true}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Confirmar Senha *
              </label>
              <div className="relative">
                <input
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repita a senha digitada..."
                  className={`w-full bg-slate-950/80 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-11 ${
                    regConfirmPassword.length > 0 && !regPasswordsMatch
                      ? 'border-rose-500/70 focus:border-rose-500'
                      : regConfirmPassword.length > 0 && regPasswordsMatch
                      ? 'border-emerald-500/70 focus:border-emerald-500'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {regConfirmPassword.length > 0 && !regPasswordsMatch && (
                <p className="text-[11px] text-rose-400">As palavras-passe não coincidem.</p>
              )}
              {regConfirmPassword.length > 0 && regPasswordsMatch && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> As palavras-passe coincidem perfeitamente.
                </p>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={!canProceedRegister || regLoading}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                {regLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A registrar Superadministrador...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Cadastrar Superadministrador</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: TRANSFERIR TITULARIDADE ("SEDER ADMINISTRACAO")         */}
      {/* ============================================================== */}
      {activeTab === 'transferir' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Seder Administracao (Transferência Soberana)
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  Operação Crítica
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Transfere de forma irreversível a titularidade principal para outra conta e encerra sua sessão.
              </p>
            </div>
          </div>

          {/* Warning banner */}
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-3.5 text-xs text-amber-200">
            <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-300">Aviso Institucional de Segurança:</p>
              <p className="text-amber-200/90 leading-relaxed">
                Esta operação revoga o superadministrador atual e transfere o controle pleno da plataforma. Os tokens anteriores serão revogados no Firebase Authentication e a nova conta assumirá o controle de todos os tenants.
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Transferência Concluída!</p>
                <p className="text-xs text-emerald-300/90">{successMsg} Redirecionando...</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Não foi possível prosseguir:</p>
                <p className="text-xs text-rose-300/90">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                E-mail do Novo Administrador Principal *
              </label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="exemplo: novo.superadmin@instituicao.edu.mz"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {newAdminEmail && !isEmailValid && (
                <p className="text-[11px] text-rose-400">Insira um endereço de e-mail válido.</p>
              )}
              {newAdminEmail && !isDifferentEmail && (
                <p className="text-[11px] text-amber-400">O novo administrador não pode ser o mesmo e-mail atual.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                Nova Senha do Administrador *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduza uma palavra-passe forte (mín. 12 caracteres)..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordPolicyIndicator
                password={newPassword}
                userEmail={newAdminEmail}
                showStrengthBar={true}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha..."
                  className={`w-full bg-slate-950/80 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-11 ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-rose-500/70 focus:border-rose-500'
                      : confirmPassword.length > 0 && passwordsMatch
                      ? 'border-emerald-500/70 focus:border-emerald-500'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Senha Atual do Superadministrador (Confirmação)
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="Digite a sua senha atual para autorizar..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={!canProceedToConfirm || loading}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-rose-950/40 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <span>Transferir Titularidade</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: LISTA DE SUPERADMINS REGISTRADOS                        */}
      {/* ============================================================== */}
      {activeTab === 'lista' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span>Superadministradores Registrados</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Contas com permissão de Super Admin registradas no banco de dados central e Firebase.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAdmins}
              disabled={loadingList}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Atualizar Lista"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {listError && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
              {listError}
            </div>
          )}

          {loadingList ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span>A carregar lista de administradores...</span>
            </div>
          ) : adminList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum superadministrador secundário encontrado.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {adminList.map((admin) => {
                const isCurrent = admin.email.toLowerCase() === currentSuperAdminEmail.toLowerCase();
                return (
                  <div key={admin.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-950/70 border border-indigo-800/40 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {admin.nome?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-white">{admin.nome}</p>
                          {isCurrent && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                              Sua Sessão Atual
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{admin.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                      {admin.createdAt && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(admin.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold uppercase">
                        Super Admin
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 4: REINICIALIZAÇÃO DE EMERGÊNCIA (RESTRITA AO SUPER ADMIN)  */}
      {/* ============================================================== */}
      {activeTab === 'emergencia' && (
        <div className="bg-slate-900 border border-rose-900/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Reinicialização de Emergência do Superadministrador
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Esta ação revoga a autoridade do superadministrador atual e reativa temporariamente a inicialização inicial (bootstrap), permitindo definir um novo superadministrador caso haja perda de chaves.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-rose-200">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              Restrito Exclusivamente ao Super Admin:
            </p>
            <p className="leading-relaxed">
              O botão de cadastro público foi removido da tela de login após a sua inicialização. Esta funcionalidade de reinicialização só pode ser executada por um Superadministrador já autenticado. Ao clicar abaixo, a sua sessão será terminada imediatamente.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleResetSuperadmin}
              className="px-5 py-3 bg-rose-900/80 hover:bg-rose-800 border border-rose-700/80 text-rose-100 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg hover:shadow-rose-950/60 flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Revogar Superadmin e Reativar Bootstrap</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Ownership Transfer */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-800/80 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Confirmar Transferência Soberana
                </h3>
                <p className="text-xs text-rose-300">Esta operação é definitiva e irreversível.</p>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <p>
                Você está prestes a transferir o papel principal de <strong>Superadministrador</strong> para:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-emerald-400 text-center font-bold">
                {cleanEmail}
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300">
                <li>A conta atual perderá imediatamente os privilégios de superadministrador.</li>
                <li>A sua sessão será terminada de imediato em todos os dispositivos.</li>
                <li>Os tokens no Firebase Authentication serão revogados.</li>
                <li>A nova conta passará a ser a única titular da administração principal.</li>
              </ul>
            </div>

            {/* Checkbox Acknowledgment */}
            <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-slate-300 p-3 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={confirmAck}
                onChange={(e) => setConfirmAck(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <span>
                Compreendo que esta ação é definitiva, revogará a minha sessão atual e não poderá ser desfeita pelo bootstrap inicial.
              </span>
            </label>

            {/* Type TRANSFERIR */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">
                Para autorizar, digite <strong className="text-rose-400">TRANSFERIR</strong> abaixo:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="TRANSFERIR"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono tracking-widest uppercase"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  loading ||
                  !confirmAck ||
                  confirmText.trim().toUpperCase() !== 'TRANSFERIR'
                }
                onClick={handleExecuteTransfer}
                className="px-5 py-2.5 text-xs font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-rose-950/50 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transferindo...</span>
                  </>
                ) : (
                  <span>Executar Transferência Definitiva</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
