import React, { useEffect } from "react";

export default function PdfAnalyzeScreen({
  pdfFile,
  setPdfMeta,
  setPdfRowsRaw,
  setPdfDetected,
  onBack,
  onNext,
}) {
  useEffect(() => {
    if (!pdfFile) return;

    const fileName = pdfFile.name || "";
    const titleGuess = fileName.replace(/\.pdf$/i, "");

    // ✅ meta invullen
    setPdfMeta({
      fileName,
      pages: 0, // nog onbekend in V1
      titleGuess,
    });

    // ✅ BELANGRIJK: GEEN hardcoded voorbeeldposten meer
    // pdfRowsRaw moet uit echte PDF parsing komen.
    // Voor nu: leeg laten (of later invullen zodra pdf.js werkt)
    setPdfRowsRaw([]);

    // ✅ detectie status
    setPdfDetected({
      hasChapters: false,
      confidence: "low",
    });
  }, [pdfFile, setPdfMeta, setPdfRowsRaw, setPdfDetected]);

  return (
    <div>
      <h3>PDF analyseren</h3>

      {!pdfFile ? (
        <div style={{ color: "red" }}>Geen PDF geselecteerd.</div>
      ) : (
        <div style={{ color: "#666", marginBottom: 10 }}>
          Bestand: <b>{pdfFile.name}</b>
        </div>
      )}

      <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
        <b>Status</b>
        <div style={{ marginTop: 6, color: "#666" }}>
          PDF parsing is nog niet geïmplementeerd in deze versie.
          <br />
          Volgende stap: PDF tekst/tabel uitlezen en omzetten naar rijen.
        </div>

        <div style={{ marginTop: 10, color: "#666" }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Geen hardcoded voorbeeldposten meer.</li>
            <li>Rijen zullen enkel uit de PDF zelf komen.</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={onNext} disabled={!pdfFile}>
          Verder → Structuurvoorstel
        </button>
      </div>
    </div>
  );
}
