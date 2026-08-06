import React, { useState } from "react";
import { Check, Zap, ShieldCheck, CreditCard, ExternalLink, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { redirectToStripeCheckout, openStripeCustomerPortal } from "../lib/stripe-client";

export interface PlanItem {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  periodicidade: string;
  moeda?: string;
  recursos: string[];
  recomendado?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
}

export interface StripePricingCardsProps {
  plans: PlanItem[];
  currentPlanId?: string;
  subscriptionStatus?: "active" | "past_due" | "canceled" | "trialing" | string;
  stripeCustomerId?: string;
  userEmail: string;
  userName?: string;
  userId?: string;
  schoolId?: string;
  onNotification?: (msg: string, type: "sucesso" | "erro" | "info") => void;
}

export function StripePricingCards({
  plans,
  currentPlanId = "plano-basico",
  subscriptionStatus = "active",
  stripeCustomerId,
  userEmail,
  userName,
  userId,
  schoolId,
  onNotification
}: StripePricingCardsProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Standard fallback plans if plans list is empty
  const defaultPlans: PlanItem[] = [
    {
      id: "plano-basico",
      nome: "Plano Básico",
      descricao: "Ideal para pequenas escolas e centros de formação inicial.",
      valor: 299,
      periodicidade: "mensal",
      recursos: [
        "Até 300 Alunos Ativos",
        "Gestão Acadêmica e Pauta de Notas",
        "Módulo de Tesouraria Integrado",
        "Acesso à Biblioteca Digital Básica",
        "Suporte por E-mail em horário laboral"
      ]
    },
    {
      id: "plano-pro",
      nome: "Plano Profissional",
      descricao: "A solução completa para instituições de médio porte em crescimento.",
      valor: 499,
      periodicidade: "mensal",
      recomendado: true,
      recursos: [
        "Até 1.000 Alunos Ativos",
        "Todas as funções do Plano Básico",
        "Portal de Alunos e Encarregados PWA",
        "Biblioteca Digital sem limites de download PDF",
        "Leitor IA de Documentos e Matrículas",
        "Relatórios Financeiros com Exportação Excel",
        "Suporte Prioritário 24/7"
      ]
    },
    {
      id: "plano-enterprise",
      nome: "Plano Empresarial",
      descricao: "Para redes de ensino e grandes colégios com requisitos dedicados.",
      valor: 899,
      periodicidade: "mensal",
      recursos: [
        "Alunos Ilimitados",
        "Multi-Campi e Multi-Instituição",
        "Acesso Total à Biblioteca Digital & IA",
        "Integração de Pagamento Personalizada (Stripe / M-Pesa)",
        "Backup Automatizado Diário em Nuvem",
        "Gerente de Conta Dedicado"
      ]
    }
  ];

  const displayPlans = plans && plans.length > 0 ? plans : defaultPlans;

  const handleSelectPlan = async (plan: PlanItem) => {
    setLoadingPlanId(plan.id);
    try {
      const result = await redirectToStripeCheckout({
        userId,
        userEmail,
        userName,
        planId: plan.id,
        schoolId,
        stripePriceId: plan.stripePriceId,
        mode: "subscription",
      });

      if (!result.success && result.error) {
        onNotification?.(`Erro no Stripe Checkout: ${result.error}`, "erro");
      }
    } catch (err: any) {
      onNotification?.(`Falha na conexão com Stripe: ${err.message}`, "erro");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleOpenPortal = async () => {
    if (!stripeCustomerId) {
      onNotification?.("A sua conta ainda não possui um ID de cliente Stripe associado.", "info");
      return;
    }

    setIsOpeningPortal(true);
    try {
      const res = await openStripeCustomerPortal(stripeCustomerId);
      if (!res.success) {
        onNotification?.(res.error || "Erro ao abrir portal do cliente", "erro");
      }
    } catch (err: any) {
      onNotification?.(err.message, "erro");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stripe Status Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Assinatura Stripe SaaS</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                subscriptionStatus === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                subscriptionStatus === "past_due" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" :
                "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}>
                {subscriptionStatus === "active" ? "Ativa" : subscriptionStatus === "past_due" ? "Pagamento Pendente" : "Cancelada"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stripeCustomerId ? `Cliente Stripe ID: ${stripeCustomerId}` : "Pagamentos seguros processados com criptografia bancária via Stripe."}
            </p>
          </div>
        </div>

        {stripeCustomerId && (
          <button
            onClick={handleOpenPortal}
            disabled={isOpeningPortal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md border border-indigo-400/30 shrink-0"
          >
            {isOpeningPortal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Gerenciar Assinatura no Portal Stripe
          </button>
        )}
      </div>

      {subscriptionStatus === "past_due" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-300">Atenção: A sua assinatura mensal possui pendência financeira.</strong>
            <p className="mt-0.5">Atualize os seus dados de pagamento ou regularize a fatura para manter o acesso aos módulos avançados da plataforma.</p>
          </div>
        </div>
      )}

      {/* Grid de Planos Stripe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayPlans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between ${
                plan.recomendado
                  ? "bg-slate-900 text-white border-2 border-indigo-500 shadow-2xl scale-[1.02] z-10"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-lg hover:border-slate-300"
              }`}
            >
              {plan.recomendado && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Mais Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-bold">{plan.nome}</h4>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Plano Atual
                    </span>
                  )}
                </div>

                <p className={`text-xs mt-1 min-h-[36px] ${plan.recomendado ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                  {plan.descricao}
                </p>

                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight">R$ {plan.valor}</span>
                    <span className={`text-xs ${plan.recomendado ? "text-slate-400" : "text-slate-500"}`}>/mês</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Cobrança recorrente mensal via Stripe</span>
                </div>

                <div className="space-y-2.5 mb-6 pt-4 border-t border-slate-200/20">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">O que está incluído:</span>
                  {plan.recursos.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.recomendado ? "text-indigo-400" : "text-emerald-500"}`} />
                      <span className={plan.recomendado ? "text-slate-200" : "text-slate-600 dark:text-slate-300"}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan(plan)}
                disabled={loadingPlanId === plan.id}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  isCurrent
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    : plan.recomendado
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/20"
                    : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
                }`}
              >
                {loadingPlanId === plan.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Iniciando Stripe Checkout...
                  </>
                ) : isCurrent ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Manter/Renovar Assinatura
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    Assinar com Stripe
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
