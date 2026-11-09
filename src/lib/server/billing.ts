import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { publicCloudConfig } from "../cloud/public-config";
import { BILLING_SCOPE, SHARE_PLANS, isLukeRefundIntent, paidCheckoutDetails, type ShareOrder } from "../billing";
import type { SharingKind } from "../personal-sharing";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL || publicCloudConfig.url;
const publicKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicCloudConfig.publishableKey;
export const billingConfigured = () => {
  const mode = process.env.STRIPE_SECRET_KEY?.match(/^sk_(test|live)_/)?.[1];
  return !!(mode && process.env.STRIPE_PUBLISHABLE_KEY?.startsWith(`pk_${mode}_`) && process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") && process.env.SUPABASE_SERVICE_ROLE_KEY);
};
export class BillingError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function stripe() {
  if (!billingConfigured()) throw new BillingError("Betaling er ikke tilgjengelig ennå. Prøv igjen senere.", 503);
  const key = process.env.STRIPE_SECRET_KEY!;
  if (!/^sk_(test|live)_/.test(key)) throw new BillingError("Betaling er ikke tilgjengelig akkurat nå.", 503);
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}
const liveMode = () => process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new BillingError("Betaling er ikke tilgjengelig ennå.", 503);
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function paymentUser(request: Request) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new BillingError("Forespørselen ble avvist.", 403);
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new BillingError("Logg inn før du deler kalenderen.", 401);
  const client = createClient(url(), publicKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new BillingError("Innloggingen er utløpt. Logg inn på nytt.", 401);
  const scoped = createClient(url(), publicKey(), { accessToken: async () => token });
  return { user: data.user, client: scoped };
}
export async function settleCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.scope !== BILLING_SCOPE) return false;
  const paid = paidCheckoutDetails(session, liveMode());
  if (!paid) return false;
  const { error } = await admin().rpc("complete_luke_share_order", {
    p_order_id: paid.orderId, p_session_id: paid.sessionId, p_owner_id: paid.ownerId, p_calendar_id: paid.calendarId,
    p_kind: paid.kind, p_amount: paid.amount, p_currency: paid.currency, p_livemode: paid.livemode, p_payment_intent: paid.paymentIntent,
  });
  if (error) throw new BillingError("Betalingen er mottatt, men kjøpet kunne ikke bekreftes ennå. Prøv igjen.", 503);
  return true;
}
export async function refundPayment(charge: Stripe.Charge) {
  if (!charge.payment_intent || charge.amount_refunded < charge.amount || charge.livemode !== liveMode()) return;
  const id = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
  const intent = await stripe().paymentIntents.retrieve(id);
  if (intent.id !== id || !isLukeRefundIntent(intent, liveMode())) return;
  const { error } = await admin().rpc("refund_luke_share_payment", { p_payment_intent: id });
  if (error) throw new BillingError("Refusjonen kunne ikke registreres.", 503);
}
export async function reconcileOrder(order: ShareOrder) {
  if (order.status !== "pending" || !order.sessionId || !billingConfigured()) return;
  const session = await stripe().checkout.sessions.retrieve(order.sessionId);
  if (session.metadata?.orderId !== order.id) throw new BillingError("Betalingsøkten tilhører et annet kjøp.", 409);
  if (await settleCheckout(session)) return;
  if (session.status === "expired") {
    const { error } = await admin().rpc("expire_luke_share_order", { p_order_id: order.id, p_session_id: session.id });
    if (error) throw new BillingError("Betalingen kunne ikke oppdateres.", 503);
  }
}
export async function checkoutForOrder(order: ShareOrder, kind: SharingKind) {
  const service = stripe();
  let session: Stripe.Checkout.Session;
  if (order.sessionId) {
    session = await service.checkout.sessions.retrieve(order.sessionId);
    if (session.metadata?.orderId !== order.id || session.metadata?.kind !== kind) throw new BillingError("Feil betalingsøkt.", 409);
    if (session.status !== "open") {
      await reconcileOrder(order);
      return null;
    }
  } else {
    const metadata = { scope: BILLING_SCOPE, orderId: order.id, calendarId: order.calendarId, kind };
    // The owner is obtained from the order by the service role, never the caller.
    const { data, error } = await admin().from("luke_share_orders").select("owner_id").eq("id", order.id).single();
    if (error || !data) throw new BillingError("Kjøpet kunne ikke åpnes.", 503);
    const identity = { ...metadata, ownerId: data.owner_id as string };
    const origin = new URL(process.env.LUKE_APP_URL || "https://luke-kalender.vercel.app").origin;
    session = await service.checkout.sessions.create({
      ui_mode: "embedded_page", mode: "payment", locale: "nb", redirect_on_completion: "if_required",
      return_url: `${origin}/calendar/${encodeURIComponent(order.calendarId)}?share=1&order=${order.id}`,
      line_items: [{ quantity: 1, price_data: { currency: "nok", unit_amount: SHARE_PLANS[kind].amount,
        product_data: { name: `Luke · ${SHARE_PLANS[kind].name}`, description: kind === "person" ? "Del én kalender med én mottaker. Engangsbetaling." : "Del én kalender med 2–50 mottakere. Engangsbetaling." } } }],
      metadata: identity, payment_intent_data: { metadata: identity },
    }, { idempotencyKey: `luke-share-${order.id}` });
    const { error: attachError } = await admin().rpc("attach_luke_share_checkout", { p_order_id: order.id, p_session_id: session.id, p_livemode: session.livemode });
    if (attachError) throw new BillingError("Betalingen kunne ikke klargjøres. Prøv igjen.", 503);
  }
  if (!session.client_secret) throw new BillingError("Betalingsskjemaet kunne ikke åpnes.", 503);
  return { order, clientSecret: session.client_secret, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY! };
}
export function billingFailure(error: unknown) {
  if (error instanceof BillingError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Betalingen kunne ikke kontrolleres akkurat nå. Prøv igjen." }, { status: 503 });
}
