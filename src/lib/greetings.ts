export type PreviewGreeting = {mode:"test"|"date";save:boolean};
export type GreetingDraft = {body:string;image:string|null;audio:string|null};
export type Greeting = GreetingDraft & {calendarId:string;userId:string;day:number;name:string;revision:number;seenRevision:number;updatedAt:string;owner:boolean;previewMode?:PreviewGreeting["mode"];temporary?:boolean};

export function sameGreeting(item:Greeting,id:string,day:number,userId:string,mode?:PreviewGreeting["mode"]) {
  return item.calendarId===id && item.day===day && item.userId===userId && item.previewMode===mode;
}
export function greetingsForCalendar(items:Greeting[],calendarId:string):Greeting[] {
  return items.filter(item=>item.calendarId===calendarId && item.owner && item.revision>0)
    .sort((a,b)=>a.day-b.day || a.name.localeCompare(b.name,"nb") || b.updatedAt.localeCompare(a.updatedAt));
}
/** Temporary trials stay in the current app session and never become real replies. */
export function temporaryGreeting(items:Greeting[],id:string,day:number,userId:string,mode:PreviewGreeting["mode"],draft?:GreetingDraft,revision=0):Greeting[] {
  const existing=items.find(item=>sameGreeting(item,id,day,userId,mode));
  if(!draft && existing) return items;
  if(draft && (existing?.revision ?? 0)!==revision) throw new Error("Prøvehilsenen er endret. Åpne den på nytt.");
  const body=draft?.body.trim() ?? "";
  if(draft && (body.length>3000 || (!body && !draft.image && !draft.audio))) throw new Error("Skriv en hilsen, eller legg til bilde eller lyd.");
  const changed=!!draft && (!existing || body!==existing.body || draft.image!==existing.image || draft.audio!==existing.audio);
  const item:Greeting={calendarId:id,day,userId,name:"Deg",body,image:draft?.image ?? null,audio:draft?.audio ?? null,
    revision:(existing?.revision ?? 0)+(changed ? 1 : 0),seenRevision:existing?.seenRevision ?? 0,
    updatedAt:changed || !existing ? new Date().toISOString() : existing.updatedAt,owner:true,previewMode:mode,temporary:true};
  return [item,...items.filter(item=>!sameGreeting(item,id,day,userId,mode))];
}
