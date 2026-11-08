"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decodeCalendar } from "@/lib/share";
import type { AdventCalendar } from "@/lib/model";
import { isReceived } from "@/lib/calendar-library";
import { RecipientView } from "@/components/recipient-view";
import { Icon } from "@/components/icons";
import { BrandLogo } from "@/components/brand";
import { useStore } from "@/components/provider";
import { useAccount } from "@/components/account-provider";
import { inviteToken } from "@/lib/cloud/workspace";
import { clientForUser, authMessage, supabase } from "@/lib/cloud/client";
export default function ReceivePage() {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setHash(location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (hash === null)
    return (
      <main className="loading-screen">
        <p>Åpner lenken …</p>
      </main>
    );
  const token = inviteToken(hash);
  return token ? <LinkedReceive token={token} /> : <LegacyReceive />;
}
function LinkedReceive({ token }: { token: string }) {
  const account = useAccount(),
    store = useStore(),
    router = useRouter();
  const [error, setError] = useState(""),[switching,setSwitching]=useState(false),[retry,setRetry]=useState(0);
  async function chooseAccount() {
    setSwitching(true);
    try {
      await store.syncNow();
      try {localStorage.setItem("luke:pending-invite",token);} catch {}
      const {data,error}=await supabase().auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/settings`,skipBrowserRedirect:true,queryParams:{prompt:"select_account"}}});
      if(error) throw error;
      if(!data.url) throw new Error("Kunne ikke åpne Google. Prøv igjen.");
      location.assign(data.url);
    } catch(error) {setError(authMessage(error));setSwitching(false);}
  }
  useEffect(() => {
    try {
      localStorage.setItem("luke:pending-invite", token);
    } catch {}
  }, [token]);
  useEffect(() => {
    if (!account.user) return;
    setError("");
    let active = true;
    void (async () => {
      const scoped = await clientForUser(account.user!.id, true);
      await store.syncNow();
      if (!active) return;
      const { data, error } = await scoped.rpc(
        "accept_luke_invite",
        {
          p_token: token,
        },
      );
      if (error) throw error;
      if (!active) return;
      try {
        localStorage.removeItem("luke:pending-invite");
      } catch {}
      await store.refresh(true);
      if (active) router.replace(`/calendar/${data}/preview`);
    })().catch((error) => {
      if (active) {
        setError(authMessage(error));
        try {
          localStorage.removeItem("luke:pending-invite");
        } catch {}
      }
    });
    return () => {
      active = false;
    };
  }, [account.user?.id, token, router, store.refresh, store.syncNow, retry]);
  return (
    <main className="receive-invitation">
      <div className="settings-card invitation-card">
        <Link href="/calendars" className="brand invitation-brand" aria-label="Luke, til forsiden">
          <BrandLogo />
        </Link>
        <h1>
          {error
            ? "Kalenderen kunne ikke åpnes"
            : account.user
              ? "Henter kalenderen …"
              : "En kalender venter på deg"}
        </h1>
        <p>
          {error ||
            (account.user
              ? "Vi legger den til under Delt med meg."
              : "Logg inn med Google for å åpne kalenderen. Nye endringer fra avsender følger med automatisk.")}
        </p>
        {!account.user && !error && (
          <Link href="/settings" className="button primary full">
            Fortsett med Google
            <Icon name="user" size={18} />
          </Link>
        )}
        {account.user && <p className="field-help">Innlogget som {account.user.email}</p>}
        {error && account.user && <button type="button" className="button primary full" disabled={switching} onClick={()=>setRetry(value=>value+1)}>Prøv igjen med denne kontoen</button>}
        {error && account.user && <button type="button" className="button secondary full" disabled={switching} onClick={()=>void chooseAccount()}><Icon name="user" size={17}/>{switching ? "Åpner Google …" : "Velg en annen Google-konto"}</button>}
        {error && !account.user && <Link href="/settings" className="button primary full">Til innlogging</Link>}
        <Link href="/calendars" className="button secondary full">
          Til Mine kalendere
        </Link>
      </div>
    </main>
  );
}
function LegacyReceive() {
  const store = useStore();
  const [calendar, setCalendar] = useState<AdventCalendar | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        setCalendar(decodeCalendar(location.hash.slice(1)));
        setError("");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Kalenderen kunne ikke åpnes.",
        );
        setCalendar(null);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (error)
    return (
      <main className="recovery">
        <Icon name="gift" size={36} />
        <h1>Vi mangler litt av lenken</h1>
        <p>{error}</p>
        <Link href="/calendars" className="button primary">
          Til Mine kalendere
          <Icon name="arrow" size={17} />
        </Link>
      </main>
    );
  if (!calendar)
    return (
      <main className="loading-screen">
        <Icon name="sparkles" size={28} />
        <p>Åpner kalenderen …</p>
      </main>
    );
  const existing = store.data.calendars.find(
    (item) =>
      isReceived(item) &&
      item.receivedSourceId === (calendar.receivedSourceId ?? calendar.id),
  );
  return (
    <>
      <div className="legacy-share-note" role="note">
        Dette er en eldre prøvelenke med en kopi av kalenderen. Be avsenderen om
        en ny delingslenke for automatiske oppdateringer.
      </div>
      <RecipientView
        key={calendar.id + calendar.updatedAt}
        calendar={calendar}
        saved={!!existing}
      />
    </>
  );
}
