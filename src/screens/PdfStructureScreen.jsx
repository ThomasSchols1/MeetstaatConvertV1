import React, { useMemo, useState, useEffect } from "react";

const ROLE_OPTIONS = [
  "Niet gebruiken",
  "Code1",
  "Omschrijving",
  "Aantal",
  "EC",
  "EKP",
  "EVP",
  "HC",
  "Totaal", // enkel voor detectie / skippen
  "Code+Omschrijving (split)",
];

const ROWTYPE_OPTIONS = ["Auto", "Post", "Hoofdstuk", "Subtotaal", "Vervolgregel", "Negeer"];

function padRow(row, n) {
  const r = Array.isArray(row) ? [...row] : [];
  while (r.length < n) r.push("");
  return r.slice(0, n);
}

function isEmpty(v) {
  return String(v ?? "").trim().length === 0;
}

function splitCodeAndDesc(cell) {
  const s = String(cell || "").trim();
  // 1 / 1.1 / 1,1 + tekst
  const m = s.match(/^(\d+(?:[.,]\d+)*)(\s+)(.+)$/);
  if (!m) return null;
  return { code: m[1], desc: m[3] };
}

function looksMoney(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  // zeer permissief: 122.697,95 / -141.634,58 / 315,50
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) || /^-?\d+([.,]\d+)?$/.test(s);
}

