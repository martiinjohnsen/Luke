# Les meg først – Luke

Overlevering til nye Codex-samtaler. Sist oppdatert 9. november 2026.
Dette er prosjektets varige arbeidsnotat, ikke en full kopi av tidligere samtaler.
Les også `AGENTS.md` og relevante deler av `README.md` før arbeidet starter.

## Hold overleveringen levende

Martin har uttrykkelig bedt om at dokumentasjonen oppdateres fortløpende.
Dette er en fast del av arbeidet i hver samtale, også når det ikke endres kode.
Agenten skal legge til og oppdatere relevant informasjon uten å vente på en
ny påminnelse eller be om godkjenning for hver vanlig dokumentasjonsendring.

- Noter nye uttrykte preferanser, rettelser, prioriteringer og ønsker om hvordan
  samarbeidet skal foregå når de kommer frem i samtalen.
- Oppdater prosjektstatus ved nye funksjoner, feil, løsninger, beslutninger,
  publiseringer, SQL-endringer, testresultater og oppdagede begrensninger.
- Skriv ned hva som gjenstår og neste konkrete steg, slik at en annen terminal
  kan fortsette uten å gjette. Oppdater senest før du avslutter en arbeidsøkt,
  og underveis når viktig ny informasjon ellers kan gå tapt.
- Erstatt utdaterte beskrivelser med gjeldende informasjon. Behold kort, datert
  historikk når den forklarer et viktig valg; unngå motstridende instruksjoner
  og gjentakelser. Skill bekreftede fakta fra forslag og usikkerhet.
- Oppdater også `AGENTS.md` hvis det gjelder en varig arbeidsregel, og annen
  relevant dokumentasjon hvis arbeidsflyten eller oppsettet er endret.
- Ta vare på nyttig kontekst, ikke alle meldinger. Registrer uttrykte ønsker,
  ikke antatte personlighetstrekk. Ikke lagre passord, nøkler eller tokens.

Denne vedlikeholdsregelen ble lagt til 9. november 2026 etter Martins ønske.

## Hvor prosjektet ligger

### Oppstart av nye arbeidsøkter (lagt til 9. november 2026)

Martin ønsker alltid spørsmålet «Er du klar for å starte litt redigering av
nettsiden din?» før arbeidsverktøyene åpnes i en ny redigeringsøkt. Vent på ja.
`START-LUKE.command` spør først, åpner VS Code og fem lagrede Chrome-faner,
og tilbyr Codex eller Claude med en ferdig prompt om å lese overleveringen.
`START-HER.md` forklarer fremgangsmåten og bruk fra en AI som allerede er startet.
I en ny samtale svarte agenten feil på «klar for startup?» fordi den ikke
undersøkte Luke-mappen først. Øktens oppgitte arbeidsmappe var hjemmemappen,
selv om Martin hadde gitt tilgang til Luke-mappen. Agenten opprettet deretter
en `AGENTS.md` i hjemmemappen. Martin ønsker ingen agentfiler der; filen ble
fjernet. Oppstartsinstruksjonene skal holdes i Luke-mappen. Martin sa «ikke
enda» til selve oppstarten. Åpne ikke appene før et nytt, tydelig ja.
Dette er et avvik agenten må håndtere ved å sjekke prosjektmappen når Luke-
oppstart nevnes, ikke ved å legge filer i hjemmemappen.
`CLAUDE.md` peker Claude til samme instruksjoner. Fanene ligger i en lokal,
Git-ignorert liste, `oppstart-faner.local.txt`; listen må vedlikeholdes ved behov.
Oppstarten er ikke SQL- eller publiseringstillatelse, og bekrefter ingen innlogging.
Oppstartsfilen er kontrollert med syntakssjekk og simulert kjøring. I en ny
arbeidsøkt 9. november fullførte `./START-LUKE.command --confirmed` uten feil
etter godkjent kjøring utenfor sandkassen. Første forsøk i sandkassen fant
ikke VS Code; dette er ikke bevis på at appen mangler. Appvinduene og
innloggingene er ikke visuelt kontrollert, og oppstart av en ekstra
AI-samtale er fortsatt ikke prøvd.

