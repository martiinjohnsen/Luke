import { refundPayment, settleCheckout, stripe } from "@/lib/server/billing";
import type Stripe from "stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return new Response("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return new Response("Invalid signature", { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
      await settleCheckout(event.data.object);
    if (event.type === "charge.refunded") await refundPayment(event.data.object);
    return Response.json({ received: true });
  } catch { return new Response("Please retry delivery", { status: 500 }); }
}
