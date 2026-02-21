import { normalizeStr, parseStrictNumber } from "../../utils/format";
import { normalizeCode1, codeClass, isCapsShort, capsRatio } from "../../utils/codes";

function isPost(row, { getVal, qtySource, ecSource, hcSource }) {
  const qty = parseStrictNumber(getVal(row, qtySource));
  const hasQty = qty !== null && qty > 0;
  const hasEC = normalizeStr(getVal(row, ecSource)).length > 0;
  const hasHC = normalizeStr(getVal(row, hcSource)).length > 0;
  return hasQty || hasEC || hasHC;
}

export function computeAutoTypes(rows, ctx) {
  const out = [];
  let prevWasH = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (isPost(row, ctx)) {
      out.push("P");
      prevWasH = false;
      continue;
    }

    const c1 = normalizeCode1(ctx.getVal(row, ctx.code1Source));
    const cls = codeClass(c1);
    const desc = normalizeStr(ctx.getVal(row, ctx.descSource));

    const high = cls === "H_PREFIX" || cls === "ROMAN" || cls === "LETTER" || cls === "INT" || cls === "WORDNUM";
    if (high) {
      out.push("H");
      prevWasH = true;
      continue;
    }

    if (cls === "DOTTED") {
      if (isCapsShort(desc)) {
        out.push("H");
        prevWasH = true;
        continue;
      }
      let score = 0;
      if (desc && desc.length <= 60) score++;
      if (capsRatio(desc) >= 0.75) score++;
      if (prevWasH) score++;
      if (score >= 2) {
        out.push("H");
        prevWasH = true;
        continue;
      }
    }

    out.push("T");
    prevWasH = false;
  }

  return out;
}
