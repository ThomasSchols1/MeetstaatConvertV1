import { normalizeStr } from "../../utils/format";

function headerRowScore(rowArr) {
  if (!Array.isArray(rowArr)) return -999;
  const nonEmpty = rowArr.map(normalizeStr).filter(Boolean);
  if (nonEmpty.length === 0) return -999;

  const numericCount = nonEmpty.filter((v) => /^\d+([.,]\d+)?$/.test(v)).length;
  const longCount = nonEmpty.filter((v) => v.length > 60).length;

  const headerHints = [
    "code","nr","nummer","ref","omschr","omschrijving","aantal","eenheid","unit","prijs","kost","ekp","evp","hc","ec",
  ];
  const hintCount = nonEmpty.filter((v) => headerHints.some((h) => v.toLowerCase().includes(h))).length;

  const widthBonus = nonEmpty.length >= 3 ? 2 : 0;
  return widthBonus + hintCount * 3 + nonEmpty.length - numericCount * 2 - longCount * 2;
}

export function suggestHeaderIndex(rawRows) {
  const limit = Math.min(rawRows.length, 50);
  let bestIdx = 0;
  let bestScore = -9999;
  for (let i = 0; i < limit; i++) {
    const score = headerRowScore(rawRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function makeUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((h, i) => {
    const base = normalizeStr(h) || `Kolom${i + 1}`;
    const key = base.toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

export function buildRowsFromRaw(rawRows, headerIndex) {
  const headerRaw = rawRows[headerIndex] || [];
  const dataRows = rawRows.slice(headerIndex + 1);

  // 1) basis headers (met fallback KolomX)
  let headers = makeUniqueHeaders(headerRaw.map((x) => normalizeStr(x)));

  // 2) verbeter lege/zwakke headers door naar data te kijken
  // we nemen een kleine sample zodat het snel blijft
  const sample = dataRows.slice(0, 30);

  headers = headers.map((h, colIdx) => {
    const normalized = normalizeStr(h);

    headers = makeUniqueHeaders(headers);


    // als de header leeg is of "KolomX", probeer te raden
    const isWeak = !normalized || /^kolom\d+$/i.test(normalized);
    if (!isWeak) return h;

    const colVals = sample.map((r) => normalizeStr(r?.[colIdx] ?? "")).filter(Boolean);

    // heuristieken
    const mostlyNumericOrDotted =
      colVals.length > 0 &&
      colVals.filter((v) => /^[0-9]+([.,][0-9]+)*$/.test(v)).length / colVals.length >= 0.7;

    const mostlyQty =
      colVals.length > 0 &&
      colVals.filter((v) => /^\d+([.,]\d+)?$/.test(v)).length / colVals.length >= 0.7;

    // als dit de eerste kolom is en lijkt op codes/posities -> noem het Code
    if (colIdx === 0 && mostlyNumericOrDotted) return "Code";

    // als veel getallen en niet de eerste kolom: vaak aantal
    if (mostlyQty) return "Aantal";

    // anders: laat generiek
    return h;
  });

  // 3) objects bouwen
  const objects = dataRows.map((arr) => {
    const o = {};
    for (let i = 0; i < headers.length; i++) {
      o[headers[i]] = arr?.[i] ?? "";
    }
    return o;
  });

  return { headers, objects };
}

