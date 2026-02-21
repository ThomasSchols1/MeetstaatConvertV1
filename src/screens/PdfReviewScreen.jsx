import React, { useEffect, useMemo, useState } from "react";

const TYPE_OPTIONS = ["Hoofdstuk", "Post", "Tekst", "Negeer"];

function normStr(v) {
  return String(v ?? "").trim();
}

function isEmpty(v) {
  return normStr(v).length === 0;
}

function normalizeRows(rows) {
  // Maak copy + zorg dat keys bestaan
  return (rows || []).map((r) => ({
    __rowType: r.__rowType || "Tekst",
    Code1: r.Code1 ?? "",
    Omschrijving: r.Omschrijving ?? "",
    HC: r.HC ?? "",
    Aantal: r.Aantal ?? "",
    EC: r.EC ?? "",
    EKP: r.EKP ?? "",
    EVP: r.EVP ?? "",
  }));
}

function applyRules(rows) {
  // Hoofdstuk: level 0, Code1 = broncode of H1.. ; geen HC/Aantal/EC/EKP/EVP
  // Post/Tekst: level 1
  let hCounter = 0;

  return rows.map((r) => {
    const t = r.__rowType;

    if (t === "Hoofdstuk") {
      const next = { ...r };

      // titel must exist
      next.Omschrijving = normStr(next.Omschrijving);

      // code: behouden als broncode bestaat, anders H1/H2/...
      if (isEmpty(next.Code1)) {
        hCounter += 1;
        next.Code1 = `H${hCounter}`;
      } else {
        // als broncode bestaat, laten we die staan, maar tellen we NIET mee (jouw keuze)
      }

      // hoofdstuk heeft geen postvelden
      next.HC = "";
      next.Aantal = "";
      next.EC = "";
      next.EKP = "";
      next.EVP = "";

      return next;
    }

    if (t === "Negeer") return r;

    // Post of Tekst
    return {
      ...r,
      Code1: r.Code1 ?? "",
      Omschrijving: normStr(r.Omschrijving),
    };
  });
}

export default function PdfReviewScreen({ initialRowsAll, onBack, onConfirm }) {
  const [rows, setRows] = useState(() => applyRules(normalizeRows(initialRowsAll)));

  // als initialRowsAll wijzigt
  useEffect(() => {
    setRows(applyRules(normalizeRows(initialRowsAll)));
  }, [initialRowsAll]);

  const preview = useMemo(() => {
    // level berekenen: hoofdstuk 0, andere 1
    return rows.map((r, idx) => ({
      ...r,
      __idx: idx,
      __level: r.__rowType === "Hoofdstuk" ? 0 : 1,
    }));
  }, [rows]);

  function updateRow(idx, patch) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function rerunNormalization() {
    setRows((prev) => applyRules(normalizeRows(prev)));
  }

  function deleteRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function mergeIntoPreviousPost(idx) {
    setRows((prev) => {
      const cur = prev[idx];
      if (!cur) return prev;
      if (cur.__rowType !== "Tekst") return prev;

      // zoek vorige Post
      let j = idx - 1;
      while (j >= 0 && prev[j].__rowType !== "Post") j--;

      if (j < 0) return prev; // geen vorige post

      const next = [...prev];
      const prevPost = next[j];

      const add = normStr(cur.Omschrijving);
      if (add) {
        const base = normStr(prevPost.Omschrijving);
        next[j] = { ...prevPost, Omschrijving: base ? `${base} ${add}` : add };
      }

      // verwijder current
      next.splice(idx, 1);
      return next;
    });
  }

  function confirm() {
    // Filter Negeer eruit
    const cleaned = rows.filter((r) => r.__rowType !== "Negeer");

    // basic check: minstens 1 hoofdstuk?
    // (mag ook niet, maar in jouw fase is dat de bedoeling)
    // We blokkeren niet hard, maar tonen alert als alles Post/Tekst is
    if (!cleaned.some((r) => r.__rowType === "Hoofdstuk")) {
      const ok = window.confirm(
        "Ik zie geen hoofdstukken. Wil je toch doorgaan?"
      );
      if (!ok) return;
    }

    // opnieuw rules toepassen (zeker Code1 bij hoofdstukken)
    const finalRows = applyRules(normalizeRows(cleaned));

    onConfirm(finalRows);
  }

  return (
    <div>
      <h3>PDF resultaat-preview</h3>

      <div style={{ color: "#666", marginBottom: 10 }}>
        Pas hier Code1 / Omschrijving / Type aan tot alles klopt. Daarna ga je verder.
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={onBack}>← Terug naar structuur</button>
        <button onClick={rerunNormalization}>↻ Normalisatie opnieuw uitvoeren</button>
        <button onClick={confirm}>Verder → Mapping</button>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", top: 0, background: "#fff", padding: 8, borderBottom: "1px solid #ddd" }}>
                Type
              </th>
              <th style={{ position: "sticky", top: 0, background: "#fff", padding: 8, borderBottom: "1px solid #ddd" }}>
                Level
              </th>
              <th style={{ position: "sticky", top: 0, background: "#fff", padding: 8, borderBottom: "1px solid #ddd", minWidth: 120 }}>
                Code1
              </th>
              <th style={{ position: "sticky", top: 0, background: "#fff", padding: 8, borderBottom: "1px solid #ddd", minWidth: 420 }}>
                Omschrijving
              </th>
              <th style={{ position: "sticky", top: 0, background: "#fff", padding: 8, borderBottom: "1px solid #ddd" }}>
                Acties
              </th>
            </tr>
          </thead>

          <tbody>
            {preview.map((r) => (
              <tr key={r.__idx}>
                <td style={{ borderTop: "1px solid #f0f0f0", padding: 8, verticalAlign: "top" }}>
                  <select
                    value={r.__rowType}
                    onChange={(e) => updateRow(r.__idx, { __rowType: e.target.value })}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ borderTop: "1px solid #f0f0f0", padding: 8, verticalAlign: "top", color: "#666" }}>
                  {r.__level}
                </td>

                <td style={{ borderTop: "1px solid #f0f0f0", padding: 8, verticalAlign: "top" }}>
                  <input
                    value={r.Code1}
                    onChange={(e) => updateRow(r.__idx, { Code1: e.target.value })}
                    style={{ width: "100%" }}
                    placeholder={r.__rowType === "Hoofdstuk" ? "H1 / broncode" : ""}
                  />
                </td>

                <td style={{ borderTop: "1px solid #f0f0f0", padding: 8, verticalAlign: "top" }}>
                  <input
                    value={r.Omschrijving}
                    onChange={(e) => updateRow(r.__idx, { Omschrijving: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </td>

                <td style={{ borderTop: "1px solid #f0f0f0", padding: 8, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  {r.__rowType === "Tekst" && (
                    <button onClick={() => mergeIntoPreviousPost(r.__idx)}>
                      Plak bij vorige post
                    </button>
                  )}{" "}
                  <button onClick={() => deleteRow(r.__idx)}>Verwijder</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        Regels:
        <ul style={{ marginTop: 6 }}>
          <li><b>Hoofdstuk</b> krijgt automatisch Code1 = H1, H2, … als die leeg is (broncode blijft behouden).</li>
          <li><b>Tekst</b> kan je “Plak bij vorige post” doen, of apart laten staan onder het hoofdstuk.</li>
          <li>“Normalisatie opnieuw uitvoeren” past de hoofdstukregels opnieuw toe.</li>
        </ul>
      </div>
    </div>
  );
}
