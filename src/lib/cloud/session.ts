type Session = { user: { id: string }; access_token: string };
type SessionResult = { data: { session: Session | null }; error: unknown };
type Auth = { getSession: () => Promise<SessionResult>; refreshSession: () => Promise<SessionResult> };

/** Refresh an existing login without ever accepting a different account's token. */
export async function renewedSession(userId: string | null, auth: Auth): Promise<Session> {
  const current = await auth.getSession();
  if (current.error) throw current.error;
  if (!userId || current.data.session?.user.id !== userId)
    throw new Error("Innloggingen har endret seg. Åpne siden på nytt.");
  const refreshed = await auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  if (refreshed.data.session?.user.id !== userId)
    throw new Error("Innloggingen har endret seg. Åpne siden på nytt.");
  return refreshed.data.session;
}