- Hovedmappe på Martins Mac: `/Users/martinjohnsen/AI Prosjekter/Luke-kalender`.
- Git-remote kontrollert lokalt: `https://github.com/martiinjohnsen/Digital-kalender.git`.
- Nettside oppgitt i README: `https://luke-kalender.vercel.app`.
- Tidligere ChatGPT-prosjekt: **Martin – Spillkoding**.
- Den siste samtalen vi åpnet der heter **Utforsk nettsideprosjektet**:
  https://chatgpt.com/g/g-p-6938284bd0188191beddf792f9489841/c/6aeadae3-4324-83ed-a1e5-664635fe9504
- En eldre arbeidskopi ligger under `/Users/martinjohnsen/.codex/.chatgpt-projects/g-p-6938284bd0188191beddf792f9489841/luke`.
  Hovedmappen over skal brukes til videre arbeid. Ikke kopier gamle filer over nyere kode ukritisk.
- Den gamle mappens `luke-oppdatering/publiser-luke.command` ble brukt da Martin selv limte inn kommandoer i VS Code. Undersøk alltid skriptet før eventuell bruk; det gjelder en bestemt tidligere retting.

## Hva vi lager

Luke er en mobiltilpasset adventskalender med 24 luker, innhold, quiz,
Google-innlogging, deling og mottakerfremdrift. Prosjektet bruker Next.js,
React, TypeScript og Supabase. Betalingskode for Stripe finnes i prosjektet.
Les kildekoden for gjeldende funksjoner og grenser.

Venner har allerede begynt å bruke nettsiden, ifølge Martin. Eksisterende
kalendere, invitasjoner, eierskap og fremdrift må overleve oppdateringer.
Detaljerte krav til lagring og tester står i `AGENTS.md`.

## Martins arbeidsmåte og preferanser

Dette er uttrykte ønsker fra samtalen, ikke antatte personlige egenskaper:

- Svar på norsk bokmål, vennlig, konkret og uten unødvendig teknisk språk.
- Martin er ny til Codex og Terminal. Forklar forskjellen på Finder,
  Terminal, VS Code, prosjektmappe og selve Codex-samtalen når det er relevant.
- Ved manuelle steg: si nøyaktig hvor det skal skrives eller klikkes.
  «Gå til mappen og skriv» er ikke tydelig nok. Forklar for eksempel at
  `cd` skrives i Terminal, og at mappen kan dras inn etter et mellomrom.
- Han ønsker effektiv bruk av tid og credits. Gjør kodearbeid i filer og kjør
  relevante lokale kontroller. Send ferdig kode eller presise erstatninger med
  filsti, slik at han kan lime dem inn i VS Code og eventuelt SQL i Supabase.
  Han kan selv kontrollere utseende og vanlige funksjoner på nettsiden, og gjør
  som regel dette uansett. Ikke naviger fysisk gjennom alle UI-steg i Chrome
  som standard; det bruker uforholdsmessig mye ressurser.
- Bruk Chrome når Stripe, Supabase, Vercel, innlogging eller annen ekstern
  tjeneste faktisk må konfigureres eller kontrolleres der. Gjør nødvendig
  arbeid, men hold nettleserbruken målrettet. Avklar kort hva Martin skal
  sjekke selv og hva agenten faktisk har verifisert. Denne presiseringen ble
  uttrykkelig gitt etter betalingsarbeidet 9. november 2026 og erstatter
  forventningen om at agenten fysisk tester alle nettsidefunksjoner i Chrome.
- Han vil kunne fortsette fra nye terminaler uten å forklare alt på nytt.
  Hold denne filen oppdatert og la viktige beslutninger stå skriftlig.
- Han har bedt om reasoning effort **medium**. Dette er en preferanse;
  faktisk innstilling må velges eller verifiseres i klienten. En bekreftelse
  i vanlig tekst endrer ikke nødvendigvis innstillingen.
- Han ønsker færre gjentatte tillatelsesspørsmål. Utfør autorisert arbeid
  selvstendig innenfor gjeldende tillatelser; ikke anta at `--yolo` er aktivert.
- Ikke send ham rundt i innstillinger basert på gjetninger. Si hva som er
  kontrollert, hva som er usikkert og hva som faktisk mangler.
- Vær nøye med designønsker. Det siste konkrete ønsket var at illustrasjonen
  på Mine kalendere skal fylle boksen helt ned til kanten, uten mellomrom.

## Nylige beslutninger og kodehistorikk

