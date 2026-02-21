import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// pdf.js worker instellen (Vite-friendly)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfSelectTableScreen({
  pdfFile,
  onBack,
  onExtract, // (rawRows, meta) => void
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.5);

  const [pageViewport, setPageViewport] = useState(null);

  // selection rectangle in canvas pixels
  const [dragging, setDragging] = useState(false);
  const [startPt, setStartPt] = useState(null);
  const [rect, setRect] = useState(null); // {x,y,w,h}

  useEffect(() => {
    if (!pdfFile) return;

    (async () => {
      const buf = await pdfFile.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(doc);
      setPageNum(1);

      // meta
      // (we geven dit straks terug via onExtract)
    })();
  }, [pdfFile]);

  const pageCount = pdfDoc?.numPages || 0;

async function renderPage() {
  if (!pdfDoc) return;

  // ✅ cancel vorige render als die nog loopt
  if (renderTaskRef.current) {
    try {
      renderTaskRef.current.cancel();
    } catch (e) {}
    renderTaskRef.current = null;
  }

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  setPageViewport(viewport);

  // reset selection when rerendering
  setRect(null);
  setStartPt(null);

  const task = page.render({ canvasContext: ctx, viewport });
  renderTaskRef.current = task;

  try {
    await task.promise;
  } catch (err) {
    // cancel is oké, dat is net de bedoeling
    if (err?.name !== "RenderingCancelledException") {
      throw err;
    }
  } finally {
    if (renderTaskRef.current === task) {
      renderTaskRef.current = null;
    }
  }
}


  useEffect(() => {
    renderPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNum, scale]);

  function clampRect(r) {
    if (!r || !pageViewport) return r;
    const w = pageViewport.width;
    const h = pageViewport.height;

    const x = Math.max(0, Math.min(r.x, w));
    const y = Math.max(0, Math.min(r.y, h));
    const x2 = Math.max(0, Math.min(r.x + r.w, w));
    const y2 = Math.max(0, Math.min(r.y + r.h, h));

    return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
  }

  function getMousePos(e) {
    const el = overlayRef.current;
    const rect = el.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onMouseDown(e) {
    if (!pageViewport) return;
    setDragging(true);
    const p = getMousePos(e);
    setStartPt(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMouseMove(e) {
    if (!dragging || !startPt) return;
    const p = getMousePos(e);
    const r = {
      x: Math.min(startPt.x, p.x),
      y: Math.min(startPt.y, p.y),
      w: Math.abs(p.x - startPt.x),
      h: Math.abs(p.y - startPt.y),
    };
    setRect(clampRect(r));
  }

  function onMouseUp() {
    setDragging(false);
    if (rect && (rect.w < 10 || rect.h < 10)) {
      // te klein → reset
      setRect(null);
    }
  }

async function extractFromSelection() {
  try {
    if (!pdfDoc) {
      alert("PDF is nog niet geladen.");
      return;
    }

    if (!rect || rect.w < 10 || rect.h < 10) {
      alert("Selecteer eerst een tabelzone (sleep een rechthoek).");
      return;
    }

    if (!pageViewport) {
      alert("Pagina is nog niet klaar om te extraheren.");
      return;
    }

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // 1️⃣ Verzamel alle tekst-items met viewport-coördinaten
    const items = (textContent.items || [])
      .map((it) => {
        const tx = pdfjsLib.Util.transform(
          pageViewport.transform,
          it.transform
        );
        const x = tx[4];
        const y = tx[5];
        const str = String(it.str || "").trim();
        return { x, y, str };
      })
      .filter((it) => it.str.length > 0);

    // 2️⃣ Filter items binnen selectie-rectangle
    const sel = rect;
    const inBox = items.filter(
      (it) =>
        it.x >= sel.x &&
        it.x <= sel.x + sel.w &&
        it.y >= sel.y &&
        it.y <= sel.y + sel.h
    );

    if (inBox.length === 0) {
      alert(
        "Ik vond geen tekst in je selectie. Is dit een scan? (OCR volgt later)"
      );
      return;
    }

    // 3️⃣ Sorteer en groepeer per rij (Y-as)
    const yTolerance = 6;
    const sorted = [...inBox].sort(
      (a, b) => a.y - b.y || a.x - b.x
    );

    const rows = [];
    for (const it of sorted) {
      const last = rows[rows.length - 1];
      if (!last || Math.abs(last.y - it.y) > yTolerance) {
        rows.push({ y: it.y, cells: [{ x: it.x, str: it.str }] });
      } else {
        last.cells.push({ x: it.x, str: it.str });
      }
    }

    // 4️⃣ Bouw rawRows (kolommen op basis van X-gaps)
    const xGap = 18;
    const rawRows = rows
      .map((r) => {
        const cells = r.cells.sort((a, b) => a.x - b.x);

        const out = [];
        let cur = "";
        let prevX = null;

        for (const c of cells) {
          if (prevX !== null && c.x - prevX > xGap) {
            out.push(cur.trim());
            cur = c.str;
          } else {
            cur = cur ? `${cur} ${c.str}` : c.str;
          }
          prevX = c.x;
        }

        if (cur.trim()) out.push(cur.trim());
        return out;
      })
      .filter((r) => r.some((v) => String(v || "").trim().length > 0));

    // 5️⃣ Split "1 Dakgroep..." → ["1", "Dakgroep..."]
    function splitLeadingCode(rows2d) {
      const codeRe = /^(\d+(?:[.,]\d+)*)(\s+)(.+)$/;
      return rows2d.map((row) => {
        if (!row || row.length === 0) return row;

        const first = String(row[0] || "").trim();
        const m = first.match(codeRe);
        if (m) {
          const code = m[1];
          const rest = m[3];
          if (row.length === 1) return [code, rest];
          return [code, rest, ...row.slice(1)];
        }
        return row;
      });
    }

    const rawRowsFixed = splitLeadingCode(rawRows);

    // 6️⃣ Meta + doorgaan
    const meta = {
      fileName: pdfFile?.name || "",
      pages: pageCount,
      titleGuess: (pdfFile?.name || "").replace(/\.pdf$/i, ""),
    };

    console.log("PDF extract sample:", rawRowsFixed.slice(0, 5));
    alert(`Extractie oké: ${rawRowsFixed.length} rijen gevonden`);

    onExtract(rawRowsFixed, meta);
  } catch (err) {
    console.error("extractFromSelection crashed:", err);
    alert(`Fout bij extractie: ${err?.message || err}`);
  }
}

  return (
    <div>
      <h3>PDF: selecteer tabel</h3>

      {!pdfFile ? (
        <div style={{ color: "red" }}>Geen PDF geselecteerd.</div>
      ) : (
        <div style={{ color: "#666", marginBottom: 10 }}>
          Bestand: <b>{pdfFile.name}</b>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button onClick={onBack}>Terug</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>
            ◀
          </button>
          <div style={{ minWidth: 90, textAlign: "center" }}>
            Pagina {pageNum} / {pageCount || "-"}
          </div>
          <button
            disabled={pageCount ? pageNum >= pageCount : true}
            onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))}
          >
            ▶
          </button>

          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={1.75}>175%</option>
          </select>

          <button onClick={extractFromSelection} disabled={!pdfDoc}>
            Extracteer tabel
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        <canvas ref={canvasRef} />

        <div
          ref={overlayRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            position: "absolute",
            inset: 0,
            cursor: "crosshair",
          }}
        />

        {rect && (
          <div
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              border: "2px solid #1976d2",
              background: "rgba(25,118,210,0.10)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        Sleep een rechthoek rond de tabel met posten. Klik daarna <b>Extracteer tabel</b>.
        <br />
        (MVP: werkt op PDF’s met selecteerbare tekst. OCR voor scans voegen we later toe.)
      </div>
    </div>
  );
}
