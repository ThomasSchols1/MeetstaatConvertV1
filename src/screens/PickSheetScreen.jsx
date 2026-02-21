import React from "react";

export default function PickSheetScreen({ sheets, selected, onChange, onConfirm, onBack }) {
  return (
    <div>
      <h3>2) Kies Excel-tabblad</h3>
      <div style={{ marginBottom: 12 }}>
        <select value={selected} onChange={(e) => onChange(e.target.value)}>
          {sheets.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={onConfirm}>Bevestigen tabblad</button>
      </div>
    </div>
  );
}
