import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseStrictNumber } from "../../utils/format";

export function downloadCSV(data, filename = "meetstaat_output.csv") {
  const csv = Papa.unparse(data, { quotes: false });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadXLSX(data, filename = "meetstaat_output.xlsx") {
  const ws = XLSX.utils.json_to_sheet(data);

  const header = Object.keys(data[0] || {});
  const numCols = new Set(["Aantal", "EKP", "EVP"]);
  const colIndex = {};
  header.forEach((h, i) => (colIndex[h] = i));

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (const key of numCols) {
      const C = colIndex[key];
      if (C === undefined) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      const n = typeof cell.v === "number" ? cell.v : parseStrictNumber(cell.v);
      if (n === null) delete ws[addr];
      else ws[addr] = { t: "n", v: n };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Meetstaat");
  XLSX.writeFile(wb, filename);
}
