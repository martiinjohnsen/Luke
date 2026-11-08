"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { type AdventCalendar, completedCount } from "@/lib/model";
import { downloadJson } from "@/lib/storage";
import { authMessage, rpcForUser } from "@/lib/cloud/client";
import { useAccount } from "./account-provider";
import { useStore } from "./provider";
import { emailInvitation, recipientEmail } from "@/lib/personal-sharing";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
export function ShareDialog({
  calendar,
  onClose,
}: {
  calendar: AdventCalendar;
  onClose: () => void;
}) {
  const store = useStore();
  const account = useAccount();
  const formId=useId();
  const [email,setEmail]=useState(""),[message,setMessage]=useState(""),[prepared,setPrepared]=useState<ReturnType<typeof emailInvitation>|null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmStop, setConfirmStop] = useState(false);
  async function generate() {
    const address=recipientEmail(email);
    if(!address){setError("Skriv én gyldig e-postadresse.");return;}
    setBusy(true);
    setError("");
    try {
      await store.syncNow();
      const { data, error } = await rpcForUser(
        account.user?.id ?? null,
        "create_luke_personal_invite",
        {
          p_calendar_id: calendar.id,
          p_email: address,
        },
      );
      if (error) throw error;
      setPrepared(emailInvitation({email:address,title:calendar.title,message,sender:calendar.sender || store.data.preferences.name,link:`${location.origin}/receive#invite=${data}`}));
    } catch (error) {
      setError(authMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Del kalenderen" onClose={onClose}>
      <div className="share-content">
        <span className="large-icon">
          <Icon name="gift" size={30} />
        </span>
        <h3>{calendar.title}</h3>
        <p className="muted">{completedCount(calendar)} av 24 luker er fylt.</p>
        {store.cloud ? (
          <>
            {!prepared && <p className="share-recipient-note">Inviter én person med e-post. Invitasjonen kan bare brukes av Google-kontoen med denne e-postadressen.</p>}
            {!prepared && <form id={formId} className="personal-share-form" onSubmit={event=>{event.preventDefault();if(!busy && !prepared) void generate();}}>
              <label>Mottakerens e-post<input type="email" autoComplete="email" inputMode="email" maxLength={254} required placeholder="navn@eksempel.no" value={email} disabled={busy || !!prepared} onChange={event=>setEmail(event.target.value)}/></label>
              <label>En hilsen (valgfritt)<textarea rows={3} maxLength={1000} placeholder="Jeg har laget en liten overraskelse til deg …" value={message} disabled={busy || !!prepared} onChange={event=>setMessage(event.target.value)}/></label>
              {!prepared && <button className="button primary full" type="submit" disabled={busy}><Icon name="share" size={17}/>{busy ? "Klargjør invitasjonen …" : "Del kalenderen"}</button>}
            </form>}
            {prepared && <div className="prepared-invitation">
              <p role="status">Invitasjonen til <strong>{prepared.email}</strong> er klargjort.</p>
              <a className="button primary full" href={prepared.href}><Icon name="external" size={17}/>Åpne e-post</a>
              <p className="field-help">E-postappen åpnes med mottaker, hilsen og invitasjon ferdig utfylt. Trykk Send der for å fullføre.</p>
              <button type="button" className="button secondary full" disabled={busy} onClick={async()=>{try {await navigator.clipboard.writeText(prepared.text);store.toast("Invitasjonen er kopiert.");}catch{setError("Kopier teksten fra feltet under.");}}}><Icon name="copy" size={16}/>Kopier invitasjonen</button>
              <details><summary>Vis invitasjonen</summary><textarea aria-label="Invitasjonstekst" readOnly rows={5} value={prepared.text} onFocus={event=>event.target.select()}/></details>
              <button type="button" className="text-link" onClick={()=>{setPrepared(null);setError("");}}>Endre mottaker eller hilsen</button>
            </div>}
            {!confirmStop ? (
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => setConfirmStop(true)}
              >
                Stopp deling
              </button>
            ) : (
              <div className="info-box">
                <p>
                  Dette avslutter invitasjonene og fjerner mottakernes tilgang. Du
                  beholder kalenderen og kan invitere på nytt senere.
                </p>
                <div className="account-action-row">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setConfirmStop(false)}
                  >
                    Avbryt
                  </button>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const { error } = await rpcForUser(
                          account.user?.id ?? null,
                          "stop_luke_sharing",
                          { p_calendar_id: calendar.id },
                        );
                        if (error) throw error;
                        setPrepared(null);
                        setConfirmStop(false);
                        store.toast("Delingen er avsluttet.");
                      } catch (error) {
                        setError(authMessage(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Stopp delingen
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="info-box">
            <strong>Logg inn for å dele</strong>
            <p>
              Legg kalenderen på en konto først. Da følger nye endringer med hos
              mottakeren, og fremtidige luker holdes låst.
            </p>
            <Link
              className="button primary full"
              href="/settings"
              onClick={onClose}
            >
              Til konto
              <Icon name="user" size={17} />
            </Link>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button secondary full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);setError("");
            try { await downloadJson(
              {
                version: 1,
                calendars: [calendar],
                preferences: store.data.preferences,
              },
              `luke-kalender-${calendar.year}.json`,
            );
            store.toast("Kalenderfilen er lastet ned.");
            } catch(error) { setError(authMessage(error)); }
            finally { setBusy(false); }
          }}
        >
          <Icon name="download" size={17} />
          Last ned sikkerhetskopi
        </button>
        <p className="field-help">
          Kun til eget bruk. Del kalenderen med invitasjonen over. Sikkerhetskopien
          inneholder også luker som ennå ikke har åpnet.
        </p>
      </div>
    </Dialog>
  );
}
