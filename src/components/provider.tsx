"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  parseBackup,
  type AdventCalendar,
  type AppData,
  type QuizResponse,
} from "@/lib/model";
import { initialData } from "@/lib/templates";
import { repository, loadRecord, saveRecord } from "@/lib/storage";
import { supabase, authMessage, rpcForUser } from "@/lib/cloud/client";
import {
  hasCloudChanges,
  hasVersionConflict,
  mergedAfterSave,
  nextOsloMidnight,
  ownedDocument,
  parseCloudSnapshot,
  rebaseDraft,
  workspacePatch,
  type CloudSnapshot,
  type CloudCache,
  type CloudProgress,
} from "@/lib/cloud/workspace";
import { useAccount } from "./account-provider";
import { workspaceRefresher } from "@/lib/cloud/workspace-refresh";
import { needsMediaMigration, prepareWorkspaceMedia, cleanUnusedMedia } from "@/lib/cloud/media";
import { stageNewMedia, restoreStagedMedia } from "@/lib/media-workspace";
import { Icon } from "./icons";
type Store = {
  data: AppData;
  status: "saving" | "saved" | "error";
  saveError: string;
  cloud: boolean;
  progress: CloudProgress;
  conflict: boolean;
  requireAccount: (create?: boolean) => boolean;
  add: (calendar: AdventCalendar) => boolean;
  update: (id: string, change: Partial<AdventCalendar>) => boolean;
  remove: (id: string) => boolean;
  setPreferences: (change: Partial<AppData["preferences"]>) => boolean;
  importData: (data: AppData) => boolean;
  syncNow: () => Promise<void>;
  refresh: (strict?: boolean) => Promise<void>;
  useCloudVersion: () => Promise<void>;
  importLocal: () => Promise<number>;
  openDoor: (id: string, day: number) => Promise<void>;
  answer: (
    id: string,
    day: number,
    index: number,
    response: QuizResponse,
  ) => Promise<void>;
  toast: (message: string) => void;
};
const Context = createContext<Store | null>(null);
export function useStore(): Store {
  const store = useContext(Context);
  if (!store) throw new Error("Luke mangler dataleverandør.");
  return store;
}
async function fetchWorkspace(userId: string | null) {
  const { data, error } = await rpcForUser(userId, "get_luke_workspace");
  if (error) throw error;
  return parseCloudSnapshot(data);
}
export function Provider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null),
    [fatal, setFatal] = useState("");
  const [status, setStatus] = useState<Store["status"]>("saving"),
    [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState(""),
    [progress, setProgress] = useState<CloudProgress>({}),
    [conflict, setConflict] = useState(false);
  const current = useRef<AppData | null>(null),
    base = useRef<CloudSnapshot | null>(null),
    uid = useRef<string | null>(null);
  const epoch = useRef(0),
    dirty = useRef(false),
    blocked = useRef(false),
    running = useRef<Promise<void> | null>(null);
  const refreshNeeded = useRef(false),
    localQueue = useRef(Promise.resolve());
  const pumpRef = useRef<() => Promise<void>>(async () => {}),
    refreshRef = useRef<() => Promise<void>>(async () => {});
  const toast = useCallback((message: string) => setNotice(message), []);
  const requireAccount = useCallback(
    (create = false) => {
      if (account.user && uid.current === account.user.id) return true;
      router.push(create ? "/settings?next=create" : "/settings");
      return false;
    },
    [account.user, router],
  );
  function show(next: AppData) {
    current.current = next;
    setData(next);
  }
  const persistCloud = useCallback(async () => {
    if (uid.current && current.current && base.current)
      await saveRecord(`account:${uid.current}`, {
        data: current.current,
        base: base.current,
        dirty: dirty.current,
      } satisfies CloudCache);
  }, []);
  const refresh = useMemo(() => workspaceRefresher(async (strict) => {
    if (!uid.current || !base.current) {
      if (strict) throw new Error("Kontoen er ikke klar ennå. Prøv igjen.");
      return;
    }
    if (dirty.current || running.current) {
      refreshNeeded.current = true;
      if (strict) throw new Error("Utkastet ditt er beholdt. Fullfør lagringen og prøv invitasjonen igjen.");
      return;
    }
    const generation = epoch.current;
    try {
      const result = await fetchWorkspace(uid.current);
      if (generation !== epoch.current) {
        if (strict) throw new Error("Innloggingen har endret seg. Åpne siden på nytt.");
        return;
      }
      if (dirty.current) {
        refreshNeeded.current = true;
        if (strict) throw new Error("Utkastet ditt er beholdt. Fullfør lagringen og prøv invitasjonen igjen.");
        return;
      }
      base.current = result;
      show(result.data);
      setProgress(result.progress);
      await persistCloud();
      if (generation !== epoch.current) return;
      setStatus("saved");
      setSaveError("");
    } catch (error) {
      if (generation === epoch.current) {
        setSaveError(authMessage(error));
        setStatus("error");
      }
      if (strict) throw error;
    }
  }), [persistCloud]);
  refreshRef.current = refresh;
  const syncNow = useCallback(async () => {
    if (running.current) return running.current;
    if (!uid.current || !dirty.current) return;
    if (blocked.current)
      throw new Error("Utkastet må avklares før det kan lagres i skyen.");
    const generation = epoch.current;
    const mediaCalendars = new Set<string>();
    const task = (async () => {
      while (
        dirty.current &&
        current.current &&
        base.current &&
        generation === epoch.current
      ) {
        const sent = current.current;
        for(const change of workspacePatch(base.current!,sent).p_changes) mediaCalendars.add(change.document.id);
        setStatus("saving");
        await persistCloud();
        if (generation !== epoch.current) return;
        const prepared = await prepareWorkspaceMedia(sent, uid.current!, base.current!.versions, mediaCalendars);
        const staged = stageNewMedia(prepared,base.current!.versions,mediaCalendars);
        if (generation !== epoch.current) return;
        const { data, error } = await rpcForUser(
          uid.current,
          "save_luke_workspace",
          workspacePatch(base.current!, staged.data),
        );
        if (error) throw error;
        if (generation !== epoch.current) return;
        const result = parseCloudSnapshot(data);
        const next = restoreStagedMedia(mergedAfterSave(sent, current.current!, result),current.current!,staged.pending);
        base.current = result;
        dirty.current = hasCloudChanges(result, next) || next.calendars.some(calendar => mediaCalendars.has(calendar.id) && needsMediaMigration(calendar));
        show(next);
        setProgress(result.progress);
        await persistCloud();
      }
      if (generation === epoch.current) {
        setStatus("saved");
        setSaveError("");
        void cleanUnusedMedia(uid.current!).catch(()=>{});
      }
    })()
      .catch(async (error) => {
        if (generation === epoch.current) {
          const isConflict = error?.code === "40001";
          blocked.current = isConflict;
          setConflict(isConflict);
          setStatus("error");
          setSaveError(authMessage(error));
          try {
            await persistCloud();
          } catch {
            setSaveError(
              "Utkastet kunne ikke lagres på enheten. Last ned en sikkerhetskopi før du lukker siden.",
            );
          }
        }
        throw error;
      })
      .finally(() => {
        if (running.current === task) running.current = null;
        if (
          generation === epoch.current &&
          refreshNeeded.current &&
          !dirty.current
        ) {
          refreshNeeded.current = false;
          void refreshRef.current();
        }
      });
    running.current = task;
    return task;
  }, [persistCloud]);
  pumpRef.current = syncNow;
  useEffect(() => {
    if (!account.ready) return;
    const generation = ++epoch.current;
    uid.current = account.user?.id ?? null;
    base.current = null;
    dirty.current = false;
    blocked.current = false;
    running.current = null;
    refreshNeeded.current = false;
    current.current = null;
    setData(null);
    setFatal("");
    setConflict(false);
    setProgress({});
    setSaveError("");
    setStatus("saving");
    let cancelled = false;
    const valid = () => !cancelled && generation === epoch.current;
    void (async () => {
      if (!uid.current) {
        const loaded = await repository.load();
        if (!valid()) return;
        show(loaded ?? initialData());
        setStatus("saved");
        return;
      }
      const cache = await loadRecord<CloudCache>(`account:${uid.current}`);
      if (cache) parseBackup(JSON.stringify(cache.data));
      try {
        const result = await fetchWorkspace(uid.current);
        if (!valid()) return;
        if (cache?.dirty) {
          const clash = hasVersionConflict(cache, result);
          base.current = clash ? cache.base : result;
          dirty.current = true;
          blocked.current = clash;
          setConflict(clash);
          show(clash ? cache.data : rebaseDraft(cache, result));
          setProgress(result.progress);
          if (clash) {
            setStatus("error");
            setSaveError(
              "Kalenderen er endret på en annen enhet. Utkastet ditt er beholdt. Last ned en sikkerhetskopi før du henter skyversjonen.",
            );
          } else void pumpRef.current().catch(() => {});
        } else {
          base.current = result;
          show(result.data);
          setProgress(result.progress);
          setStatus("saved");
          await persistCloud();
        }
      } catch (error) {
        if (!valid()) return;
        if (cache) {
          base.current = cache.base;
          dirty.current = cache.dirty;
          show(cache.data);
          setProgress(cache.base.progress);
          setStatus("error");
          setSaveError(authMessage(error));
        } else throw error;
      }
    })().catch((error) => {
      if (valid()) setFatal(authMessage(error));
    });
    return () => {
      cancelled = true;
    };
  }, [account.ready, account.user?.id, persistCloud]);
  useEffect(() => {
    if (!account.user) return;
    let debounce: ReturnType<typeof setTimeout>;
    const changed = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refreshRef.current(), 180);
    };
    const channel = supabase().channel(`workspace:${account.user.id}`);
    for (const table of [
      "luke_updates",
      "luke_members",
      "luke_profiles",
      "luke_progress",
      "luke_answers",
    ])
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        changed,
      );
    channel.subscribe();
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (dirty.current && !blocked.current)
        void pumpRef.current().catch(() => {});
      else void refreshRef.current();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    let midnight: ReturnType<typeof setTimeout>;
    const schedule = () => {
      midnight = setTimeout(
        () => {
          void refreshRef.current();
          schedule();
        },
        Math.max(1000, nextOsloMidnight() - Date.now() + 500),
      );
    };
    schedule();
    const poll=setInterval(resume,30000);
    return () => {
      clearInterval(poll);
      clearTimeout(debounce);
      clearTimeout(midnight);
      void supabase().removeChannel(channel);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [account.user?.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (status !== "saved") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  function commit(change: (previous: AppData) => AppData): boolean {
    if (!current.current) return false;
    if (blocked.current) {
      toast("Ta vare på utkastet og avklar skyversjonen under Konto først.");
      return false;
    }
    const next = change(current.current);
    try {
      parseBackup(JSON.stringify(next));
    } catch (error) {
      toast(authMessage(error));
      return false;
    }
    show(next);
    setStatus("saving");
    if (uid.current) {
      dirty.current = true;
      void pumpRef.current().catch(() => {});
    } else {
      const generation = epoch.current,
        snapshot = next;
      localQueue.current = localQueue.current
        .catch(() => {})
        .then(() => repository.save(snapshot))
        .then(() => {
          if (generation === epoch.current && current.current === snapshot) {
            setStatus("saved");
            setSaveError("");
          }
        })
        .catch((error) => {
          if (generation === epoch.current) {
            setStatus("error");
            setSaveError(authMessage(error));
          }
        });
    }
    return true;
  }
  const loading = (
    <main className="loading-screen">
      <span className="loading-star">
        <Icon name="cloud" size={28} />
      </span>
      <p>{account.user ? "Henter kalenderne dine …" : "Åpner Luke …"}</p>
    </main>
  );
  if (fatal)
    return (
      <main className="recovery">
        <Icon name="cloud" size={40} />
        <h1>Vi får ikke åpnet kalenderne</h1>
        <p className="form-error">{fatal}</p>
        <p>Lagrede utkast er beholdt på enheten.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Prøv igjen
        </button>
        {account.user && (
          <button
            className="button secondary"
            onClick={() => void supabase().auth.signOut({ scope: "local" })}
          >
            Logg ut
          </button>
        )}
      </main>
    );
  if (!data || !account.ready || (account.user?.id ?? null) !== uid.current)
    return loading;
  const value: Store = {
    data,
    status,
    saveError,
    cloud: !!account.user,
    progress,
    conflict,
    requireAccount,
    toast,
    syncNow,
    refresh,
    add: (calendar) => {
      if (!requireAccount(true)) return false;
      if (account.user && calendar.access === "received") {
        toast(
          "Åpne den nye delingslenken for å legge til kalenderen på kontoen.",
        );
        return false;
      }
      return commit((p) => ({ ...p, calendars: [calendar, ...p.calendars] }));
    },
    update: (id, change) => {
      if (!requireAccount()) return false;
      if (
        current.current?.calendars.find((c) => c.id === id)?.access ===
        "received"
      ) {
        toast("Bare avsenderen kan redigere denne kalenderen.");
        return false;
      }
      return commit((p) => ({
        ...p,
        calendars: p.calendars.map((c) =>
          c.id === id
            ? {
                ...c,
                ...change,
                id: c.id,
                access: c.access,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      }));
    },
    remove: (id) => {
      if (!requireAccount()) return false;
      return commit((p) => ({
        ...p,
        calendars: p.calendars.filter((c) => c.id !== id),
      }));
    },
    setPreferences: (change) => {
      if (!requireAccount()) return false;
      return commit((p) => ({
        ...p,
        preferences: { ...p.preferences, ...change },
      }));
    },
    importData: (incoming) => {
      if (!requireAccount()) return false;
      const calendars = incoming.calendars.filter(
        (c) => !account.user || c.access !== "received",
      );
      if (
        calendars.some((c) =>
          current.current?.calendars.some(
            (old) => old.id === c.id && old.access === "received",
          ),
        )
      ) {
        toast(
          "En mottatt kalender kan ikke erstattes med en redigerbar kalenderfil.",
        );
        return false;
      }
      return commit((p) => ({
        ...p,
        calendars: [
          ...calendars,
          ...p.calendars.filter((c) => !calendars.some((n) => n.id === c.id)),
        ],
      }));
    },
    importLocal: async () => {
      if (!requireAccount())
        throw new Error("Logg inn før du legger til kalendere.");
      const generation = epoch.current;
      const guest = await repository.load();
      if (!guest || generation !== epoch.current) return 0;
      const incoming = guest.calendars
        .filter(
          (c) =>
            c.access !== "received" &&
            !current.current?.calendars.some((n) => n.id === c.id),
        )
        .map(ownedDocument);
      if (!incoming.length) return 0;
      if (!commit((p) => ({ ...p, calendars: [...incoming, ...p.calendars] })))
        throw new Error("Kalenderne kunne ikke flyttes.");
      await pumpRef.current();
      return incoming.length;
    },
    useCloudVersion: async () => {
      if (running.current) await running.current.catch(() => {});
      const generation = epoch.current;
      const server = await fetchWorkspace(uid.current);
      if (generation !== epoch.current) return;
      base.current = server;
      dirty.current = false;
      blocked.current = false;
      setConflict(false);
      show(server.data);
      setProgress(server.progress);
      await persistCloud();
      setSaveError("");
      setStatus("saved");
    },
    openDoor: async (id, day) => {
      const generation = epoch.current;
      const { data, error } = await rpcForUser(uid.current, "open_luke_door", {
        p_calendar_id: id,
        p_day: day,
      });
      if (error) throw error;
      if (generation !== epoch.current) return;
      setProgress((p) => ({
        ...p,
        [id]: { opened: data, answers: p[id]?.answers ?? {} },
      }));
    },
    answer: async (id, day, index, response) => {
      const generation = epoch.current;
      const { data, error } = await rpcForUser(
        uid.current,
        "submit_luke_answer",
        {
          p_calendar_id: id,
          p_day: day,
          p_index: index,
          p_response: response,
        },
      );
      if (error) throw error;
      if (generation !== epoch.current) return;
      setProgress((p) => ({
        ...p,
        [id]: {
          opened: p[id]?.opened ?? [],
          answers: { ...p[id]?.answers, [data.key]: data.attempt },
        },
      }));
    },
  };
  return (
    <Context.Provider value={value}>
      {status === "error" && (
        <div role="alert" className="storage-warning">
          <span>{saveError}</span>
          {!conflict && (
            <button
              className="button secondary small-button"
              onClick={() =>
                void (dirty.current ? syncNow() : refresh()).catch(() => {})
              }
            >
              Prøv igjen
            </button>
          )}
        </div>
      )}
      {children}
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span className="toast-message">{notice}</span>
          <button aria-label="Lukk melding" onClick={() => setNotice("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
