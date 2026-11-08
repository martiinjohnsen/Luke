# Luke

Mobiltilpasset adventskalender med Next.js, React og TypeScript. Kildekode: https://github.com/martiinjohnsen/Luke. Nettside: https://luke-kalender.vercel.app.

## Start lokalt

```bash
npm ci
npm run dev
```

Åpne http://localhost:3001. Bruk Node.js 24 eller nyere. Hvis npm ikke får skrive til standardbufferen, bruk `npm ci --cache .cache/npm`.

## Konto og lagring

- Konto-siden bruker Google til registrering og innlogging. Kontoen opprettes ved første innlogging. Navn kan endres på kontosiden, mens passord håndteres hos Google.
- Besøkende kan utforske forsiden og inspirasjonen. Oppretting, kopiering, redigering, sletting og import krever innlogging, både i grensesnittet og ved endring av data. Databasen avviser også anonyme forespørsler.
- Opprett kalender sender en gjest til `/settings?next=create`. Etter innlogging fortsetter brukeren til kalenderoppretting. En ventende kalenderinvitasjon har prioritet. Handlingen bevares gjennom Google-innloggingen i samme nettleserfane.
- Eventuelle lokale kalendere fra den tidligere versjonen beholdes. De kan flyttes uttrykkelig under Konto etter innlogging. Gjestesiden viser dem ikke i Mine kalendere.
- Innloggede brukere får en lokal, kontoavgrenset kopi av siste data og eventuelle ulagrede utkast. Nettverksfeil blir synlige. Utkast blir ikke erstattet av et mislykket nettverkskall.
- Kalenderendringer bruker revisjonskontroll. Ved en konflikt beholdes utkastet. Kontosiden viser da en egen handling for å laste ned utkastet før skyversjonen hentes. Den tidligere, store sikkerhetskopiseksjonen er fjernet.
- Eiers forhåndsvisning og prøvesvar er adskilt fra mottakerens lagrede fremdrift. Når «Lagre fremdrift» er på, følger prøvesvar og åpnede luker kontoen mellom enhetene. Gamle lokale prøvesvar importeres én gang per enhet uten å slette den lokale kopien. Avslått lagring bruker bare midlertidig minne.

Google-innlogging krever ingen SMTP-tjeneste eller eget domene. Google må være konfigurert i både Google Auth Platform og Supabase før knappen kan brukes.

## Deling

Del-dialogen viser opprettede invitasjoner, også før mottakeren har åpnet kalenderen. «Del kalenderen» åpner en egen dialog med Enkeltperson eller Gruppe, e-postadresser og valgfri hilsen. «Del» oppretter invitasjonen og åpner e-postappen med ferdig utkast. Brukeren sender der; appen kan ikke bekrefte levering. Gruppen bruker blindkopi og én felles tilfeldig lenke med en serverkontrollert liste over tillatte adresser, opptil 50 personer. Bare bekreftede kontoer med riktig e-postadresse kan hente kalenderen. Adresser og invitasjonslisten er bare synlige for eieren.

«Fjern tilgang» under Personer med kalenderen fjerner bare medlemskapet. Invitasjonen kan fortsatt brukes. «Trekk tilbake invitasjonen» under Deling fjerner adressens invitasjoner og medlemskap og stopper også gjeninnmelding gjennom eldre lenker. Andre i en gruppe beholder sin tilgang. Å stoppe deling avslutter alle lenker og medlemskap. Ingen av disse handlingene sletter fremdrift eller quizforsøk. En uttrykkelig ny invitasjon kan gi tilgang igjen med samme fremdrift.

Innlogget mottaker får fornyet økten uten ny Google-velger og venter på en fersk kalenderoversikt før navigering. Ved feil kan samme konto prøve igjen. Kontobindingen kontrolleres før og etter fornying. Invitasjonen ligger i URL-fragmentet, ikke kalenderinnholdet.

Kalenderdokumentet er bare direkte lesbart for eieren. Mottakerdata hentes gjennom databasefunksjoner som holder tilbake fremtidige luker etter norsk tid. Quizfasit og avsenderkommentar følger først med etter at mottakeren har sendt et svar. Første svar på samme spørsmålsversjon beholdes. Endres spørsmålet, får det en ny nøkkel.

Realtime-varsler inneholder kalender-ID og revisjon, ikke hele kalenderdokumentet. Appen henter nye, tilgangskontrollerte data ved varsler, når den får fokus/nett igjen, og ved norsk midnatt. Eieren kan avslutte delingen. JSON-eksport er en privat sikkerhetskopi som også inneholder fremtidige luker. Gamle prøvelenker kan fortsatt åpnes som eldre, statiske kopier; de gir ikke en ny konto tilgang til originalen.

## Oppsett av et nytt Supabase-prosjekt

