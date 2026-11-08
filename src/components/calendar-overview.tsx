"use client";
import { useState, type ReactNode } from "react";
import type { AdventCalendar } from "@/lib/model";
import {
  calendarCollection,
  type CollectedItem,
} from "@/lib/calendar-collection";
import type { quizSummary } from "@/lib/quiz-progress";
import { Dialog } from "./dialog";
import { GiftCardView } from "./door-content";
import { MediaImage, AudioPlayer } from "./media";
import { Icon } from "./icons";
import { QuizOverview } from "./quiz-overview";

type Keepsake = Exclude<CollectedItem, { kind: "message" | "activity" }>;
type KeepsakeFilter = "all" | "giftcard" | "image" | "audio" | "link";
const contentLabels = {
  giftcard: { label: "Gavekort", icon: "gift" },
  image: { label: "Bilder", icon: "image" },
  audio: { label: "Lydhilsener", icon: "mic" },
  link: { label: "Lenker", icon: "external" },
} as const;
const category = (item: Keepsake) => item.kind === "video" ? "link" : item.kind;

export function CalendarOverview({
  calendar, opened, available, summary, onClose, onOpenDoor, leaderboard,
}: {
  leaderboard?:ReactNode;
  calendar: AdventCalendar;
  opened: readonly number[];
  available: number;
  summary: ReturnType<typeof quizSummary>;
  onClose: () => void;
  onOpenDoor: (day: number) => void;
}) {
  const [section, setSection] = useState<"content" | "quiz">("content");
  const [filter, setFilter] = useState<KeepsakeFilter>("all");
  const items = calendarCollection(calendar, opened, available).filter(
    (item): item is Keepsake => item.kind !== "message" && item.kind !== "activity",
  );
  const kinds = Object.keys(contentLabels) as Exclude<KeepsakeFilter, "all">[];
  return (
    <Dialog title="Kalenderoversikt" onClose={onClose} wide>
      <div className="calendar-overview">
        <p className="overview-intro">Gavekort, bilder, lydhilsener og lenker fra lukene du har åpnet, samlet på ett sted.</p>
        <div className="overview-sections" role="group" aria-label="Velg oversikt">
          <button type="button" aria-pressed={section === "content"} onClick={() => setSection("content")}>
            <Icon name="gift" size={17} />Innhold <span>{items.length}</span>
          </button>
          <button type="button" aria-pressed={section === "quiz"} onClick={() => setSection("quiz")}>
            <Icon name="quiz" size={17} />Quizoversikt
          </button>
        </div>
        {section === "quiz" ? (
          <section aria-label="Quizoversikt">
            {leaderboard}
            {summary.total > 0 ? (
              <QuizOverview summary={summary} />
            ) : (
              <div className="overview-empty"><Icon name="quiz" size={28} /><h3>Ingen quiz i denne kalenderen ennå</h3><p>Hvis avsender legger til spørsmål, finner du framdrift og resultater her.</p></div>
            )}
          </section>
        ) : (
          <section aria-label="Innhold fra åpnede luker">
            {items.length > 0 ? (
              <>
                <div className="collection-filters" role="group" aria-label="Vis innholdstype">
                  <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Alt</button>
                  {kinds.filter((kind) => items.some((item) => category(item) === kind)).map((kind) => (
                    <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{contentLabels[kind].label}</button>
                  ))}
                </div>
                <div className="collection-grid">
                  {items.filter((item) => filter === "all" || category(item) === filter).map((item) => (
                    <article className={`collection-item collection-${item.kind}`} key={item.id}>
                      <header>
                        <span title={contentLabels[category(item)].label}><Icon name={contentLabels[category(item)].icon} size={15} /></span>
                        <button type="button" onClick={() => onOpenDoor(item.day)} aria-label={`Åpne luka fra ${item.day}. desember`}>{item.day}. desember<Icon name="arrow" size={13} /></button>
                      </header>
                      <CollectedContent item={item} />
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="overview-empty"><Icon name="gift" size={30} /><h3>Overraskelsene dine samles her</h3><p>Når du åpner luker med gavekort, bilder eller lenker, finner du dem igjen her.</p></div>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}

function CollectedContent({ item }: { item: Keepsake }) {
  switch (item.kind) {
    case "giftcard":
      return <GiftCardView gift={item.gift} compact />;
    case "video":
      return <a className="button secondary collection-link" href={item.url} target="_blank" rel="noopener noreferrer"><Icon name="video" size={18} />{item.title || "Se video"}<Icon name="external" size={15} /></a>;
    case "image":
      return <MediaImage className="collection-image" src={item.src} alt={item.alt} loading="lazy" />;
    case "audio":
      return <AudioPlayer src={item.src}/>;
    case "link":
      return <a className="button secondary collection-link" href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<Icon name="external" size={17} /></a>;
  }
}
