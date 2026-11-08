"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "./provider";
import { Icon, type IconName } from "./icons";
import { Artwork } from "./artwork";
import { DoorEditor } from "./door-editor";
import { ShareDialog } from "./share-dialog";
import { AppearancePicker } from "./appearance-picker";
import { OwnerParticipants } from "./calendar-participants";
import { GreetingInbox } from "./greetings";
import {
  completedCount,
  calendarContentSummary,
  hasDoorContent,
  isDoorComplete,
  sceneFor,
  kindInfo,
  doorBlockOrder,
  blockNames,
  blockKind,
  questionsForDoor,
  type AdventCalendar,
  type Door,
} from "@/lib/model";
import { isReceived, ownerCopy } from "@/lib/calendar-library";
export function CalendarEditor({ id }: { id: string }) {
  const store = useStore(),
    router = useRouter();
  const calendar = store.data.calendars.find((c) => c.id === id);
  const [settings, setSettings] = useState(false),
    [settingsDirty, setSettingsDirty] = useState(false),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<number | null>(null),
    [share, setShare] = useState(false);
  if (!store.cloud)
    return (
      <div className="empty-state">
        <Icon name="user" size={32} />
        <h1>Logg inn for å redigere</h1>
        <p>Kalenderne dine er knyttet til kontoen din.</p>
        <Link href="/settings" className="button primary">
          Fortsett med Google
        </Link>
      </div>
    );
  if (!calendar)
    return (
      <div className="empty-state">
        <h1>Kalenderen finnes ikke her</h1>
        <p>
          Sjekk at du er logget inn med riktig Google-konto, eller åpne
          invitasjonen fra avsenderen.
        </p>
        <Link href="/calendars" className="button primary">
          Mine kalendere
        </Link>
      </div>
    );
  if (isReceived(calendar))
    return (
      <div className="empty-state">
        <Icon name="share" size={32} />
        <h1>{calendar.title}</h1>
        <p>Denne kalenderen er delt med deg.</p>
        <Link href={`/calendar/${id}/preview`} className="button primary">
          Åpne kalender
        </Link>
        {!calendar.remote && (
          <button
            className="button secondary"
            onClick={() => {
              const copy = ownerCopy(calendar);
              if (store.add(copy)) router.push(`/calendar/${copy.id}`);
            }}
          >
            Lag en redigerbar kopi
          </button>
        )}
      </div>
    );
  const count = completedCount(calendar);
  const content = calendarContentSummary(calendar);
  const contentLabels: {
    kind: keyof typeof content.counts;
    icon: IconName;
    one: string;
    many: string;
  }[] = [
    { kind: "message", icon: "message", one: "tekst", many: "tekster" },
    { kind: "giftcard", icon: "gift", one: "gavekort", many: "gavekort" },
    { kind: "image", icon: "image", one: "bilde", many: "bilder" },
    { kind: "audio", icon: "mic", one: "lydhilsen", many: "lydhilsener" },
    { kind: "video", icon: "video", one: "video", many: "videoer" },
    { kind: "link", icon: "external", one: "lenke", many: "lenker" },
    { kind: "quiz", icon: "quiz", one: "quiz", many: "quizer" },
    { kind: "activity", icon: "heart", one: "opplevelse", many: "opplevelser" },
  ];
  const doors = calendar.doors.filter(
    (door) =>
      filter === "all" ||
      (filter === "filled" && isDoorComplete(door)) ||
      (filter === "empty" && !isDoorComplete(door)),
  );
  function closeSettings() {
    if (
      settingsDirty &&
      !window.confirm("Forkaste endringene i innstillingene?")
    )
      return;
    setSettings(false);
    setSettingsDirty(false);
  }
  function saveDoor(door: Door) {
    if (
      !store.update(id, {
        doors: calendar!.doors.map((d) => (d.day === door.day ? door : d)),
      })
    )
      return;
    setEditing(null);
    store.toast(`Luke ${door.day} er lagret.`);
  }
  return (
    <div className="page-enter editor-page">
      <Link href="/calendars" className="button secondary back-link">
        <Icon name="back" size={15} />
        Mine kalendere
      </Link>
      <div className="page-heading editor-heading">
        <div>
          <h1>{calendar.title}</h1>
          {(calendar.recipient || calendar.sender) && (
            <p>
              {calendar.recipient && `Til ${calendar.recipient}`}
              {calendar.recipient && calendar.sender && " · "}
              {calendar.sender && `Fra ${calendar.sender}`}
            </p>
          )}
        </div>
        <div className="heading-actions">
          <Link
            className="button secondary"
            href={`/calendar/${id}/preview`}
            onClick={(event) => {
              if (
                settingsDirty &&
                !window.confirm(
                  "Du har ulagrede innstillinger. Gå videre likevel?",
                )
              )
                event.preventDefault();
            }}
          >
            <Icon name="eye" size={17} />
            Forhåndsvis
          </Link>
          <button className="button primary" onClick={() => setShare(true)}>
            <Icon name="share" size={17} />
            Del
          </button>
          <button
            className="icon-button calendar-settings-button"
            aria-label={
              settings ? "Tilbake til lukene" : "Kalenderinnstillinger"
            }
            aria-pressed={settings}
            onClick={() => (settings ? closeSettings() : setSettings(true))}
          >
            <Icon name={settings ? "back" : "settings"} size={19} />
          </button>
        </div>
      </div>
      <OwnerParticipants calendar={calendar} onOpenDoor={setEditing}/>
      <GreetingInbox calendarId={calendar.id}/>
      {calendar.demo && (
        <div className="example-notice">
          <span>Eksempelkalender</span>
          <button
            className="text-link"
            onClick={() => {
              const copy = ownerCopy(calendar);
              if (store.add(copy)) router.push(`/calendar/${copy.id}`);
            }}
          >
            Lag min egen kopi
            <Icon name="copy" size={14} />
          </button>
        </div>
      )}
      {settings ? (
        <CalendarSettings
          key={calendar.id}
          calendar={calendar}
          onDirty={setSettingsDirty}
          onDone={() => {
            setSettings(false);
            setSettingsDirty(false);
          }}
        />
      ) : (
        <div className="editor-layout">
          <section className="doors-workspace">
            <div className="section-heading">
              <div>
                <h2>Lukene dine</h2>
                <p>Velg en luke for å legge til eller endre innhold.</p>
              </div>
              <span className="progress-pill">{count} av 24 klare</span>
            </div>
            <div
              className="filter-tabs compact-tabs"
              aria-label="Filtrer luker"
            >
              {[
                ["all", "Alle"],
                ["filled", "Klare"],
                ["empty", "Under arbeid"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="door-grid">
              {doors.map((door) => {
                const complete = isDoorComplete(door),
                  partial = hasDoorContent(door);
                return (
                  <button
                    key={door.day}
                    className={`editor-door ${complete ? "filled" : partial ? "partial" : ""}`}
                    onClick={() => setEditing(door.day)}
                    aria-label={`Luke ${door.day}, ${complete ? "klar" : partial ? "under arbeid" : "tom"}${door.title ? `: ${door.title}` : ""}`}
                  >
                    <span className="door-top">
                      DESEMBER{complete && <Icon name="check" size={13} />}
                    </span>
                    <strong>{door.day}</strong>
                    <span className="door-type">
                      <span>
                        {partial
                          ? door.contentOrder
                            ? doorBlockOrder(door)
                                .filter((block) => block !== "effect")
                                .map((block) => blockNames[blockKind(block)])
                                .slice(0, 2)
                                .join(" · ") || "Hilsen"
                            : kindInfo[door.kind].name
                          : "Legg til"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {doors.length === 0 && (
              <div className="empty-state compact-empty">
                <p>
                  {filter === "empty"
                    ? "Alle lukene er klare."
                    : "Ingen luker i dette utvalget."}
                </p>
              </div>
            )}
          </section>
          <aside className="editor-summary">
            <div className="summary-preview">
              <Artwork theme={calendar.theme} scene={calendar.scene} fit="cover" />
            </div>
            <div className="summary-content">
              <h3>{count} av 24 luker klare</h3>
              <progress
                max={24}
                value={count}
                aria-label="Kalenderens fremdrift"
              />
              <div
                className="calendar-content-counts summary-content-grid"
                aria-label="Innhold i kalenderen"
              >
                {contentLabels.map(({ kind, icon, one, many }) => {
                  const amount = content.counts[kind] ?? 0;
                  return amount ? (
                    <div className="summary-stat" key={kind}>
                      <Icon name={icon} size={16} />
                      <strong>{kind === "quiz"
                        ? `${content.questionCount} spørsmål`
                        : `${amount} ${amount === 1 ? one : many}`}</strong>
                    </div>
                  ) : null;
                })}
              </div>
              {count < 24 ? (
                <button
                  className="button secondary full"
                  onClick={() =>
                    setEditing(
                      calendar.doors.find((door) => !isDoorComplete(door))!.day,
                    )
                  }
                >
                  Neste uferdige luke
                  <Icon name="arrow" size={16} />
                </button>
              ) : (
                <Link
                  href={`/calendar/${id}/preview`}
                  className="button primary full"
                >
                  Forhåndsvis
                  <Icon name="eye" size={16} />
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
      {editing !== null && (
        <DoorEditor
          key={editing}
          calendar={calendar}
          door={calendar.doors.find((door) => door.day === editing)!}
          onSave={saveDoor}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {share && (
        <ShareDialog calendar={calendar} onClose={() => setShare(false)} />
      )}
    </div>
  );
}
function CalendarSettings({
  calendar,
  onDirty,
  onDone,
}: {
  calendar: AdventCalendar;
  onDirty: (dirty: boolean) => void;
  onDone: () => void;
}) {
  const { update, toast } = useStore();
  const [draft, setDraft] = useState(() => ({
    title: calendar.title,
    description: calendar.description,
    recipient: calendar.recipient,
    sender: calendar.sender,
    year: calendar.year,
    theme: calendar.theme,
    scene: sceneFor(calendar),
  }));
  const [legacyDay, setLegacyDay] = useState(1);
  const original = JSON.stringify({
    title: calendar.title,
    description: calendar.description,
    recipient: calendar.recipient,
    sender: calendar.sender,
    year: calendar.year,
    theme: calendar.theme,
    scene: sceneFor(calendar),
  });
  const dirty = JSON.stringify(draft) !== original;
  useEffect(() => {
    onDirty(dirty);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirty]);
  return (
    <form
      className="calendar-settings-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.title.trim()) return;
        if (update(calendar.id, { ...draft, title: draft.title.trim() })) {
          toast("Innstillingene er lagret.");
          onDone();
        }
      }}
    >
      <div className="section-heading">
        <h2>Kalenderinnstillinger</h2>
      </div>
      <div className="calendar-settings-grid">
        <section className="settings-card">
          <h3>Om kalenderen</h3>
          <label>
            Navn
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            Introduksjon
            <textarea
              rows={3}
              maxLength={1000}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label>
              Til
              <input
                maxLength={100}
                value={draft.recipient}
                onChange={(event) =>
                  setDraft({ ...draft, recipient: event.target.value })
                }
              />
            </label>
            <label>
              Fra
              <input
                maxLength={100}
                value={draft.sender}
                onChange={(event) =>
                  setDraft({ ...draft, sender: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            År
            <span className="year-select">
            <select
              value={draft.year}
              onChange={(event) =>
                setDraft({ ...draft, year: Number(event.target.value) })
              }
            >
              {Array.from(
                new Set([
                  calendar.year,
                  ...Array.from(
                    { length: 6 },
                    (_, i) => new Date().getFullYear() + i,
                  ),
                ]),
              )
                .sort()
                .map((year) => (
                  <option key={year}>{year}</option>
                ))}
            </select>
              <Icon name="chevron" size={17} />
            </span>
          </label>
          <p className="field-help">
            Lukene åpnes fra 1. til 24. desember etter norsk tid.
          </p>
          {calendar.quiz && (
            <details className="legacy-quiz">
              <summary>
                Quiz fra førsteversjonen ({calendar.quiz.questions.length}{" "}
                spørsmål)
              </summary>
              <p className="field-help">
                Velg en luke for å plassere de tidligere spørsmålene i
                kalenderen.
              </p>
              <label>
                Luke
                <select
                  value={legacyDay}
                  onChange={(event) => setLegacyDay(Number(event.target.value))}
                >
                  {calendar.doors.map((door) => (
                    <option key={door.day} value={door.day}>
                      {door.day}. desember
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button secondary small-button"
                onClick={() => {
                  const doors = calendar.doors.map((door) =>
                    door.day !== legacyDay
                      ? door
                      : {
                          ...door,
                          questions: [
                            ...questionsForDoor(door),
                            ...structuredClone(calendar.quiz!.questions),
                          ],
                          showCalendarQuiz: false,
                          quiz: undefined,
                          title: door.title || "Julequiz",
                        },
                  );
                  if (update(calendar.id, { doors })) {
                    toast(`Spørsmålene er lagt i luke ${legacyDay}.`);
                    onDone();
                  }
                }}
              >
                Legg i denne luka
              </button>
            </details>
          )}
        </section>
        <section className="settings-card">
          <h3>Utseende</h3>
          <AppearancePicker
            title={draft.title}
            value={{ theme: draft.theme, scene: draft.scene }}
            onChange={(value) => setDraft({ ...draft, ...value })}
          />
        </section>
      </div>
      <div className="dialog-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (!dirty || window.confirm("Forkaste endringene?")) onDone();
          }}
        >
          Avbryt
        </button>
        <button
          className="button primary"
          type="submit"
          disabled={!draft.title.trim()}
        >
          Lagre innstillinger
          <Icon name="check" size={17} />
        </button>
      </div>
    </form>
  );
}
