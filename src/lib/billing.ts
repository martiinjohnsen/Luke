import type { SharingKind } from "./personal-sharing.ts";

export const SHARE_PLANS = {
  person: { name: "Enkeltperson", amount: 1900, price: "19 kr", detail: "En personlig kalender til én mottaker.", features: ["Én mottaker", "Egen fremdrift og quiz", "Del nå eller senere"] },
  group: { name: "Gruppe", amount: 2900, price: "29 kr", detail: "Den samme kalenderen til flere du vil glede.", features: ["2–50 mottakere", "Egen fremdrift for hver person", "Felles quiz og resultatliste"] },
} as const;
export const BILLING_SCOPE = "luke-sharing-v1";
export type ShareOrder = {
  id: string; calendarId: string; kind: SharingKind; amount: number;
  status: "pending" | "paid" | "expired" | "refunded";
  sessionId: string | null; emails: string[] | null; message: string; createdAt: string;
};
export const sharingKind = (value: unknown): value is SharingKind => value === "person" || value === "group";
export const orderId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** A Stripe account may receive refunds for products other than Luke sharing. */
export function isLukeRefundIntent(intent: { metadata: Record<string, string>; livemode: boolean }, live: boolean) {
  return intent.livemode === live && intent.metadata.scope === BILLING_SCOPE;
}

type Checkout = {
  id: string; status: string | null; payment_status: string; mode: string | null;
  currency: string | null; amount_total: number | null; livemode: boolean;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string } | null;
};
/** Never unlock from a browser callback or an unpaid/incorrect Stripe session. */
export function paidCheckoutDetails(session: Checkout, live: boolean) {
  if (session.payment_status !== "paid") return null;
  const m = session.metadata;
  if (session.status !== "complete" || session.mode !== "payment" || session.currency !== "nok" || session.livemode !== live ||
      !m || m.scope !== BILLING_SCOPE || !orderId(m.orderId) || !orderId(m.ownerId) || !m.calendarId ||
      !sharingKind(m.kind) || session.amount_total !== SHARE_PLANS[m.kind].amount || !session.payment_intent) {
    throw new Error("Betalingen stemmer ikke med delingskjøpet.");
  }
  return {
    orderId: m.orderId, ownerId: m.ownerId, calendarId: m.calendarId, kind: m.kind,
    amount: session.amount_total, currency: session.currency, livemode: session.livemode, sessionId: session.id,
    paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
  };
}
