# Kollektivdata – Systemverktøy

Dette prosjektet består av tre hovedverktøy som sammen gir en helhetlig oversikt over kollektivtrafikk og fartsgrensedata i Rogaland:

1. **Sanntidskart**  
   Live posisjoner fra Kolumbus med fart, ruteinformasjon og automatisk matching mot fartsgrensesegmenter.

2. **Fartsgrensekart**  
   Visualisering av Statens Vegvesen sine fartsgrensedata for Rogaland, inkludert segmentvisning og heatmap.

3. **Enterprise Dashboard**  
   Et statuspanel som viser systemhelse, datakvalitet, siste oppdateringer og metadata.

Prosjektet inkluderer også en komplett GitHub Actions‑pipeline som:

- henter data automatisk  
- validerer og prosesserer dem  
- bygger frontend  
- genererer dashboard  
- deployer til GitHub Pages  

Dette dokumentet forklarer hvordan alt henger sammen.

## 1. Datainnsamling

Systemet henter to typer data automatisk via GitHub Actions:

### 🚍 Kolumbus sanntidsdata  
Workflow: **Fetch Kolumbus data**

- Henter sanntidsposisjoner for alle busser i Rogaland
- Lagrer data som `kolumbus.json`
- Validerer JSON‑integritet
- Publiserer som artifact
- Brukes av sanntidskartet

### 🛣️ Fartsgrensedata fra Statens Vegvesen  
Workflow: **Fetch Rogaland speed limits**

- Henter alle fartsgrensesegmenter for Rogaland
- Deler dem opp i filer: `speedlimits_part1.json`, `speedlimits_part2.json`, …
- Validerer hver fil
- Publiserer som artifact
- Brukes av sanntidskartet og fartsgrensekartet

---

## 2. Databehandling og logikk

### 🔄 Hash‑basert endringsdeteksjon  
Deploy‑workflowen beregner en hash av alle speedlimit‑filer.  
Hvis hashen er identisk med forrige deploy → ingen deploy.

### 🕒 Freshness‑kontroll  
Begge datakildene må være oppdatert innen **3 timer** for at deploy skal kjøre.

### 🧊 Caching  
Speedlimit‑filer caches mellom kjøringer for å redusere nedlastingstid.

---

## 3. Workflow‑rekkefølge

1. Fetch Rogaland speed limits  
2. Fetch Kolumbus data  
3. Update Enterprise Dashboard  
4. Deploy frontend  

Dette sikrer at dashboardet alltid er oppdatert før frontend deployes.

---

# 3. Sanntidskartet

Sanntidskartet (`realtime.html`) gir en detaljert og interaktiv visning av kollektivtrafikken i Rogaland.

## Funksjoner

### ✔ Live bussposisjoner  
Hentet fra `kolumbus.json`.

### ✔ Fart og retning  
Vises i et infopanel når du klikker på en buss.

### ✔ Automatisk fartsgrense‑matching  
Frontend laster alle `speedlimits_partX.json` og:

1. bygger et cachet datasett  
2. pre‑beregner bounding boxes for ytelse  
3. finner nærmeste segment med Turf.js  
4. viser fartsgrense som ikon  
5. markerer overspeed med rødt ikon  

Matching‑logikken er optimalisert for ytelse og nøyaktighet.

### ✔ Ruteinformasjon  
Viser linjenummer, destinasjon og eventuelle avvik.

### ✔ Debug‑panel (valgfritt)  
Viser:

- avstand til nærmeste segment  
- valgt segment  
- matching‑logikk  
- bounding boxes  

Dette gjør det enkelt å feilsøke datakvalitet og matching.

---

# 4. Fartsgrensekartet

Fartsgrensekartet (`web/test_speedlimits.html`) visualiserer alle fartsgrensesegmenter i Rogaland.

## Funksjoner

### ✔ Segmentvisning  
Klikk på et segment for å se:

- fartsgrense  
- geometri  
- segment‑ID  

### ✔ Heatmap  
Gir et visuelt bilde av fartsfordelingen i regionen.

### ✔ Debug‑modus  
Viser bounding boxes og matching‑logikk.

---

# 5. Enterprise Dashboard

Dashboardet genereres automatisk av workflowen **Update Enterprise Dashboard**.

## Funksjoner

- viser siste genereringstidspunkt  
- viser hash av speedlimit‑data  
- viser systemhelse  
- viser metadata  
- lenker til alle verktøy  
- genereres fra `status.html.template`  
- deployes kun hvis innholdet faktisk endres  

Dashboardet fungerer som et kontrollpanel for hele systemet.

---

# 6. Filstruktur

Prosjektet er organisert slik at både frontend, data og automatiske workflows er tydelig separert:
/
├── assets/                # Ikoner, CSS, bilder
├── dashboard/             # Dashboard template + generert dashboard
│   ├── status.html.template
│   ├── status.html         # Genereres av workflow
│   └── assets/
├── data/                  # Kolumbus-data (main branch)
├── scripts/               # JS-moduler brukt av frontend
├── web/                   # Frontend-komponenter
│   ├── style.css
│   ├── test_speedlimits.html
│   └── ...
├── realtime.html           # Sanntidskart
├── index.html              # Forside
└── .github/workflows/     # Alle automatiske pipelines

Denne strukturen gjør det enkelt å:

- oppdatere frontend uten å påvirke dashboardet  
- generere dashboardet separat  
- holde data og kode adskilt  
- deploye kun det som faktisk endres  

---

# 7. Deploy‑logikk

Frontend deployes via workflowen **Deploy frontend to GitHub Pages**.

## Viktige prinsipper

### ✔ `keep_files: true`
Dette er avgjørende for at dashboardet ikke slettes av frontend‑deployen.

- Filer som **ikke endres** → beholdes i `gh-pages`
- Filer som **endres** → overskrives
- Dashboardet slettes aldri av frontend‑deploy
- Dashboardet oppdateres kun av workflowen **Update Enterprise Dashboard**

## Deploy‑pipeline i praksis

1. Henter siste vellykkede speedlimit‑run  
2. Henter siste vellykkede Kolumbus‑run  
3. Validerer data  
4. Kopierer frontendfiler til `public/`  
5. Kopierer dashboardet (som allerede ligger i gh-pages)  
6. Deployer til GitHub Pages med `keep_files: true`

## Resultat

- gh-pages blir stabil og forutsigbar  
- kun nødvendige filer oppdateres  
- dashboardet lever sitt eget liv og oppdateres kun når det faktisk endres  

---

# 8. Videre arbeid

Mulige forbedringer og utvidelser:

### 🔹 API-basert dashboardstatus
Dashboardet kan hente sanntidsstatus direkte fra GitHub Actions eller eksterne API-er.

### 🔹 Websocket-basert sanntidsoppdatering
Sanntidskartet kan oppdateres uten polling for enda raskere respons.

### 🔹 Automatisk generert changelog
Basert på datahash, commit‑meldinger eller workflow‑resultater.

### 🔹 Full systemhelse-monitor
Dashboardet kan vise:
- responstid
- datakvalitet
- siste vellykkede run
- feilhistorikk
- datamengde per dag

### 🔹 Avansert matching-visualisering
F.eks. vise hvilke segmenter som matches i sanntid, heatmap for avvik, eller historiske fartsmønstre.

---

# 9. Lisens

Prosjektet kan lisensieres etter behov.  
Legg inn ønsket lisens i `LICENSE`‑filen i rotmappen.
