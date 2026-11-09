"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type AdventCalendar, completedCount } from "@/lib/model";
import { downloadJson } from "@/lib/storage";
import { authMessage, rpcForUser, supabase } from "@/lib/cloud/client";
import { type CalendarInvitation } from "@/lib/personal-sharing";
import { SHARE_PLANS } from "@/lib/billing";
import { SharePurchaseFlow } from "./share-purchase";
import { useShareOrders } from "./share-orders";
import { useAccount } from "./account-provider";
import { useStore } from "./provider";
import { Dialog } from "./dialog";
import { Icon } from "./icons";

function useInvitations(calendarId: string, enabled: boolean) {
  const {user} = useAccount();
  const identity = `${user?.id ?? ''}:${calendarId}`;
  const [state,setState] = useState<{identity:string;items?:CalendarInvitation[];error:string}>({identity,error:''});
  const refresh = useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    if (!user || !enabled) return;
    let alive=true, running=false, again=false;
    const load=async()=>{
      if (running) {again=true;return;}
      running=true;
      try {
        const {data,error}=await rpcForUser(user.id,'get_luke_invitations',{p_calendar_id:calendarId});
        if (error) throw error;
        if (alive) setState({identity,items:data as CalendarInvitation[],error:''});
      } catch(error) {
        if (alive) setState(previous=>({...(previous.identity===identity ? previous : {identity}),error:authMessage(error)}));
      } finally {running=false;if (again && alive) {again=false;void load();}}
    };
    refresh.current=load;void load();
    const resume=()=>{if (document.visibilityState==='visible') void load();};
    const channel=supabase().channel(`invitations:${identity}`).on('postgres_changes',{event:'*',schema:'public',table:'luke_updates',filter:`calendar_id=eq.${calendarId}`},()=>void load()).subscribe();
    const timer=setInterval(resume,15000);
    window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
    return ()=>{alive=false;clearInterval(timer);void supabase().removeChannel(channel);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[identity,enabled]);
  return {...(state.identity===identity ? state : {items:undefined,error:''}),refresh:()=>refresh.current()};
}

