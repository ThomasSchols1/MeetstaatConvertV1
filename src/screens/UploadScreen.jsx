import React from "react";

export default function UploadScreen({ onFile }) {
  return (
    <div>
      <h3>1) Bestand kiezen</h3>
      <input type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={onFile} />
    </div>
  );
}
