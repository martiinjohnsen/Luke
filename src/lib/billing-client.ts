"use client";
import { supabase } from "./cloud/client";
export async function billingRequest<T>(userId: string, path: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase().auth.getSession();
  if (error) throw error;
  if (!data.session || data.session.user.id !== userId) throw new Error("Innloggingen har endret seg. Åpne siden på nytt.");
  const response = await fetch(`/api/sharing/${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Betalingen kunne ikke kontrolleres. Prøv igjen.");
  return result as T;
}
