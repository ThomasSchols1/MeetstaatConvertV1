// src/features/import/excel.js
import * as XLSX from 'xlsx';

export async function readExcelToWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return wb;
}

export function workbookToRows(workbook, sheetName) {
  if (!workbook) return [];
  const name = sheetName || workbook.SheetNames?.[0];
  const ws = workbook.Sheets?.[name];
  if (!ws) return [];

  // header:1 => array-of-arrays
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });

  return rows || [];
}
