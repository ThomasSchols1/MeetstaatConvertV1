import { clamp } from "../../../utils/format";

const MIN_COLS = 2;
const MAX_COLS = 10;

function clusterRowsByY(items, yTolerance = 6) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];

  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (!last || Math.abs(last.y - it.y) > yTolerance) {
      rows.push({ y: it.y, items: [it] });
    } else {
      last.items.push(it);
    }
  }

  return rows;
}

function clusterXs(xs, maxGap) {
  if (!xs.length) return [];
  const sorted = [...xs].sort((a, b) => a - b);
  const clusters = [];
  let group = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const x = sorted[i];
    const prev = sorted[i - 1];
    if (x - prev <= maxGap) group.push(x);
    else {
      clusters.push(group);
      group = [x];
    }
  }
  clusters.push(group);

  return clusters.map((g) => g.reduce((s, v) => s + v, 0) / g.length);
}

function evenlySpacedGuides(selection, colCount) {
  const guideCount = Math.max(1, colCount - 1);
  const step = selection.w / colCount;
  const out = [];
  for (let i = 1; i <= guideCount; i++) out.push(selection.x + step * i);
  return out;
}

export function detectColumnGuides(selection, itemsInSelection, { maxRows = 50 } = {}) {
  if (!selection || selection.w <= 0 || !itemsInSelection?.length) {
    return { guides: [], clusterCenters: [] };
  }

  // We sample only the first rows for performance and robustness on long PDFs.
  const rows = clusterRowsByY(itemsInSelection, 6);
  const sampled = rows.slice(0, maxRows).flatMap((r) => r.items);

  const dynamicGap = clamp(selection.w / 40, 8, 30);
  const centers = clusterXs(sampled.map((it) => it.x), dynamicGap)
    .filter((x) => x >= selection.x && x <= selection.x + selection.w)
    .sort((a, b) => a - b);

  let guides = [];
  if (centers.length >= 2) {
    // Guides are boundaries between detected x-clusters (column centers).
    for (let i = 0; i < centers.length - 1; i++) {
      guides.push((centers[i] + centers[i + 1]) / 2);
    }

    const maxGuides = MAX_COLS - 1;
    if (guides.length > maxGuides) {
      const step = guides.length / maxGuides;
      guides = Array.from({ length: maxGuides }, (_, i) => guides[Math.floor(i * step)]);
    }
  } else {
    guides = evenlySpacedGuides(selection, 3);
  }

  const minX = selection.x + 4;
  const maxX = selection.x + selection.w - 4;
  guides = guides
    .map((x) => clamp(x, minX, maxX))
    .sort((a, b) => a - b)
    .filter((x, idx, arr) => idx === 0 || Math.abs(x - arr[idx - 1]) > 4);

  const colCount = clamp(guides.length + 1, MIN_COLS, MAX_COLS);
  if (guides.length !== colCount - 1) {
    guides = evenlySpacedGuides(selection, colCount);
  }

  return { guides, clusterCenters: centers };
}

export function rowClusterAndBinByGuides(itemsInSelection, selection, guides) {
  const sortedGuides = [...(guides || [])].sort((a, b) => a - b);
  const boundaries = [selection.x, ...sortedGuides, selection.x + selection.w];
  const rows = clusterRowsByY(itemsInSelection, 6);

  // Binning by fixed guide boundaries keeps multiline text in the same column.
  const rawRows = rows
    .map((row) => {
      const bins = Array.from({ length: boundaries.length - 1 }, () => []);
      for (const it of row.items) {
        let binIndex = bins.length - 1;
        for (let i = 0; i < boundaries.length - 1; i++) {
          const left = boundaries[i];
          const right = boundaries[i + 1];
          if (it.x >= left && it.x < right) {
            binIndex = i;
            break;
          }
        }
        bins[binIndex].push(it);
      }

      return bins.map((bin) =>
        bin
          .sort((a, b) => a.x - b.x)
          .map((it) => String(it.str || "").trim())
          .filter(Boolean)
          .join(" ")
          .trim()
      );
    })
    .filter((r) => r.some((v) => String(v || "").trim().length > 0));

  return rawRows;
}
