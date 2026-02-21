import Papa from "papaparse";

export function readCsvToRows(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      complete: (res) => {
        const rows = (res.data || []).map((r) => (Array.isArray(r) ? r : []));
        resolve(rows);
      },
      error: reject,
    });
  });
}