1. Kjør SQL-filene i `supabase/migrations/` i filnavnrekkefølge i et nytt prosjekt. Eksisterende prosjekter skal bare kjøre nye migrasjoner, nå `202611060001_preview_progress.sql`. Migrasjonen oppretter tabeller, RLS-regler, revisjonskontroll, mottakerfunksjoner og Realtime-publication.
2. Bruk prosjektets URL og **publishable key**. `src/lib/cloud/public-config.ts` inneholder de offentlige identifikatorene for Luke. `.env.example` viser valgfrie overstyringer for en annen installasjon. Ingen administrative nøkler eller service-role-nøkler skal inn i appen.
3. Sett Site URL til `https://luke-kalender.vercel.app`. Tillat nøyaktig `https://luke-kalender.vercel.app/settings` og `http://localhost:3001/settings` som returadresser. Unngå vide wildcard-regler.
4. Opprett en OAuth-klient av typen Web application i Google Auth Platform. Bruk appnavnet Luke og bare innloggingsinformasjonen `openid`, `email` og `profile`. Tillat nettstedets origin og lokal utviklingsadresse. Sett autorisert redirect URI til `https://<prosjekt-id>.supabase.co/auth/v1/callback`.
5. Legg klient-ID og klienthemmelighet inn i Supabase under Authentication → Sign In / Providers → Google. Hemmeligheten skal aldri ligge i kildekoden. Behold kontroll av nonce og ikke tillat uverifiserte e-postadresser. Sørg for at Google-appens målgruppe og publiseringsstatus tillater brukerne som skal teste.
6. Test ny konto, eksisterende konto, avbrutt innlogging, utlogging, retur til oppretting og en ventende delingsinvitasjon. Test i både mobil og datamaskin før lansering.

Prosjektets publishable key er beregnet for klientbruk og gir ingen administrative rettigheter. Tilgang til data håndheves i databasen med brukerens verifiserte Supabase-token. Hemmelige SMTP- og administrasjonsnøkler hører bare hjemme i leverandørens innstillinger eller servermiljøet.

## Kalenderfunksjoner

Mine kalendere har søk, sortering og filtrene Alle, Laget av meg og Delt med meg. Kalenderen har 24 luker med tekst, bilder, YouTube, lenker, opplevelser, manuelt innlagte gavekort og quiz. Innholdsbokser kan dras i rekkefølge. Quiz støtter inntil 12 alternativer, flere riktige svar og fritekst med godkjente svarvarianter.

Ni fargepaletter og seks motiver kan kombineres med gjenstander, snøfall, bris og stjerneblinking. Redigeringen bruker appens lilla stil; mottakerkalenderen følger valgt tema. Datolåsen har lenke og lås, og lukene åpnes med en døranimasjon. Redusert bevegelse respekteres. PWA kan legges på hjemskjermen.

Gavekortkjøp, kontroll av saldo og leverandørintegrasjon er ikke implementert. Bilder komprimeres lokalt. Bilder og lyd på kontokalendere lagres privat hos Supabase med tilgangskontrollerte referanser i dokumentet. YouTube kontaktes først ved avspilling.

## Kontroller

```bash
npm run check
```

Kjører typekontroll, enhetstester, databasekontroller og produksjonsbygg. Databasekontrollen bruker en separat Postgres-instans i minnet med Supabase-lignende roller og JWT-identitet. Den kjører de faktiske migrasjonene og alle SQL-testene i `supabase/tests/`. Testene dekker eierisolasjon, mottakertilgang, fremtidige luker, serverretting av quiz, fremdrift, oppdateringer, revisjonskonflikt, tilbakekalling og fletting av prøvesvar fra flere enheter. Alle testdata rulles tilbake.

Denne kontrollen erstatter ikke en ende-til-ende-test av Google-innlogging via Supabase Auth og Realtime-transport. Slike kontroller må også gjøres i det tilkoblede prosjektet før ordinær lansering.

## GitHub og Vercel

Vercel bygger automatisk fra `main`. Bruk Next.js, repoets rot som Root Directory, `npm ci` og `npm run build`. Behold standard Output Directory. Ikke last opp `node_modules`, `.next` eller `.env.local`.

I VS Code kan **Sync Changes** hente nye commits. Egne filendringer må først lagres og committes før de pushes.

## Viktige filer

| Fil                                 | Innhold                                       |
| ----------------------------------- | --------------------------------------------- |
| src/components/account-panel.tsx    | Konto, Google-innlogging og profil                  |
| src/components/account-provider.tsx | Innlogget bruker og gjenoppretting            |
| src/components/provider.tsx         | Lokal lagring, konto og synkronisering        |
| src/lib/cloud/workspace.ts          | Endringssett, revisjoner og utkast            |
| src/components/share-dialog.tsx     | Invitasjoner, gruppedeling og tilbakekalling                |
| src/app/receive/page.tsx            | Mottak av invitasjon og eldre prøvelenker     |
| src/components/recipient-view.tsx   | Luker, fremdrift og mottakerquiz              |
| supabase/migrations                 | Versjonert databaseoppsett                    |
| supabase/tests/accounts.sql         | Databasekontroll med midlertidige testbrukere |

Se [videre utvikling](docs/neste-steg.md) og [prøveplan](docs/proveplan.md).
