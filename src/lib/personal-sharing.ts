export function recipientEmail(value:string):string|null {
  const address=value.trim().toLowerCase();
  return address.length<=254 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(address.split("@")[1] ?? "") && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(address) ? address : null;
}
export function emailInvitation({email,title,message,sender,link}:{email:string;title:string;message:string;sender:string;link:string}) {
  const to=recipientEmail(email);
  if(!to) throw new Error("Skriv én gyldig e-postadresse.");
  const separator=to.indexOf("@");
  const target=`${encodeURIComponent(to.slice(0,separator))}@${to.slice(separator+1)}`;
  const subject=`En julekalender til deg: ${title.replace(/[\r\n]/g," ").slice(0,100)}`;
  const text=[message.trim() || "Jeg har laget en julekalender til deg!",link,`Åpne kalenderen med Google-kontoen ${to}.`,sender.trim() ? `Hilsen ${sender.trim()}` : ""].filter(Boolean).join("\n\n");
  return {email:to,text,href:`mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\r?\n/g,"\r\n"))}`};
}