Pågående arbeid 9. november 2026: Martin vil ta opp igjen integrasjonen av
Stripe-betaling for kalenderdeling. Han er logget inn i Stripe og har bedt om
at alle beslutninger, endringer og kontroller dokumenteres fortløpende her,
slik at en ny terminal kan fortsette. Første kontroll viser at betalingskoden
og testene finnes, mens `PAID_SHARING_ENABLED` fortsatt er `false` og gratis
deling er aktiv. Kontroll i innloggede arbeidsfaner viste at Stripe-kontoen
«Luke» har et testmiljø med testnøkkel. Ingen hemmelige nøkkelverdier er
kopiert til prosjektet eller denne filen. Supabase-prosjektets produksjons-
database har `luke_share_orders`, `luke_billing_ready()` og
`luke_free_sharing_ready()`. En skrivefri SQL-kontroll viste
`billing_livemode=false`, 0 delingskjøp, 5 kalendere og
`free_sharing_ready=1`; autentiserte brukere har fortsatt tilgang til gratis
invitasjonsfunksjon. Vercel-prosjektet viser ingen miljøvariabler og siste
produksjonsdeploy er klar på commit `d180a8a`. Lokalt finnes verken
`.env.local` eller `.vercel/project.json`; Vercel-, Supabase-, Stripe- og
GitHub-CLI er ikke installert i denne terminalen. Ingenting er aktivert
eller publisert. Martin valgte uttrykkelig å starte med Stripe-testbetalinger
etter anbefaling fra agenten. Hold gratis deling aktiv på den offentlige
nettsiden mens testoppsettet verifiseres. Bevar eksisterende kalendere og
fremdrift.
Stripe Workbench i «Test mode» viste ingen eksisterende webhook-destinasjon.
`npm test` besto med 107 tester, isolerte databasetester besto, og
`npm run build` og `npm run typecheck` besto. Første `npm run check` stoppet
på utdaterte genererte Next-typer; byggingen oppdaterte dem, og typekontroll
gikk deretter gjennom. Ingen kodeendring er gjort i betalingsflyten ennå.
Videre kontroll: Supabase har en eksisterende maskert `sb_secret_…`-nøkkel,
og Vercel har et skjema for Secret-miljøvariabler. `git ls-remote origin`
feilet fordi denne terminalen ikke kan slå opp `github.com`; Git-push er
derfor ikke bekreftet som tilgjengelig. Før opprettelse av Stripe-webhook
eller lagring av Stripe-/Supabase-hemmeligheter i Vercel ble Martin bedt om
en konkret bekreftelse: dette gir Vercels server privilegert tilgang til
Luke-databasen. Martin svarte «ja! bare gjør alt!» og godkjente dermed den
beskrevne testkoblingen med Stripe-webhook og Secret-variabler i Vercel.
Ingen hemmelige verdier skal skrives her.
Etter godkjenningen ble Stripe-testdestinasjonen «Luke testbetaling»
opprettet med ID `we_1UZxVbJfAPNNWEhw5CJBHARk`, URL
`https://luke-kalender.vercel.app/api/stripe/webhook`, snapshot-hendelser
`checkout.session.completed`, `checkout.session.async_payment_succeeded`
og `charge.refunded`, API-versjon `2026-10-28.endive`. Vercel fikk fem
Secret-variabler for Production: `STRIPE_WEBHOOK_SECRET`,
`STRIPE_SECRET_KEY` (test), `STRIPE_PUBLISHABLE_KEY` (test),
`SUPABASE_SERVICE_ROLE_KEY` og `LUKE_APP_URL`. Agenten kontrollerte bare
prefiksene, ikke lagrede nøkkelverdier i dokumentasjonen. En redeploy av
uendret commit `d180a8a` ble startet etter at Martin godkjente Vercels
Touch ID-kontroll. Vercel-deploy-ID er `J5rQHsyzBE5evecGGQGoTFBbaZXq`;
status ble kontrollert til «Ready», og domenet `luke-kalender.vercel.app`
ble tilordnet deployen. Betalingsvinduet er fortsatt av i koden og gratis
deling er ikke deaktivert. Stripe Shell sendte en simulert `charge.refunded`-
hendelse; Stripe viste «Delivered» og HTTP 200 med `received: true`.
En skrivefri SQL-kontroll etterpå viste fremdeles 5 kalendere, 0 kjøp og
`free_sharing_ready=1`. Hendelsen opprettet én refusjonsmarkør uten tilhørende
kjøp i `luke_share_refunds`. Den er ikke slettet. Dette viser at webhook-
signatur, Vercel-miljøvariabler og Supabase-serverkall virker for denne
hendelsen, men ikke at et helt kalenderdelingskjøp er testet.

