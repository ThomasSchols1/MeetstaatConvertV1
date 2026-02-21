import { parseStrictNumber } from '../../utils/format';
import { exportToXlsx } from './excel';

export function buildExportRows({
  effectiveRows,
  mapping,
  ORDERED_OUTPUT_FIELDS,
  NUMERIC_TARGETS,
  targetToSource,
}) {
  return effectiveRows.map((it) => {
    const r = it.row;
    const out = { Type: it.type, Level: it.level };

    for (const target of ORDERED_OUTPUT_FIELDS) {
      const src = targetToSource(mapping, target);
      const raw = src ? r?.[src] : '';

      if ((target === 'EKP' || target === 'EVP') && it.type !== 'P') {
        out[target] = '';
        continue;
      }

      if (NUMERIC_TARGETS.has(target)) {
        const n = parseStrictNumber(raw);
        out[target] = n === null ? '' : n;
      } else {
        out[target] = src ? String(raw ?? '') : '';
      }
    }
    return out;
  });
}
export function exportRowsToXlsx(buildArgs, filename = "meetstaat.xlsx") {
  const rows = buildExportRows(buildArgs);
  exportToXlsx(rows, filename);
}
