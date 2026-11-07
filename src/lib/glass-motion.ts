import { glassLevel } from "./glass.ts";
export function glassMotion(value:number,mobile=false) {
  const strength=1-glassLevel(value)/100;
  return {strength,pressX:1-(mobile ? .07 : .05)*strength,pressY:1-(mobile ? .18 : .14)*strength,
    popX:1+(mobile ? .075 : .055)*strength,popY:1+(mobile ? .15 : .10)*strength,duration:180+(mobile ? 430 : 350)*strength};
}
export function previewGlassFeedback(root:HTMLElement) {
  document.dispatchEvent(new CustomEvent("luke:preview-glass",{detail:root}));
}
/** One shared response for pointer, keyboard and assistive-technology activation. */
export function installGlassFeedback(readLevel:()=>number):()=>void {
  const selector='button:not(:disabled):not(.block-grip),a.button,.bottom-nav > a,.nav-item,.avatar,.glass-choice,.scene-toggle,summary,label.button';
  let held:{element:HTMLElement;pointer:number|null;mobile:boolean;animation:Animation|null}|null=null;
  let lastRelease=-Infinity;
  const running=new Map<HTMLElement,Animation>();
  function animate(element:HTMLElement,frames:Keyframe[],duration:number) {
    running.get(element)?.cancel();
    const animation=element.animate(frames,{duration,easing:"cubic-bezier(.22,.7,.3,1)",fill:"forwards"});
    running.set(element,animation);return animation;
  }
  const target=(event:Event)=>event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
  const surface=(element:HTMLElement)=>element.matches(".recipient-door") ? element.closest<HTMLElement>(".recipient-door-cell") ?? element : element;
  const reduced=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse=()=>window.matchMedia("(pointer: coarse)").matches;
  function begin(event:PointerEvent|KeyboardEvent,pointer:number|null) {
    const mobile=coarse() || ("pointerType" in event && event.pointerType==="touch");
    const control=target(event),motion=glassMotion(readLevel(),mobile);
    if(!control || reduced() || !motion.strength || control.getAttribute("aria-disabled")==="true") return;
    const element=surface(control);if(typeof element.animate!=="function") return;
    cancel();running.get(element)?.cancel();
    held={element,pointer,mobile,animation:animate(element,[{scale:"1 1"},{scale:`${motion.pressX} ${motion.pressY}`}],125)};
  }
  function pop(element:HTMLElement,mobile=coarse()) {
    if(!element.isConnected || typeof element.animate!=="function" || reduced()) {running.get(element)?.cancel();running.delete(element);return;}
    const motion=glassMotion(readLevel(),mobile);if(!motion.strength) return;
    const current=getComputedStyle(element).scale;
    const animation=animate(element,[{scale:current==="none" ? "1 1" : current},{scale:`${motion.popX} ${motion.popY}`,offset:.35},{scale:`${1-.015*motion.strength} ${1-.03*motion.strength}`,offset:.62},{scale:`${1+.008*motion.strength} ${1+.015*motion.strength}`,offset:.81},{scale:"1 1"}],motion.duration);
    animation.onfinish=()=>{animation.cancel();if(running.get(element)===animation) running.delete(element);};
  }
  function cancel(){if(held){held.animation?.cancel();running.delete(held.element);held=null;}}
  const down=(event:PointerEvent)=>{if(event.button===0) begin(event,event.pointerId);};
  const up=(event:PointerEvent)=>{if(held?.pointer===event.pointerId){const {element,mobile}=held;held=null;lastRelease=performance.now();pop(element,mobile);}};
  const keyDown=(event:KeyboardEvent)=>{if(!event.repeat && (event.key==="Enter" || event.key===" ") && target(event)===document.activeElement) begin(event,null);};
  const keyUp=(event:KeyboardEvent)=>{if(held?.pointer===null && (event.key==="Enter" || event.key===" ")){const {element,mobile}=held;held=null;lastRelease=performance.now();pop(element,mobile);}};
  const click=(event:MouseEvent)=>{if(event.detail===0 && !held && performance.now()-lastRelease>90){const element=target(event);if(element) pop(surface(element));}};
  const demonstrate=(event:Event)=>{
    const root=(event as CustomEvent<HTMLElement>).detail;
    if(!(root instanceof HTMLElement) || !root.isConnected || reduced()) return;
    const motion=glassMotion(readLevel(),coarse());
    for(const element of root.querySelectorAll<HTMLElement>("button:not(:disabled)")) {
      if(typeof element.animate!=="function") continue;
      const animation=animate(element,[{scale:"1 1",translate:"0 0"},{scale:`${motion.pressX} ${motion.pressY}`,translate:"0 1px",offset:.2},
        {scale:`${motion.popX} ${motion.popY}`,translate:"0 0",offset:.48},{scale:`${1-.015*motion.strength} ${1-.03*motion.strength}`,offset:.7},
        {scale:`${1+.008*motion.strength} ${1+.015*motion.strength}`,offset:.85},{scale:"1 1",translate:"0 0"}],motion.duration+125);
      animation.onfinish=()=>{animation.cancel();if(running.get(element)===animation) running.delete(element);};
    }
  };
  document.addEventListener("pointerdown",down,true);document.addEventListener("pointerup",up,true);document.addEventListener("pointercancel",cancel,true);
  document.addEventListener("luke:preview-glass",demonstrate);
  document.addEventListener("keydown",keyDown,true);document.addEventListener("keyup",keyUp,true);document.addEventListener("click",click,true);window.addEventListener("blur",cancel);
  return ()=>{cancel();for(const animation of running.values()) animation.cancel();running.clear();document.removeEventListener("luke:preview-glass",demonstrate);document.removeEventListener("pointerdown",down,true);document.removeEventListener("pointerup",up,true);document.removeEventListener("pointercancel",cancel,true);document.removeEventListener("keydown",keyDown,true);document.removeEventListener("keyup",keyUp,true);document.removeEventListener("click",click,true);window.removeEventListener("blur",cancel);};
}
