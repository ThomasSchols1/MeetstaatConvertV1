import React, { useMemo, useState } from "react";
import "./App.css";

// ---------- config / utils ----------
import { MAX_LEVEL, ORDERED_OUTPUT_FIELDS, NUMERIC_TARGETS } from "./config/constants";
import { normalizeStr, clamp } from "./utils/format";
import { buildInitialMapping, targetToSource } from "./utils/mapping";
import { isLikelyCode, looksLikeProjectInfo } from "./utils/codes";

// ---------- import helpers ----------
import { suggestHeaderIndex, buildRowsFromRaw } from "./features/import/headerDetection";
import { readCsvToRows } from "./features/import/csv";
import { readExcelToWorkbook, workbookToRows } from "./features/import/excel";


// ---------- engines ----------
import { computeAutoTypes } from "./features/typing/typeEngine";
import { deriveAnchorFromFirstChapterRow, computeAutoLevelsFromTypes } from "./features/typing/levelEngine";

// ---------- export ----------
import { buildExportRows } from "./features/export/exportLogic";
import { downloadCSV } from "./features/export/download";
import { exportToXlsx } from "./features/export/excel";

// ---------- screens ----------
import UploadScreen from "./screens/UploadScreen";
import PickSheetScreen from "./screens/PickSheetScreen";
import PickHeaderScreen from "./screens/PickHeaderScreen";
import MappingScreen from "./screens/MappingScreen";
import AnchorScreen from "./screens/AnchorScreen";
import TypeLevelScreen from "./screens/TypeLevelScreen";
import ExportScreen from "./screens/ExportScreen";
import PdfReviewScreen from "./screens/PdfReviewScreen";


// ---------- tree preview ----------
import MeetstaatTreePreview from "./features/tree/MeetstaatTreePreview";

// ---------- PDF screens ----------
import PdfSelectTableScreen from "./screens/PdfSelectTableScreen";
import PdfStructureScreen from "./screens/PdfStructureScreen";

