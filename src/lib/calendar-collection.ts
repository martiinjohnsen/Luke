import {
  doorBlockOrder,
  blockDoor,blockKind,
  safeLink,
  youtubeId,
  type AdventCalendar,
  type GiftCard,
} from "./model.ts";

type Content =
  | { kind: "message"; body: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "audio"; src: string }
  | { kind: "giftcard"; gift: GiftCard }
  | { kind: "video"; url: string; title: string }
  | { kind: "link"; url: string; label: string }
  | { kind: "activity"; title: string; body: string };

export type CollectedItem = Content & { id: string; day: number };
export type CollectedKind = CollectedItem["kind"];

export function calendarCollection(
  calendar: AdventCalendar,
  opened: readonly number[],
  available: number,
): CollectedItem[] {
  const openedDays = new Set(opened);
  const items: CollectedItem[] = [];
  const doors = calendar.doors
    .filter((door) => openedDays.has(door.day) && door.day <= available)
    .sort((a, b) => b.day - a.day);

  for (const root of doors) {
    let slot="message";
    function add(content: Content) {
      items.push({ ...content, day: root.day, id: `${root.day}-${slot}` });
    }
    if (root.body.trim()) add({ kind: "message", body: root.body });
    for (const id of doorBlockOrder(root)) {
      const door=blockDoor(root,id),block=blockKind(id);slot=id;
      switch (block) {
        case "image":
          if (door.image)
            add({ kind: "image", src: door.image, alt: door.imageAlt || door.title || "Et bilde i kalenderen" });
          break;
        case "giftcard":
          if (door.giftCard && (door.giftCard.merchant.trim() || door.giftCard.code.trim() || safeLink(door.giftCard.url)))
            add({ kind: "giftcard", gift: door.giftCard });
          break;
        case "audio":
          if (door.audio) add({kind:"audio",src:door.audio});
          break;
        case "video":
          if (door.videoUrl && youtubeId(door.videoUrl))
            add({ kind: "video", url: door.videoUrl, title: door.title || `Video fra ${door.day}. desember` });
          break;
        case "link": {
          const url = door.link && safeLink(door.link.url);
          if (url) add({ kind: "link", url, label: door.link!.label || "Åpne lenken" });
          break;
        }
        case "activity":
          if (door.activity && (door.activity.title.trim() || door.activity.body.trim()))
            add({ kind: "activity", title: door.activity.title, body: door.activity.body });
          break;
      }
    }
  }
  return items;
}
