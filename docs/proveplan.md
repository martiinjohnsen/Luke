# Prøveplan

## Utført 4. november 2026

- Typekontroll, 29 automatiske tester og produksjonsbygg bestått.
- Lokal Chrome: opprettet kalender med Nordlys, hytte, snømann og reinsdyr.
- Lagret en luke med 100 kr testgavekort og quizspørsmål i samme luke.
- Åpnet luka, viste gavekortkoden og svarte riktig på spørsmålet.
- Lastet siden på nytt og verifiserte at svaret og poengsummen var bevart.
- Slått av prøvemodus. Fremtidige luker forble låst. Klikk viste lenke, lås og melding med riktig dato.
- Kontrollert mottakervisning i Chromes iPhone 16-emulering. Dette erstatter ikke testing på fysisk iPhone.
- Kontrollert like inspirasjonskort, tydelige filterknapper, søkefelt og sorteringspil i lokal Chrome.
- Kontrollert seks motiver og forhåndsvisninger med snømann, reinsdyr, snøfall, vind og blinkende stjerner.
- Flyttet innholdsblokker med både drahåndtak og tastatur. Boksene krympet under dragging, og rekkefølgen og innholdet ble bevart etter lagring.
- Lagt til en bildeblokk nederst, fjernet den og kontrollert at valget kunne legges tilbake.
- Besvart et spørsmål med fem alternativer og to riktige svar, samt et spørsmål med skrevet svar. Begge ga riktig poengsum; avsenderkommentar og quizoversikt ble kontrollert.
- Kontrollert at redigeringssiden og lukeredigeringen beholder appens lilla farger. Forhåndsvisning og mottakervisning følger kalenderens eget tema.
- Kontrollert redigeringssiden og lukedialogen ved 393 pikslers bredde i Chromes iPhone 16-emulering.
- Lagret en luke med tekst uten egen overskrift. Den ble markert klar, og mottakervisningen viste dato og tekst.
- Kontrollert det separate feltet for åpningseffekt og avspilling av konfetti og stjerner i forhåndsvisningen.
- Kontrollert Granskog og Juleby uten den rette snøbasen, samt husenes plassering i snøen.
- Kontrollert lenke med hengende ledd og lås i kalenderens temafarge, sammen med datomeldingen.
- Rullet Inspirasjon ned og byttet til Mine kalendere. Hele toppfeltet og sideoverskriften var synlige etter sideskiftet.

## Videre kontroll

1. Åpne sidene på fysisk iPhone og Android, og ved 320, 393, 768 og 1440 pikslers bredde. Se etter horisontal rulling og små trykkflater.
2. Opprett kalender, endre navn og utseende under kalenderinnstillinger. Last på nytt og kontroller lagringen.
3. Fyll en luke med hilsen, bilde, lenke, gavekort, video og spørsmål. Uferdige utkast skal kunne lagres uten å vises som klare.
4. Bytt mellom Alle, Klare og Under arbeid. Avbryt redigering og kontroller at endringer ikke forsvinner uten valg.
5. Prøv to spørsmål i samme luke, bytt rekkefølge, legg til og fjern svaralternativer. Endre et spørsmål etter at det er besvart. Det gamle poenget skal ikke telle for det nye spørsmålet.
6. Åpne én luke. Ingen neste/forrige-knapper skal være synlige. Kontroller at 1, 10 og 24 er sentrert under døranimasjonen.
7. Slå av Åpne alle luker. Før 1. desember skal alle være låst. På 4. desember skal bare 1–4 være tilgjengelige. Datoene beregnes i Europe/Oslo.
8. Åpne Quizoversikt. Fremtidige dagers spørsmål skal ikke kunne spilles der. Eierens prøvesvar skal være adskilt fra mottakerens.
9. Logg inn på to separate kontoer. Del en kalender fra eieren til mottakeren. Kontroller at mottakeren får lesetilgang under Delt med meg, at eierens nye endringer følger med og at avsluttet deling fjerner tilgangen. Gamle prøvelenker er statiske kopier.
10. Ved revisjonskonflikt: last ned utkast før skyversjonen hentes. Flytt eldre, lokale kalendere uttrykkelig etter innlogging. Gamle quizspørsmål skal fortsatt kunne åpnes.
11. Installer den publiserte siden på iPhone og Android. Test hjemskjermikon og frakoblet reservevisning.
12. Bruk tastatur og VoiceOver: navigasjon, oppretting, quiz, Escape og retur av fokus. Reduser bevegelse skal slå av dørsekvensen, risting og partikler.