export default function PdfStructureScreen({
  pdfRowsRaw,
  pdfMeta,
  generatedRoot,
  setGeneratedRoot,
  onBack,
  onNext, // ({ columns, rowsAll, mapping }) => void
}) {
  const previewRowCount = 40;

  const maxCols = useMemo(() => {
    const sample = (pdfRowsRaw || []).slice(0, 120);
    return sample.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0) || 1;
  }, [pdfRowsRaw]);

  const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState(true);
  const [mergeMultiline, setMergeMultiline] = useState(true);
  const [skipSubtotals, setSkipSubtotals] = useState(true);

  const [colRoles, setColRoles] = useState(() => Array(maxCols).fill("Niet gebruiken"));
  const [rowTypes, setRowTypes] = useState([]); // per datarij: "Auto" | ...

  useEffect(() => {
    // bij nieuwe pdf / andere maxCols
    setColRoles((prev) => {
      const next = Array(maxCols).fill("Niet gebruiken");
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  }, [maxCols]);

  const tableRows = useMemo(() => {
    const rows = (pdfRowsRaw || []).slice(0, previewRowCount);
    return rows.map((r) => padRow(r, maxCols));
  }, [pdfRowsRaw, maxCols]);

  const headerRow = tableRows[0] || padRow([], maxCols);
  const dataRows = useMemo(() => {
    if (!tableRows.length) return [];
    return useFirstRowAsHeader ? tableRows.slice(1) : tableRows;
  }, [tableRows, useFirstRowAsHeader]);

  useEffect(() => {
    setRowTypes((prev) => {
      const next = Array(dataRows.length).fill("Auto");
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  }, [dataRows.length]);

  function setRoleAt(idx, role) {
    setColRoles((prev) => {
      const next = [...prev];
      next[idx] = role;
      return next;
    });
  }

  function setRowTypeAt(idx, type) {
    setRowTypes((prev) => {
      const next = [...prev];
      next[idx] = type;
      return next;
    });
  }

  function getColIdx(role) {
    return colRoles.findIndex((r) => r === role);
  }

  function autoDetectRowType(row) {
    // we gebruiken gekozen kolommen als hints (maar werkt ook als niet alles gekozen is)
    const codeIdx = getColIdx("Code1");
    const descIdx = getColIdx("Omschrijving");
    const qtyIdx = getColIdx("Aantal");
    const totalIdx = getColIdx("Totaal");
    const splitIdx = getColIdx("Code+Omschrijving (split)");

    const codeVal =
      codeIdx !== -1 ? row[codeIdx] : (splitIdx !== -1 ? row[splitIdx] : "");
    const descVal =
      descIdx !== -1 ? row[descIdx] : (splitIdx !== -1 ? row[splitIdx] : "");

    const qtyVal = qtyIdx !== -1 ? row[qtyIdx] : "";
    const totVal = totalIdx !== -1 ? row[totalIdx] : "";

    const hasCodeLike = !isEmpty(codeVal) && !!String(codeVal).trim().match(/^\d+([.,]\d+)*\.?$/);
    const hasDesc = !isEmpty(descVal);
    const hasQty = !isEmpty(qtyVal);
    const hasTotal = !isEmpty(totVal) && looksMoney(totVal);

    // Subtotaal: typisch alleen totaal gevuld, geen code/qty
    if (hasTotal && !hasQty && !hasCodeLike) return "Subtotaal";

    // Hoofdstuk: vaak desc gevuld, maar geen qty, en code vaak leeg (mag ook code hebben)
    // Als er code is maar geen qty en desc is kort (bv. "Voorzien") => ook hoofdstuk
    if (hasDesc && !hasQty) {
      const s = String(descVal).trim();
      if (s.length <= 40 && (s.split(" ").length <= 6)) return "Hoofdstuk";
      // ook als er geen code/qty: kan hoofdstuk zijn
      if (!hasCodeLike) return "Hoofdstuk";
    }

    // Vervolgregel: desc gevuld maar geen code/qty/total, vaak doorlopende zin
    if (hasDesc && !hasCodeLike && !hasQty && !hasTotal) return "Vervolgregel";

    // Post: code of qty aanwezig
    if (hasCodeLike || hasQty) return "Post";

    // default: negeer
    return "Negeer";
  }

  function autoDetectAllRowTypes() {
    setRowTypes((prev) =>
      prev.map((t, idx) => (t !== "Auto" ? t : autoDetectRowType(dataRows[idx])))
    );
  }

  function applyRowType(type, fromIdx, toIdx) {
    setRowTypes((prev) => {
      const next = [...prev];
      for (let i = fromIdx; i <= toIdx; i++) next[i] = type;
      return next;
    });
  }

  function mergeContinuationIntoPrevious(rows2d, types, roleByColIdx) {
    const descCol = roleByColIdx.findIndex((r) => r === "Omschrijving" || r === "Code+Omschrijving (split)");
    if (descCol === -1) return { rows: rows2d, types };

    const outRows = [];
    const outTypes = [];

    for (let i = 0; i < rows2d.length; i++) {
      const row = [...rows2d[i]];
      const t = types[i];

      if (t === "Vervolgregel" && outRows.length > 0) {
        const prev = outRows[outRows.length - 1];
        const prevDesc = String(prev[descCol] ?? "").trim();
        const curDesc = String(row[descCol] ?? "").trim();
        prev[descCol] = prevDesc ? `${prevDesc} ${curDesc}` : curDesc;
        continue; // deze rij verdwijnt
      }

      outRows.push(row);
      outTypes.push(t);
    }

    return { rows: outRows, types: outTypes };
  }

  function validateAndContinue() {
    // 1) mapping opbouwen target -> gekozen kolom
    const usedTargets = new Map(); // target -> colIdx
    const identityMapping = {}; // target -> target (voor App mapping step)

    for (let i = 0; i < colRoles.length; i++) {
      const role = colRoles[i];
      if (!role || role === "Niet gebruiken") continue;

      if (role === "Code+Omschrijving (split)") {
        // produceert Code1 + Omschrijving
        if (usedTargets.has("Code1")) return alert("Code1 is dubbel gekozen. Kies maar 1 keer Code1 (of split).");
        if (usedTargets.has("Omschrijving")) return alert("Omschrijving is dubbel gekozen. Kies maar 1 keer Omschrijving (of split).");
        usedTargets.set("Code1", i);
        usedTargets.set("Omschrijving", i);
        identityMapping["Code1"] = "Code1";
        identityMapping["Omschrijving"] = "Omschrijving";
        continue;
      }

      // duplicates (behalve Totaal: mag maar 1 keer, maar is ok)
      if (usedTargets.has(role)) return alert(`Doelveld dubbel gebruikt: ${role}`);
      usedTargets.set(role, i);
      identityMapping[role] = role;
    }

    if (!usedTargets.has("Omschrijving")) {
      return alert("Omschrijving is verplicht. Kies een kolom als Omschrijving (of gebruik Code+Omschrijving split).");
    }

    const hasCode1 = usedTargets.has("Code1");

    // 2) rijtypes bepalen: Auto -> autoDetect
    let effectiveTypes = rowTypes.map((t, idx) => (t === "Auto" ? autoDetectRowType(dataRows[idx]) : t));

    // 3) filter subtotals indien gewenst
    let filteredRows = dataRows;
    let filteredTypes = effectiveTypes;

    if (skipSubtotals) {
      const tmpRows = [];
      const tmpTypes = [];
      for (let i = 0; i < filteredRows.length; i++) {
        if (filteredTypes[i] === "Subtotaal") continue;
        tmpRows.push(filteredRows[i]);
        tmpTypes.push(filteredTypes[i]);
      }
      filteredRows = tmpRows;
      filteredTypes = tmpTypes;
    }

    // 4) merge vervolgregels (indien gewenst)
    if (mergeMultiline) {
      const merged = mergeContinuationIntoPrevious(filteredRows, filteredTypes, colRoles);
      filteredRows = merged.rows;
      filteredTypes = merged.types;
    }

    // 5) rowsAll objects bouwen
    const rowsAll = filteredRows
      .map((row, idx) => {
        const t = filteredTypes[idx];
        if (t === "Negeer") return null;

        const obj = { __rowType: t };

        for (let i = 0; i < colRoles.length; i++) {
          const role = colRoles[i];
          if (!role || role === "Niet gebruiken" || role === "Totaal") continue;

          const cell = row[i];

          if (role === "Code+Omschrijving (split)") {
            const split = splitCodeAndDesc(cell);
            if (split) {
              obj["Code1"] = split.code;
              obj["Omschrijving"] = split.desc;
            } else {
              obj["Omschrijving"] = String(cell || "");
            }
            continue;
          }

          obj[role] = cell ?? "";
        }

        // Hoofdstuk zonder code is oké, maar moet wel omschrijving hebben
        if (String(obj["Omschrijving"] || "").trim().length === 0) return null;

        // Zet HC automatisch voor hoofdstukken (handig downstream)
        if (t === "Hoofdstuk") {
          obj["HC"] = String(obj["Omschrijving"] || "").trim();
        }

        return obj;
      })
      .filter(Boolean);

    // 6) Optioneel: generatedRoot bovenaan als “hoofdstuk boven hoofdstukken”
    if (generatedRoot?.enabled) {
      const title =
        generatedRoot.title ||
        pdfMeta?.titleGuess ||
        pdfMeta?.fileName ||
        "Offerte";

      rowsAll.unshift({
        __rowType: "Hoofdstuk",
        ...(hasCode1 ? { Code1: "0" } : {}),
        Omschrijving: title,
        HC: title,
      });
    }

    // 7) columns = targets die effectief gebruikt worden (in vaste volgorde)
    const columns = ["Code1", "Omschrijving", "HC", "Aantal", "EC", "EKP", "EVP"].filter((k) => {
      if (k === "Code1") return hasCode1;
      return usedTargets.has(k);
    });

    onNext({
      columns,
      rowsAll,
      mapping: identityMapping,
      hasCode1,
    });
  }

  return (
    <div>
      <h3>PDF → Tabel, rijtypes en kolommen mappen</h3>

      <div style={{ color: "#666", marginBottom: 10 }}>
        Bestand: <b>{pdfMeta?.fileName || "-"}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={generatedRoot.enabled}
            onChange={(e) =>
              setGeneratedRoot({ ...generatedRoot, enabled: e.target.checked })
            }
          />{" "}
          Voeg boven-hoofdstuk toe (optioneel)
        </label>

        {generatedRoot.enabled && (
          <div style={{ marginTop: 6 }}>
            <input
              type="text"
              value={generatedRoot.title}
              onChange={(e) =>
                setGeneratedRoot({ ...generatedRoot, title: e.target.value })
              }
              style={{ width: "100%" }}
              placeholder="Bv. Offerte Heylen Ceramics"
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        <label>
          <input
            type="checkbox"
            checked={useFirstRowAsHeader}
            onChange={(e) => setUseFirstRowAsHeader(e.target.checked)}
          />{" "}
          Eerste rij is header (aanbevolen)
        </label>

        <label>
          <input
            type="checkbox"
            checked={mergeMultiline}
            onChange={(e) => setMergeMultiline(e.target.checked)}
          />{" "}
          Vervolgregels samenvoegen (aanbevolen)
        </label>

        <label>
          <input
            type="checkbox"
            checked={skipSubtotals}
            onChange={(e) => setSkipSubtotals(e.target.checked)}
          />{" "}
          Subtotalen negeren (aanbevolen)
        </label>

        <button onClick={autoDetectAllRowTypes}>Auto-detect rijtypes</button>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {/* rijtype kolom */}
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                  minWidth: 160,
                  zIndex: 3,
                }}
              >
                Rijtype
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => applyRowType("Hoofdstuk", 0, Math.max(0, dataRows.length - 1))}>
                    Alles Hoofdstuk
                  </button>
                  <button onClick={() => applyRowType("Post", 0, Math.max(0, dataRows.length - 1))}>
                    Alles Post
                  </button>
                  <button onClick={() => applyRowType("Auto", 0, Math.max(0, dataRows.length - 1))}>
                    Reset Auto
                  </button>
                </div>
              </th>

              {/* kolom mapping */}
              {Array.from({ length: maxCols }).map((_, colIdx) => (
                <th
                  key={`map-${colIdx}`}
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#fff",
                    borderBottom: "1px solid #ddd",
                    padding: 8,
                    minWidth: 170,
                    zIndex: 2,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                    Kolom {colIdx + 1}
                  </div>
                  <select
                    value={colRoles[colIdx] || "Niet gebruiken"}
                    onChange={(e) => setRoleAt(colIdx, e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>

            {/* header preview row */}
            {useFirstRowAsHeader && (
              <tr>
                <th
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: 8,
                    background: "#fafafa",
                    fontWeight: 600,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                  }}
                >
                  (header)
                </th>
                {padRow(headerRow, maxCols).map((cell, i) => (
                  <th
                    key={`hdr-${i}`}
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: 8,
                      background: "#fafafa",
                      fontWeight: 600,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                    title={String(cell || "")}
                  >
                    {String(cell || "") || <span style={{ color: "#aaa" }}>(leeg)</span>}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr key={`r-${rIdx}`}>
                <td
                  style={{
                    borderTop: "1px solid #f0f0f0",
                    padding: 8,
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                    background: "#fcfcfc",
                  }}
                >
                  <select
                    value={rowTypes[rIdx] || "Auto"}
                    onChange={(e) => setRowTypeAt(rIdx, e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {ROWTYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>

                {row.map((cell, cIdx) => (
                  <td
                    key={`c-${rIdx}-${cIdx}`}
                    style={{
                      borderTop: "1px solid #f0f0f0",
                      padding: 8,
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                    }}
                    title={String(cell || "")}
                  >
                    {String(cell || "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        Tips:
        <ul style={{ marginTop: 6 }}>
          <li>
            Als Code &amp; Omschrijving in één kolom staan, kies <b>Code+Omschrijving (split)</b>.
          </li>
          <li>
            Kies de kolom met hoofdstuk-totalen als <b>Totaal</b> zodat auto-detect subtotals herkent (en we die kunnen negeren).
          </li>
          <li>
            Hoofdstuk mag een code hebben of niet: zet rijtype op <b>Hoofdstuk</b>.
          </li>
        </ul>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={validateAndContinue}>Verder → Mapping</button>
      </div>
    </div>
  );
}
