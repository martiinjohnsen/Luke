"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { SHARE_PLANS, type ShareOrder } from "@/lib/billing";
import { billingRequest } from "@/lib/billing-client";
import { authMessage, rpcForUser } from "@/lib/cloud/client";
import { emailInvitation, groupEmailInvitation, invitationEmails, type SharingKind } from "@/lib/personal-sharing";
import type { AdventCalendar } from "@/lib/model";
import type { ShareOrdersSource } from "./share-orders";
import { useAccount } from "./account-provider";
import { useStore } from "./provider";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { AutoTextarea } from "./auto-textarea";

export function SharePurchaseFlow({ calendar, source, initialOrderId, onBack, onDone }: {
  calendar: AdventCalendar; source: ShareOrdersSource; initialOrderId?: string; onBack: () => void; onDone: () => void;
}) {
  const [kind, setKind] = useState<SharingKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId ?? null);
  const selected = source.data?.orders.find(o => o.id === selectedId);
  const chosenKind = selected?.kind ?? kind;
  const paid = selected?.status === "paid" ? selected : null;
  function choose(value: SharingKind) {
    setKind(value);
    setSelectedId(source.data?.orders.find(o => o.kind === value && o.status === "paid" && !o.emails)?.id ?? null);
  }
  const close = () => { void source.refresh().catch(() => {}); onBack(); };
  if (!chosenKind) return <Dialog title="Del kalenderen" onClose={close} wide footer={<div className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Tilbake</button></div>}>
    <div className="share-plans-content">
      <p className="info-box" role="status"><strong>Testbetaling</strong><br/>Ingen ekte penger trekkes. Deling blir tilgjengelig etter en fullført testbetaling.</p>
      <p className="share-plan-intro">Velg en delingspakke for <strong>{calendar.title}</strong>.</p>
      {initialOrderId && !source.data && <p role="status">Kontrollerer kjøpet …</p>}
      <div className="share-plans">{(["person", "group"] as const).map(value => {
        const plan = SHARE_PLANS[value], owned = source.data?.orders.some(o => o.kind === value && o.status === "paid" && !o.emails);
        return <button type="button" key={value} className="share-plan" onClick={() => choose(value)}>
          <span className="share-plan-icon"><Icon name={value === "person" ? "user" : "calendar"} size={23} /></span>
          <span className="share-plan-name">{plan.name}</span>
          <span className="share-plan-price">{plan.price}</span><span className="share-plan-once">Engangsbetaling</span>
          <span className="share-plan-detail">{plan.detail}</span>
          <span className="share-plan-features">{plan.features.map(feature => <span key={feature}><Icon name="check" size={15} />{feature}</span>)}</span>
          <span className="share-plan-action">{owned ? "Allerede betalt · fortsett" : "Velg pakken"}<Icon name="arrow" size={16} /></span>
        </button>;
      })}</div>
      <p className="share-purchase-note"><Icon name="lock" size={15} />Kjøpet lagres på kontoen din. Du kan dele kalenderen senere.</p>
      {source.error && <p className="form-error" role="alert">{source.error}</p>}
    </div>
  </Dialog>;
  const tabs = <div className="share-package-tabs" role="group" aria-label="Delingspakke">{(["person", "group"] as const).map(value => <button type="button" key={value} className="button secondary" aria-pressed={chosenKind === value} onClick={() => choose(value)}>{SHARE_PLANS[value].name}<strong>{SHARE_PLANS[value].price}</strong></button>)}</div>;
  if (paid) return <PaidInvitationComposer key={paid.id} calendar={calendar} order={paid} onBack={close} onDone={() => { void source.refresh().catch(() => {}); onDone(); }} />;
  return <Dialog title="Betal for deling" onClose={close} wide footer={<div className="dialog-actions"><button type="button" className="button secondary" onClick={() => { setKind(null); setSelectedId(null); }}>Tilbake</button><span className="field-help">Engangsbetaling · {SHARE_PLANS[chosenKind].price}</span></div>}>
    <div className="share-checkout-content">{tabs}
      <p className="info-box" role="status"><strong>Stripe-test</strong><br/>Ingen ekte penger trekkes. Bruk testkortnummeret 4242 4242 4242 4242, en fremtidig utløpsdato og valgfri sikkerhetskode.</p>
      <p>Etter betaling velger du mottakere og skriver en hilsen.</p>
      {source.error && <p className="form-error" role="alert">{source.error}<button type="button" className="text-link" onClick={() => void source.refresh().catch(() => {})}>Kontroller på nytt</button></p>}
      {source.data?.configured === false ? <div className="info-box" role="status">Betaling er ikke tilgjengelig ennå. Prøv igjen senere.</div> :
        <ShareCheckout key={chosenKind} calendar={calendar} kind={chosenKind} onPaid={async order => {
          const orders = await source.refresh();
          const ready = orders.find(o => o.id === order.id && o.status === "paid");
          if (!ready) throw new Error("Betalingen kontrolleres fortsatt. Vent litt og trykk «Kontroller betalingen».");
          setSelectedId(ready.id);
        }} />}
      <p className="share-purchase-note">Har du betalt og lukket vinduet, finner du kjøpet igjen under «Del kalenderen».</p>
    </div>
  </Dialog>;
}

