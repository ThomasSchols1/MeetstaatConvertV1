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

function clusterGuideCandidates(points, maxGap) {
  if (!points.length) return [];

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const groups = [];
  let group = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.x - sorted[i - 1].x <= maxGap) group.push(p);
    else {
      groups.push(group);
      group = [p];
    }
  }
  groups.push(group);

  return groups.map((g) => {
    const totalWeight = g.reduce((s, p) => s + p.w, 0) || 1;
    const weightedX = g.reduce((s, p) => s + p.x * p.w, 0) / totalWeight;
    return { x: weightedX, w: totalWeight };
  });
}

function evenlySpacedGuides(selection, colCount) {
  const guideCount = Math.max(1, colCount - 1);
  const step = selection.w / colCount;
  return Array.from({ length: guideCount }, (_, i) => selection.x + step * (i + 1));
}

export function detectColumnGuides(selection, itemsInSelection, { maxRows = 50 } = {}) {
  if (!selection || selection.w <= 0 || !itemsInSelection?.length) {
    return { guides: [], clusterCenters: [] };
  }

  const rows = clusterRowsByY(itemsInSelection, 6);
  const sampledRows = rows.slice(0, maxRows);
  const sampledItems = sampledRows.flatMap((r) => r.items);

  const dynamicGap = clamp(selection.w / 42, 8, 28);
  const centers = clusterXs(sampledItems.map((it) => it.x), dynamicGap)
    .filter((x) => x > selection.x + 2 && x < selection.x + selection.w - 2)
    .sort((a, b) => a - b);

  // Better default placement: use biggest whitespace gaps per row as candidate boundaries.
  const guideCandidates = [];
  for (const row of sampledRows) {
    const rowItems = [...row.items].sort((a, b) => a.x - b.x);
    for (let i = 0; i < rowItems.length - 1; i++) {
      const left = rowItems[i];
      const right = rowItems[i + 1];
      const gap = right.x - left.x;
      if (gap >= dynamicGap * 1.3) {
        guideCandidates.push({ x: (left.x + right.x) / 2, w: gap });
      }
    }
  }

  const clusteredCandidates = clusterGuideCandidates(guideCandidates, dynamicGap * 1.5)
    .sort((a, b) => b.w - a.w)
    .slice(0, MAX_COLS - 1)
    .map((p) => p.x)
    .sort((a, b) => a - b);

  let guides = clusteredCandidates;

  if (!guides.length && centers.length >= 2) {
    guides = [];
    for (let i = 0; i < centers.length - 1; i++) {
      const gap = centers[i + 1] - centers[i];
      if (gap >= dynamicGap * 1.1) {
        guides.push((centers[i] + centers[i + 1]) / 2);
      }
    }
  }

  if (!guides.length) guides = evenlySpacedGuides(selection, 3);

  const minX = selection.x + 4;
  const maxX = selection.x + selection.w - 4;
  guides = guides
    .map((x) => clamp(x, minX, maxX))
    .sort((a, b) => a - b)
    .filter((x, idx, arr) => idx === 0 || Math.abs(x - arr[idx - 1]) > 6)
    .slice(0, MAX_COLS - 1);

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
  return rows
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
}
