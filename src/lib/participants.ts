import type { quizSummary } from './quiz-progress.ts';
export type Participant={id:string;name:string;email?:string;self:boolean;joinedAt:string;openedCount:number;opened:number[];summary:ReturnType<typeof quizSummary>};
export type Participants={owner:boolean;available:number;participants:Participant[]};
/** Equal scores share a position. Answer speed and participation never break a tie. */
export function leaderboard(people:readonly Participant[]) {
  const sorted=people.slice().sort((a,b)=>b.summary.correct-a.summary.correct || a.name.localeCompare(b.name,'nb') || a.id.localeCompare(b.id));
  let rank=0,last=-1;
  return sorted.map((person,index)=>{if(person.summary.correct!==last) rank=index+1;last=person.summary.correct;return {person,rank};});
}