function ShareCheckout({ calendar, kind, onPaid }: { calendar: AdventCalendar; kind: SharingKind; onPaid: (order: ShareOrder) => Promise<void> }) {
  const { user } = useAccount(), store = useStore();
  const mount = useRef<HTMLDivElement>(null), callback = useRef(onPaid), order = useRef<ShareOrder | null>(null);
  callback.current = onPaid;
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0), [checking, setChecking] = useState(false);
  async function check() {
    if (!order.current || checking) return;
    setChecking(true); setError("");
    try { await callback.current(order.current); } catch (error) { setError(authMessage(error)); } finally { setChecking(false); }
  }
  useEffect(() => {
    if (!user) return;
    let alive = true, checkout: StripeEmbeddedCheckout | undefined;
    setLoading(true); setError("");
    void (async () => {
      await store.syncNow();
      const result = await billingRequest<{ order: ShareOrder; clientSecret?: string; publishableKey?: string }>(user.id, "checkout", { calendarId: calendar.id, kind });
      if (!alive) return;
      order.current = result.order;
      if (result.order.status === "paid") { await callback.current(result.order); return; }
      if (!result.clientSecret || !result.publishableKey) throw new Error("Betalingsskjemaet kunne ikke åpnes.");
      const { loadStripe } = await import("@stripe/stripe-js/pure");
      const stripe = await loadStripe(result.publishableKey);
      if (!alive) return;
      if (!stripe) throw new Error("Betalingsskjemaet kunne ikke lastes.");
      checkout = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: async () => result.clientSecret!, onComplete: () => { if (alive) void check(); } });
      if (!alive) { checkout.destroy(); return; }
      if (mount.current) checkout.mount(mount.current);
      setLoading(false);
    })().catch(error => { if (alive) { setError(authMessage(error)); setLoading(false); } });
    return () => { alive = false; checkout?.destroy(); };
  }, [calendar.id, kind, user?.id, attempt]);
  return <div className="share-checkout">
    {loading && <p role="status">Klargjør sikker betaling …</p>}
    <div ref={mount} />
    {checking && <p role="status">Kontrollerer betalingen …</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {error && <div className="account-action-row">{order.current && <button type="button" className="button secondary" disabled={checking} onClick={() => void check()}>Kontroller betalingen</button>}<button type="button" className="button secondary" disabled={checking} onClick={() => setAttempt(value => value + 1)}>Prøv igjen</button></div>}
  </div>;
}

function PaidInvitationComposer({ calendar, order, onBack, onDone }: {
  calendar: AdventCalendar; order: ShareOrder; onBack: () => void; onDone: () => void;
}) {
  const store = useStore(), { user } = useAccount(), formId = useId();
  const [email, setEmail] = useState(order.emails?.join("\n") ?? ""), [message, setMessage] = useState(order.message), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const locked = !!order.emails, busyRef = useRef(false);
  async function share() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const emails = invitationEmails(email, order.kind);
      await store.syncNow();
      const { data, error } = await rpcForUser(user?.id ?? null, "create_luke_paid_invitation", { p_order_id: order.id, p_emails: emails, p_message: message });
      if (error) throw error;
      if (!data || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error("Invitasjonen kunne ikke klargjøres. Prøv igjen.");
      const content = { title: calendar.title, message, sender: calendar.sender || store.data.preferences.name, link: `${location.origin}/receive#invite=${data.token}` };
      const draft = order.kind === "person" ? emailInvitation({ ...content, email: emails[0] }) : groupEmailInvitation({ ...content, emails });
      location.assign(draft.href);
      onDone();
    } catch (error) { setError(authMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <Dialog title="Del kalenderen" onClose={() => { if (!busy) onBack(); }} wide footer={<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onBack}>Tilbake</button><button type="submit" form={formId} className="button primary" disabled={busy}><Icon name="share" size={17} />{busy ? "Klargjør …" : "Del"}</button></div>}>
    <form id={formId} className="invitation-composer personal-share-form" onSubmit={event => { event.preventDefault(); void share(); }}>
      <p className="share-paid"><Icon name="check" size={17} />{SHARE_PLANS[order.kind].name} · betalt {SHARE_PLANS[order.kind].price}</p>
      <p className="field-help">Kjøpet er lagret. Du kan lukke vinduet og dele senere uten å betale på nytt.</p>
      <label>{order.kind === "person" ? "Mottakerens e-post" : "Mottakernes e-postadresser"}{order.kind === "person" ? <input type="email" autoComplete="email" inputMode="email" maxLength={254} required placeholder="navn@eksempel.no" value={email} disabled={busy || locked} onChange={event => setEmail(event.target.value)} /> : <AutoTextarea rows={3} autoComplete="off" inputMode="email" maxLength={13000} required placeholder={"navn@eksempel.no\nvenn@eksempel.no"} value={email} disabled={busy || locked} onChange={event => setEmail(event.target.value)} />}</label>
      {order.kind === "group" && <p className="field-help">2–50 personer. Én adresse per linje, eller skill med komma. Adressene legges i blindkopi.</p>}
      {locked && <p className="field-help">Invitasjonen er allerede klargjort til disse mottakerne. Du kan sende den på nytt.</p>}
      <label>En hilsen (valgfritt)<AutoTextarea rows={3} maxLength={1000} placeholder="Jeg har laget en liten overraskelse til deg …" value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /></label>
      <p className="field-help">Del åpner e-postappen med invitasjonen ferdig utfylt. Trykk Send der. Kalenderen åpnes med Google-kontoen til den inviterte e-postadressen.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </Dialog>;
}
