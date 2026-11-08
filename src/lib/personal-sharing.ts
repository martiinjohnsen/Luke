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

export type SharingKind = 'person' | 'group';
export type CalendarInvitation = { email: string; createdAt: string; kinds: SharingKind[]; accepted: boolean; hasAccess: boolean };
export function invitationEmails(value: string, kind: SharingKind): string[] {
  const raw = value.trim().split(/[\s,;]+/).filter(Boolean);
  if (!raw.length || raw.length > 50) throw new Error("Skriv mellom 1 og 50 e-postadresser.");
  const addresses = raw.map(address => recipientEmail(address));
  if (addresses.some(address => !address)) throw new Error("Skriv gyldige e-postadresser, uten navn eller annen tekst.");
  const unique = [...new Set(addresses as string[])].sort();
  if (kind === 'person' && unique.length !== 1) throw new Error("Skriv én e-postadresse for enkeltperson.");
  if (kind === 'group' && unique.length < 2) throw new Error("Legg til minst to ulike e-postadresser i gruppen.");
  return unique;
}
export function groupEmailInvitation({emails,title,message,sender,link}:{emails:readonly string[];title:string;message:string;sender:string;link:string}) {
  const recipients = invitationEmails(emails.join('\n'), 'group');
  const subject = `En julekalender til deg: ${title.replace(/[\r\n]/g," ").slice(0,100)}`;
  const text = [message.trim() || "Jeg har laget en julekalender til deg!", link, "Åpne kalenderen med Google-kontoen som denne e-posten er sendt til.", sender.trim() ? `Hilsen ${sender.trim()}` : ""].filter(Boolean).join('\n\n');
  // One restricted group link, with Bcc so recipients do not see each other's email.
  return {text, href:`mailto:?bcc=${encodeURIComponent(recipients.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\r?\n/g,'\r\n'))}`};
}