export default function App() {
  const [step, setStep] = useState("upload");

  // -------------------- RAW INPUT (CSV/XLSX/PDF -> rawRows) --------------------
  const [rawRows, setRawRows] = useState([]); // Array<Array<any>>
  const [headerIndex, setHeaderIndex] = useState(0);

  // -------------------- XLSX --------------------
  const [excelWorkbook, setExcelWorkbook] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [pdfPreparedRowsAll, setPdfPreparedRowsAll] = useState([]);


  // -------------------- parsed objects after header --------------------
  const [columns, setColumns] = useState([]);
  const [rowsAll, setRowsAll] = useState([]); // Array<Object>

  // mapping source column -> target field
  const [mapping, setMapping] = useState({});

  // anchor row index (in rowsAll)
  const [anchorIndex, setAnchorIndex] = useState(0);

  // anchor spec used for level inference
  const [anchorSpec, setAnchorSpec] = useState({
    class: null,
    dottedDepth: 0,
    example: "",
  });

  // typed rows (after clean + slice from anchor)
  const [typedRows, setTypedRows] = useState([]); // [{row, autoType, type, autoLevel, manualLevel}]

  // -------------------- PDF --------------------
  const [pdfFile, setPdfFile] = useState(null);

  const [pdfMeta, setPdfMeta] = useState({
    fileName: "",
    pages: 0,
    titleGuess: "",
  });

  const [pdfRowsRaw, setPdfRowsRaw] = useState([]); // Array<Array<string>>

  const [generatedRoot, setGeneratedRoot] = useState({
    enabled: true,
    title: "",
  });

  // -------------------- helpers --------------------
  function resetAll() {
    setRawRows([]);
    setHeaderIndex(0);

    setExcelWorkbook(null);
    setExcelSheets([]);
    setSelectedSheet("");

    setColumns([]);
    setRowsAll([]);
    setMapping({});

    setAnchorIndex(0);
    setAnchorSpec({ class: null, dottedDepth: 0, example: "" });

    setTypedRows([]);

    // pdf
    setPdfFile(null);
    setPdfMeta({ fileName: "", pages: 0, titleGuess: "" });
    setPdfRowsRaw([]);
    setGeneratedRoot({ enabled: true, title: "" });
  }

  function getVal(row, col) {
    return col ? row?.[col] : "";
  }

  // -------------------- mapping validation --------------------
  const status = useMemo(() => {
    const values = Object.values(mapping);
    const count = (t) => values.filter((v) => v === t).length;

    const errors = [];
    const hasCode1 = count("Code1") === 1;

if (!hasCode1) {
  // toegestaan voor ongestructureerde offertes
  // we gaan later alles onder 1 hoofdstuk hangen
}

    if (count("Omschrijving") !== 1) errors.push("Omschrijving is verplicht.");

    const seen = new Set();
    const dup = new Set();
    for (const v of values) {
      if (v === "Niet gebruiken") continue;
      if (seen.has(v)) dup.add(v);
      else seen.add(v);
    }
    if (dup.size > 0) errors.push(`Doelveld dubbel gebruikt: ${[...dup].join(", ")}`);

    return { ok: errors.length === 0, errors };
  }, [mapping]);

  // -------------------- derived sources --------------------
  const code1Source = useMemo(() => targetToSource(mapping, "Code1"), [mapping]);
  const descSource = useMemo(() => targetToSource(mapping, "Omschrijving"), [mapping]);
  const qtySource = useMemo(() => targetToSource(mapping, "Aantal"), [mapping]);
  const ecSource = useMemo(() => targetToSource(mapping, "EC"), [mapping]);
  const hcSource = useMemo(() => targetToSource(mapping, "HC"), [mapping]);

  // (optioneel, voor export)
  const ekpSource = useMemo(() => targetToSource(mapping, "EKP"), [mapping]);
  const evpSource = useMemo(() => targetToSource(mapping, "EVP"), [mapping]);

  // -------------------- Upload handler (CSV/XLSX/PDF) --------------------
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    resetAll();

    const name = file.name.toLowerCase();

    // PDF
    if (name.endsWith(".pdf")) {
      setPdfFile(file);
      setGeneratedRoot({
        enabled: true,
        title: file.name.replace(/\.pdf$/i, ""),
      });
      setStep("pdfSelect");
      return;
    }

    // CSV
    if (name.endsWith(".csv")) {
      const rows = await readCsvToRows(file);
      setRawRows(rows);
      setHeaderIndex(suggestHeaderIndex(rows));
      setStep("pickHeader");
      return;
    }

    // Excel
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = await readExcelToWorkbook(file);
      setExcelWorkbook(wb);
      setExcelSheets(wb.SheetNames || []);
      setSelectedSheet((wb.SheetNames && wb.SheetNames[0]) || "");
      setStep("pickSheet");
      return;
    }

    alert("Upload een CSV, XLSX/XLS of PDF.");
  }

  function confirmSheet() {
    const rows = workbookToRows(excelWorkbook, selectedSheet);
    setRawRows(rows);
    setHeaderIndex(suggestHeaderIndex(rows));
    setStep("pickHeader");
  }

  // -------------------- Header selection confirm --------------------
  function applyHeaderSelection() {
    const { headers, objects } = buildRowsFromRaw(rawRows, headerIndex);
    setColumns(headers);
    setRowsAll(objects);

    // initial mapping suggestion
    setMapping(buildInitialMapping(headers, objects));


    setAnchorIndex(0);
    setAnchorSpec({ class: null, dottedDepth: 0, example: "" });
    setTypedRows([]);

    setStep("mapping");
  }

  // -------------------- Anchor suggestion --------------------
  function suggestAnchorIndex() {
    const codeCol = targetToSource(mapping, "Code1");
    const descCol = targetToSource(mapping, "Omschrijving");

    let suggested = 0;

    for (let i = 0; i < Math.min(rowsAll.length, 800); i++) {
      const rr = rowsAll[i] || {};
      const code = codeCol ? rr[codeCol] : "";
      const desc = descCol ? rr[descCol] : "";

      if (!normalizeStr(code) && !normalizeStr(desc)) continue;

      if (isLikelyCode(code)) {
        suggested = i;
        break;
      }
      if (normalizeStr(desc) && !looksLikeProjectInfo(desc)) {
        suggested = i;
        break;
      }
    }

    return clamp(suggested, 0, Math.max(0, rowsAll.length - 1));
  }

  function goToAnchorStep() {
    if (!status.ok) return;

    const suggested = suggestAnchorIndex();
    setAnchorIndex(suggested);
    setStep("anchor");
  }

  // -------------------- Build typedRows from anchor --------------------
  function buildFromAnchorAndGoTree() {
    try {
      const codeCol = targetToSource(mapping, "Code1");
      const hasStructure = Boolean(codeCol);
      const descCol = targetToSource(mapping, "Omschrijving");

      // slice from anchor
      const sliced = rowsAll.slice(anchorIndex);

      // clean: drop rows with empty description
      const cleaned = sliced.filter((r) => normalizeStr(descCol ? r?.[descCol] : "").length > 0);

      // auto types
      const autos = computeAutoTypes(cleaned, {
        getVal,
        code1Source: codeCol,
        descSource: descCol,
        qtySource: targetToSource(mapping, "Aantal"),
        ecSource: targetToSource(mapping, "EC"),
        hcSource: targetToSource(mapping, "HC"),
      });

      // anchor spec + auto levels
      const firstRow = cleaned[0];
      const spec = firstRow
        ? deriveAnchorFromFirstChapterRow(firstRow, { getVal, code1Source: codeCol })
        : { class: null, dottedDepth: 0, example: "" };
      setAnchorSpec(spec);

      const autoLevels = computeAutoLevelsFromTypes(cleaned, autos, spec, {
        getVal,
        code1Source: codeCol,
        maxLevel: MAX_LEVEL,
      });

      let tr;

      if (!hasStructure) {
        // 🔹 ONGestructureerde offerte (geen Code1)
        tr = cleaned.map((row) => ({
          row,
          autoType: "T", // alles is een post
          type: "T",
          autoLevel: 1, // alles op level 1
          manualLevel: 1,
        }));

        // forceer anchorSpec: 1 hoofdstuk op level 0
        setAnchorSpec({
          class: "HOOFDSTUK",
          dottedDepth: 0,
          example: generatedRoot.title || "Offerte",
        });
      } else {
        // 🔹 Normale gestructureerde meetstaat
        tr = cleaned.map((row, idx) => ({
          row,
          autoType: autos[idx],
          type: autos[idx],
          autoLevel: autoLevels[idx],
          manualLevel: null,
        }));
      }

      setTypedRows(tr);
      setStep("treePreview");
    } catch (err) {
      console.error("Kon anker niet bevestigen", err);

      const descCol = targetToSource(mapping, "Omschrijving");
      const fallbackRows = rowsAll
        .slice(anchorIndex)
        .filter((r) => normalizeStr(descCol ? r?.[descCol] : "").length > 0)
        .map((row) => ({
          row,
          autoType: "T",
          type: "T",
          autoLevel: 1,
          manualLevel: 1,
        }));

      setAnchorSpec({ class: "HOOFDSTUK", dottedDepth: 0, example: generatedRoot.title || "Offerte" });
      setTypedRows(fallbackRows);
      setStep("treePreview");
    }
  }

  // -------------------- effectiveRows (live computed levels) --------------------
  const effectiveRows = useMemo(() => {
    if (!typedRows.length) return [];

    const rows = typedRows.map((x) => x.row);
    const types = typedRows.map((x) => x.type || x.autoType || "T");

    const codeCol = targetToSource(mapping, "Code1");

    const computed = computeAutoLevelsFromTypes(rows, types, anchorSpec, {
      getVal,
      code1Source: codeCol,
      maxLevel: MAX_LEVEL,
    });

    return typedRows.map((it, idx) => {
      const level = it.manualLevel == null ? computed[idx] : clamp(it.manualLevel, 0, MAX_LEVEL);
      return { ...it, computedLevel: computed[idx], level, _idx: idx };
    });
  }, [typedRows, mapping, anchorSpec]);

  function updateRowType(index, newType) {
    setTypedRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], type: newType };
      return next;
    });
  }

  function updateRowManualLevel(index, value) {
    const raw = normalizeStr(value);
    let ml = null;
    if (raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) ml = clamp(Math.trunc(n), 0, MAX_LEVEL);
    }
    setTypedRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], manualLevel: ml };
      return next;
    });
  }

  // -------------------- Export data --------------------
  function getExportData() {
    return buildExportRows({
      effectiveRows,
      mapping,
      ORDERED_OUTPUT_FIELDS,
      NUMERIC_TARGETS,
      targetToSource,
    });
  }

  // -------------------- PDF -> mapping pipeline --------------------
  function proceedFromPdfStructure() {
    let rows = [...pdfRowsRaw];

    // Optioneel: generatedRoot als extra "rij" bovenaan
    if (generatedRoot.enabled) {
      const title =
        generatedRoot.title || pdfMeta.titleGuess || pdfMeta.fileName || "Offerte";
      rows.unshift([title]);
    }

    setRawRows(rows);
    setHeaderIndex(0);
    setStep("pickHeader");
  }

  // -------------------- UI --------------------
