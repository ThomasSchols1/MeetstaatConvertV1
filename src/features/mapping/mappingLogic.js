// src/features/mapping/mappingLogic.js
export function suggestTargetField(sourceColName) {
  const s = String(sourceColName || "").toLowerCase().replace(/\s+/g, "");
  const has = (...parts) => parts.some((p) => s.includes(p));

  if (has("nr", "nummer", "code", "post", "item", "ref")) return "Code1";
  if (has("omschr", "omschrijving", "beschrijving", "tekst", "desc")) return "Omschrijving";
  if (has("aantal", "qty", "hoeveel", "quantity")) return "Aantal";
  if (has("eenheid", "unit", "uom", "ec")) return "EC";
  if (has("ekp", "kost", "cost")) return "EKP";
  if (has("evp", "verkoop", "price")) return "EVP";
  if (has("hc", "hoofdstuk", "rubriek", "chapter")) return "HC";
  return "Niet gebruiken";
}

function looksLikeCodeValue(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  // codes zoals 1, 1.1, 01, 2.03, 10.2.5
  return /^[0-9]+([.,][0-9]+)*$/.test(s);
}

function scoreCodeColumn(values) {
  const cleaned = values.map((v) => String(v || "").trim()).filter(Boolean);
  if (cleaned.length < 5) return 0;

  const codeLike = cleaned.filter(looksLikeCodeValue).length / cleaned.length;

  // bonus: korte strings (codes zijn meestal kort)
  const shortish = cleaned.filter((s) => s.length <= 10).length / cleaned.length;

  return codeLike * 0.75 + shortish * 0.25; // 0..1
}

export function buildInitialMapping(columns, rowsSample = null) {
  const mapping = {};
  const used = new Set();

  // 1) eerst jouw bestaande header-based suggesties
  for (const col of columns) {
    const suggested = suggestTargetField(col);
    if (suggested !== "Niet gebruiken" && !used.has(suggested)) {
      mapping[col] = suggested;
      used.add(suggested);
    } else {
      mapping[col] = "Niet gebruiken";
    }
  }

  // 2) Als Code1 nog niet gezet is, probeer data-driven detectie
  if (rowsSample && !used.has("Code1")) {
    // rowsSample = array of objects (rowsAll) of rawRows? -> wij verwachten objects (na header)
    // Dus: columns => keys in object
    let bestCol = null;
    let bestScore = 0;

    for (const col of columns) {
      const vals = rowsSample.slice(0, 80).map((r) => r?.[col]);
      const sc = scoreCodeColumn(vals);
      if (sc > bestScore) {
        bestScore = sc;
        bestCol = col;
      }
    }

    // drempel: redelijk zeker dat dit code is
    if (bestCol && bestScore >= 0.65) {
      mapping[bestCol] = "Code1";
    }
  }

  return mapping;
}


export function mappedTargets(mapping) {
  return new Set(Object.values(mapping).filter((t) => t !== "Niet gebruiken"));
}

export function targetToSource(mapping, target) {
  return Object.keys(mapping).find((k) => mapping[k] === target) || null;
}
