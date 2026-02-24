import React from "react";
import { MAX_LEVEL, PREVIEW_COUNT } from "../config/constants";

export default function TypeLevelScreen({
  effectiveRows,
  updateRowType,
  updateRowManualLevel,
  onBack,
  onNext,
  code1Source,
  descSource,
  getVal,
}) {
  return (
    <div>
      <h3>Types en niveaus</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onBack}>Terug naar preview</button>
        <button onClick={onNext}>Terug naar preview</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f7f7f7" }}>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>#</th>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Type</th>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Level</th>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Manual</th>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Code1</th>
              <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Omschrijving</th>
            </tr>
          </thead>
          <tbody>
            {effectiveRows.slice(0, 700).map((it, idx) => {
              const r = it.row;
              return (
                <tr key={idx}>
                  <td style={{ borderBottom: "1px solid #eee", color: "#666" }}>{idx + 1}</td>

                  <td style={{ borderBottom: "1px solid #eee" }}>
                    <select value={it.type} onChange={(e) => updateRowType(idx, e.target.value)}>
                      <option value="H">H</option>
                      <option value="P">P</option>
                      <option value="T">T</option>
                    </select>
                  </td>

                  <td style={{ borderBottom: "1px solid #eee" }}>{it.level}</td>

                  <td style={{ borderBottom: "1px solid #eee" }}>
                    <input
                      type="number"
                      min="0"
                      max={MAX_LEVEL}
                      placeholder="-"
                      value={it.manualLevel == null ? "" : String(it.manualLevel)}
                      onChange={(e) => updateRowManualLevel(idx, e.target.value)}
                      style={{ width: 70 }}
                    />
                  </td>

                  <td style={{ borderBottom: "1px solid #eee" }}>
                    {String(getVal(r, code1Source) ?? "")}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee" }}>
                    {String(getVal(r, descSource) ?? "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, color: "#666" }}>
        Pas enkel aan waar nodig.
      </div>
    </div>
  );
}
