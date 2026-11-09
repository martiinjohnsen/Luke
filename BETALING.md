# Betaling for kalenderdeling

## Nå: overgang til ekte betaling pågår

Delingsvinduet er aktivert for enkeltperson og gruppe. Koden er rettet for
standard Stripe Checkout og testmerking er fjernet lokalt. Produksjonsmiljøet
bruker fortsatt testnøkler per 9. november kl. 22, så dette er ennå ikke
ekte betaling. Eksisterende kalendere, invitasjoner, lenker og mottakerfremdrift
beholdes.

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

Status 9. november 2026: Stripe-testwebhooken og fem hemmelige Production-
variabler er satt opp i Vercel, og en testrefusjon nådde webhooken med HTTP 200.
Det offentlige betalingsvinduet er nå på i Stripe-testmodus. Den simulerte refusjonen
var ikke et Luke-kjøp og opprettet én refusjonsmarkør uten ordre i databasen.
Lokal kode er derfor endret slik at refusjoner må ha Lukes merking på
PaymentIntent før de registreres. Rettelsen er publisert i commit `50c4d8d`.
Stripe Workbench viste senere at alle Checkout-forsøk ble avvist med HTTP 400:
kontoen aktiverte Managed Payments som standard, og produktene manglet
avgiftskode. Lokal kode sender nå `managed_payments.enabled=false` for standard
Checkout. Idempotensnøkkelen er endret fra `luke-share-…` til
`luke-share-v2-…`, slik at uferdige ordre kan prøve igjen uten å få det
tidligere 400-svaret. Denne rettelsen er ennå ikke publisert eller kontrollert
mot Stripe. Stripe-kontoens Managed Payments-oppsett er separat og uferdig.

Betalingsmigreringen er kjørt i Supabase. Ved testvisningen skal tilgangen
til å opprette nye gratisinvitasjoner være stengt, og
`luke_free_sharing_ready()` skal returnere `0`. Bare å legge inn Stripe-nøkler
aktiverer ikke betaling; kodeflagget styrer vinduet.

Betalingsmigreringen er allerede kjørt i hovedprosjektet. For live-modus må
en egen Stripe live secret key opprettes for Luke, en live webhook til
`https://luke-kalender.vercel.app/api/stripe/webhook` opprettes med de tre
hendelsene nedenfor, Vercels tre Stripe-variabler byttes til live-verdier,
og `configure_luke_billing(true)` kjøres i Supabase. En ny produksjonsdeploy
må deretter bli Ready. Ikke legg nøkler i chatten eller kildekoden.

Servervariablene er `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` og `LUKE_APP_URL`.
Ingen hemmelig nøkkel har `NEXT_PUBLIC_`-prefiks eller legges i nettleseren.

Kort og tilgjengelige betalingsmåter vises av Stripe. Apple Pay krever et
registrert domene og en støttet enhet/nettleser. Andre betalingsmåter, som
Vipps, må være tilgjengelige og aktivert på Stripe-kontoen. Appen lover ikke
en betalingsmåte før Stripe tilbyr den.

## Kontroll etter live-oppsett

Kontroller at Checkout åpnes for begge pakkene, at Stripe viser riktig beløp,
og at en faktisk betaling gir «Betalt» og åpner invitasjonsformen. Lukk vinduet
før mottakerne fylles inn, åpne deling igjen og kontroller at kjøpet fortsatt
er betalt. Klargjør en e-post og prøv «Send på nytt». Martin gjennomfører selv
en eventuell ekte transaksjon og visuell gjennomgang.

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
