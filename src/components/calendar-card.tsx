"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completedCount, type AdventCalendar } from "@/lib/model";
import { useStore } from "./provider";
import { Artwork } from "./artwork";
import { Icon } from "./icons";
import { CalendarDeleteDialog } from "./calendar-delete-dialog";
import { GreetingBadge } from "./greetings";
import { isReceived, ownerCopy } from "@/lib/calendar-library";
import { installMenuDismissal } from "@/lib/menu-dismissal";
export function CalendarCard({ calendar }: { calendar: AdventCalendar }) {
  const { add, toast, progress } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menuRef.current) return installMenuDismissal(menuRef.current);
  }, []);
  const received = isReceived(calendar);
  const count =
    received && calendar.remote
      ? (progress[calendar.id]?.opened.length ?? 0)
      : completedCount(calendar);
  const destination = `/calendar/${calendar.id}${received ? "/preview" : ""}`;
  return (
    <article className="calendar-card">
      <div className="calendar-card-visual">
        <Link
          href={destination}
          className={`calendar-cover theme-${calendar.theme}`}
          aria-label={`Åpne ${calendar.title}`}
        >
          <Artwork theme={calendar.theme} scene={calendar.scene} fit="cover" />
          <span className="cover-stamp">DESEMBER {calendar.year}</span>

          <span className="card-state">
            {received
              ? "Delt med meg"
              : calendar.demo
                ? "Eksempel"
                : count === 24
                  ? "Alle luker fylt"
                  : "Underveis"}
          </span>
        </Link>
        <details
          ref={menuRef}
          className="card-menu"
        >
          <summary aria-label={`Flere valg for ${calendar.title}`}>
            <Icon name="more" size={20} />
          </summary>
          <div>
            {(!received || !calendar.remote) && (
              <button
                type="button"
                onClick={(event) => {
                  const copy = ownerCopy(calendar);
                  if (!add(copy)) return;
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  toast("En kopi av kalenderen er lagt til.");
                }}
              >
                <Icon name="copy" size={16} />
                Dupliser kalender
              </button>
            )}
            <button
              type="button"
              className="danger-text"
              onClick={(event) => {
                const menu = event.currentTarget.closest("details");
                menu?.removeAttribute("open");
                menu?.querySelector("summary")?.focus();
                setConfirmDelete(true);
              }}
            >
              <Icon name="trash" size={16} />
              {received ? "Fjern fra mine kalendere" : "Slett kalender"}
            </button>
          </div>
        </details>
      </div>
      <div className="calendar-card-body">
        <div className="card-title-row">
          <h3>
            <Link href={destination}>{calendar.title}</Link>
          </h3>
          {!received && <GreetingBadge calendarId={calendar.id}/>}
        </div>
        <p className="card-recipient">
          <Icon name="heart" size={13} />
          {received
            ? `Fra ${calendar.sender || "en venn"}`
            : calendar.recipient || ""}
        </p>
        <div className="progress-label">
          <span>
            <strong>{count}</strong> av 24 luker{" "}
            {received && calendar.remote ? "åpnet" : "fylt"}
          </span>
          <span>{Math.round((count / 24) * 100)} %</span>
        </div>
        <progress
          max={24}
          value={count}
          aria-label={`${count} av 24 luker ${received && calendar.remote ? "åpnet" : "fylt"}`}
        />
        <div className="card-bottom">
          <span>
            <span className={count === 24 ? "tiny-dot complete" : "tiny-dot"} />
            {received
              ? "Åpne kalenderen"
              : calendar.demo
                ? "Eksempel"
                : count === 24
                  ? "Klar"
                  : "Under arbeid"}
          </span>
          <Link
            href={destination}
            className="button secondary card-edit"
            aria-label={`${received ? "Åpne" : "Rediger"} ${calendar.title}`}
          >
            <Icon name="arrow" size={22} />
          </Link>
        </div>
      </div>
      {confirmDelete && (
        <CalendarDeleteDialog calendar={calendar} onClose={() => setConfirmDelete(false)} />
      )}
    </article>
  );
}
