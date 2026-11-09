# Betaling for kalenderdeling

## Nå: live Checkout er publisert

Delingsvinduet er aktivert for enkeltperson og gruppe. Produksjon bruker
Stripe live-nøkler, live-webhook og `livemode=true` i Supabase. Koden for
standard Stripe Checkout er publisert, og testmerkingen er fjernet. Offentlig
Checkout åpnet 9. november 2026 med live-nøkkel og riktig pris for
Enkeltperson, 19 kr. En faktisk betaling og påfølgende invitasjon er ennå
ikke gjennomført og kan derfor ikke regnes som verifisert. Eksisterende
kalendere, invitasjoner, lenker og mottakerfremdrift beholdes.

`src/lib/sharing-mode.ts` har `PAID_SHARING_ENABLED = true`. Stripe-nøklene og
databasens betalingsmodus avgjør om økten er test eller live.

Den tidligere gratisinvitasjonsfunksjonen må ikke være tilgjengelig for nye
invitasjoner i denne modusen. Eksisterende invitasjoner er fremdeles gyldige.

## Betalingsløsning

Enkeltperson koster 19 kr. Gruppe koster 29 kr og gjelder 2–50 mottakere.
Prisene er engangsbeløp for denne kalenderen. Serveren bestemmer beløpene.

Et betalt kjøp lagres i Supabase før mottakerne velges. Kjøpet kan åpnes igjen
fra «Dine delingskjøp». Når invitasjonen klargjøres, bindes kjøpet til de valgte
adressene. E-postappen kan åpnes på nytt med samme lenke og hilsen uten ny
betaling. Appen kan ikke vite om brukeren faktisk trykker Send i e-postappen.

## Oppsett

Historikk: Stripe-testwebhooken og fem hemmelige Production-variabler ble
satt opp i Vercel, og en testrefusjon nådde webhooken med HTTP 200. Den
simulerte refusjonen var ikke et Luke-kjøp og opprettet én refusjonsmarkør
uten ordre i databasen.
Lokal kode er derfor endret slik at refusjoner må ha Lukes merking på
PaymentIntent før de registreres. Rettelsen er publisert i commit `50c4d8d`.
Stripe Workbench viste senere at alle Checkout-forsøk ble avvist med HTTP 400:
kontoen aktiverte Managed Payments som standard, og produktene manglet
avgiftskode. Lokal kode sender nå `managed_payments.enabled=false` for standard
Checkout. Idempotensnøkkelen er endret fra `luke-share-…` til
`luke-share-v2-…`, slik at uferdige ordre kan prøve igjen uten å få det
tidligere 400-svaret. Rettelsen er publisert i `3658aac` og kontrollert ved
at live Checkout åpner. Standard Checkout brukes for Luke.

Betalingsmigreringen er kjørt i Supabase. Tilgangen til å opprette nye
gratisinvitasjoner er stengt, og
`luke_free_sharing_ready()` skal returnere `0`. Bare å legge inn Stripe-nøkler
aktiverer ikke betaling; kodeflagget styrer vinduet.

Live-oppsettet ble fullført samme kveld: en begrenset Stripe live-nøkkel for
engangsbetalinger, live-webhook til
`https://luke-kalender.vercel.app/api/stripe/webhook`, tre live Stripe-variabler
i Vercel Production og `configure_luke_billing(true)` i Supabase-prosjekt
`rybrqiicknqjmoimiegx`. Deployen for `77fcc7b` ble «Ready». Ingen
nøkkelverdier er lagret i kildekoden eller denne dokumentasjonen.

Servervariablene er `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` og `LUKE_APP_URL`.
Ingen hemmelig nøkkel har `NEXT_PUBLIC_`-prefiks eller legges i nettleseren.

Kort og tilgjengelige betalingsmåter vises av Stripe. Apple Pay krever et
registrert domene og en støttet enhet/nettleser. Andre betalingsmåter, som
Vipps, må være tilgjengelige og aktivert på Stripe-kontoen. Appen lover ikke
en betalingsmåte før Stripe tilbyr den.

## Kontroll etter live-oppsett

Live Checkout er kontrollert for Enkeltperson til 19 kr. Kontroller Gruppe
til 29 kr ved behov. Martin gjennomfører én faktisk betaling og kontrollerer
at den gir «Betalt» og åpner invitasjonsformen. Lukk vinduet før mottakerne
fylles inn, åpne deling igjen og kontroller at kjøpet fortsatt er betalt.
Klargjør en e-post og prøv «Send på nytt». Martin gjør selv den visuelle
gjennomgangen.

Stripe-webhooken er `/api/stripe/webhook` og mottar
`checkout.session.completed` og `checkout.session.async_payment_succeeded`.
Den registrerer også fulle refusjoner med `charge.refunded`.
Signaturen kontrolleres mot den urørte forespørselskroppen. Statusen i Stripe,
NOK-beløpet, kjøperen, kalenderen, pakken og test/live-modusen må stemme før
deling åpnes. Gjenåpning kontrollerer også uferdige kjøp direkte mot Stripe.

Testkjøp kan ikke brukes til ny deling i live-modus. Eventuelle testinvitasjoner
bør gjennomgås før offentlig lansering. Full refusjon sperrer kjøpet for ny
deling; eksisterende mottakertilgang trekkes tilbake i Luke om nødvendig.

Refusjoner gjennomføres i Stripe. En full refusjon sperrer kjøpet for ny
deling, også hvis betalingsvarslene kommer i motsatt rekkefølge. Trekk også
tilbake invitasjonen i Luke dersom en eksisterende mottaker skal miste
tilgangen. Kalender- og quizfremdrift slettes ikke ved tilbaketrekking.
