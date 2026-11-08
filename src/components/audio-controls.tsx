"use client";
import { useRef, useState, type CSSProperties } from "react";
import { audioDuration, audioPosition, audioTime } from "@/lib/audio-playback";

export function AudioControls({url,label}:{url:string;label:string}) {
  const ref=useRef<HTMLAudioElement>(null);
  const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(false);
  const [current,setCurrent]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState("");
  const request=useRef(0);
  function update() {
    const audio=ref.current;if(!audio) return;
    const total=audioDuration(audio);
    setDuration(previous=>total || previous);
    setCurrent(Number.isFinite(audio.currentTime) ? Math.max(0,audio.currentTime) : 0);
  }
  async function toggle() {
    const audio=ref.current;if(!audio) return;
    const ticket=++request.current;
    setError("");
    if(!audio.paused) {audio.pause();return;}
    try {
      if(audio.ended) audio.currentTime=0;
      if(audio.error) audio.load();
      await audio.play();
    } catch {
      if(ref.current===audio && ticket===request.current) setError("Kunne ikke spille av lyden. Trykk på avspillingsknappen for å prøve igjen.");
    }
  }
  const position=audioPosition(current,duration);
  return <>
    <div className="audio-controls" role="group" aria-label={label}>
      <audio ref={ref} className="audio-element" src={url} preload="metadata"
        onLoadedMetadata={update} onDurationChange={update} onTimeUpdate={update}
        onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
        onEnded={()=>{setPlaying(false);update();}}
        onEmptied={()=>{setPlaying(false);setCurrent(0);setDuration(0);}}
        onVolumeChange={()=>{const audio=ref.current;if(audio) setMuted(audio.muted || audio.volume===0);}}
        onError={()=>{setPlaying(false);setError("Lyden kunne ikke lastes. Trykk på avspillingsknappen for å prøve igjen.");}}/>
      <button type="button" className="audio-control-button" onClick={()=>void toggle()} aria-label={playing ? `Sett ${label} på pause` : `Spill av ${label}`} aria-pressed={playing}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></> : <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z"/>}</svg>
      </button>
      <output className="audio-time" aria-live="off">{audioTime(current)} / {duration ? audioTime(duration) : "–:––"}</output>
      <input className="audio-timeline" type="range" min="0" max={duration || 1} step="0.1" value={position} disabled={!duration}
        aria-label={`Spol i ${label}`} aria-valuetext={`${audioTime(position)} av ${audioTime(duration)}`}
        style={{"--audio-position":`${duration ? position/duration*100 : 0}%`} as CSSProperties}
        onChange={event=>{const audio=ref.current;if(!audio) return;try{const next=audioPosition(Number(event.target.value),duration);audio.currentTime=next;setCurrent(next);}catch{setError("Kunne ikke spole i lyden ennå. Prøv igjen om litt.");}}}/>
      <button type="button" className="audio-control-button" aria-label={muted ? "Slå på lyd" : "Demp lyd"} aria-pressed={muted} onClick={()=>{const audio=ref.current;if(audio) {audio.muted=!muted;if(!audio.muted && audio.volume===0) audio.volume=1;}}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Z"/>{muted ? <path d="m16 9 6 6m0-6-6 6"/> : <><path d="M15 8a6 6 0 0 1 0 8"/><path d="M18 5a10 10 0 0 1 0 14"/></>}</svg>
      </button>
    </div>
    {error && <p className="media-placeholder audio-error" role="alert">{error}</p>}
  </>;
}
