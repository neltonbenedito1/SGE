import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ArrowRight, Sparkles, RefreshCw } from "lucide-react";

export function StripeCheckoutStatus() {
  const [status, setStatus] = useState<"success" | "cancelled" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("stripe_checkout");
    const session = params.get("session_id");

    if (checkoutResult === "success") {
      setStatus("success");
      setSessionId(session);
    } else if (checkoutResult === "cancelled") {
      setStatus("cancelled");
    }
  }, []);

  const handleDismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe_checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, document.title, url.toString());
    setStatus(null);
  };

  if (!status) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center relative overflow-hidden">
        {status === "success" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Pagamento Processado via Stripe
            </span>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">Assinatura Ativada com Sucesso!</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              O seu pagamento foi validado no portal Stripe. A sua instituição e conta de utilizador já estão ativas com acesso completo aos módulos da plataforma.
            </p>

            {sessionId && (
              <p className="text-[10px] text-slate-400 font-mono mt-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                Sessão Stripe ID: {sessionId}
              </p>
            )}

            <button
              onClick={handleDismiss}
              className="mt-6 w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              Aceder à Plataforma <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto mb-4 shadow-md">
              <XCircle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">Checkout Cancelado</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              O processo de pagamento no Stripe foi interrompido antes da conclusão. Nenhuma cobrança foi efetuada no seu cartão.
            </p>

            <button
              onClick={handleDismiss}
              className="mt-6 w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs transition cursor-pointer"
            >
              Tentar Novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}
