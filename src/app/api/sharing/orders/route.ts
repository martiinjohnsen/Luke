import { billingConfigured, billingFailure, BillingError, paymentUser, reconcileOrder } from "@/lib/server/billing";
import type { ShareOrder } from "@/lib/billing";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { client } = await paymentUser(request);
    const calendarId = new URL(request.url).searchParams.get("calendarId");
    if (!calendarId || calendarId.length > 200) throw new BillingError("Kalenderen mangler.");
    const load = () => client.rpc("get_luke_share_orders", { p_calendar_id: calendarId });
    let result = await load();
    if (result.error) {
      if (result.error.code === "PGRST202") return Response.json({ configured: false, orders: [] }, { headers: { "Cache-Control": "no-store" } });
      throw new BillingError("Delingskjøpene kunne ikke hentes.", 403);
    }
    const pending = (result.data as ShareOrder[]).filter(o => o.status === "pending" && o.sessionId);
    if (billingConfigured() && pending.length) {
      await Promise.all(pending.slice(0, 2).map(reconcileOrder));
      result = await load();
      if (result.error) throw new BillingError("Kjøpene kunne ikke oppdateres.", 503);
    }
    return Response.json({ configured: billingConfigured(), orders: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return billingFailure(error); }
}
