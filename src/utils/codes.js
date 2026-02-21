import { normalizeStr } from "./format";

export function looksLikeProjectInfo(desc) {
  const d = normalizeStr(desc).toLowerCase();
  const bad = ["project", "klant", "werf", "adres", "datum", "telefoon", "contact", "offerte", "referentie"];
  return bad.some((w) => d.includes(w));
}

export function isLikelyCode(code) {
  const c = normalizeStr(code);
  if (!c) return false;
  if (/^\d+$/.test(c)) return true;
  if (/^\d+(\.\d+)+$/.test(c)) return true;
  if (/^[A-Z]\.?$/.test(c)) return true;
  if (/^(deel|hoofdstuk|chapter)\s*\d+/i.test(c)) return true;
  if (/^H\s*\d+$/i.test(c)) return true;
  if (/^H\d+$/i.test(c)) return true;
  if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)$/i.test(c)) return true;
  return false;
}

export function capsRatio(text) {
  const t = normalizeStr(text);
  if (!t) return 0;
  const letters = t.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length === 0) return 0;
  const upper = t.match(/[A-ZÀ-ß]/g);
  return (upper ? upper.length : 0) / letters.length;
}

export function isCapsShort(desc) {
  const d = normalizeStr(desc);
  if (!d) return false;
  return d.length <= 60 && capsRatio(d) >= 0.75;
}

export function normalizeCode1(code1) {
  let c = normalizeStr(code1);
  if (!c) return "";
  c = c.replace(/\s+/g, "");
  c = c.replace(/\.+$/g, "");
  return c;
}

export function isRoman(c) {
  return /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)$/i.test(c);
}

export function codeClass(code1Raw) {
  const c = normalizeCode1(code1Raw);
  if (!c) return "EMPTY";
  if (/^H\d+(\.\d+)*$/i.test(c)) return "H_PREFIX";
  if (isRoman(c)) return "ROMAN";
  if (/^[A-Z]$/.test(c)) return "LETTER";
  if (/^\d+$/.test(c)) return "INT";
  if (/^\d+(\.\d+)+$/.test(c)) return "DOTTED";
  if (/^(deel|hoofdstuk|chapter)\d+$/i.test(c)) return "WORDNUM";
  return "OTHER";
}

export function dottedDepth(code1Raw) {
  const c = normalizeCode1(code1Raw);
  if (!/^\d+(\.\d+)+$/.test(c)) return 0;
  const dots = (c.match(/\./g) || []).length;
  return Math.min(dots, 6); // depth support
}
