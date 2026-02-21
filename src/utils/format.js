export function normalizeStr(x) {
  return String(x ?? "").trim();
}

export function parseStrictNumber(x) {
  const raw = normalizeStr(x);
  if (!raw) return null;

  let s = raw.replace(/\s|\u00A0/g, "");
  s = s.replace(/[^0-9,\.\-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decIsComma = lastComma > lastDot;

    if (decIsComma) {
      s = s.replace(/\./g, "");
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  if (s === "" || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
