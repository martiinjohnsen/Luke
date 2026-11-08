import type { Door } from "./model.ts";
/** One stable shuffle per calendar, shared by previews, devices and recipients. */
export function shuffledDoors(doors:readonly Door[],calendarId:string):Door[] {
  let seed=2166136261;
  for(let i=0;i<calendarId.length;i++) seed=Math.imul(seed^calendarId.charCodeAt(i),16777619);
  const result=[...doors].sort((a,b)=>a.day-b.day);
  for(let i=result.length-1;i>0;i--) {
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const j=(seed>>>0)%(i+1);[result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
