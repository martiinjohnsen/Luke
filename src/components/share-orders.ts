"use client";
import { useEffect, useRef, useState } from "react";
import { billingRequest } from "@/lib/billing-client";
import type { ShareOrder } from "@/lib/billing";
import { authMessage } from "@/lib/cloud/client";
import { useAccount } from "./account-provider";
type Orders = { configured: boolean; orders: ShareOrder[] };
export function useShareOrders(calendarId: string, enabled: boolean) {
  const { user } = useAccount();
  const identity = `${user?.id ?? ""}:${calendarId}`;
  const [state, setState] = useState<{ identity: string; data?: Orders; error: string }>({ identity, error: "" });
  const refresh = useRef<() => Promise<ShareOrder[]>>(async () => []);
  useEffect(() => {
    if (!user || !enabled) return;
    let alive = true, generation = 0;
    const load = async () => {
      const current = ++generation;
      try {
        const data = await billingRequest<Orders>(user.id, `orders?calendarId=${encodeURIComponent(calendarId)}`);
        if (alive && current === generation) setState({ identity, data, error: "" });
        return data.orders;
      } catch (error) {
        if (alive && current === generation) setState(previous => ({ ...(previous.identity === identity ? previous : { identity }), error: authMessage(error) }));
        throw error;
      }
    };
    refresh.current = load;
    const resume = () => { if (document.visibilityState === "visible") void load().catch(() => {}); };
    resume();
    const timer = setInterval(resume, 15000);
    window.addEventListener("focus", resume); window.addEventListener("online", resume); document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false; clearInterval(timer); refresh.current = async () => [];
      window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume);
    };
  }, [identity, enabled]);
  return { ...(state.identity === identity ? state : { data: undefined, error: "" }), refresh: () => refresh.current() };
}
export type ShareOrdersSource = ReturnType<typeof useShareOrders>;