Refusjonsfeilen er nå rettet lokalt i `src/lib/server/billing.ts`: en full
refusjon må tilhøre en PaymentIntent med Lukes `scope` og riktig test/live-
modus før Supabase-RPC kalles. `src/lib/billing.ts` har en avgrenset
kontrollfunksjon, og `tests/billing.test.ts` dekker refusjoner fra andre
produkter og feil modus. Endringen og `BETALING.md` er samlet i lokal commit
`50c4d8d` på `main`.
Den ene eldre testmarkøren i databasen står fortsatt urørt. `npm run check`
besto etter endringen: typekontroll, 108 enhetstester, alle isolerte
databasetester og produksjonsbygg. GitHub-fanen viste `martiinjohnsen/Luke`
på `main` fortsatt på `d180a8a`, altså samme kilde som før rettingen.
Terminalens nye forsøk på `git ls-remote origin HEAD` feilet igjen fordi
`github.com` ikke kunne slås opp. Nettleseren viste at Vercels faktiske
GitHub-repo er `martiinjohnsen/Luke` med commit `d180a8a`; lokal `origin`
pekte på det eldre navnet `Digital-kalender`. Lokal `origin` er nå rettet
til `https://github.com/martiinjohnsen/Luke.git`.
Martin ba deretter om et nytt publiseringsforsøk og åpnet den lokale mappen
i VS Code. Terminalens `git push origin main` feilet fortsatt med DNS-feil,
men VS Codes «Push 1 commits to origin/main» lyktes. GitHub viste
`50c4d8d` som siste commit på `main`. Vercel bygget automatisk deploy
`CEvsNK6YSYLMZaHHAVoTV23DiW7B`; status ble kontrollert til «Ready» og
domenet `luke-kalender.vercel.app` var tilordnet. Rettelsen er dermed
publisert. Gratis deling er fortsatt aktiv; en full Stripe-kjøpsflyt er
fortsatt ikke testet og betalingsvinduet er fortsatt av.
Betalingsdokumentasjonen fikk deretter en statusretting i commit `9073abb`
og ble pushet fra VS Code. Vercel-deploy `5zJyfqHuhqy4wS8MgWfdGD8kGDwE`
for denne committen ble «Ready». Vercels redeploy-dialog viste denne som
«Current» på `main` og listet `luke-kalender.vercel.app` under «Assigned
domains». Prosjektets Overview-visning viste likevel fremdeles den gamle
`d180a8a` som Production Deployment. Denne motstriden i Vercel-grensesnittet
ble ikke løst med ytterligere redeploy; kontrollér hoveddomenets faktisk
tilordnede deploy på nytt ved behov. Ingen ny redeploy ble startet.
Martin viste deretter skjermbilde fra den offentlige kalenderen kl. 21:11:
«Del kalenderen» viser fortsatt gratisvalgene Enkeltperson og Gruppe. Dette
er forventet ut fra `PAID_SHARING_ENABLED = false`; hverken Stripe-nøkler,
webhook eller refusjonsrettelsen endrer delingsvinduet. Martin påpekte at
ingenting synlig var endret. Agenten erkjente at tidligere svar ikke gjorde
dette tydelig nok, og ba om valg mellom egen testlenke først (anbefalt) og
å vise testbetaling på den offentlige siden. Svar avventes før valg som
endrer brukernes deling.
Martin valgte uttrykkelig «bare vis den på den offentlige.. mye enklere det».
Dermed er målet nå å vise Stripe-testbetaling offentlig, mens ekte betaling
fortsatt ikke brukes. Lokalt er `PAID_SHARING_ENABLED` satt til `true`.
`PaidShareDialog` og `SharePurchaseFlow` er merket tydelig som testbetaling
uten ekte trekk, og testkortet vises ved betalingen. `BETALING.md` er justert
for denne modusen. `npm run check` besto: typekontroll, 108 enhetstester,
isolerte databasetester og produksjonsbygg. Ikke publisert ennå på dette
tidspunktet. Før offentlig deling brukes, lukk den direkte gratisinvitasjons-
rettigheten for `authenticated` i Supabase og kontroller at eksisterende
kalendere og invitasjoner er bevart. Testkjøp er ikke en ekte betaling.
Publisering og kontroll: kode og `BETALING.md` ble committet som `57c7bfc`
(`Show Stripe test checkout on public sharing`) og pushet fra VS Code.
Vercel-deploy `9WQE8SGPQxEKAc4LAPBiQ8neucHS` ble «Ready» og viste
`luke-kalender.vercel.app` under «Current Domains». I Supabase ble kun
`EXECUTE`-rettigheten på
`public.create_luke_invitation_batch(text,jsonb,text,uuid)` trukket tilbake
fra `public`, `anon` og `authenticated`, deretter ble PostgREST-skjemaet
oppdatert. SQL-kjøringen var vellykket. Skrivefri kontroll etterpå viste
`free_sharing_ready=0`, `billing_livemode=false`, 6 eksisterende kalendere,
0 kjøp og den samme ene refusjonsmarkøren. Kalenderantallet hadde økt fra 5
til 6 før denne kontrollen; ingen kalender ble opprettet eller endret av
agentens SQL. I Chrome ble hoveddomenets kalender lastet på nytt. «Del» viste
nå «Testbetaling» og forklaringen om at ingen ekte penger trekkes; neste
vindu viste Enkeltperson 19 kr og Gruppe 29 kr. Agenten startet ikke en
Stripe Checkout-økt eller et testkjøp mot den levende Supabase-databasen.
Eksisterende inviterte personer ble fortsatt vist i delingsvinduet.

