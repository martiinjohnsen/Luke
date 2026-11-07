"use client";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { previewGlassFeedback } from "@/lib/glass-motion";
import { useGlass } from "./glass-provider";
import { Icon } from "./icons";
export function GlassSettings() {
  const glass = useGlass();
  const id = useId();
  const demo=useRef<HTMLDivElement>(null),changed=useRef(false),frame=useRef(0);
  const demonstrate=()=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{if(demo.current) previewGlassFeedback(demo.current);});};
  const finish=()=>{glass.flush();if(changed.current) {changed.current=false;demonstrate();}};
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  return (
    <section className="settings-card glass-settings" aria-labelledby={`${id}-title`}>
      <div className="settings-card-heading"><span className="soft-icon"><Icon name="sparkles" size={24} /></span><div><h2 id={`${id}-title`}>Knapputseende</h2><p>Velg hvor gjennomsiktige knappene og mobilmenyen skal være.</p></div></div>
      <div ref={demo} className="glass-demo" role="group" aria-label="Prøv knappenes utseende og trykkrespons"><button type="button" className="button primary">Prøv handlingsknapp <Icon name="check" size={16} /></button><button type="button" className="glass-choice" aria-pressed="true">Prøv valgt fane</button></div>
      <label className="glass-slider-label" htmlFor={id}>Gjennomsiktighet</label>
      <div className="glass-range" style={{ "--range-value": `${glass.level}%` } as CSSProperties}>
        <input id={id} className="glass-slider" type="range" min="0" max="100" step="1" value={glass.level} disabled={!glass.ready} onChange={event=>{changed.current=true;glass.setLevel(Number(event.target.value));}} onPointerUp={finish} onPointerCancel={finish} onKeyUp={finish} onBlur={finish} />
      </div>
      <div className="glass-slider-ends"><span>Mer gjennomsiktig</span><span>Mer dekkende</span></div>
      {glass.error && <div className="form-error" role="alert">{glass.error} <button type="button" className="text-link" onClick={glass.retry}>Prøv igjen</button></div>}
    </section>
  );
}
