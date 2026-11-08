"use client";
import type { AdventCalendar, AppData } from "../model";
import {doorPayloads,mapDoorPayloads} from "../model";
import { MEDIA_BUCKET, MAX_MEDIA_BYTES, mediaBelongsTo, mediaPath, mediaReference, type MediaScope } from "../media-reference";
import { clientForUser } from "./client";
import { needsMediaMigration } from "../media-workspace";
export { needsMediaMigration } from "../media-workspace";
export type MediaContext = { userId: string; calendarId: string; day: number; scope: MediaScope };
export function normalizedMediaType(type: string): string {
  const mime = type.toLowerCase().split(";")[0].trim();
  return ({ "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/x-wav": "audio/wav", "audio/mp3": "audio/mpeg" } as Record<string,string>)[mime] ?? mime;
}
export async function uploadMedia(blob: Blob, context: MediaContext): Promise<string> {
  const mime = normalizedMediaType(blob.type);
  if (!/^(image\/(jpeg|png|webp)|audio\/(mp4|webm|ogg|mpeg|wav))$/.test(mime))
    throw new Error("Velg JPG, PNG, WebP eller en lydfil i MP3-, M4A-, WebM-, Ogg- eller WAV-format.");
  if (!blob.size || blob.size > MAX_MEDIA_BYTES) throw new Error("Filen må være mellom 1 byte og 8 MB.");
  const bytes = await blob.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2,"0")).join("");
  const client = await clientForUser(context.userId);
  const { data: path, error: reservation } = await client.rpc("reserve_luke_media", {
    p_calendar_id: context.calendarId, p_day: context.day, p_scope: context.scope,
    p_mime: mime, p_bytes: blob.size, p_hash: hash,
  });
  if (reservation) throw reservation;
  const source = mediaReference(path);
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path,blob,{contentType:mime,upsert:false,cacheControl:"300"});
  if (error && String(error.statusCode) !== "409" && !/already exists|duplicate/i.test(error.message)) throw error;
  const {error:finished}=await client.rpc("finish_luke_media",{p_path:path});
  if(finished) throw finished;
  return source;
}
export async function downloadMedia(source: string, userId: string): Promise<Blob> {
  const path = mediaPath(source);
  if (!path) {
    if (!/^data:(image|audio)\//.test(source)) throw new Error("Ugyldig mediefil.");
    const response = await fetch(source);
    return response.blob();
  }
  const client = await clientForUser(userId);
  const { data, error } = await client.storage.from(MEDIA_BUCKET).download(path);
  if (error) throw error;
  return data;
}
export async function prepareWorkspaceMedia(data: AppData, userId: string, versions: Record<string,number>, ids: Set<string>): Promise<AppData> {
  const calendars: AdventCalendar[] = [];
  for (const calendar of data.calendars) {
    if (!ids.has(calendar.id) || !versions[calendar.id] || !needsMediaMigration(calendar)) { calendars.push(calendar); continue; }
    const doors = [];
    for (const door of calendar.doors) {
      const next = mapDoorPayloads(door,payload=>({...payload}));
      for(const payload of doorPayloads(next)) for (const kind of ["image","audio"] as const) {
        const source = payload[kind];
        if (source && !mediaBelongsTo(source,calendar.id,door.day,"door"))
          payload[kind] = await uploadMedia(await downloadMedia(source,userId), { userId,calendarId:calendar.id,day:door.day,scope:"door" });
      }
      doors.push(next);
    }
    calendars.push({ ...calendar, doors });
  }
  return { ...data, calendars };
}
export async function portableMediaCopy<T>(value: T, userId: string): Promise<T> {
  const cache = new Map<string,Promise<string>>();
  async function visit(item: unknown): Promise<unknown> {
    if (typeof item === "string" && mediaPath(item)) {
      if (!cache.has(item)) cache.set(item,downloadMedia(item,userId).then(blob => new Promise<string>((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      })));
      return cache.get(item);
    }
    if (Array.isArray(item)) { const result=[]; for(const child of item) result.push(await visit(child)); return result; }
    if (item && typeof item === "object") {
      const result: Record<string,unknown> = {};
      for(const [key,child] of Object.entries(item)) result[key]=await visit(child);
      return result;
    }
    return item;
  }
  return await visit(value) as T;
}
const lastCleanup=new Map<string,number>();
const cleanupRunning=new Map<string,Promise<void>>();
export async function cleanUnusedMedia(userId:string):Promise<void> {
  if(cleanupRunning.has(userId)) return cleanupRunning.get(userId);
  if(Date.now()-(lastCleanup.get(userId) ?? 0)<3600000) return;
  const task=(async()=>{
  const client=await clientForUser(userId);
  const {data,error}=await client.rpc("luke_unused_media");
  if(error) throw error;
  if(Array.isArray(data) && data.length) {
    const {error:removed}=await client.storage.from(MEDIA_BUCKET).remove(data);
    if(removed) throw removed;
    const {error:finished}=await client.rpc("finish_luke_cleanup",{p_paths:data});
    if(finished) throw finished;
  }
  lastCleanup.set(userId,Date.now());
  })().finally(()=>cleanupRunning.delete(userId));
  cleanupRunning.set(userId,task);
  return task;
}
