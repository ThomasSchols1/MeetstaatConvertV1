import { clamp } from "../../utils/format";
import { normalizeCode1, codeClass, dottedDepth } from "../../utils/codes";
import { MAX_LEVEL } from "../../config/constants";

export function deriveAnchorFromFirstChapterRow(firstChapterRow, { getVal, code1Source }) {
  const c1 = normalizeCode1(getVal(firstChapterRow, code1Source));
  const cls = codeClass(c1);
  const depth = cls === "DOTTED" ? dottedDepth(c1) : 0;
  return { class: cls, dottedDepth: depth, example: c1 };
}

function chapterIntrinsicLevel(code1Raw, anchorSpec) {
  const c1 = normalizeCode1(code1Raw);
  const cls = codeClass(c1);

  if (anchorSpec?.class === "H_PREFIX") {
    if (cls === "H_PREFIX") {
      const dots = (c1.match(/\./g) || []).length;
      return clamp(dots, 0, MAX_LEVEL);
    }
    if (cls === "INT") return 1;
    if (cls === "DOTTED") return clamp(dottedDepth(c1) + 1, 0, MAX_LEVEL);
    if (cls === "LETTER" || cls === "ROMAN" || cls === "WORDNUM") return 1;
    return 1;
  }

  if (anchorSpec?.class === "INT" || anchorSpec?.class === "LETTER" || anchorSpec?.class === "ROMAN" || anchorSpec?.class === "WORDNUM") {
    if (cls === anchorSpec.class) return 0;
    if (cls === "INT") return 0;
    if (cls === "DOTTED") return clamp(dottedDepth(c1), 0, MAX_LEVEL);
    if (cls === "H_PREFIX") return 0;
    if (cls === "LETTER" || cls === "ROMAN" || cls === "WORDNUM") return 0;
    return 1;
  }

  if (anchorSpec?.class === "DOTTED") {
    if (cls === "DOTTED") {
      const d = dottedDepth(c1);
      const rel = d - (anchorSpec.dottedDepth || 0);
      return clamp(rel, 0, MAX_LEVEL);
    }
    if (cls === "INT") return 0;
    return 1;
  }

  if (cls === "DOTTED") return clamp(dottedDepth(c1), 0, MAX_LEVEL);
  return 0;
}

export function computeAutoLevelsFromTypes(rows, types, anchorSpec, { getVal, code1Source }) {
  const levels = new Array(rows.length).fill(0);
  const stack = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const t = types[i];

    if (t === "H") {
      const intrinsic = chapterIntrinsicLevel(getVal(row, code1Source), anchorSpec);
      while (stack.length && stack[stack.length - 1].level >= intrinsic) stack.pop();
      stack.push({ level: intrinsic });
      levels[i] = intrinsic;
    } else {
      const currentChapterLevel = stack.length ? stack[stack.length - 1].level : 0;
      levels[i] = clamp(currentChapterLevel + 1, 0, MAX_LEVEL);
    }
  }

  return levels;
}
