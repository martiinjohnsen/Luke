"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "./provider";
import { GettingStarted } from "./getting-started";
import { CalendarCard } from "./calendar-card";
import { startNew } from "./new-calendar";
import { Artwork } from "./artwork";
import { Icon } from "./icons";
import {
  isReceived,
  libraryCalendars,
  type LibraryFilter,
} from "@/lib/calendar-library";
export function CalendarLibrary() {
  const { data, cloud } = useStore();
  const [filter, setFilter] = useState<LibraryFilter>("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("newest");
  const own = data.calendars.filter((calendar) => !isReceived(calendar));
  const received = data.calendars.filter(isReceived);
  const calendars = libraryCalendars(
    cloud ? data.calendars : [], filter, search,
  ).sort(
    (a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "nb")
        : b.updatedAt.localeCompare(a.updatedAt),
  );
  const tabs: { value: LibraryFilter; label: string; count: number }[] = [
    { value: "all", label: "Alle", count: cloud ? data.calendars.length : 0 },
    { value: "owner", label: "Laget av meg", count: cloud ? own.length : 0 },
    { value: "received", label: "Delt med meg", count: cloud ? received.length : 0 },
  ];
  return (
    <div className="library-page page-enter">
      <div className="page-heading">
        <div><h1>{cloud ? "Mine kalendere" : "Velkommen til Luke"}</h1>
          {!cloud && <p>Logg inn for å komme i gang.</p>}
        </div>
      </div>
      <section className="hero library-hero" aria-label="Opprett kalender">
        <div className="hero-copy">
          <h2>
            Små luker.
            <br />
            Stor glede.
          </h2>
          <p className="hero-tagline">Din digitale julekalender</p>
          <p>
            Lag en personlig kalender med hilsener, gavekort og overraskelser.
          </p>
          <button className="button primary" onClick={() => startNew()}>
            <Icon name="plus" size={18} />
            Opprett kalender
          </button>
        </div>
        <div className="hero-scene">
          <Artwork
            scene={{
              house: "classic",
              sky: "stars",
              snowman: true,
              reindeer: false,
              trees: true,
              lights: true,
              snowfall: true,
              wind: true,
              twinkle: true,
            }}
          />
        </div>
      </section>
      {!cloud && <div className="guest-devices">
        <span><Icon name="monitor" size={20} /><Icon name="phone" size={17} /></span>
        <div><strong>Luke på mobil og PC</strong><p>Bruk samme konto og fortsett der du slapp.</p></div>
      </div>}
      {!cloud ? (
        <>
          <GettingStarted />
          <div className="guest-signin"><Link href="/settings" className="button primary">Fortsett med Google<Icon name="arrow" size={17} /></Link></div>
        </>
      ) : (
        <>
          <div className="library-controls">
            <div
              className="filter-tabs library-filters"
              aria-label="Vis kalendere"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  className={filter === tab.value ? "active" : ""}
                  aria-pressed={filter === tab.value}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                  <span>{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="collection-toolbar">
              <div className="search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Søk i kalendere"
                  placeholder="Søk i kalendere"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    className="icon-button"
                    aria-label="Tøm søk"
                    onClick={() => setSearch("")}
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
              <div className="sort-control">
                <select
                  aria-label="Sorter kalendere"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="newest">Sist endret</option>
                  <option value="name">Navn A–Å</option>
                </select>
                <Icon name="chevron" size={16} />
              </div>
            </div>
          </div>
          <div className="calendar-grid">
            {calendars.map((calendar) => (
              <CalendarCard key={calendar.id} calendar={calendar} />
            ))}
          </div>
          {!calendars.length && (
            <div className="empty-state library-empty">
              <Icon
                name={
                  filter === "received"
                    ? "share"
                    : search
                      ? "search"
                      : "calendar"
                }
                size={29}
              />
              <h2>
                {search
                  ? "Ingen treff"
                  : filter === "received"
                    ? "Ingen delte kalendere ennå"
                    : "Her kommer kalenderne dine"}
              </h2>
              <p>
                {search
                  ? "Prøv et annet søk."
                  : filter === "received"
                    ? "Kalendere andre deler med kontoen din, vises her."
                    : "Opprett en kalender for å begynne."}
              </p>
            </div>
          )}
        </>
      )}
      <footer className="field-help"><Link href="/privacy">Personvern</Link></footer>
    </div>
  );
}