return (
  <div className="app-shell">
    <div className="app-header">
      <div className="app-title">
        <h2>Meetstaat Converter</h2>
        <div className="app-subtitle">Upload, controleer structuur en exporteer.</div>
      </div>
      <div className="step-pill">{step}</div>
    </div>

    {anchorSpec?.class ? (
      <div className="notice" style={{ marginBottom: 12 }}>
        Anker: <b>{anchorSpec.class}</b> · voorbeeld: <b>{anchorSpec.example || "-"}</b>
      </div>
    ) : null}

    {/* -------------------- UPLOAD -------------------- */}
    {step === "upload" && <UploadScreen onFile={handleFile} />}

    {/* -------------------- EXCEL TAB SELECT -------------------- */}
    {step === "pickSheet" && (
      <PickSheetScreen
        sheets={excelSheets}
        selected={selectedSheet}
        onChange={setSelectedSheet}
        onConfirm={confirmSheet}
        onBack={() => setStep("upload")}
      />
    )}

    {/* ========================================================= */}
    {/* ======================= PDF FLOW ======================== */}
    {/* ========================================================= */}

    {/* ---------- PDF: selecteer tabel ---------- */}
    {step === "pdfSelect" && (
      <PdfSelectTableScreen
        pdfFile={pdfFile}
        onBack={() => setStep("upload")}
        onExtract={(rawRowsFromPdf, meta) => {
          setPdfMeta(meta);
          setPdfRowsRaw(rawRowsFromPdf);

          setGeneratedRoot((prev) => ({
            ...prev,
            title: prev.title || meta.titleGuess || "",
          }));

          setStep("pdfStructure");
        }}
      />
    )}

    {/* ---------- PDF: structuur + rijtypes ---------- */}
    {step === "pdfStructure" && (
      <PdfStructureScreen
        pdfRowsRaw={pdfRowsRaw}
        pdfMeta={pdfMeta}
        generatedRoot={generatedRoot}
        setGeneratedRoot={setGeneratedRoot}
        onBack={() => setStep("pdfSelect")}
        onNext={({ rowsAll }) => {
          // Zorg dat basisvelden altijd bestaan
          const ensuredRows = (rowsAll || []).map((r) => ({
            Code1: r.Code1 ?? "",
            Omschrijving: r.Omschrijving ?? "",
            HC: r.HC ?? "",
            Aantal: r.Aantal ?? "",
            EC: r.EC ?? "",
            EKP: r.EKP ?? "",
            EVP: r.EVP ?? "",
            __rowType: r.__rowType || "Tekst",
          }));

          // Standaard kolommen voor PDF flow
          const ensuredColumns = [
            "Code1",
            "Omschrijving",
            "HC",
            "Aantal",
            "EC",
            "EKP",
            "EVP",
          ];

          const ensuredMapping = {
            Code1: "Code1",
            Omschrijving: "Omschrijving",
            HC: "HC",
            Aantal: "Aantal",
            EC: "EC",
            EKP: "EKP",
            EVP: "EVP",
          };

          setColumns(ensuredColumns);
          setMapping(ensuredMapping);

          setPdfPreparedRowsAll(ensuredRows);
          setStep("pdfReview");
        }}
      />
    )}

    {/* ---------- PDF: resultaat preview ---------- */}
    {step === "pdfReview" && (
      <PdfReviewScreen
        initialRowsAll={pdfPreparedRowsAll}
        onBack={() => setStep("pdfStructure")}
        onConfirm={(finalRowsAll) => {
          setRowsAll(finalRowsAll);

          setAnchorIndex(0);
          setAnchorSpec({ class: null, dottedDepth: 0, example: "" });
          setTypedRows([]);

          setStep("mapping");
        }}
      />
    )}

    {/* ========================================================= */}
    {/* =================== NORMALE FLOW ======================== */}
    {/* ========================================================= */}

    {step === "pickHeader" && (
      <PickHeaderScreen
        rawRows={rawRows}
        headerIndex={headerIndex}
        setHeaderIndex={setHeaderIndex}
        onBack={() => {
          if (pdfFile) return setStep("pdfStructure");
          if (excelWorkbook) return setStep("pickSheet");
          return setStep("upload");
        }}
        onConfirm={applyHeaderSelection}
      />
    )}

    {step === "mapping" && (
      <MappingScreen
        columns={columns}
        mapping={mapping}
        setMapping={setMapping}
        status={status}
        onBack={() =>
          pdfPreparedRowsAll.length
            ? setStep("pdfReview")
            : setStep("pickHeader")
        }
        onNext={goToAnchorStep}
      />
    )}

    {step === "anchor" && (
      <AnchorScreen
        rowsAll={rowsAll}
        anchorIndex={anchorIndex}
        setAnchorIndex={setAnchorIndex}
        code1Source={code1Source}
        descSource={descSource}
        getVal={getVal}
        onBack={() => setStep("mapping")}
        onConfirm={buildFromAnchorAndGoTree}
      />
    )}

    {step === "treePreview" && (
      <MeetstaatTreePreview
        effectiveRows={effectiveRows}
        getVal={getVal}
        code1Source={code1Source}
        descSource={descSource}
        qtySource={qtySource}
        ecSource={ecSource}
        hcSource={hcSource}
        onCorrectMapping={() => setStep("mapping")}
        onCorrectLevels={() => setStep("typeLevel")}
        onNext={() => setStep("export")}
      />
    )}

    {step === "typeLevel" && (
      <TypeLevelScreen
        effectiveRows={effectiveRows}
        updateRowType={updateRowType}
        updateRowManualLevel={updateRowManualLevel}
        onBack={() => setStep("treePreview")}
        onNext={() => setStep("treePreview")}
        code1Source={code1Source}
        descSource={descSource}
        getVal={getVal}
        maxLevel={MAX_LEVEL}
      />
    )}

    {step === "export" && (
      <ExportScreen
        onBack={() => setStep("treePreview")}
        onCSV={() => downloadCSV(getExportData())}
        onXLSX={() => exportToXlsx(getExportData(), "meetstaat.xlsx")}
      />
    )}
  </div>
);
}
