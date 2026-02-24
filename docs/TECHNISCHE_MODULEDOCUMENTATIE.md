# Technische moduledocumentatie

Dit document beschrijft per module in `src/`:

- verantwoordelijkheid
- belangrijkste functies/props
- input/output contract
- aandachtspunten voor onderhoud

---

## 1. Applicatie-shell

### `src/main.jsx`
- **Rol:** Bootstrap van React app.
- **Doet:** mount `App` in `#root` met `React.StrictMode`.
- **I/O:** geen externe contracten; enkel rendering-entrypoint.

### `src/App.jsx`
- **Rol:** centrale orchestrator van alle stappen in de conversieflow.
- **State domeinen:**
  - upload + ruwe data (`rawRows`, `headerIndex`)
  - excel (`excelWorkbook`, `excelSheets`, `selectedSheet`)
  - mapping (`columns`, `mapping`, validatiestatus)
  - type/level (`anchorIndex`, `anchorSpec`, `typedRows`, `effectiveRows`)
  - pdf (`pdfFile`, `pdfMeta`, `pdfRowsRaw`, `generatedRoot`, `pdfPreparedRowsAll`)
- **Belangrijkste verantwoordelijkheden:**
  - routeert schermen via `step`
  - converteert input (CSV/XLSX/PDF) naar `rowsAll`
  - past type- en level-engines toe
  - start export naar CSV/XLSX
- **Output-contract voor export:** array objecten met `Type`, `Level` + vaste doelvelden.
- **Aandachtspunt:** dit bestand bevat veel flowlogica; opsplitsing in hooks (`useImportFlow`, `useTypingFlow`) zou onderhoud verbeteren.

### `src/App.css` & `src/index.css`
- **Rol:** globale/starter-styling.
- **Status:** bevat grotendeels template-styles; beperkt gekoppeld aan domeinlogica.

---

## 2. Config

### `src/config/constants.js`
- **Rol:** centrale constants voor UI en dataverwerking.
- **Belangrijk:**
  - `TARGET_FIELDS`: opties in mapping-UI
  - `ORDERED_OUTPUT_FIELDS`: vaste exportvolgorde
  - `NUMERIC_TARGETS`: velden die numeriek geparsed moeten worden
  - `MAX_LEVEL`: maximale hiërarchiediepte
  - `PREVIEW_COUNT`: limiet voor previewtabellen
- **Contract:** alle engines/screens moeten deze constants als bron van waarheid gebruiken.

---

## 3. Utilities

### `src/utils/format.js`
- **`normalizeStr(x)`**: trim + null-safe stringify.
- **`parseStrictNumber(x)`**: parse van Europese/US notatie (`1.234,56`, `1234.56`) naar `number | null`.
- **`clamp(n, min, max)`**: begrenzing van numerieke waardes.
- **Gebruik:** import-, type- en exportengines vertrouwen op consistente normalisatie.

### `src/utils/mapping.js`
- **Rol:** eenvoudige mappingheuristiek op basis van kolomnaam.
- **Belangrijkste API:**
  - `suggestTargetField(colName)`
  - `buildInitialMapping(columns)`
  - `mappedTargets(mapping)`
  - `targetToSource(mapping, target)`
- **Contract:** mappingobject heeft vorm `{ bronKolom: doelveld }`.

### `src/utils/codes.js`
- **Rol:** classificatie van codepatronen voor hoofdstukdetectie en levelbepaling.
- **Belangrijkste API:**
  - `isLikelyCode`, `looksLikeProjectInfo`
  - `normalizeCode1`, `codeClass`, `dottedDepth`
  - `capsRatio`, `isCapsShort`
- **Codeklassen:** `H_PREFIX`, `ROMAN`, `LETTER`, `INT`, `DOTTED`, `WORDNUM`, `OTHER`, `EMPTY`.

---

## 4. Import-modules

### `src/features/import/csv.js`
- **Rol:** CSV-bestand inlezen naar 2D array (`Array<Array<any>>`).
- **Techniek:** `Papa.parse` zonder headermodus.
- **Output:** ruwe rijen, nog zonder kolomnamen-objectmapping.

### `src/features/import/excel.js`
- **Rol:** Excel workbook laden en sheet omzetten naar 2D array.
- **Belangrijk:**
  - `readExcelToWorkbook(file)`
  - `workbookToRows(workbook, sheetName)`
- **Techniek:** SheetJS `sheet_to_json(..., { header: 1 })`.

### `src/features/import/headerDetection.js`
- **Rol:** detecteert vermoedelijke header-rij en bouwt objectrijen.
- **Belangrijkste API:**
  - `suggestHeaderIndex(rawRows)`
  - `buildRowsFromRaw(rawRows, headerIndex)`
- **Heuristiek:** score op hintwoorden, niet-numerieke dichtheid, rijbreedte.
- **Output:** `{ headers, objects }` waarbij `objects` `Array<Record<string, any>>` is.

### `src/features/import/pdf/columnGuides.js`
- **Rol:** PDF-tabelextractie ondersteunen via kolomgeleiders.
- **Belangrijkste API:**
  - `detectColumnGuides(selection, itemsInSelection)`
  - `rowClusterAndBinByGuides(itemsInSelection, selection, guides)`
- **Werking:**
  - cluster tekst op Y-as naar rijen
  - detecteer mogelijke kolomscheidingen via witte ruimte en X-clusters
  - bin tekstitems per kolomgrens
- **Output:** rijen als array van cell-strings.

---

## 5. Typing/Level engines

### `src/features/typing/typeEngine.js`
- **Rol:** automatische rijtypeclassificatie `H/P/T`.
- **Belangrijkste API:** `computeAutoTypes(rows, ctx)`.
- **Contextcontract (`ctx`):**
  - `getVal`
  - `code1Source`, `descSource`, `qtySource`, `ecSource`, `hcSource`