Forsøk på Stripes syntetiske `checkout.session.completed` via Stripe Shell
stoppet i Stripes egen testfikstur: `payment_intent_data.shipping` støttes
ikke med kontoens standardinnstilling «Managed Payments». Det ble ikke sendt
en Checkout-hendelse til Luke. Før ekte betaling må en full kjøpsflyt testes
i et isolert testoppsett. Bevar markøren inntil trygg opprydding er avtalt;
aldri kjør bred reset mot produksjon.

Kontrollert mot lokal Git-historikk 9. november 2026:

- `5a8ae2b`: betalingsbasert deling med Stripe ble lagt til.
- `e0fd044`: gratis deling med enkeltperson eller gruppe ble gjeninnført.
  Martins instruks var å bevare betalingskoden til senere, ikke slette den.
  Se blant annet `src/lib/sharing-mode.ts`, `src/components/share-dialog.tsx`
  og `supabase/migrations/202611090002_restore_free_sharing.sql`.
- `d180a8a`: illustrasjonen på Mine kalendere ble rettet slik at den fyller
  boksen til kanten. Endret `src/components/calendar-library.tsx` og `public/sw.js`.

Ved kontroll før denne dokumentasjonsendringen var hovedmappen på `main`,
uten lokale endringer. Lokal `origin/main` pekte også på `d180a8a`.
Dette bekrefter ikke fersk status hos GitHub eller vellykket Vercel-publisering.

Ny arbeidsøkt 9. november 2026: Martin bekreftet oppstart med «ja».
AGENTS.md, denne overleveringen, START-HER.md og README.md er lest.
Lokal branch er `main`, med `d180a8a` som siste commit og uten vist avvik fra
lokal `origin/main`; GitHub er ikke hentet på nytt. Det finnes eksisterende,
ikke committede endringer i dokumentasjon og oppsett: `.gitignore`,
`AGENTS.md`, `README.md`, `CLAUDE.md`, `LES-MEG.md`, `START-HER.md` og
`START-LUKE.command`. Disse er bevart. Bare denne overleveringen er oppdatert
i den nye økten. Ingen appkode, SQL, push eller publisering er utført;
tester og bygg er ikke kjørt for oppstarten. Neste steg er Martins konkrete
redigeringsoppgave.

