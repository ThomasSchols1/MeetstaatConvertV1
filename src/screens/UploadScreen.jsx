import React from "react";

export default function UploadScreen({ onFile }) {
  return (
    <div>
      <h3>1) Upload CSV, Excel of PDF</h3>
      <input type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={onFile} />
      <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
        Tip: PDF werkt straks via “tabel selecteren” (rechthoek).
      </div>
    </div>
  );
}
