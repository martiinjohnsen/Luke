export function audioTime(value:number):string {
  const seconds=Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
}
export function audioPosition(value:number,duration:number):number {
  if(!Number.isFinite(value) || !Number.isFinite(duration) || duration<=0) return 0;
  return Math.max(0,Math.min(duration,value));
}
export function audioDuration(media:Pick<HTMLMediaElement,"duration"|"currentTime"|"ended"|"seekable">):number {
  if(Number.isFinite(media.duration) && media.duration>0) return media.duration;
  // Some recordings do not expose a finite duration until they become seekable
  // or finish playing. Playback remains available while metadata catches up.
  if(media.ended && Number.isFinite(media.currentTime) && media.currentTime>0) return media.currentTime;
  if(media.seekable.length) {
    const end=media.seekable.end(media.seekable.length-1);
    if(Number.isFinite(end) && end>0) return end;
  }
  return 0;
}
