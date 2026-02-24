# Meetstaat Converter V1

Een React/Vite webapp om **CSV, Excel en PDF-offertes** om te zetten naar een gestructureerde meetstaat met:

- hiërarchie via `Type` (`H`, `P`, `T`)
- niveau (`Level`)
- gestandaardiseerde velden (`Code1..4`, `Omschrijving`, `HC`, `EC`, `Aantal`, `EKP`, `EVP`)
- export naar **CSV** en **XLSX**

De app is ontworpen voor offertes/meetstaten die in de praktijk vaak rommelig zijn (wisselende kolomnamen, gemengde nummernotaties, subtotalen, vervolgregels, enz.).

---

## Inhoud

- [Belangrijkste mogelijkheden](#belangrijkste-mogelijkheden)
- [Technische stack](#technische-stack)
- [Projectstructuur](#projectstructuur)
- [Werking van de conversieflow](#werking-van-de-conversieflow)
  - [Flow A: CSV/XLSX](#flow-a-csvxlsx)
  - [Flow B: PDF](#flow-b-pdf)
- [Type- en levellogica](#type--en-levellogica)
- [Exportlogica](#exportlogica)
- [Installatie & starten](#installatie--starten)
- [Beschikbare scripts](#beschikbare-scripts)
- [Gebruikstips](#gebruikstips)
- [Beperkingen (V1)](#beperkingen-v1)
- [Roadmap-ideeën](#roadmap-ideeën)
- [Technische moduledocumentatie](docs/TECHNISCHE_MODULEDOCUMENTATIE.md)

---

## Technische moduledocumentatie

Gedetailleerde, technische documentatie **per module** staat in:

- [`docs/TECHNISCHE_MODULEDOCUMENTATIE.md`](docs/TECHNISCHE_MODULEDOCUMENTATIE.md)

Dit document beschrijft per bestand de verantwoordelijkheid, API's, datacontracten en onderhoudspunten.

---

## Belangrijkste mogelijkheden

1. **Import van meerdere bestandsformaten**
   - `.csv`
   - `.xlsx` / `.xls`
   - `.pdf` (interactieve tabelextractie via selectiekader + kolomgeleiders)

2. **Semiautomatische kolommapping**
   - suggesties op basis van kolomnaam (bv. `omschrijving`, `qty`, `ekp`, ...)
   - validatie op verplichte velden (minimaal `Omschrijving`)

3. **Detectie en correctie van structuur**
   - automatische typebepaling per rij (`H`, `P`, `T`)
   - automatische levelbepaling op basis van codepatronen en gekozen anker
   - manuele correcties in een aparte correctiescreen

4. **Boompreview van de meetstaat**
   - uitklapbare hoofdstukstructuur
   - snel terugkeren om mapping/types/levels bij te sturen

5. **Export**
   - CSV-download
   - XLSX-download met numerieke cellen voor `Aantal`, `EKP`, `EVP`

---

## Technische stack

- **Frontend:** React 18
- **Bundler/dev server:** Vite 5
- **CSV parsing:** PapaParse
- **Excel import/export:** SheetJS (`xlsx`)
- **PDF rendering en tekstextractie:** `pdfjs-dist`

Alles draait client-side in de browser (geen backend vereist).

---

## Projectstructuur

```text
src/
  App.jsx                         # hoofdflow + schermnavigatie
  config/constants.js             # doelvelden, limieten, preview-instellingen
  utils/
    format.js                     # normalisatie, nummerparsing, clamp
    mapping.js                    # mappingsuggesties + helpers
    codes.js                      # codeclassificatie (INT/DOTTED/ROMAN/...)

  features/
    import/
      csv.js                      # CSV -> 2D rows
      excel.js                    # Workbook inlezen + rows
      headerDetection.js          # header-rij score + objectbouw
      pdf/columnGuides.js         # detectie kolomgeleiders in PDF-selectie
    typing/
      typeEngine.js               # auto type per rij (H/P/T)
      levelEngine.js              # auto level per rij
    tree/
      MeetstaatTreePreview.jsx    # visuele boomweergave
    export/
      exportLogic.js              # opbouw exportrijen
      download.js                 # CSV/XLSX downloadhelpers
      excel.js                    # XLSX export utility

  screens/
    UploadScreen.jsx
    PickSheetScreen.jsx
    PickHeaderScreen.jsx
    MappingScreen.jsx
    AnchorScreen.jsx
    TypeLevelScreen.jsx
    PdfSelectTableScreen.jsx
    PdfStructureScreen.jsx
    PdfReviewScreen.jsx
    ExportScreen.jsx
```

---

## Werking van de conversieflow

## Flow A: CSV/XLSX

1. **Upload** van CSV/XLSX.
2. Bij Excel: kies werkblad.
3. **Headerselectie:** app stelt automatisch een header-rij voor.
4. **Kolommapping:** bronkolommen mappen naar doelvelden.
5. **Anker kiezen:** eerste hoofdstukregel selecteren (basis voor levels).
6. **Automatische typering + levelberekening.**
7. **Boompreview** en optionele manuele correcties.
8. **Export** naar CSV/XLSX.

## Flow B: PDF

1. Upload PDF.
2. In **PDF selecteer tabel**:
   - teken een selectie (rechthoek)
   - laat kolommen autodetecteren
   - verfijn met versleepbare kolomgeleiders
3. Extractie naar ruwe tabelrijen.
4. In **PDF structuur**:
   - per kolom een rol kiezen (Code1, Omschrijving, Aantal, ...)
   - per rijtype kiezen (Auto/Post/Hoofdstuk/Subtotaal/Vervolgregel/Negeer)
   - optioneel subtotalen negeren en vervolgregels samenvoegen
5. Resultaat gaat door naar dezelfde mapping/preview/export pipeline.

---

## Type- en levellogica

### Type (`H`, `P`, `T`)

- `P` (post) wordt o.a. afgeleid wanneer hoeveelheid of eenheid-gerelateerde info aanwezig is.
- `H` (hoofdstuk) wordt o.a. afgeleid uit codepatronen:
  - `H1`, `H1.2`
  - Romeinse cijfers
  - letters
  - integers
  - woorden zoals `hoofdstuk 3`
- `T` (tekst/tussenregel) is fallback wanneer een rij geen duidelijke post/hoofdstuk is.

### Level

- Level wordt bepaald met een **stack-model** op basis van hoofdstukken en een **anker** (eerste hoofdstuk).
- Dotted codes (zoals `1.2.3`) beïnvloeden diepte.
- Manuele override per rij is mogelijk (`0..MAX_LEVEL`, standaard max 6).

---

## Exportlogica

De output bevat altijd:

- `Type`
- `Level`
- daarna de vaste veldvolgorde:
  - `Code1`, `Code2`, `Code3`, `Code4`, `Omschrijving`, `HC`, `EC`, `Aantal`, `EKP`, `EVP`

Belangrijke regels:

- `Aantal`, `EKP`, `EVP` worden strikt numeriek geparsed (ondersteunt o.a. `1.234,56` en `1234.56`).
- `EKP`/`EVP` worden enkel gevuld voor `Type = P` (niet voor hoofdstukken/tekstregels).

---

## Installatie & starten

### Vereisten

- Node.js 18+ (aanbevolen LTS)
- npm

### Installatie

```bash
npm install
```

### Development server

```bash
npm run dev
```

Open daarna de URL uit de terminal (standaard meestal `http://localhost:5173`).

### Productiebouw

```bash
npm run build
```

### Lokale preview van build

```bash
npm run preview
```

---

## Beschikbare scripts

- `npm run dev` — start Vite in development mode
- `npm run build` — maakt productiebuild in `dist/`
- `npm run preview` — serveert de build lokaal

---

## Gebruikstips

- Begin bij twijfel met een conservatieve mapping: map alleen velden die je zeker kent.
- Controleer de boompreview vóór export; vooral bij gemengde codeformaten.
- Bij PDF’s met één samengevoegde kolom: gebruik `Code+Omschrijving (split)` als rol.
- Gebruik “Auto-detect rijtypes” als startpunt, daarna handmatig bijsturen op uitzonderingen.

---

## Beperkingen (V1)

- Geen backend-opslag of gebruikersaccounts.
- PDF extractie werkt op tekstgebaseerde PDF’s; scans zonder OCR leveren weinig tot geen bruikbare tekst op.
- Geen geautomatiseerde test-suite of lint-script in de huidige setup.
- Een deel van de UX/validatie is heuristisch en kan per offerte/template verschillen.

---

## Roadmap-ideeën

- OCR-integratie voor gescande PDF’s.
- Persistente projectconfiguraties (mapping-profielen per klant/sjabloon).
- Undo/redo voor mapping en type/level-aanpassingen.
- Bulkvalidaties met waarschuwingen (bijv. ontbrekende eenheden, negatieve hoeveelheden).
- Geautomatiseerde tests voor import-, type- en exportengines.

---

## Licentie

Er is momenteel geen expliciete licentie gedefinieerd in deze repository. Voeg een `LICENSE`-bestand toe indien je distributievoorwaarden wilt vastleggen.
