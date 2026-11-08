import type { AdventCalendar, AppData } from "./model.ts";
import {doorPayloads,mapDoorPayloads} from "./model.ts";
import { mediaBelongsTo } from "./media-reference.ts";
export function needsMediaMigration(calendar: AdventCalendar): boolean {
  return calendar.access !== "received" && calendar.doors.some(door =>
    doorPayloads(door).some(payload=>[payload.image,payload.audio].some(value => !!value && !mediaBelongsTo(value,calendar.id,door.day,"door"))));
}
/** Create the calendar before uploading its attachments, without sending large inline files. */
export function stageNewMedia(data:AppData,versions:Record<string,number>,ids:Set<string>) {
  const pending=new Set<string>();
  return {pending,data:{...data,calendars:data.calendars.map(calendar=>{
    if(!ids.has(calendar.id) || versions[calendar.id] || !needsMediaMigration(calendar)) return calendar;
    pending.add(calendar.id);
    return {...calendar,doors:calendar.doors.map(door=>mapDoorPayloads(door,payload=>({...payload,...(payload.image ? {image:""} : {}),...(payload.audio ? {audio:""} : {})})))};
  })}};
}
export function restoreStagedMedia(server:AppData,current:AppData,pending:Set<string>):AppData {
  return {...server,calendars:server.calendars.map(calendar=>pending.has(calendar.id)
    ? current.calendars.find(local=>local.id===calendar.id) ?? calendar : calendar)};
}
