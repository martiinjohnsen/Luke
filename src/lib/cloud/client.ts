"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicCloudConfig } from "./public-config";
import { renewedSession } from "./session";
let client: SupabaseClient | null = null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || publicCloudConfig.url;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  publicCloudConfig.publishableKey;
export const cloudConfigured = Boolean(url && publishableKey);
export function supabase(): SupabaseClient {
  if (!cloudConfigured)
    throw new Error("Kontotjenesten er ikke koblet til ennå.");
  return (client ??= createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  }));
}
export async function rpcForUser(
  userId: string | null,
  name: string,
  args?: Record<string, unknown>,
) {
  const scoped = await clientForUser(userId);
  return scoped.rpc(name, args);
}
export async function clientForUser(userId: string | null, renew = false): Promise<SupabaseClient> {
  const { data, error } = renew
    ? { data: { session: await renewedSession(userId, supabase().auth) }, error: null }
    : await supabase().auth.getSession();
  if (error) throw error;
  if (!userId || !data.session || data.session.user.id !== userId)
    throw new Error("Innloggingen har endret seg. Åpne siden på nytt.");
  // Bind the request to this user's token, even if another tab changes the
  // active account while a queued save is waiting for its network request.
  const token = data.session.access_token;
  return createClient(url, publishableKey, {
    accessToken: async () => token,
  });
}
export function authMessage(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/invalid login credentials|email not confirmed|email.*invalid/i.test(raw))
    return "Logg inn med Google for å bruke kontoen din.";
  if (/signup.*disabled|signups.*disabled/i.test(raw))
    return "Registrering av nye kontoer er ikke åpnet ennå.";
  if (/otp.*expired|token.*expired|invalid.*token|link.*expired/i.test(raw))
    return "Innloggingen eller lenken er utløpt. Logg inn på nytt, eller be avsenderen om en ny invitasjon.";
  if (/email.*not authorized|smtp|error sending/i.test(raw))
    return "Bruk Fortsett med Google for å logge inn. Du trenger ikke en bekreftelsesepost fra Luke.";
  if (/rate limit|too many|security purposes/i.test(raw))
    return "Litt mange forsøk på kort tid. Vent noen minutter og prøv igjen.";
  if (/fetch|network|offline|timeout/i.test(raw))
    return "Vi får ikke kontakt akkurat nå. Sjekk nettforbindelsen og prøv igjen.";
  if (/40001|annen enhet|Utkastet/i.test(raw))
    return "Kalenderen er endret på en annen enhet. Utkastet ditt er beholdt. Ta en sikkerhetskopi før du henter skyversjonen.";
  return raw || "Noe gikk galt. Prøv igjen.";
}
