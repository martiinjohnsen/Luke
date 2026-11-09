"use client";
import Link from "next/link";
import { PAID_SHARING_ENABLED } from "@/lib/sharing-mode";
import { PaidShareDialog } from "./paid-share-dialog";
import { useEffect, useId, useRef, useState } from "react";
import { type AdventCalendar, completedCount } from "@/lib/model";
import { downloadJson } from "@/lib/storage";
import { authMessage, rpcForUser, supabase } from "@/lib/cloud/client";
import { emailInvitation, groupEmailInvitation, invitationEmails, type CalendarInvitation, type SharingKind } from "@/lib/personal-sharing";
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

type ShareDialogProps = {calendar:AdventCalendar;onClose:()=>void;initialOrderId?:string};

export function ShareDialog(props:ShareDialogProps) {
  return PAID_SHARING_ENABLED ? <PaidShareDialog {...props}/> : <FreeShareDialog calendar={props.calendar} onClose={props.onClose}/>;
}

function FreeShareDialog({calendar,onClose}:ShareDialogProps) {
  const store=useStore(),{user}=useAccount();
  const invitations=useInvitations(calendar.id,store.cloud);
  const [composing,setComposing]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmStop,setConfirmStop]=useState(false);
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
  if (composing) return <InvitationComposer calendar={calendar} onBack={()=>setComposing(false)} onDone={()=>{setComposing(false);void invitations.refresh();}}/>;
  return <Dialog key="sharing" title="Del kalenderen" onClose={()=>{if(!busy) onClose();}}>
    <div className="share-content">
      <span className="large-icon"><Icon name="gift" size={30}/></span>
      <h3>{calendar.title}</h3>
      <p className="muted">{completedCount(calendar)} av 24 luker er fylt.</p>
      {store.cloud ? <>
        <button type="button" className="button primary full" disabled={busy} onClick={()=>{setError('');setComposing(true);}}><Icon name="share" size={17}/>Del kalenderen</button>
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

function InvitationComposer({calendar,onBack,onDone}:{calendar:AdventCalendar;onBack:()=>void;onDone:()=>void}) {
  const store=useStore(),{user}=useAccount(),formId=useId();
  const [kind,setKind]=useState<SharingKind|null>(null),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const requestId=useRef<string|null>(null),busyRef=useRef(false);
  async function share() {
    if(!kind || busyRef.current) return;
    busyRef.current=true;setBusy(true);setError('');
    try {
      const emails=invitationEmails(email,kind);
      await store.syncNow();
      requestId.current ??= crypto.randomUUID();
      const {data,error}=await rpcForUser(user?.id ?? null,'create_luke_invitation_batch',{p_calendar_id:calendar.id,p_emails:emails,p_kind:kind,p_request_id:requestId.current});
      if(error) throw error;
      if(!data || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error('Invitasjonen kunne ikke klargjøres. Prøv igjen.');
      const content={title:calendar.title,message,sender:calendar.sender || store.data.preferences.name,link:`${location.origin}/receive#invite=${data.token}`};
      const draft=kind==='person' ? emailInvitation({...content,email:emails[0]}) : groupEmailInvitation({...content,emails});
      location.assign(draft.href);
      onDone();
    } catch(error) {setError(authMessage(error));}
    finally {busyRef.current=false;setBusy(false);}
  }
  return <Dialog title="Del kalenderen" onClose={()=>{if(!busy) onBack();}} footer={<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onBack}>Tilbake</button><button type="submit" form={formId} className="button primary" disabled={busy || !kind}><Icon name="share" size={17}/>{busy ? 'Klargjør …' : 'Del'}</button></div>}>
    <form id={formId} className="invitation-composer personal-share-form" onSubmit={event=>{event.preventDefault();void share();}}>
      <div className="sharing-kind" role="group" aria-label="Velg mottakere">{(['person','group'] as const).map(value=><button key={value} className="button secondary" type="button" disabled={busy} aria-pressed={kind===value} onClick={()=>{setKind(value);setEmail('');requestId.current=null;setError('');}}><Icon name={value==='person' ? 'user' : 'calendar'} size={20}/>{value==='person' ? 'Enkeltperson' : 'Gruppe'}</button>)}</div>
      {kind && <>
        <label>{kind==='person' ? 'Mottakerens e-post' : 'Mottakernes e-postadresser'}{kind==='person' ? <input type="email" autoComplete="email" inputMode="email" maxLength={254} required placeholder="navn@eksempel.no" value={email} disabled={busy} onChange={event=>{setEmail(event.target.value);requestId.current=null;}}/> : <textarea rows={3} autoComplete="off" inputMode="email" maxLength={13000} required placeholder={'navn@eksempel.no\nvenn@eksempel.no'} value={email} disabled={busy} onChange={event=>{setEmail(event.target.value);requestId.current=null;}}/>}</label>
        {kind==='group' && <p className="field-help">Én adresse per linje, eller skill med komma. Opptil 50 personer. Adressene legges i blindkopi.</p>}
        <label>En hilsen (valgfritt)<textarea rows={3} maxLength={1000} placeholder="Jeg har laget en liten overraskelse til deg …" value={message} disabled={busy} onChange={event=>setMessage(event.target.value)}/></label>
        <p className="field-help">Del åpner e-postappen med invitasjonen ferdig utfylt. Trykk Send der. Kalenderen åpnes med Google-kontoen til den inviterte e-postadressen.</p>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </Dialog>;
}