Senere oppstartsforsøk 9. november 2026: Martin bekreftet på nytt «ja» i en
Codex-samtale. `./START-LUKE.command --confirmed` stoppet før fanene ble åpnet:
macOS svarte «Unable to find application named 'Visual Studio Code'».
Videre søk fant appen i `~/Downloads/Visual Studio Code.app`. Et direkte
åpningsforsøk mot denne stien feilet også: macOS meldte `kLSNoExecutableErr`,
selv om `Contents/MacOS/Electron` finnes og er kjørbar. Årsaken til denne
motstridende feilmeldingen er ikke fastslått. Datamaskinstyring fant ingen
kjørende VS Code-app. Et midlertidig forsøk på å peke skriptet mot appstien
ble reversert da det heller ikke virket. `/Applications/Google Chrome.app`
finnes. Etter at Martin påpekte at Chrome ikke var åpnet, åpnet agenten
Martin Johnsen-profilen og de fem lagrede arbeidsfanene gjennom datamaskin-
styring. Chrome viste faner for GitHub, Vercel, Luke, Stripe og Supabase.
Git-status og siste commit er som beskrevet over. Ingen appkode, SQL, push
eller publisering er utført. Neste steg er å få VS Code til å starte i denne
økten, og deretter få Martins konkrete redigeringsoppgave.

## Kontrollert tilgang og begrensninger

- Denne samtalen har lest lokale filer og åpnet den gamle ChatGPT-samtalen
  via datamaskinstyring i Chrome. Direkte styring av ChatGPT-appen ble avvist
  av verktøyet. Ikke forsøk å omgå en slik begrensning.
- Bare den siste delen av den gamle samtalen er lest, ikke hele historikken.
- Vercels aktuelle publiseringsstatus er ikke kontrollert i denne samtalen.
- Det er ikke kontrollert hvilke SQL-migrasjoner som er kjørt i produksjon,
  eller om riktig Supabase-prosjekt er innlogget og tilgjengelig.
- Ingen SQL, push eller publisering er utført i denne samtalen så langt.
- En ny samtale må kontrollere egne verktøy og innlogginger. Tidligere tilgang
  til Chrome betyr ikke at samme tilgang finnes i neste terminal.

## Siste korrigering 9. november 2026 kl. 22

Martin vil nå ha et ferdig produkt med ekte betaling. Testmerking skal bort.
Ikke kall løsningen ferdig før live-nøkler, live-webhook, database-modus,
produksjonsmiljø og kjøpsflyt faktisk er kontrollert. Han vil selv gjøre
vanlig visuell gjennomgang i Chrome; bruk nettleseren målrettet for Stripe,
Supabase og Vercel når det er nødvendig.

Stripe Workbench viste at offentlig `POST /api/sharing/checkout` ga 503 fordi
Stripe avviste `POST /v1/checkout/sessions` med 400: kontoen har Managed
Payments på som standard, og Luke sendte ingen produktavgiftskode. Den gamle
idempotensnøkkelen gjentok samme 400-svar på nye forsøk. Live-konto finnes i
Stripe og viser en live publishable key, men produksjonsmiljøet er fortsatt
konfigurert med testnøkler; aktivering for ekte kjøp er ikke verifisert.

Lokal rettelse: `src/lib/server/billing.ts` slår av Managed Payments per
Checkout-økt, bruker `luke-share-v2-…` som idempotensnøkkel og logger trygge
Stripe-feildetaljer på serveren. Testtekst er fjernet fra delingsvinduene.
`BETALING.md` beskriver live-overgangen. `npm run check` besto med 108 tester,
isolerte databasetester og produksjonsbygg. Dette er foreløpig bare lokalt;
produksjon bruker fortsatt testnøkler. Bekreftelse for å opprette live-nøkkel
og lagre live-hemmeligheter på Vercel er bedt om etter nettleserverktøyets
sikkerhetsregel. Ikke publiser testtekstfjerningen som ferdig live-løsning før
produksjonskonfigurasjonen faktisk er skiftet.

