"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  availableDay,
  isDoorComplete,
  isQuestionComplete,
  doorBlockOrder,
  blockKind,blockDoor,blockQuestionOffset,
  validQuizResponse,
  type QuizResponse,
  questionsForDoor,
  youtubeId,
  safeLink,
  type AdventCalendar,
  type Door,
  type QuizQuestion,
} from "@/lib/model";
import {
  questionKey,
  quizSummary,
  type QuizProgress,
} from "@/lib/quiz-progress";
import { readLocalProgress, writeLocalProgress } from "@/lib/local-progress";
import { shuffledDoors } from "@/lib/door-layout";
import { Artwork } from "./artwork";
import { Icon } from "./icons";
import { BrandLogo } from "./brand";
import { useStore } from "./provider";
import { useAccount } from "./account-provider";
import { authMessage } from "@/lib/cloud/client";
import { Dialog } from "./dialog";
import { DoorQuizPlayer } from "./door-quiz-player";
import { QuizLeaderboard, useParticipants } from "./calendar-participants";
import { CalendarOverview } from "./calendar-overview";
import { usePreviewProgress } from "./use-preview-progress";
import { GiftCardView, VideoBlock } from "./door-content";
import { MediaImage, AudioPlayer } from "./media";
import { GreetingComposer } from "./greetings";
import { useGreetings, type PreviewGreeting } from "./greetings-provider";
import {
  DoorTransition,
  Celebration,
  type DoorOrigin,
} from "./door-transition";
export function RecipientView({
  calendar,
  owner = false,
  onSaveShared,
  saved = false,
}: {
  calendar: AdventCalendar;
  owner?: boolean;
  onSaveShared?: () => void;
  saved?: boolean;
}) {
  const store = useStore();
  const { toast } = store;
  const account = useAccount();
  const greetings = useGreetings();
  const participants=useParticipants(calendar.id);
  const [greetingDay,setGreetingDay] = useState<number|null>(null);
  const greetingContext=useRef<PreviewGreeting|undefined>(undefined);
  const firstVisit = useRef(false), openingRequest = useRef<Promise<void>|null>(null), interaction = useRef(0), alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;interaction.current++;};},[]);
  const remote = !!calendar.remote && !owner;
  const [testMode, setTestMode] = useState(owner),
    [day, setDay] = useState<number | null>(null),
    [now, setNow] = useState(() => new Date()),
    [overviewOpen, setOverviewOpen] = useState(false),
    [transitionDay, setTransitionDay] = useState<number | null>(null),
    [origin, setOrigin] = useState<DoorOrigin>(),
    [lockedAttempt, setLockedAttempt] = useState<{
      day: number;
      nonce: number;
    } | null>(null);
  const storageKey = `luke:progress:${account.user ? account.user.id + ":" : ""}${calendar.receivedSourceId ?? calendar.id}:${calendar.year}:${owner ? (testMode ? "test" : "owner-date") : "recipient"}`;
  const preview = usePreviewProgress(owner ? account.user?.id ?? null : null, calendar.id, calendar.year);
  const savePreviewProgress = owner && preview.data.enabled;
  const greetingPreview=owner ? {mode:testMode ? "test" as const : "date" as const,save:savePreviewProgress} : undefined;
  const savedPreview = savePreviewProgress ? preview.data[testMode ? "test" : "date"] : null;
  const rememberProgress = !owner;
  const progressKey = `${storageKey}:${savePreviewProgress ? "account" : rememberProgress ? "saved" : "temporary"}`;
  useEffect(()=>{
    interaction.current++;firstVisit.current=false;
    if(owner) greetings.clearPreview(calendar.id);
  },[owner,calendar.id,progressKey]);
  useEffect(()=>{if(owner && preview.ready) void greetings.refresh();},[owner,calendar.id,savePreviewProgress,preview.ready]);
  const [state, setState] = useState<{
    key: string;
    opened: number[];
    answers: QuizProgress;
  }>({ key: "", opened: [], answers: {} });
  useEffect(() => {
    if (remote) return;
    let progress = { opened: [] as number[], answers: {} as QuizProgress };
    try {
      progress = readLocalProgress(localStorage, storageKey, rememberProgress);
    } catch {
      /* Continue in memory when browser storage is unavailable. */
    }
    setState({ key: progressKey, ...progress });
  }, [storageKey, progressKey, remote, rememberProgress]);
  useEffect(() => {
    if (remote || owner || !rememberProgress || state.key !== progressKey) return;
    try {
      writeLocalProgress(localStorage, storageKey, state, rememberProgress);
    } catch {
      toast(
        "Fremdriften kunne ikke lagres på enheten. Den beholdes mens siden er åpen.",
      );
    }
  }, [state, storageKey, progressKey, toast, remote, owner, rememberProgress]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!lockedAttempt) return;
    const timer = setTimeout(() => setLockedAttempt(null), 1700);
    return () => clearTimeout(timer);
  }, [lockedAttempt]);
  const finishOpening = useCallback(() => {
    setDay(transitionDay);
    setTransitionDay(null);
  }, [transitionDay]);
  const limit =
    owner && testMode
      ? 24
      : remote
        ? (calendar.serverAvailableDay ?? 0)
        : availableDay(calendar.year, now);
  const opened = remote
    ? (store.progress[calendar.id]?.opened ?? [])
    : savedPreview
      ? savedPreview.opened
      : state.key === progressKey
      ? state.opened
      : [];
  const answers = remote
    ? (store.progress[calendar.id]?.answers ?? {})
    : savedPreview
      ? savedPreview.answers
      : state.key === progressKey
      ? state.answers
      : {};
  const summary = quizSummary(calendar, answers, limit);
  function open(door: Door, element?: HTMLElement) {
    if (
      transitionDay !== null ||
      day !== null ||
      (!remote && !savedPreview && state.key !== progressKey)
    )
      return;
    if (door.day > limit) {
      setLockedAttempt({ day: door.day, nonce: Date.now() });
      toast(
        `Luke ${door.day} åpner ${door.day}. desember ${calendar.year}. Litt mer å glede seg til!`,
      );
      return;
    }
    interaction.current++;
    firstVisit.current = (remote || (owner && isDoorComplete(door))) && !opened.includes(door.day);
    openingRequest.current=null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rect = element?.getBoundingClientRect();
      setOrigin(
        rect
          ? {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
          }
          : undefined,
      );
      setTransitionDay(door.day);
    } else setDay(door.day);
    if (remote) {
      const request=store.openDoor(calendar.id,door.day);
      openingRequest.current=request;
      void request.catch(error=>toast(authMessage(error)));
    }
    else if (savedPreview && isDoorComplete(door)) {
      const request=preview.merge(testMode ? "test" : "date", { opened: [door.day], answers: {} });
      openingRequest.current=request;
      void request.catch(error => toast(authMessage(error)));
    }
    else if (isDoorComplete(door))
      setState((previous) => ({
        ...previous,
        opened: previous.opened.includes(door.day)
          ? previous.opened
          : [...previous.opened, door.day],
      }));
  }
  async function closeDoor() {
    const closedDay=day;
    const offer=firstVisit.current;
    firstVisit.current=false;
    const ticket=++interaction.current;
    setDay(null);
    if((!remote && !owner) || !offer || closedDay===null) return;
    try {
      await openingRequest.current;
      const show=await greetings.claim(calendar.id,closedDay,greetingPreview);
      if(show && alive.current && ticket===interaction.current) {greetingContext.current=greetingPreview;setGreetingDay(closedDay);}
    } catch(error) { if(alive.current) toast(authMessage(error)); }
  }
  async function answerQuestion(
    index: number,
    question: QuizQuestion,
    response: QuizResponse,
  ) {
    if (day === null || day > limit || !validQuizResponse(question, response))
      return;
    if (remote) {
      await store.answer(calendar.id, day, index, response);
      return;
    }
    const key = questionKey(day, index, question);
    if (savedPreview) {
      await preview.merge(testMode ? "test" : "date", { opened: [day], answers: { [key]: response } });
      return;
    }
    setState((previous) =>
      previous.answers[key]
        ? previous
        : { ...previous, answers: { ...previous.answers, [key]: response } },
    );
  }
  return (
    <div
      className={`recipient-view calendar-palette theme-${calendar.theme} with-snow`}
    >
      <header className="recipient-topbar">
        <Link href="/calendars" className="recipient-brand">
          <BrandLogo />
        </Link>
        <div className="recipient-topbar-actions">
          {owner ? (
            <Link
              className="button secondary recipient-back"
              href={`/calendar/${calendar.id}`}
            >
              <Icon name="back" size={16} />
              <span>Til redigering</span>
            </Link>
          ) : onSaveShared ? (
            <button
              className="button secondary small-button"
              onClick={onSaveShared}
            >
              <Icon name={saved ? "check" : "plus"} size={16} />
              {saved ? "Lagret i Mine kalendere" : "Lagre kalender"}
            </button>
          ) : (
            <Link href="/calendars" className="button secondary small-button">
              Mine kalendere
            </Link>
          )}
        </div>
      </header>
      {owner && (
        <div className="preview-controls">
          <span>
            <Icon name="eye" size={16} />
            Forhåndsvisning
          </span>
          <div className="preview-options">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(event) => setTestMode(event.target.checked)}
              />
              <span className="switch" />
              Åpne alle luker
            </label>
            <label className="switch-label" title="Lagrer dine egne prøvesvar, åpnede luker og prøvehilsener på kontoen.">
              <input
                type="checkbox"
                checked={savePreviewProgress}
                disabled={!preview.ready || preview.pending}
                onChange={(event) => void preview.setSaving(event.target.checked)}
              />
              <span className="switch" />
              Lagre fremdrift
            </label>
            {!savePreviewProgress && (opened.length > 0 || Object.keys(answers).length > 0) && (
              <button
                className="button secondary small-button preview-reset"
                onClick={() => {greetings.clearPreview(calendar.id);setState({ key: progressKey, opened: [], answers: {} });}}
              >Start på nytt</button>
            )}
          </div>
        </div>
      )}
      {owner && preview.error && <p className="preview-sync-error" role="alert">Prøvefremdriften kunne ikke synkroniseres. {preview.error}</p>}
      <section className="recipient-content" aria-label="Kalenderen">
        <div className="recipient-title">
          <h1>{calendar.title}</h1>
          {calendar.description && <p>{calendar.description}</p>}
          {calendar.recipient && (
            <span className="recipient-to">
              Til {calendar.recipient}
              <Icon name="heart" size={13} />
            </span>
          )}
        </div>
        <div className="recipient-illustration">
          <Artwork theme={calendar.theme} scene={calendar.scene} />
        </div>
        <button
          className="recipient-quiz-card recipient-overview-card"
          onClick={() => setOverviewOpen(true)}
        >
          <span className="quiz-card-icon">
            <Icon name="calendar" size={24} />
          </span>
          <span>
            <strong>Kalenderoversikt</strong>
            <span>Alt du har fått i kalenderen, samlet på ett sted.</span>
          </span>
          <Icon name="arrow" size={18} />
        </button>
        <div className="recipient-grid-intro">
          <span>
            {owner && testMode
              ? "Alle lukene er åpne i prøvemodus"
              : limit === 0
                ? "Første luke åpner 1. desember"
                : limit === 24
                  ? "Alle lukene er åpne"
                  : `Du kan åpne luke 1 til ${limit}`}
          </span>
          <span>
            {opened.filter((value) => value <= limit).length} av 24 åpnet
          </span>
        </div>
        <div className="recipient-door-grid">
          {shuffledDoors(calendar.doors,calendar.id)
            .map((door) => (
              <div className="recipient-door-cell" key={door.day}>
              <button
                aria-label={`${door.day}. desember${door.day > limit ? ", låst" : opened.includes(door.day) ? ", allerede åpnet" : ", åpne luke"}`}
                className={`recipient-door ${opened.includes(door.day) && door.day <= limit ? "opened" : ""} ${door.day > limit ? "locked" : ""} ${lockedAttempt?.day === door.day ? "lock-attempt" : ""}`}
                onClick={(event) => open(door, event.currentTarget)}
              >
                <strong>{door.day}</strong>
                <span className="door-status">
                  {opened.includes(door.day) && door.day <= limit ? (
                    <Icon name="check" size={15} />
                  ) : door.day > limit ? (
                    <Icon name="lock" size={14} />
                  ) : null}
                </span>
                {lockedAttempt?.day === door.day && (
                  <span
                    key={lockedAttempt.nonce}
                    className="door-chain"
                    aria-hidden="true"
                  >
                    <DoorChain />
                  </span>
                )}
              </button>
              {(remote || owner) && opened.includes(door.day) && door.day<=limit && <button type="button" className="door-greeting-shortcut button secondary" aria-label={`Gi eller rediger en hilsen til luke ${door.day}`} onClick={()=>{interaction.current++;greetingContext.current=greetingPreview;setGreetingDay(door.day);}}><Icon name="message" size={11}/><span>{greetings.items.some(item=>item.calendarId===calendar.id && item.day===door.day && item.revision>0 && (owner ? item.previewMode===greetingPreview?.mode && !!item.temporary===!savePreviewProgress : !item.owner)) ? "Din hilsen" : "Gi hilsen"}</span></button>}
              </div>
            ))}
        </div>
        {calendar.sender && (
          <p className="recipient-signature">
            Fra {calendar.sender}
            <Icon name="heart" size={16} />
          </p>
        )}
        {!owner && (
          <p className="shared-note">
            {remote
              ? "Delt med deg. Nye endringer fra avsender vises automatisk."
              : "Dette er en eldre kalenderkopi. Be avsenderen om en ny invitasjon for å få oppdateringer."}
          </p>
        )}
      </section>
      <footer className="recipient-footer">
        <Link href="/calendars">
          Lag din egen kalender
          <Icon name="arrow" size={14} />
        </Link>
        <BrandLogo />
      </footer>
      {transitionDay !== null && (
        <DoorTransition
          day={transitionDay}
          theme={calendar.theme}
          origin={origin}
          onComplete={finishOpening}
        />
      )}{" "}
      {overviewOpen && (
        <CalendarOverview
          leaderboard={<QuizLeaderboard people={participants.data?.participants ?? []}/>}
          calendar={calendar}
          opened={opened}
          available={limit}
          summary={summary}
          onClose={() => setOverviewOpen(false)}
          onOpenDoor={(value) => {
            setOverviewOpen(false);
            open(calendar.doors.find(door=>door.day===value)!);
          }}
        />
      )}
      {day !== null && day <= limit && (
        <DoorViewer
          key={day}
          door={calendar.doors.find((door) => door.day === day)!}
          calendar={calendar}
          answers={answers}
          onAnswer={answerQuestion}
          onClose={() => void closeDoor()}
        />
      )}
      {greetingDay!==null && (remote || owner) && <GreetingComposer calendarId={calendar.id} day={greetingDay} preview={greetingContext.current} onClose={()=>setGreetingDay(null)}/>}
    </div>
  );
}
function DoorChain() {
  return (
    <svg
      className="door-chain-graphic"
      viewBox="0 0 220 110"
      fill="none"
      aria-hidden="true"
    >
      <g className="chain-links">
        {Array.from({ length: 17 }, (_, index) => {
          const x = -10 + index * 15;
          const t = Math.max(0, Math.min(1, x / 220));
          const y = 22 + Math.sin(t * Math.PI) * 27;
          const angle = Math.cos(t * Math.PI) * 20;
          return (
            <g key={index} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <ellipse
                rx="11"
                ry={index % 2 ? 4 : 6.5}
                stroke="var(--chain-metal)"
                strokeWidth="4"
              />
              <path
                d={index % 2 ? "M-8-1q8-4 16 0" : "M-8-2q5-6 13-2"}
                stroke="var(--chain-shine)"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>
      <g className="chain-padlock">
        <path
          d="M101 65V53a9 9 0 0 1 18 0v12"
          stroke="var(--chain-metal)"
          strokeWidth="5"
        />
        <path
          d="M102 56v-3a8 8 0 0 1 6-8"
          stroke="var(--chain-shine)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="94"
          y="60"
          width="32"
          height="28"
          rx="6"
          fill="var(--chain-metal)"
        />
        <path
          d="M98 67v-1q0-3 4-3h17"
          stroke="var(--chain-shine)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="110" cy="72" r="2.5" fill="var(--theme-pale)" />
        <path
          d="M110 73v6"
          stroke="var(--theme-pale)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
function DoorViewer({
  door,
  calendar,
  answers,
  onAnswer,
  onClose,
}: {
  door: Door;
  calendar: AdventCalendar;
  answers: QuizProgress;
  onAnswer: (
    index: number,
    question: QuizQuestion,
    response: QuizResponse,
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={`${door.day}. desember`}
      onClose={onClose}
      className="recipient-door-dialog"
      overlay={<Celebration key={door.day} effect={door.effect} />}
    >
      <div className="door-reveal ordered-door-reveal">
        <h2 className="reveal-date">{door.day}. desember</h2>
        {!isDoorComplete(door) && (
          <p className="empty-door-message">Her kommer det mer innhold.</p>
        )}
        {door.body && <p className="reveal-body">{door.body}</p>}
        <div className="revealed-blocks">
          {doorBlockOrder(door).map((block) => {
            const payload={...blockDoor(door,block),extra:undefined};
            switch (blockKind(block)) {
              case "image":
                return payload.image ? (
                  <figure className="reveal-figure" key={block}>
                    <MediaImage
                      className="reveal-image"
                      src={payload.image}
                      alt={payload.imageAlt || payload.title || "Et bilde i kalenderen"}
                    />
                    {payload.imageAlt && <figcaption>{payload.imageAlt}</figcaption>}
                  </figure>
                ) : null;
              case "giftcard":
                return payload.giftCard ? (
                  <GiftCardView key={block} gift={payload.giftCard} />
                ) : null;
              case "audio":
                return payload.audio ? <AudioPlayer key={block} src={payload.audio}/> : null;
              case "video":
                return youtubeId(payload.videoUrl ?? "") ? (
                  <VideoBlock
                    key={block}
                    url={payload.videoUrl!}
                    title={payload.title}
                  />
                ) : null;
              case "link":
                return payload.link && safeLink(payload.link.url) ? (
                  <a
                    key={block}
                    className="button secondary reveal-link"
                    href={safeLink(payload.link.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {payload.link.label || "Åpne lenken"}
                    <Icon name="external" size={16} />
                  </a>
                ) : null;
              case "quiz":
                return (
                  <DoorQuizPlayer
                    key={block}
                    door={payload}
                    offset={blockQuestionOffset(door,block,calendar)}
                    calendar={calendar}
                    answers={answers}
                    onAnswer={onAnswer}
                  />
                );
              case "activity":
                return payload.activity ? (
                  <section key={block} className="activity-reveal">
                    <h3>{payload.activity.title}</h3>
                    <p>{payload.activity.body}</p>
                  </section>
                ) : null;
              default:
                return null;
            }
          })}
        </div>
        {calendar.sender && (
          <p className="reveal-sender">
            Fra {calendar.sender}
            <Icon name="heart" size={12} />
          </p>
        )}
        <div className="reveal-navigation">
          <button className="button secondary" onClick={onClose}>
            Tilbake til kalenderen
          </button>
        </div>
      </div>
    </Dialog>
  );
}
