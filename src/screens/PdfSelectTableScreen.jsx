import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { clamp } from "../utils/format";
import { detectColumnGuides, rowClusterAndBinByGuides } from "../features/import/pdf/columnGuides";

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

  // Guide state (viewport x coordinates)
  const [colGuidesXs, setColGuidesXs] = useState([]);
  const [clusterCenters, setClusterCenters] = useState([]);
  const [activeGuideIdx, setActiveGuideIdx] = useState(null);

  const [pageTextItems, setPageTextItems] = useState([]);

  useEffect(() => {
    if (!pdfFile) return;

    (async () => {
      const buf = await pdfFile.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(doc);
      setPageNum(1);
    })();
  }, [pdfFile]);

  const pageCount = pdfDoc?.numPages || 0;

  async function renderPage() {
    if (!pdfDoc) return;

    // ✅ cancel vorige render als die nog loopt
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // noop
      }
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

    // reset selectie + guides bij pagina/zoom wijziging
    setRect(null);
    setStartPt(null);
    setColGuidesXs([]);
    setClusterCenters([]);

    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;

    try {
      await task.promise;
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") throw err;
    } finally {
      if (renderTaskRef.current === task) renderTaskRef.current = null;
    }

    const textContent = await page.getTextContent();
    const mappedItems = (textContent.items || [])
      .map((it) => {
        const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
        const x = tx[4];
        const y = tx[5];
        const str = String(it.str || "").trim();
        return { x, y, str };
      })
      .filter((it) => it.str.length > 0);

    setPageTextItems(mappedItems);
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
    const box = el.getBoundingClientRect();
    return {
      x: e.clientX - box.left,
      y: e.clientY - box.top,
    };
  }

  function itemsInRect(targetRect) {
    if (!targetRect) return [];
    return pageTextItems.filter(
      (it) =>
        it.x >= targetRect.x &&
        it.x <= targetRect.x + targetRect.w &&
        it.y >= targetRect.y &&
        it.y <= targetRect.y + targetRect.h
    );
  }

  function autoDetectGuides(targetRect = rect) {
    if (!targetRect) return;
    const inBox = itemsInRect(targetRect);
    const { guides, clusterCenters: centers } = detectColumnGuides(targetRect, inBox);
    setColGuidesXs(guides);
    setClusterCenters(centers);
  }

  function onMouseDown(e) {
    if (!pageViewport || activeGuideIdx != null) return;
    setDragging(true);
    const p = getMousePos(e);
    setStartPt(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMouseMove(e) {
    if (activeGuideIdx != null && rect) {
      const p = getMousePos(e);
      const minX = rect.x + 4;
      const maxX = rect.x + rect.w - 4;
      const snapThreshold = 7;

      let nextX = clamp(p.x, minX, maxX);

      // optional nice-to-have: snap to detected x centers
      const nearestCenter = clusterCenters.reduce(
        (best, cx) => {
          const d = Math.abs(cx - nextX);
          return d < best.d ? { x: cx, d } : best;
        },
        { x: nextX, d: Number.POSITIVE_INFINITY }
      );
      if (nearestCenter.d <= snapThreshold) nextX = nearestCenter.x;

      setColGuidesXs((prev) => {
        const sorted = [...prev].sort((a, b) => a - b);
        const left = activeGuideIdx > 0 ? sorted[activeGuideIdx - 1] + 6 : minX;
        const right = activeGuideIdx < sorted.length - 1 ? sorted[activeGuideIdx + 1] - 6 : maxX;
        sorted[activeGuideIdx] = clamp(nextX, left, right);
        return sorted;
      });
      return;
    }

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
    if (activeGuideIdx != null) {
      setActiveGuideIdx(null);
      return;
    }

    setDragging(false);
    if (!rect || rect.w < 10 || rect.h < 10) {
      setRect(null);
      setColGuidesXs([]);
      setClusterCenters([]);
      return;
    }

    autoDetectGuides(rect);
  }

  function addGuide() {
    if (!rect) return;
    const minX = rect.x + 4;
    const maxX = rect.x + rect.w - 4;

    setColGuidesXs((prev) => {
      const sorted = [...prev].sort((a, b) => a - b);
      if (!sorted.length) return [rect.x + rect.w / 2];

      const edges = [minX, ...sorted, maxX];
      let widest = { idx: 0, w: 0 };
      for (let i = 0; i < edges.length - 1; i++) {
        const w = edges[i + 1] - edges[i];
        if (w > widest.w) widest = { idx: i, w };
      }

      const newX = (edges[widest.idx] + edges[widest.idx + 1]) / 2;
      const next = [...sorted, clamp(newX, minX, maxX)].sort((a, b) => a - b);
      return next.slice(0, 9); // max 10 columns => 9 guides
    });
  }

  function removeGuide(index = null) {
    setColGuidesXs((prev) => {
      if (!prev.length) return prev;
      const sorted = [...prev].sort((a, b) => a - b);
      if (typeof index === "number") return sorted.filter((_, i) => i !== index);

      if (!rect) return sorted.slice(0, -1);
      const centerX = rect.x + rect.w / 2;
      let nearest = 0;
      let nearestDist = Number.POSITIVE_INFINITY;
      sorted.forEach((x, i) => {
        const d = Math.abs(x - centerX);
        if (d < nearestDist) {
          nearest = i;
          nearestDist = d;
        }
      });
      return sorted.filter((_, i) => i !== nearest);
    });
  }

  async function extractFromSelection() {
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

    const inBox = itemsInRect(rect);

    if (inBox.length === 0) {
      alert("Ik vond geen tekst in je selectie. Is dit een scan? (OCR volgt later)");
      return;
    }

    const sortedGuides = [...colGuidesXs].sort((a, b) => a - b);
    const rawRows = rowClusterAndBinByGuides(inBox, rect, sortedGuides);

    const meta = {
      fileName: pdfFile?.name || "",
      pages: pageCount,
      titleGuess: (pdfFile?.name || "").replace(/\.pdf$/i, ""),
    };

    console.log("PDF extract sample:", rawRows.slice(0, 5));
    alert(`Extractie oké: ${rawRows.length} rijen gevonden`);

    onExtract(rawRows, meta);
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

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={() => autoDetectGuides()} disabled={!rect}>Auto kolommen</button>
        <button onClick={addGuide} disabled={!rect}>+ Kolomlijn</button>
        <button onClick={() => removeGuide()} disabled={!rect || !colGuidesXs.length}>Verwijder kolomlijn</button>

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
            cursor: activeGuideIdx != null ? "ew-resize" : "crosshair",
          }}
        />

        {rect && (
          <>
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

            {colGuidesXs
              .slice()
              .sort((a, b) => a - b)
              .map((x, idx) => (
                <div
                  key={`${x}-${idx}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveGuideIdx(idx);
                  }}
                  style={{
                    position: "absolute",
                    left: x - 1,
                    top: rect.y,
                    width: 3,
                    height: rect.h,
                    background: "#ff5722",
                    cursor: "ew-resize",
                  }}
                >
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGuide(idx);
                    }}
                    title="Verwijder kolomlijn"
                    style={{
                      position: "absolute",
                      top: -22,
                      left: -8,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      border: "1px solid #ccc",
                      background: "white",
                      color: "#b71c1c",
                      fontSize: 12,
                      lineHeight: "14px",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </>
        )}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        Teken eerst een selectiezone. Daarna kan je kolomlijnen slepen voor stabiele kolommen.
        <br />
        “Extracteer tabel” gebruikt vaste bins tussen de kolomlijnen i.p.v. xGap.
      </div>
    </div>
  );
}
