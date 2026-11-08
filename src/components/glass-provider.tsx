"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authMessage, rpcForUser, supabase } from "@/lib/cloud/client";
import { DEFAULT_GLASS, GUEST_GLASS, glassLevel, glassStyle } from "@/lib/glass";
import { useAccount } from "./account-provider";
import { installGlassFeedback } from "@/lib/glass-motion";

type Glass = { level: number; ready: boolean; status: "loading" | "saving" | "saved" | "error"; error: string; setLevel: (value: number) => void; flush: () => void; retry: () => void };
const Context = createContext<Glass | null>(null);
export function useGlass() {
  const value = useContext(Context);
  if (!value) throw new Error("Knappinnstillingene er ikke tilgjengelige.");
  return value;
}
export function GlassProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const userId = user?.id ?? null;
  const identity = useRef(userId);
  identity.current = userId;
  const [state, setState] = useState<{ userId: string | null; level: number; ready: boolean; status: Glass["status"]; error: string }>({ userId: null, level: GUEST_GLASS, ready: false, status: "loading", error: "" });
  const desired = useRef<{ userId: string; level: number } | null>(null);
  const sequence = useRef(0);
  const schedule = useRef<() => void>(() => {});
  const flush = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});
  const level = state.userId === userId ? state.level : userId ? DEFAULT_GLASS : GUEST_GLASS;
  const levelRef=useRef(level);levelRef.current=level;
  useEffect(()=>installGlassFeedback(()=>levelRef.current),[]);
  useEffect(() => {
    for (const [key,value] of Object.entries(glassStyle(level))) document.documentElement.style.setProperty(key,value);
  }, [level]);
  useEffect(() => {
    desired.current = null;
    if (!userId) {
      setState({ userId: null, level: GUEST_GLASS, ready: false, status: "saved", error: "" });
      schedule.current = flush.current = retry.current = () => {};
      return;
    }
    let active = true;
    let writing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = async (value: number | null) => {
      const { data, error } = await rpcForUser(userId,"luke_glass",{ p_level: value });
      if (error) throw error;
      return glassLevel(data?.level);
    };
    const report = (error: unknown) => {
      if (!active || identity.current !== userId) return;
      setState(previous => ({ ...(previous.userId === userId ? previous : { userId, level: DEFAULT_GLASS, ready: false }), status: "error", error: authMessage(error) }));
    };
    const load = async () => {
      const before = sequence.current;
      try {
        const saved = await request(null);
        if (active && identity.current === userId && !desired.current && before === sequence.current)
          setState({ userId, level: saved, ready: true, status: "saved", error: "" });
      } catch (error) { report(error); }
    };
    const save = async () => {
      if (writing || !active) return;
      writing = true;
      try {
        while (active && desired.current?.userId === userId) {
          const pending = desired.current;
          await request(pending.level);
          if (!active || identity.current !== userId) return;
          if (desired.current === pending) {
            desired.current = null;
            setState(previous => ({ ...previous, status: "saved", error: "" }));
          }
        }
      } catch (error) { report(error); }
      finally { writing = false; }
    };
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (desired.current?.userId === userId) void save(); else void load();
    };
    schedule.current = () => { clearTimeout(timer); timer = setTimeout(() => void save(),450); };
    flush.current = () => { clearTimeout(timer); void save(); };
    retry.current = refresh;
    const channel = supabase().channel(`glass:${userId}`)
      .on("postgres_changes",{ event:"*",schema:"public",table:"luke_glass_settings",filter:`user_id=eq.${userId}` },refresh).subscribe();
    void load();
    window.addEventListener("focus",refresh);
    window.addEventListener("online",refresh);
    document.addEventListener("visibilitychange",refresh);
    const poll = setInterval(refresh,30000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus",refresh);
      window.removeEventListener("online",refresh);
      document.removeEventListener("visibilitychange",refresh);
      void supabase().removeChannel(channel);
    };
  }, [userId]);
  const setLevel = useCallback((value: number) => {
    if (!userId || identity.current !== userId) return;
    const next = glassLevel(value);
    sequence.current++;
    desired.current = { userId, level: next };
    setState({ userId, level: next, ready: true, status: "saving", error: "" });
    schedule.current();
  }, [userId]);
  return <Context.Provider value={{ level, ready: state.userId === userId && state.ready, status: state.userId === userId ? state.status : "loading", error: state.userId === userId ? state.error : "", setLevel, flush: () => flush.current(), retry: () => retry.current() }}>{children}</Context.Provider>;
}
