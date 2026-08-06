import { loadStripe, Stripe } from "@stripe/stripe-js";

// Stripe Publishable Key from environment or default fallback key
export const STRIPE_PUBLISHABLE_KEY = 
  ((import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY) || 
  "pk_test_51U078S8T9we2UIJzzEHLDyWkhlkhMoruT9SLucd6KoIMvZ7tNtl1ZCzXHPN3d4dbYg6L7AwuHibOXhovOghSXuE000GJS7EBlD";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripeClient = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

export interface CreateCheckoutSessionParams {
  userId?: string;
  userEmail: string;
  userName?: string;
  planId: string;
  schoolId?: string;
  stripePriceId?: string;
  mode?: "subscription" | "payment";
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
}

/**
  * Requests the backend to create a Stripe Checkout Session and redirects the browser.
  */
export async function redirectToStripeCheckout(params: CreateCheckoutSessionParams): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Falha ao iniciar sessão do Stripe Checkout");
    }

    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }

    // Direct Stripe JS Redirect fallback if URL is not directly present
    const stripe: any = await getStripeClient();
    if (stripe && data.sessionId && typeof stripe.redirectToCheckout === "function") {
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) {
        throw new Error(error.message);
      }
      return { success: true };
    }

    throw new Error("Não foi possível redirecionar para a página do Stripe.");
  } catch (error: any) {
    console.error("[Stripe Client Error]", error);
    return { success: false, error: error.message || "Erro de conexão ao processar Stripe" };
  }
}

/**
  * Opens the Stripe Customer Portal for managing/canceling existing subscriptions.
  */
export async function openStripeCustomerPortal(customerId: string, returnUrl?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stripe/create-portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, returnUrl: returnUrl || window.location.href }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Falha ao abrir portal de cobrança Stripe");
    }

    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }

    throw new Error("URL do portal não retornada");
  } catch (error: any) {
    console.error("[Stripe Portal Error]", error);
    return { success: false, error: error.message || "Erro ao redirecionar para o portal de cobrança" };
  }
}

/**
  * Cancel a subscription directly via server API
  */
export async function cancelStripeSubscription(subscriptionId: string, immediately: boolean = false): Promise<{ success: boolean; error?: string; status?: string }> {
  try {
    const response = await fetch("/api/stripe/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, immediately }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Falha ao cancelar assinatura");
    }

    return { success: true, status: data.status };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
  * Refund a charge or payment intent
  */
export async function refundStripeCharge(paymentIntentId: string, amount?: number): Promise<{ success: boolean; error?: string; refundId?: string }> {
  try {
    const response = await fetch("/api/stripe/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId, amount }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Falha ao efetuar reembolso");
    }

    return { success: true, refundId: data.refundId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
  * Synchronize Stripe Products & Prices
  */
export async function syncStripePlans(): Promise<{ success: boolean; syncedPlans?: any[]; error?: string }> {
  try {
    const response = await fetch("/api/stripe/sync-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Falha ao sincronizar planos com o Stripe");
    }

    return { success: true, syncedPlans: data.syncedPlans };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