## Kontoer, 5. november 2026

- Migrasjonen ble kjørt i Supabase-prosjektet. Site URL og to nøyaktige returadresser ble lagret.
- Typekontroll, 37 enhetstester, databasekontroll og produksjonsbygg passerte med Next.js 16.4.5. Pakkekontroll etter oppdateringen rapporterte null kjente sårbarheter.
- Databasekontrollen kjører samme migrasjon i en separat Postgres-instans. Den tester eierisolasjon, forbud mot mottakerredigering, serverstyrte datoer, skjult fasit, første quizforsøk, fritekstnormalisering, fremdrift, oppdateringer, revisjonskonflikt og tilbakekalling. Testdata rulles tilbake.
- Ekstern, uinnlogget tilgang til kalendertabell, arbeidsområde og oppretting av invitasjon ble avvist med 401/42501 av Supabase.
- Macen ble låst under arbeidet. Ny visuell kontroll av konto-siden, full e-postflyt og faktisk Realtime mellom to innlogginger er derfor ikke verifisert. E-posttjeneste mangler fortsatt.

Når e-post er koblet til: test registrering, bekreftelse, ny bekreftelse, innlogging, glemt passord, passordbytte, utlogging, kontoavgrensning, eksplisitt flytting av lokale kalendere, to enheter, frakobling og motstridende kalenderendringer. Test fysisk iPhone, også med åpent tastatur.

## Samlet kontoside og gjestetilgang, 5. november

- Fjernet de separate seksjonene Profil og visning og Ta vare på de små gledene. Navn og visningsvalg ligger i kontopanelet etter innlogging; registreringsskjemaet krever navn.
- Gjestekontroll gjelder oppretting, kopiering, redigering, fjerning og import. Innloggingskravet ved anonyme databasekall er også testet.
- Lokal Chrome med produksjonsbygg: gjestesiden viser forside og inspirasjon uten private kalenderkort, søk eller tomme filtre. Opprett kalender sendte til `/settings?next=create` med forklaringen om innlogging, uten å åpne opprettingsdialogen.
- Resend Domains viste ingen domener. SMTP og e-postlevering er ikke aktivert. Registreringsknappen, ny bekreftelse og passordlenker er derfor sperret med en synlig forklaring til avsenderen er klar.
- Etter innlogging skal Opprett kalender fortsette automatisk. Hele innloggingsforløpet og mobilvisningen må fortsatt kontrolleres med faktiske kontoer når e-posttjenesten er koblet til.


## Invitasjoner og eksisterende innlogging

- Åpne en invitasjon mens riktig konto allerede er innlogget. Kalenderen skal hentes før mottakervisningen åpnes, også når en bakgrunnsoppdatering allerede pågår. Ved nettverksfeil skal «Prøv igjen med denne kontoen» beholde kontoen og invitasjonen.
- Åpne med feil konto. Kontoens e-post skal vises, og invitasjonen skal fortsatt avvises til riktig Google-konto velges.
- Åpne Del: ingen e-postfelt i første dialog. Del kalenderen skal åpne separat valg av enkeltperson eller gruppe. Gruppe krever minst to ulike adresser. Del skal åpne e-postutkastet uten kopieringsmenyer. Bekreft mottakere/blindkopi, hilsen og lenke i den faktiske e-postappen før utsending.
- Invitasjonslisten skal inkludere adresser som ennå ikke har åpnet kalenderen, men mottakerlisten skal bare inkludere aktuelle medlemskap.
- Fjern én person fra kalenderen. Invitasjonen skal virke igjen og beholde åpnede luker og første quizforsøk.
- Trekk tilbake invitasjonen for én gruppeadresse. Alle personens invitasjoner og tilgang skal stoppe. De andre i gruppen skal fortsatt kunne åpne. En forsinket gjentakelse av opprettelsen skal ikke legge den fjernede adressen tilbake.
- Inviter den samme adressen på nytt. Fremdrift og første feilaktige quizsvar skal fortsatt gjelde. En gammel, tilbakekalt personinvitasjon eller gruppetilhørighet skal fortsatt være ugyldig.
- På mobil skal bare åpnede luker ha tall høyere opp, og hilsenknappen skal ligge innenfor luka. På PC skal tallene være sentrert. Kontroller at oversiktsknappene ikke blinker ved musebevegelse, særlig i Safari.