Senere samme kveld godkjente Martin live-oppsettet. Stripe krevde verifisering
via e-post; Martin fullførte den. En begrenset Stripe live-nøkkel for
engangsbetalinger ble opprettet og rotert før lagring. `STRIPE_SECRET_KEY` og
`STRIPE_PUBLISHABLE_KEY` ble byttet til live i Vercel Production. Koden er
utvidet til å godta Stripes `rk_live_…`-nøkler. Live webhook-destinasjonen
`we_1UZzshJfAPNNWEhwQ80JG9Ic` er Active på
`https://luke-kalender.vercel.app/api/stripe/webhook` med
`checkout.session.completed`, `checkout.session.async_payment_succeeded` og
`charge.refunded`. Webhook-hemmeligheten ble rotert før den ble lagret i
`STRIPE_WEBHOOK_SECRET` i Vercel Production. Ingen av disse hemmelighetene
finnes i prosjektfilene. Supabase-prosjekt `rybrqiicknqjmoimiegx` fikk
`configure_luke_billing(true)`, og SQL-resultatet viste `livemode=true`.
`npm run check` besto igjen etter støtte for begrensede Stripe-nøkler.
Endringene ble pushet til `main` i commitene `3658aac` og `77fcc7b`.
Vercel-deployen for `77fcc7b` ble kontrollert til «Ready» 9. november 2026
kl. 22:18. På den offentlige kalenderen åpnet Enkeltperson Stripe Checkout
med live publishable key og riktig beløp, 19 kr. Testtekst er borte. Det ble
ikke gjort et faktisk korttrekk. Dermed er opprettelse av live Checkout
verifisert, mens betaling, webhook for fullført kjøp, «Betalt»-status,
invitasjonsflyt etter kjøp og refusjon i live-modus fortsatt ikke er
verifisert ende til ende. Martin gjør én ekte betaling og vanlig visuell
gjennomgang selv. Ikke kall hele kjøpsflyten verifisert før dette er gjort.
Etter kodepushen var `origin/main..HEAD` tom. Tidligere lokale endringer i
`.gitignore`, `README.md`, `CLAUDE.md`, `START-HER.md` og
`START-LUKE.command` tilhører Martin og skal ikke inkluderes i denne leveransen.

## Arbeidsflyt for endringer og publisering

1. Les denne filen og `AGENTS.md`. Sjekk Git-status, branch og relevante filer.
2. Gjør den avtalte endringen og bevar eksisterende brukerdata og øvrige endringer.
3. Kjør relevante kontroller. UI-endringer krever relevante tester og
   produksjonsbygg; lagring, tillatelser og migrasjoner krever også isolerte
   databasetester. Kjør aldri databaseprøver eller reset mot produksjon.
4. Vanlige UI-endringer trenger normalt ikke SQL. Ved databaseendringer:
   bruk en versjonert migrasjon, gjennomgå konsekvensene, test isolert og
   kontroller hvilket produksjonsprosjekt og hvilke migrasjoner som gjelder.
   Ikke kjør alle gamle migrasjoner på nytt bare fordi de finnes i mappen.
5. Lever ferdig kode eller nøyaktige erstatninger med filstier når Martin vil
   lime inn i VS Code. Ved autorisert publisering beskriver README automatisk
   Vercel-bygg fra `main` etter push til GitHub. Kontroller publiseringsstatus
   med det minst ressurskrevende pålitelige verktøyet; en lokal commit eller
   et lokalt bygg er ikke bevis for at nettsiden er oppdatert.
6. Ved nødvendig Supabase-SQL: gi et kopierbart, gjennomgått SQL-skript når
   Martin vil lime inn selv. Bruk nettleser eller egnet verktøy når ekstern
   konfigurasjon faktisk krever det. Kontrollér riktig prosjekt og resultat.
   Ikke endre eller slette produksjonsdata som et rutinetiltak.
7. Oppdater denne overleveringen med hva som ble gjort, testresultater,
   eventuell commit, publisering, SQL-status og konkrete gjenstående steg.

Nyttige kommandoer fra hovedmappen:

```bash
npm run dev
npm run typecheck
npm test
npm run test:database
npm run build
```

`npm run dev` bruker port 3001. `npm run check` kjører hele kontrollrekken.
Kontroller `package.json` for gjeldende kommandoer og Node-krav.

## Dokumentasjon som må leses med dato og kildekode i mente

`README.md` har funksjonsoversikt og driftsoppsett. `docs/proveplan.md` har
prøveplan. `docs/neste-steg.md` er en eldre plan; deler om e-post/SMTP,
innlogging og bildelagring kan være utdaterte. Ikke behandle den som en
bekreftet liste over hva som mangler nå. README viste også en eldre GitHub-URL
og en utdatert «nå»-henvisning til en migrasjon; bruk faktisk remote og kontroller
databasehistorikken. Ingen hemmelige nøkler, tokens eller passord skal inn i
denne overleveringen, annen dokumentasjon eller Git.