- **Kernlogica:**
  - Post bij kwantiteit/eenheid-signalen
  - Hoofdstuk bij sterke codeklassen
  - anders tekst/fallback

### `src/features/typing/levelEngine.js`
- **Rol:** automatische levelbepaling op basis van types + codepatronen + anker.
- **Belangrijkste API:**
  - `deriveAnchorFromFirstChapterRow(firstChapterRow, ctx)`
  - `computeAutoLevelsFromTypes(rows, types, anchorSpec, ctx)`
- **Werking:** stack-based nesting; hoofdstukken bepalen nieuwe context, andere rijen hangen onder huidige context.

---

## 6. Tree preview

### `src/features/tree/MeetstaatTreePreview.jsx`
- **Rol:** visualisatie van effectieve structuur als uitklapbare boom.
- **Input:** `effectiveRows` met minstens `{ type, level, row, _idx }`.
- **Belangrijk:** berekent parent-child via levels + hoofdstukstack.
- **UI-acties:**
  - expand/collapse
  - terug naar mapping
  - terug naar type/level-correcties
  - verder naar export

---

## 7. Export-modules

### `src/features/export/exportLogic.js`
- **Rol:** omzetting van interne rows naar exportschema.
- **Belangrijkste API:**
  - `buildExportRows(buildArgs)`
  - `exportRowsToXlsx(buildArgs, filename)`
- **Regels:**
  - vult altijd `Type` en `Level`
  - outputvolgorde via `ORDERED_OUTPUT_FIELDS`
  - numerieke parse op targets in `NUMERIC_TARGETS`
  - `EKP/EVP` enkel voor type `P`

### `src/features/export/download.js`
- **Rol:** browser-download voor CSV en XLSX.
- **Belangrijk:**
  - `downloadCSV(data, filename)` via `Papa.unparse`
  - `downloadXLSX(data, filename)` met expliciete nummerconversie per cel

### `src/features/export/excel.js`
- **Rol:** eenvoudige generieke XLSX-exporthelper.
- **API:** `exportToXlsx(rows, filename)`.
- **Opmerking:** deels overlap met `downloadXLSX`; consolidatie is mogelijk.

---

## 8. Mapping-module (feature)

### `src/features/mapping/mappingLogic.js`
- **Rol:** alternatieve/uitgebreide mappingsuggestie met data-driven fallback voor `Code1`.
- **Belangrijk:**
  - kan codekolom detecteren op basis van rijwaarden (`scoreCodeColumn`)
  - bevat gelijkaardige API als `src/utils/mapping.js`
- **Aandachtspunt:** momenteel dubbele verantwoordelijkheid met `utils/mapping.js`; idealiter één bron kiezen.

---

## 9. Screens (UI-stappen)

### `src/screens/UploadScreen.jsx`
- Bestandsselectie voor CSV/XLS/XLSX/PDF.

### `src/screens/PickSheetScreen.jsx`
- Excel-tabbladselectie vóór row-extractie.

### `src/screens/PickHeaderScreen.jsx`
- Header-rijkeuze op basis van preview van ruwe rijen.

### `src/screens/MappingScreen.jsx`
- Bronkolommen mappen op doelvelden + basisvalidatiefeedback.

### `src/screens/AnchorScreen.jsx`
- Eerste hoofdstukregel (anker) kiezen voor levelinferentie.

### `src/screens/TypeLevelScreen.jsx`
- Handmatige correctie van type en level per rij.

### `src/screens/ExportScreen.jsx`
- Trigger voor CSV- of XLSX-download.

### `src/screens/PdfSelectTableScreen.jsx`
- PDF renderen, selectierechthoek tekenen, kolomgeleiders detecteren/aanpassen, tabel extraheren.

### `src/screens/PdfStructureScreen.jsx`
- Kolomrollen en rijtypes instellen voor PDF-rijen.
- Ondersteunt:
  - `Code+Omschrijving (split)`
  - subtotaal-filtering
  - merge van vervolgregels
  - optioneel gegenereerd boven-hoofdstuk

### `src/screens/PdfReviewScreen.jsx`
- Review/correctie van PDF-afgeleide rijen vóór algemene mappingflow.
- Regels voor hoofdstuknormalisatie (bv. auto `H1`, `H2` als code leeg is).

### `src/screens/PdfAnalyzeScreen.jsx`
- Placeholder-analysecomponent (in huidige flow niet de primaire route).

---

## 10. Datacontracten (samenvatting)

### Ruwe import
- `rawRows: Array<Array<any>>`

### Geparste rijen
- `rowsAll: Array<Record<string, any>>`

### Mapping
- `mapping: Record<string, TargetField>`
- `TargetField ∈ {Niet gebruiken, Code1, Code2, Code3, Code4, Omschrijving, HC, EC, Aantal, EKP, EVP}`

### Typing/level
- `typedRows: Array<{ row, autoType, type, autoLevel, manualLevel }>`
- `effectiveRows: typedRows + berekende/finale level + _idx`

### Exportrow
- `{ Type, Level, Code1, Code2, Code3, Code4, Omschrijving, HC, EC, Aantal, EKP, EVP }`

---

## 11. Onderhoudsadvies

1. **Deduplicatie mappinglogica:** fuseer `features/mapping/mappingLogic.js` en `utils/mapping.js`.
2. **Flowlogica modulariseren:** verplaats state + flowtransities uit `App.jsx` naar hooks/services.
3. **Eenduidige exportlaag:** kies één XLSX-pad (`download.js` vs `excel.js`).
4. **Tests per engine:** voeg unit-tests toe voor `format`, `codes`, `typeEngine`, `levelEngine`, `headerDetection`.
