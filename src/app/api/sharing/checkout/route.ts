import { billingFailure, BillingError, checkoutForOrder, paymentUser, stripe } from "@/lib/server/billing";
import { sharingKind, type ShareOrder } from "@/lib/billing";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { client } = await paymentUser(request);
    stripe();
    const body = await request.json();
    if (!sharingKind(body.kind) || typeof body.calendarId !== "string" || body.calendarId.length > 200) throw new BillingError("Velg en delingspakke.");
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await client.rpc("begin_luke_share_order", { p_calendar_id: body.calendarId, p_kind: body.kind });
      if (error) throw new BillingError("Kjøpet kunne ikke opprettes. Kontroller at kalenderen er lagret.", 403);
      const order = data as ShareOrder;
      if (order.status === "paid") return Response.json({ order }, { headers: { "Cache-Control": "no-store" } });
      const checkout = await checkoutForOrder(order, body.kind);
      if (checkout) return Response.json(checkout, { headers: { "Cache-Control": "no-store" } });
    }
    throw new BillingError("Betalingen er under behandling. Vent litt og prøv igjen.", 409);
  } catch (error) { return billingFailure(error); }
}
