import Link from "next/link";
import { Icon } from "@/components/icons";

export default function PrivacyPage() {
  return (
    <article className="privacy-page page-enter">
      <div className="page-heading">
        <div><h1>Personvern i Luke</h1><p>Dette lagrer vi, og slik brukes opplysningene dine.</p></div>
      </div>
      <div className="settings-card privacy-card">
        <section>
          <h2><Icon name="user" size={19} /> Når du logger inn</h2>
          <p>Du logger inn med Google. Luke mottar navn, e-postadresse, bruker-ID og eventuelt profilbilde. Vi får ikke passordet ditt eller tilgang til Gmail eller Google-kalenderen din.</p>
        </section>
        <section>
          <h2><Icon name="calendar" size={19} /> Kalenderne dine</h2>
          <p>Vi lagrer profilnavnet ditt, kalenderne du lager, åpnede luker og quizsvar. Det gjør at du kan bruke kalenderne dine på både mobil og PC. Når du slår på «Lagre fremdrift» i forhåndsvisningen, lagres også prøvesvarene dine på kontoen.</p>
        </section>
        <section>
          <h2><Icon name="share" size={19} /> Når du deler en kalender</h2>
          <p>En mottaker åpner invitasjonen og logger inn med sin egen konto. Alle som får invitasjonslenken, kan bruke den til å få mottakertilgang. Mottakeren kan åpne kalenderen og svare på quiz, men kan ikke redigere innholdet ditt. Avsender ser hvem som har kalenderen, åpnet fremdrift og quizresultater per mottaker. Når flere har samme kalender, kan de se hverandres profilnavn og samlede quizpoeng i resultatlisten, men ikke hverandres svar. Hvis tilgangen fjernes, beholdes fremdrift og førsteforsøk slik at de fortsatt gjelder ved en ny invitasjon.</p>
        </section>
        <section>
          <h2><Icon name="mic" size={19} /> Bilder, lyd og hilsener tilbake</h2>
          <p>Bilder og lydfiler lagres privat hos Supabase. Bare avsender og mottakere med tilgang til den aktuelle luka kan hente vedleggene. Mikrofonen brukes bare når du selv starter et opptak. Hilsener du sender tilbake, med tekst og eventuelle bilder eller lydopptak, vises til kalenderens avsender. Andre mottakere ser ikke hilsenene dine. Du kan endre en sendt hilsen senere.</p>
        </section>
        <section>
          <h2><Icon name="cloud" size={19} /> Hvor opplysningene lagres</h2>
          <p>Supabase håndterer innlogging og lagring på kontoen. Vercel drifter nettsiden. Nettleseren lagrer innloggingsøkten og en lokal kopi av kalenderdata, slik at blant annet utkast kan beholdes ved nettverksfeil. YouTube-videoer lastes først når du velger å spille dem av.</p>
        </section>
        <section>
          <h2><Icon name="settings" size={19} /> Du styrer innholdet ditt</h2>
          <p>Du kan endre navnet ditt, redigere og slette egne kalendere og avslutte deling i appen. For spørsmål om opplysningene dine, innsyn eller sletting av kontoen kan du kontakte <a href="mailto:martin.johnsen@outlook.com">martin.johnsen@outlook.com</a>.</p>
        </section>
        <footer className="privacy-footer">
          <span>Sist oppdatert 8. november 2026</span>
          <Link href="/settings" className="button secondary"><Icon name="back" size={16} />Tilbake til konto</Link>
        </footer>
      </div>
    </article>
  );
}
