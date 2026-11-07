"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { compressImage } from "@/lib/storage";
import { uploadMedia } from "@/lib/cloud/media";
import { authMessage } from "@/lib/cloud/client";
import { useAccount } from "./account-provider";
import { useStore } from "./provider";
import { useGreetings, type Greeting, type PreviewGreeting } from "./greetings-provider";
import { sameGreeting, greetingsForCalendar } from "@/lib/greetings";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { AudioInput } from "./audio-input";
import { MediaImage, AudioPlayer } from "./media";
export function GreetingBadge({calendarId}:{calendarId:string}) {
  const {items}=useGreetings();
  const count=items.filter(item=>item.owner && item.calendarId===calendarId && item.revision>item.seenRevision).length;
  return count ? <Link className="greeting-badge glass-choice" href={`/calendar/${calendarId}#hilsener`} aria-label={`${count} uleste hilsener`}><Icon name="message" size={14}/><span>{count}</span></Link> : null;
}
export function GreetingComposer({calendarId,day,onClose,preview}:{calendarId:string;day:number;onClose:()=>void;preview?:PreviewGreeting}) {
  const greetings=useGreetings();
  const {user}=useAccount();
  const record=greetings.items.find(item=>sameGreeting(item,calendarId,day,user?.id ?? "",preview?.mode) && !!item.temporary===!!(preview && !preview.save));
  if(!greetings.ready && (!preview || preview.save)) return <Dialog title={`En hilsen tilbake · ${day}. desember`} onClose={onClose}><div className="dialog-content"><p role="status">{greetings.error || "Henter hilsenen din …"}</p><button type="button" className="button secondary" onClick={()=>void greetings.refresh()}>Prøv igjen</button></div></Dialog>;
  return user ? <GreetingForm key={`${calendarId}:${day}:${user.id}:${preview?.mode ?? "recipient"}:${preview?.save ?? false}`} calendarId={calendarId} day={day} userId={user.id} record={record} preview={preview} onClose={onClose}/> : null;
}
function GreetingForm({calendarId,day,userId,record,onClose,preview}:{calendarId:string;day:number;userId:string;record?:Greeting;onClose:()=>void;preview?:PreviewGreeting}) {
  const greetings=useGreetings(),{toast}=useStore();
  const formId=useId();
  const initial=()=>({body:record?.body ?? "",image:record?.image ?? null,audio:record?.audio ?? null});
  const [draft,setDraft]=useState(initial),[revision,setRevision]=useState(record?.revision ?? 0),[busy,setBusy]=useState(false),[audioBusy,setAudioBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const [audioAdded,setAudioAdded]=useState(!!record?.audio);
  const baseline=useRef(JSON.stringify(initial())),alive=useRef(true),uploadToken=useRef(0);
  const dirty=JSON.stringify(draft)!==baseline.current;
  const changedElsewhere=!!record && record.revision!==revision;
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;uploadToken.current++;};},[]);
  function reload() {const next=initial();setDraft(next);setAudioAdded(!!next.audio);baseline.current=JSON.stringify(next);setRevision(record?.revision ?? 0);setError("");}
  useEffect(()=>{if(!dirty && !busy && !audioBusy && changedElsewhere) reload();},[record?.revision,dirty,busy,audioBusy]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty || busy || audioBusy || saving) event.preventDefault();};window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);},[dirty,busy,audioBusy,saving]);
  async function image(file?:File) {
    if(!file) return;const attempt=++uploadToken.current;setBusy(true);setError("");
    try {const compressed=await compressImage(file);const source=await uploadMedia(await(await fetch(compressed)).blob(),{userId,calendarId,day,scope:preview ? "door" : "reply"});if(alive.current && uploadToken.current===attempt) setDraft(previous=>({...previous,image:source}));}
    catch(error){if(alive.current && uploadToken.current===attempt) setError(authMessage(error));}
    finally{if(alive.current && uploadToken.current===attempt) setBusy(false);}
  }
  const blocked=busy || audioBusy || saving;
  function close(){if(saving) return;if((!dirty && !busy && !audioBusy) || window.confirm("Lukke uten å lagre hilsenen?")) onClose();}
  return <Dialog title={`En hilsen tilbake · ${day}. desember`} onClose={close} className="greeting-dialog" footer={<div className="dialog-actions"><button type="button" className="button secondary" disabled={saving} onClick={close}>Lukk</button><button type="submit" form={formId} className="button primary" disabled={blocked || changedElsewhere || (!draft.body.trim() && !draft.image && !draft.audio)}>{saving ? "Lagrer …" : revision ? "Oppdater hilsen" : "Send hilsen"}<Icon name="heart" size={16}/></button></div>}>
  <form id={formId} className="greeting-form" onSubmit={async event=>{
    event.preventDefault();if(blocked || changedElsewhere) return;setSaving(true);setError("");
    try {await greetings.save(calendarId,day,draft,revision,preview);if(alive.current) {toast(preview ? "Prøvehilsenen vises under Hilsener tilbake i redigeringen." : revision ? "Hilsenen er oppdatert." : "Hilsenen er sendt.");onClose();}}
    catch(error){if(alive.current) {setError(authMessage(error));void greetings.refresh();}}
    finally{if(alive.current) setSaving(false);}
  }}>
    <label>Din hilsen<textarea rows={3} maxLength={3000} placeholder="Tusen takk for dagens luke …" value={draft.body} onChange={event=>setDraft({...draft,body:event.target.value})}/></label>
    {draft.image && <div className="greeting-image"><MediaImage src={draft.image} alt="Bildet i hilsenen din"/><button type="button" className="icon-button" aria-label="Fjern bildet" disabled={blocked} onClick={()=>setDraft({...draft,image:null})}><Icon name="trash" size={16}/></button></div>}
    <div className="greeting-attachment-actions">
      <label className="button secondary small-button"><Icon name="image" size={16}/>{busy ? "Lagrer bildet …" : draft.image ? "Bytt bilde" : "Legg til bilde"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={blocked} onChange={event=>{void image(event.target.files?.[0]);event.target.value="";}}/></label>
      {!audioAdded && !draft.audio && <button type="button" className="button secondary small-button" disabled={blocked} onClick={()=>setAudioAdded(true)}><Icon name="mic" size={16}/>Legg til lyd</button>}
    </div>
    {(audioAdded || draft.audio) && <section className="content-block greeting-audio" data-block="audio" aria-label="Lydhilsen">
      <header className="content-block-header"><h3>Lydhilsen</h3><button type="button" className="block-remove" aria-label="Fjern lydhilsen" disabled={blocked} onClick={()=>{setAudioAdded(false);setDraft(previous=>({...previous,audio:null}));}}><Icon name="trash" size={16}/><span>Fjern</span></button></header>
      <div className="content-block-body"><AudioInput value={draft.audio ?? undefined} context={{userId,calendarId,day,scope:preview ? "door" : "reply"}} disabled={busy || saving} onBusyChange={setAudioBusy} onChange={audio=>setDraft(previous=>({...previous,audio:audio || null}))}/></div>
    </section>}
    {changedElsewhere && <div className="form-error" role="alert">Hilsenen er endret på en annen enhet. Utkastet ditt er beholdt.<button type="button" className="button secondary small-button" onClick={reload}>Hent nyeste hilsen</button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form></Dialog>;
}
export function GreetingInbox({calendarId}:{calendarId:string}) {
  const greetings=useGreetings();
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[visibleCount,setVisibleCount]=useState(12);
  const items=greetingsForCalendar(greetings.items,calendarId);
  const unread=items.filter(item=>item.revision>item.seenRevision);
  const visible=items.slice(0,visibleCount);
  const visibleUnread=visible.filter(item=>item.revision>item.seenRevision);
  const signature=visibleUnread.map(item=>`${item.userId}:${item.day}:${item.previewMode ?? "recipient"}:${item.temporary ?? false}:${item.revision}`).join("|");
  useEffect(()=>{const hash=()=>{if(location.hash==="#hilsener") setOpen(true);};hash();window.addEventListener("hashchange",hash);return ()=>window.removeEventListener("hashchange",hash);},[]);
  useEffect(()=>{if(!open || !visibleUnread.length) return;let active=true;void greetings.read(calendarId,visibleUnread).then(()=>{if(active) setError("");}).catch(error=>{if(active) setError(authMessage(error));});return ()=>{active=false;};},[open,calendarId,signature]);
  return <section className="greeting-inbox" id="hilsener">
    <button type="button" className="button secondary greeting-inbox-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="message" size={18}/><strong>Hilsener tilbake</strong><span>{unread.length ? `${unread.length} nye` : items.length || ""}</span><Icon name="chevron" size={16}/></button>
    {open && <div className="greeting-inbox-content">
      {(error || greetings.error) && <p className="form-error" role="alert">{error || greetings.error}</p>}
      {!items.length ? <p className="field-help">Hilsener fra mottakeren og dine egne prøvehilsener dukker opp her.</p> : visible.map(item=><article className="greeting-message" key={`${item.userId}:${item.day}:${item.previewMode ?? "recipient"}:${item.temporary ?? false}`}>
        <header><strong>{item.previewMode ? "Prøvehilsen fra deg" : `Hilsen fra ${item.name}`}</strong><span>{item.day}. desember</span><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString("nb-NO",{day:"numeric",month:"short"})}</time></header>
        {item.body && <p>{item.body}</p>}{item.image && <MediaImage src={item.image} alt={`Et bilde fra ${item.name}`} loading="lazy"/>}{item.audio && <AudioPlayer src={item.audio} label={`Lydhilsen fra ${item.name}`}/>}
      </article>)}
      {items.length>visibleCount && <button type="button" className="button secondary" onClick={()=>setVisibleCount(visibleCount+12)}>Vis flere hilsener</button>}
    </div>}
  </section>;
}
