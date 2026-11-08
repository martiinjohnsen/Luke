import { correctChoices, doorBlockOrder, blockDoor, blockKind, safeLink, youtubeId, type Door, type DoorBlockId } from "./model.ts";
import { isAudioSource } from "./media-reference.ts";

export const ISSUE_SCOPE=Symbol("validation scope");
export type DoorIssues = Record<string, string> & {[ISSUE_SCOPE]?:string};
export function issuesForBlock(issues:DoorIssues,id:DoorBlockId):DoorIssues {
  const prefix=id.includes(":") ? `${id}/` : "";
  return {...Object.fromEntries(Object.entries(issues).filter(([key])=>prefix ? key.startsWith(prefix) : !key.includes("/")).map(([key,value])=>[prefix ? key.slice(prefix.length) : key,value])),[ISSUE_SCOPE]:`${id}-`};
}

export function validateDoor(door: Door): DoorIssues {
  const ids=doorBlockOrder(door),base={...door,extra:undefined,contentOrder:ids.filter(id=>!id.includes(":"))};
  const issues=validateSingleDoor(base);
  if(ids.some(id=>id.includes(":"))) delete issues.body;
  for(const id of ids.filter(id=>id.includes(":"))) {
    const child=validateSingleDoor({...blockDoor(door,id),extra:undefined,contentOrder:[blockKind(id)]});
    for(const [key,value] of Object.entries(child)) issues[`${id}/${key}`]=value;
  }
  return issues;
}
function validateSingleDoor(door:Door):DoorIssues {
  const issues: DoorIssues = {};
  const blocks = doorBlockOrder(door).filter((block) => block !== "effect");
  if (!door.body.trim() && !blocks.length)
    issues.body = "Skriv en hilsen eller legg til innhold i luka.";
  for (const block of blocks) {
    switch (block) {
      case "image":
        if (!door.image) issues.image = "Velg et bilde, eller fjern bildeboksen.";
        break;
      case "audio":
        if (!door.audio || !isAudioSource(door.audio)) issues.audio = "Spill inn eller velg en lydhilsen, eller fjern lydboksen.";
        break;
      case "video":
        if (!youtubeId(door.videoUrl?.trim() ?? ""))
          issues.video = "Legg inn en gyldig HTTPS-lenke til en YouTube-video.";
        break;
      case "link":
        if (!safeLink(door.link?.url.trim() ?? ""))
          issues["link-url"] = "Legg inn en gyldig nettadresse som begynner med https://.";
        break;
      case "activity":
        if (!door.activity?.title.trim()) issues["activity-title"] = "Gi opplevelsen et navn.";
        if (!door.activity?.body.trim()) issues["activity-body"] = "Beskriv hva opplevelsen går ut på.";
        break;
      case "giftcard": {
        const gift = door.giftCard;
        if (!gift?.merchant.trim()) issues["gift-merchant"] = "Skriv hvilken butikk eller tjeneste gavekortet gjelder.";
        if (!gift || !Number.isFinite(gift.amount) || gift.amount <= 0 || gift.amount > 1000000)
          issues["gift-amount"] = "Skriv et beløp fra 0,01 til 1 000 000 kroner.";
        if (!gift?.code.trim() && !gift?.url.trim())
          issues["gift-code"] = "Legg inn en gavekortkode eller en innløsningslenke.";
        if (gift?.url.trim() && !safeLink(gift.url.trim()))
          issues["gift-url"] = "Innløsningslenken må begynne med https:// og være en gyldig nettadresse.";
        if (gift?.expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(gift.expiresOn) ||
          !Number.isFinite(Date.parse(gift.expiresOn)) ||
          new Date(gift.expiresOn).toISOString().slice(0, 10) !== gift.expiresOn))
          issues["gift-expiry"] = "Velg en gyldig utløpsdato, eller la feltet stå tomt.";
        break;
      }
      case "quiz":
        if (!door.questions?.length) issues.quiz = "Legg til minst ett spørsmål, eller fjern quizboksen.";
        door.questions?.forEach((question, index) => {
          const key = `quiz-${index}`;
          if (!question.title.trim()) issues[`${key}-title`] = "Skriv spørsmålet.";
          if (question.type === "text") {
            if (!question.acceptedAnswers?.length || question.acceptedAnswers.some((answer) => !answer.trim()))
              issues[`${key}-answers`] = "Skriv minst ett godkjent svar. Fjern eventuelle tomme linjer.";
          } else {
            if (question.options.length < 2) issues[`${key}-correct`] = "Legg til minst to svaralternativer.";
            question.options.forEach((option, optionIndex) => {
              if (!option.trim()) issues[`${key}-option-${optionIndex}`] = "Fyll ut svaralternativet eller fjern det.";
            });
            const correct = correctChoices(question);
            if (!correct.length || correct.some((answer) => !Number.isInteger(answer) || answer < 0 || answer >= question.options.length))
              issues[`${key}-correct`] = "Merk minst ett riktig svaralternativ.";
          }
        });
        break;
    }
  }
  return issues;
}
