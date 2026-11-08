"use client";
import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { MEDIA_BUCKET, mediaPath } from "@/lib/media-reference";
import { clientForUser, authMessage } from "@/lib/cloud/client";
import { useAccount } from "./account-provider";
import { AudioControls } from "./audio-controls";
function useMedia(source: string) {
  const { user } = useAccount();
  const [state,setState] = useState({ source:"", userId:"", url:"", error:"" });
  const path=mediaPath(source);
  useEffect(() => {
    if (!path || !user) return;
    let active=true;
    const userId=user.id;
    async function refresh() {
      try {
        const client=await clientForUser(userId);
        const { data,error }=await client.storage.from(MEDIA_BUCKET).createSignedUrl(path!,300);
        if(error) throw error;
        if(active) setState({source,userId,url:data.signedUrl,error:""});
      } catch(error) { if(active) setState({source,userId,url:"",error:authMessage(error)}); }
    }
    void refresh();
    const timer=setInterval(() => { if(document.visibilityState === "visible") void refresh(); },240000);
    const resume=() => { if(document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("online",resume);
    return () => { active=false; clearInterval(timer); document.removeEventListener("visibilitychange",resume); window.removeEventListener("online",resume); };
  },[path,source,user?.id]);
  if(!path) return {url:source,error:""};
  return state.source === source && state.userId === user?.id ? state : {url:"",error:""};
}
export function MediaImage({src,alt,...props}: Omit<ImgHTMLAttributes<HTMLImageElement>,"src"> & {src:string;alt:string}) {
  const media=useMedia(src);
  return media.url ? <img {...props} src={media.url} alt={alt} /> : <p className="media-placeholder" role="status">{media.error || "Henter bildet …"}</p>;
}
export function AudioPlayer({src,label="Lydhilsen",compact=false}:{src:string;label?:string;compact?:boolean}) {
  const media=useMedia(src);
  return <div className={`audio-player${compact ? " is-compact" : ""}`}>{!compact && <span>{label}</span>}{media.url ? <AudioControls key={media.url} url={media.url} label={label}/> : <p className="media-placeholder" role="status">{media.error || "Henter lydhilsenen …"}</p>}</div>;
}