export function PaidShareDialog({calendar,onClose,initialOrderId}:{calendar:AdventCalendar;onClose:()=>void;initialOrderId?:string}) {
  const store=useStore(),{user}=useAccount();
  const invitations=useInvitations(calendar.id,store.cloud);
  const purchases=useShareOrders(calendar.id,store.cloud);
  const [composing,setComposing]=useState(!!initialOrderId),[purchaseId,setPurchaseId]=useState(initialOrderId),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmStop,setConfirmStop]=useState(false);
  const busyRef=useRef(false);
  async function revoke(email:string) {
    if (busyRef.current || !window.confirm(`Trekke tilbake invitasjonen til ${email}? Invitasjonslenken og kalendertilgangen slutter å fungere for denne personen. Fremdrift og quizforsøk beholdes.`)) return;
    busyRef.current=true;setBusy(true);setError('');
    try {
      const {error}=await rpcForUser(user?.id ?? null,'revoke_luke_invitation',{p_calendar_id:calendar.id,p_email:email});
      if (error) throw error;
      await invitations.refresh();store.toast('Invitasjonen er trukket tilbake.');
    } catch(error) {setError(authMessage(error));}
    finally {busyRef.current=false;setBusy(false);}
  }
  async function stop() {
    if (busyRef.current) return;
    busyRef.current=true;setBusy(true);setError('');
    try {
      const {error}=await rpcForUser(user?.id ?? null,'stop_luke_sharing',{p_calendar_id:calendar.id});
      if (error) throw error;
      await invitations.refresh();setConfirmStop(false);store.toast('Delingen er avsluttet.');
    } catch(error) {setError(authMessage(error));}
    finally {busyRef.current=false;setBusy(false);}
  }
  if (composing) return <SharePurchaseFlow calendar={calendar} source={purchases} initialOrderId={purchaseId} onBack={()=>{setComposing(false);setPurchaseId(undefined);}} onDone={()=>{setComposing(false);setPurchaseId(undefined);void invitations.refresh();}}/>;
  return <Dialog key="sharing" title="Del kalenderen" onClose={()=>{if(!busy) onClose();}}>
    <div className="share-content">
      <span className="large-icon"><Icon name="gift" size={30}/></span>
      <h3>{calendar.title}</h3>
      <p className="muted">{completedCount(calendar)} av 24 luker er fylt.</p>
      {store.cloud ? <>
        <button type="button" className="button primary full" disabled={busy} onClick={()=>{setError('');setPurchaseId(undefined);setComposing(true);}}><Icon name="share" size={17}/>Del kalenderen</button>
        {!!purchases.data?.orders.some(o=>o.status==='paid' || o.status==='pending') && <section className="share-purchases" aria-label="Dine delingskjøp"><h4>Dine delingskjøp</h4>{purchases.data.orders.filter(o=>o.status==='paid' || o.status==='pending').map(order=><div key={order.id}>
          <div><strong>{SHARE_PLANS[order.kind].name} · {SHARE_PLANS[order.kind].price}</strong><span>{order.status==='pending' ? 'Betaling ikke fullført' : order.emails ? order.emails.join(', ') : 'Betalt · klar til å deles'}</span></div>
          <button type="button" className="button secondary small-button" disabled={busy} onClick={()=>{setPurchaseId(order.id);setComposing(true);}}>{order.status==='pending' ? 'Fortsett' : order.emails ? 'Send på nytt' : 'Del'}</button>
        </div>)}</section>}
        {purchases.error && <p className="form-error" role="alert">{purchases.error}<button type="button" className="text-link" onClick={()=>void purchases.refresh().catch(()=>{})}>Prøv igjen</button></p>}
        <section className="invitation-list-section" aria-label="Invitasjoner">
          <h4>Invitasjoner <span>{invitations.items?.length ?? ''}</span></h4>
          {invitations.error ? <p className="form-error" role="alert">{invitations.error}<button className="text-link" type="button" onClick={()=>void invitations.refresh()}>Prøv igjen</button></p> : !invitations.items ? <p className="field-help" role="status">Henter invitasjoner …</p> : !invitations.items.length ? <p className="field-help">Ingen invitasjoner ennå.</p> : <ul className="invitation-list">{invitations.items.map(item=><li key={item.email}>
            <div><strong>{item.email}</strong><span>{item.kinds.includes('group') ? 'Gruppe' : 'Enkeltperson'} · {item.hasAccess ? 'Har kalenderen' : item.accepted ? 'Kan legges til igjen' : 'Ikke åpnet'}</span></div>
            <button className="icon-button" type="button" aria-label={`Trekk tilbake invitasjonen til ${item.email}`} title="Trekk tilbake invitasjonen" disabled={busy} onClick={()=>void revoke(item.email)}><Icon name="trash" size={16}/></button>
          </li>)}</ul>}
        </section>
        {!confirmStop ? <button className="button secondary full" type="button" disabled={busy} onClick={()=>setConfirmStop(true)}>Stopp deling</button> : <div className="info-box"><p>Dette avslutter alle invitasjoner og fjerner mottakernes tilgang. Fremdrift og quizforsøk beholdes.</p><div className="account-action-row"><button className="button secondary" type="button" disabled={busy} onClick={()=>setConfirmStop(false)}>Avbryt</button><button className="button danger" type="button" disabled={busy} onClick={()=>void stop()}>Stopp delingen</button></div></div>}
      </> : <div className="info-box"><strong>Logg inn for å dele</strong><p>Legg kalenderen på en konto først. Da følger nye endringer med hos mottakeren.</p><Link className="button primary full" href="/settings" onClick={onClose}>Til konto<Icon name="user" size={17}/></Link></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button secondary full" type="button" disabled={busy} onClick={async()=>{
        if(busyRef.current) return;
        busyRef.current=true;setBusy(true);setError('');
        try {await downloadJson({version:1,calendars:[calendar],preferences:store.data.preferences},`luke-kalender-${calendar.year}.json`);store.toast('Kalenderfilen er lastet ned.');}
        catch(error){setError(authMessage(error));}finally{busyRef.current=false;setBusy(false);}
      }}><Icon name="download" size={17}/>Last ned sikkerhetskopi</button>
      <p className="field-help">Kun til eget bruk. Sikkerhetskopien inneholder også luker som ennå ikke har åpnet.</p>
    </div>
  </Dialog>;
}
