"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const InstallContext = createContext<{
  install: () => void;
  installed: boolean;
}>({ install: () => {}, installed: false });
export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);
  const [offline, setOffline] = useState(false);
  const [canShare,setCanShare]=useState(false),[shareError,setShareError]=useState(""),[sharing,setSharing]=useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", done);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    network();
    setCanShare(typeof navigator.share==="function");
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", done);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  async function install() {
    if (prompt) {
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        setPrompt(null);
      }
    } else setGuide(true);
  }
  async function openShareMenu() {
    setShareError("");setSharing(true);
    try {await navigator.share({title:"Luke",url:`${location.origin}/calendars`});}
    catch(error){if(!(error instanceof DOMException && error.name==="AbortError")) setShareError("Delingsmenyen kunne ikke åpnes. Bruk Del i nettlesermenyen i stedet.");}
    finally{setSharing(false);}
  }
  return (
    <InstallContext.Provider value={{ install, installed }}>
      {offline && (
        <div className="offline-banner" role="status">
          Du er frakoblet. Kalenderutkast beholdes på enheten. Bilder, lyd og hilsener krever nett.
        </div>
      )}
      {children}
      {guide && (
        <Dialog title="Ta Luke med deg" onClose={() => setGuide(false)}>
          <div className="install-guide">
            <span className="large-icon">
              <Icon name="phone" size={30} />
            </span>
            <h3>En liten app på hjemskjermen</h3>
            <p>
              Åpne Luke på mobilen og legg den til på hjemskjermen. Da får du et
              eget ikon og mer plass til kalenderne.
            </p>
            <div className="info-box">
              <strong>iPhone eller iPad</strong>
              <p>
                Åpne Safari-menyen ved adresselinjen, trykk Del og velg «Legg til på Hjem-skjerm». Bekreft med «Legg til».
              </p>
              {canShare && <button type="button" className="button secondary full" disabled={sharing} onClick={()=>void openShareMenu()}><Icon name="share" size={17}/>{sharing ? "Åpner …" : "Åpne delingsmenyen"}</button>}
              <p className="field-help">Hvis «Legg til på Hjem-skjerm» ikke vises her, bruk Del i Safari-menyen. Du bekrefter selv når appen skal legges til.</p>
              {shareError && <p className="form-error" role="alert">{shareError}</p>}
            </div>
            <div className="info-box">
              <strong>Android og Chrome</strong>
              <p>
                Åpne nettlesermenyen og velg «Installer app» eller «Legg til på
                startskjermen».
              </p>
            </div>
            <button
              className="button primary full"
              onClick={() => setGuide(false)}
            >
              Det høres fint ut <Icon name="check" size={18} />
            </button>
          </div>
        </Dialog>
      )}
    </InstallContext.Provider>
  );
}
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const { install, installed } = useContext(InstallContext);
  return (
    <button
      className={compact ? "install-card" : "button secondary"}
      onClick={install}
    >
      {compact ? (
        <>
          <span className="install-icon">
            <Icon name="phone" size={23} />
          </span>
          <span>
            <strong>
              {installed ? "Luke er installert" : "Ta Luke med deg"}
            </strong>
            <small>
              {installed
                ? "På din egen hjemskjerm"
                : "Legg til på hjemskjermen"}
            </small>
          </span>
          <Icon name="chevron" size={16} />
        </>
      ) : (
        <>
          <Icon name="phone" size={18} />
          {installed ? "Appen er installert" : "Installer Luke"}
        </>
      )}
    </button>
  );
}
