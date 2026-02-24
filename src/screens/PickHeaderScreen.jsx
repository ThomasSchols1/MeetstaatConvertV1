import React from "react";
import { PREVIEW_COUNT } from "../config/constants";
import { normalizeStr } from "../utils/format";

export default function PickHeaderScreen({ rawRows, headerIndex, setHeaderIndex, onBack, onConfirm }) {
  return (
    <div>
      <h3>3) Kies kolomkoppen</h3>

      <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f7f7f7" }}>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Header?</th>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Rij</th>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Preview (eerste 8 cellen)</th>
          </tr>
        </thead>
        <tbody>
          {rawRows.slice(0, PREVIEW_COUNT).map((arr, i) => {
            const cells = (arr || []).slice(0, 8).map((c) => normalizeStr(c)).filter(Boolean);
            return (
              <tr key={i} style={i === headerIndex ? { background: "#fff3cd" } : undefined}>
                <td style={{ borderBottom: "1px solid #eee" }}>
                  <input type="radio" checked={i === headerIndex} onChange={() => setHeaderIndex(i)} />
                </td>
                <td style={{ borderBottom: "1px solid #eee", color: "#666" }}>{i + 1}</td>
                <td style={{ borderBottom: "1px solid #eee" }}>
                  {cells.length ? cells.join(" | ") : <span style={{ color: "#999" }}>(leeg)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={onConfirm}>Bevestigen header</button>
      </div>
    </div>
  );
}
