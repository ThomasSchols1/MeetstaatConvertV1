import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { clamp } from "../utils/format";
import { detectColumnGuides, rowClusterAndBinByGuides } from "../features/import/pdf/columnGuides";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfSelectTableScreen({ pdfFile, onBack, onExtract }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [pageViewport, setPageViewport] = useState(null);

  const [draggingRect, setDraggingRect] = useState(false);
  const [startPt, setStartPt] = useState(null);
  const [rect, setRect] = useState(null);

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
        return { x: tx[4], y: tx[5], str: String(it.str || "").trim() };
      })
      .filter((it) => it.str.length > 0);

    setPageTextItems(mappedItems);
  }

  useEffect(() => {
    renderPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNum, scale]);

  function getMousePos(e) {
    const box = overlayRef.current?.getBoundingClientRect();
    return {
      x: e.clientX - box.left,
      y: e.clientY - box.top,
    };
  }

  function clampRect(r) {
    if (!r || !pageViewport) return r;
    const x1 = clamp(r.x, 0, pageViewport.width);
    const y1 = clamp(r.y, 0, pageViewport.height);
    const x2 = clamp(r.x + r.w, 0, pageViewport.width);
    const y2 = clamp(r.y + r.h, 0, pageViewport.height);
    return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
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
    setColGuidesXs([...guides].sort((a, b) => a - b));
    setClusterCenters(centers);
  }

  function beginRectSelection(e) {
    if (!pageViewport || activeGuideIdx != null) return;
    const p = getMousePos(e);
    setDraggingRect(true);
    setStartPt(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    setColGuidesXs([]);
    setClusterCenters([]);
  }

  function startGuideDrag(e, idx) {
    e.stopPropagation();
    setActiveGuideIdx(idx);
  }

  useEffect(() => {
    if (!draggingRect && activeGuideIdx == null) return;

    const onMove = (e) => {
      if (activeGuideIdx != null && rect) {
        const p = getMousePos(e);
        const minX = rect.x + 4;
        const maxX = rect.x + rect.w - 4;

        let nextX = clamp(p.x, minX, maxX);
        const snapThreshold = 7;
        const nearestCenter = clusterCenters.reduce(
          (best, cx) => {
            const d = Math.abs(cx - nextX);
            return d < best.d ? { x: cx, d } : best;
          },
          { x: nextX, d: Number.POSITIVE_INFINITY }
        );
        if (nearestCenter.d <= snapThreshold) nextX = nearestCenter.x;

        setColGuidesXs((prev) => {
          if (!prev.length) return prev;
          const sorted = [...prev].sort((a, b) => a - b);
          const left = activeGuideIdx > 0 ? sorted[activeGuideIdx - 1] + 6 : minX;
          const right = activeGuideIdx < sorted.length - 1 ? sorted[activeGuideIdx + 1] - 6 : maxX;
          sorted[activeGuideIdx] = clamp(nextX, left, right);
          return sorted;
        });
        return;
      }

      if (draggingRect && startPt) {
        const p = getMousePos(e);
        const next = {
          x: Math.min(startPt.x, p.x),
          y: Math.min(startPt.y, p.y),
          w: Math.abs(p.x - startPt.x),
          h: Math.abs(p.y - startPt.y),
        };
        setRect(clampRect(next));
      }
    };

    const onUp = () => {
      if (activeGuideIdx != null) {
        setActiveGuideIdx(null);
        return;
      }

      if (draggingRect) {
        setDraggingRect(false);
        if (!rect || rect.w < 10 || rect.h < 10) {
          setRect(null);
          return;
        }
        autoDetectGuides(rect);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [activeGuideIdx, draggingRect, rect, startPt, clusterCenters]);

  function addGuide() {
    if (!rect) return;
    const minX = rect.x + 4;
    const maxX = rect.x + rect.w - 4;

    setColGuidesXs((prev) => {
      const sorted = [...prev].sort((a, b) => a - b);
      const edges = [minX, ...sorted, maxX];
      let widest = { idx: 0, w: 0 };
      for (let i = 0; i < edges.length - 1; i++) {
        const w = edges[i + 1] - edges[i];
        if (w > widest.w) widest = { idx: i, w };
      }

      const newX = (edges[widest.idx] + edges[widest.idx + 1]) / 2;
      return [...sorted, clamp(newX, minX, maxX)].sort((a, b) => a - b).slice(0, 9);
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
    if (!pdfDoc) return alert("PDF is nog niet geladen.");
    if (!rect || rect.w < 10 || rect.h < 10) return alert("Selecteer eerst een tabelzone (sleep een rechthoek).");
    if (!pageViewport) return alert("Pagina is nog niet klaar om te extraheren.");

    const inBox = itemsInRect(rect);
    if (!inBox.length) return alert("Ik vond geen tekst in je selectie. Is dit een scan? (OCR volgt later)");

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

      {!pdfFile ? <div style={{ color: "red" }}>Geen PDF geselecteerd.</div> : <div style={{ color: "#666", marginBottom: 10 }}>Bestand: <b>{pdfFile.name}</b></div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={() => autoDetectGuides()} disabled={!rect}>Auto kolommen</button>
        <button onClick={addGuide} disabled={!rect}>+ Kolomlijn</button>
        <button onClick={() => removeGuide()} disabled={!rect || !colGuidesXs.length}>Verwijder kolomlijn</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>◀</button>
          <div style={{ minWidth: 90, textAlign: "center" }}>Pagina {pageNum} / {pageCount || "-"}</div>
          <button disabled={pageCount ? pageNum >= pageCount : true} onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))}>▶</button>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={1.75}>175%</option>
          </select>
          <button onClick={extractFromSelection} disabled={!pdfDoc}>Extracteer tabel</button>
        </div>
      </div>

      <div style={{ position: "relative", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", display: "inline-block", maxWidth: "100%" }}>
        <canvas ref={canvasRef} />

        <div
          ref={overlayRef}
          onMouseDown={beginRectSelection}
          style={{ position: "absolute", inset: 0, cursor: activeGuideIdx != null ? "ew-resize" : "crosshair", zIndex: 5 }}
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
                zIndex: 6,
              }}
            />

            {colGuidesXs.map((x, idx) => (
              <div
                key={`${idx}-${x}`}
                onMouseDown={(e) => startGuideDrag(e, idx)}
                style={{
                  position: "absolute",
                  left: x - 1,
                  top: rect.y,
                  width: 4,
                  height: rect.h,
                  background: "#ff5722",
                  cursor: "ew-resize",
                  zIndex: 7,
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
                    left: -7,
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
        Teken eerst een selectiezone. Daarna krijg je automatische kolomlijnen die je kan verslepen.
        <br />
        Tip: klik “Auto kolommen” na aanpassen van de selectie voor een nieuwe startpositie.
      </div>
    </div>
  );
}
