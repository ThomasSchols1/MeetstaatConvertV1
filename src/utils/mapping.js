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

export function buildInitialMapping(columns) {
  const mapping = {};
  const used = new Set();
  for (const col of columns) {
    const suggested = suggestTargetField(col);
    if (suggested !== "Niet gebruiken" && !used.has(suggested)) {
      mapping[col] = suggested;
      used.add(suggested);
    } else {
      mapping[col] = "Niet gebruiken";
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
