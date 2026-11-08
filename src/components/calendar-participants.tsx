"use client";
import {useEffect,useRef,useState} from 'react';
import type {AdventCalendar} from '@/lib/model';
import {authMessage,rpcForUser,supabase} from '@/lib/cloud/client';
import {leaderboard,type Participants,type Participant} from '@/lib/participants';
import {useAccount} from './account-provider';
import {useStore} from './provider';
import {Icon} from './icons';
import {PersonFilters} from './person-filters';
import {CalendarOverview} from './calendar-overview';
export function useParticipants(calendarId:string,enabled=true) {
  const {user}=useAccount();
  const identity=`${user?.id ?? ''}:${calendarId}`;
  const [state,setState]=useState<{identity:string;data?:Participants;error:string}>({identity,error:''});
  const refresh=useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    if(!user || !enabled) return;
    let alive=true,running=false,again=false;
    const load=async()=>{
      if(running){again=true;return;}
      running=true;
      try {const {data,error}=await rpcForUser(user.id,'get_luke_participants',{p_calendar_id:calendarId});if(error) throw error;
        if(alive) setState({identity,data:data as Participants,error:''});
      } catch(error) {if(alive) setState(previous=>previous.identity===identity ? {...previous,error:authMessage(error)} : {identity,error:authMessage(error)});}
      finally{running=false;if(again && alive){again=false;void load();}}
    };
    refresh.current=load;void load();
    const resume=()=>{if(document.visibilityState==='visible') void load();};
    const channel=supabase().channel(`participants:${identity}`).on('postgres_changes',{event:'*',schema:'public',table:'luke_updates',filter:`calendar_id=eq.${calendarId}`},()=>void load()).subscribe();
    const poll=setInterval(resume,15000);
    window.addEventListener('focus',resume);window.addEventListener('online',resume);
    document.addEventListener('visibilitychange',resume);
    return ()=>{alive=false;clearInterval(poll);void supabase().removeChannel(channel);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[identity,enabled]);
  return {...(state.identity===identity ? state : {error:'',data:undefined}),refresh:()=>refresh.current()};
}
export function QuizLeaderboard({people}:{people:readonly Participant[]}) {
  if(people.length<2 || !people.some(person=>person.summary.total)) return null;
  return <section className="quiz-leaderboard" aria-label="Resultatliste"><h3>Resultatliste</h3><ol>{leaderboard(people).map(({person,rank})=><li key={person.id} className={person.self ? 'is-self' : ''}><span className="leaderboard-rank">{rank}</span><span className="leaderboard-name">{person.name}{person.self && <small>Du</small>}<small>{person.summary.answered} av {person.summary.total} besvart</small></span><strong>{person.summary.correct}<span> / {person.summary.total}</span></strong></li>)}</ol></section>;
}
export function OwnerParticipants({calendar,onOpenDoor,source}:{calendar:AdventCalendar;onOpenDoor:(day:number)=>void;source:ReturnType<typeof useParticipants>}) {
  const {data,error,refresh}=source,{user}=useAccount(),store=useStore();
  const [filter,setFilter]=useState("all");
  const [expanded,setExpanded]=useState(false),[selected,setSelected]=useState<string|null>(null),[removing,setRemoving]=useState<string|null>(null),[failure,setFailure]=useState('');
  const people=data?.participants ?? [],person=people.find(p=>p.id===selected);
  const activeFilter=people.some(p=>p.id===filter) ? filter : "all";
  async function remove(p:Participant) {
    if(!user || removing || !window.confirm(`Fjerne tilgangen til ${p.name}? Fremdrift og quizforsøk beholdes dersom personen får kalenderen igjen.`)) return;
    setRemoving(p.id);setFailure('');
    try {const {error}=await rpcForUser(user.id,'remove_luke_participant',{p_calendar_id:calendar.id,p_user_id:p.id});if(error) throw error;
      if(selected===p.id) setSelected(null);await refresh();store.toast(`Tilgangen til ${p.name} er fjernet.`);
    } catch(error){setFailure(authMessage(error));}finally{setRemoving(null);}
  }
  return <section className="calendar-participants">
    <button type="button" className="button secondary participants-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><Icon name="user" size={18}/><strong>Personer med kalenderen</strong><span>{people.length}</span><Icon name="chevron" size={16}/></button>
    {expanded && <div className="participants-content">
      {(failure || error) && <p className="form-error" role="alert">{failure || error}<button className="text-link" type="button" onClick={()=>void refresh()}>Prøv igjen</button></p>}
      {!data && !error ? <p role="status">Henter mottakere …</p> : !people.length ? <p className="field-help">Mottakerne vises her når de har lagt kalenderen til på kontoen sin.</p> : <>
        <PersonFilters people={people} value={activeFilter} onChange={setFilter} label="Velg mottaker" total={people.length}/>
        <ul className="participant-list">
          {people.filter(p=>activeFilter==="all" || p.id===activeFilter).map(p=><li key={p.id}>
            <header className="participant-card-heading"><div><strong>{p.name}</strong>{p.email && <span className="participant-email">{p.email}</span>}</div>
              <button className="icon-button" aria-label={`Fjern tilgangen til ${p.name}`} title="Fjern tilgang" disabled={removing!==null} type="button" onClick={()=>void remove(p)}><Icon name="trash" size={16}/></button>
            </header>
            <p className="participant-progress">{p.openedCount} av 24 luker åpnet</p>
            <button className="button secondary small-button" type="button" onClick={()=>setSelected(p.id)}><Icon name="calendar" size={15}/>Se oversikt</button>
          </li>)}
        </ul>
      </>}
    </div>}
    {person && data && <CalendarOverview calendar={calendar} opened={person.opened} available={data.available} summary={person.summary} onClose={()=>setSelected(null)} onOpenDoor={day=>{setSelected(null);onOpenDoor(day);}} leaderboard={<QuizLeaderboard people={people}/>} controls={<label className="participant-select">Mottaker<select value={person.id} onChange={event=>setSelected(event.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}/>}
  </section>;
}
