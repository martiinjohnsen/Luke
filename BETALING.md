# Betaling for kalenderdeling

## Nå: offentlig Stripe-test

Delingsvinduet viser testbetaling for enkeltperson og gruppe. Stripe bruker
testnøkler, så ingen ekte penger trekkes. Eksisterende kalendere, invitasjoner,
lenker og mottakerfremdrift beholdes.

`src/lib/sharing-mode.ts` har `PAID_SHARING_ENABLED = true`. Dette viser
betalingsvinduet og åpner for Stripe-testøkter. Betalingsvinduet og kortskjemaet
er merket «Testbetaling». Dette er ikke en lansering med ekte betaling.

Den tidligere gratisinvitasjonsfunksjonen må ikke være tilgjengelig for nye
invitasjoner i denne modusen. Eksisterende invitasjoner er fremdeles gyldige.

## Bevart betalingsløsning for senere

Enkeltperson koster 19 kr. Gruppe koster 29 kr og gjelder 2–50 mottakere.
Prisene er engangsbeløp for denne kalenderen. Serveren bestemmer beløpene.

Et betalt kjøp lagres i Supabase før mottakerne velges. Kjøpet kan åpnes igjen
fra «Dine delingskjøp». Når invitasjonen klargjøres, bindes kjøpet til de valgte
adressene. E-postappen kan åpnes på nytt med samme lenke og hilsen uten ny
betaling. Appen kan ikke vite om brukeren faktisk trykker Send i e-postappen.

## Oppsett

Status 9. november 2026: Stripe-testwebhooken og fem hemmelige Production-
variabler er satt opp i Vercel, og en testrefusjon nådde webhooken med HTTP 200.
Det offentlige betalingsvinduet er nå på i Stripe-testmodus. Den simulerte refusjonen
var ikke et Luke-kjøp og opprettet én refusjonsmarkør uten ordre i databasen.
Lokal kode er derfor endret slik at refusjoner må ha Lukes merking på
PaymentIntent før de registreres. Rettelsen er publisert i commit `50c4d8d`.
En hel kjøpsflyt er ennå ikke bekreftet. Ingen ekte betalingsnøkler skal tas
i bruk før dette er kontrollert.

Betalingsmigreringen er kjørt i Supabase. Ved testvisningen skal tilgangen
til å opprette nye gratisinvitasjoner være stengt, og
`luke_free_sharing_ready()` skal returnere `0`. Bare å legge inn Stripe-nøkler
aktiverer ikke betaling; kodeflagget styrer vinduet.

1. Kjør `supabase/migrations/202611090001_paid_sharing.sql` i SQL-editoren i
   det eksisterende Supabase-prosjektet. Den beholder eksisterende kalendere,
   invitasjonslenker og quizforsøk, og stenger de gamle inngangene for nye
   gratisinvitasjoner.
2. Finn Stripe-nøklene under Developers / API keys. Start med testmodus og
   hent `pk_test_…` og `sk_test_…` fra samme Stripe-miljø. Finn Supabase
   secret key eller den eldre `service_role`-nøkkelen under prosjektets API keys.
   Skriv nøklene i terminaloppsettet, ikke i chatten eller kildekoden.
3. Kjør `node scripts/configure-payments.mjs --vercel --deploy` i prosjektet.
   Oppsettet registrerer betalingsdomenet og Stripe-webhooken, lagrer nøklene
   i `.env.local` og på Vercel, og publiserer. Velg det eksisterende
   Luke-prosjektet hvis Vercel ber om en prosjektkobling.

Servervariablene er `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` og `LUKE_APP_URL`.
Ingen hemmelig nøkkel har `NEXT_PUBLIC_`-prefiks eller legges i nettleseren.

Kort og tilgjengelige betalingsmåter vises av Stripe. Apple Pay krever et
registrert domene og en støttet enhet/nettleser. Andre betalingsmåter, som
Vipps, må være tilgjengelige og aktivert på Stripe-kontoen. Appen lover ikke
en betalingsmåte før Stripe tilbyr den.

## Kontroller før ekte betaling

Test kjøp for begge pakkene med Stripe-testkort `4242 4242 4242 4242`.
Lukk vinduet etter betaling og før mottakere er fylt inn. Åpne deling igjen og
kontroller at kjøpet fortsatt er betalt. Klargjør en e-post, lukk e-postappen
uten å sende, og velg «Send på nytt». Test også avbrutt betaling og Vipps/annen
retur via nettleseren hvis kontoen tilbyr det.

Stripe-webhooken er `/api/stripe/webhook` og mottar
`checkout.session.completed` og `checkout.session.async_payment_succeeded`.
Den registrerer også fulle refusjoner med `charge.refunded`.
Signaturen kontrolleres mot den urørte forespørselskroppen. Statusen i Stripe,
NOK-beløpet, kjøperen, kalenderen, pakken og test/live-modusen må stemme før
deling åpnes. Gjenåpning kontrollerer også uferdige kjøp direkte mot Stripe.

Aktiver Stripe-kontoen og bytt til live-nøkler når testene virker. For å bytte
modus, fjern de tre `STRIPE_…`-verdiene fra `.env.local` før oppsettet kjøres
igjen, og velg live-miljøets nøkler og webhook-hemmelighet. Oppsettet bytter
også betalingsmodus i databasen. Testkjøp kan ikke brukes til ny deling i
live-modus. Avslutt eventuelle testinvitasjoner før en offentlig lansering.

Refusjoner gjennomføres i Stripe. En full refusjon sperrer kjøpet for ny
deling, også hvis betalingsvarslene kommer i motsatt rekkefølge. Trekk også
tilbake invitasjonen i Luke dersom en eksisterende mottaker skal miste
tilgangen. Kalender- og quizfremdrift slettes ikke ved tilbaketrekking.
