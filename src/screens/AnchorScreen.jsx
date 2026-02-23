import React, { useMemo } from "react";
import { PREVIEW_COUNT } from "../config/constants";
import { normalizeStr } from "../utils/format";

export default function AnchorScreen({
  rowsAll,
  anchorIndex,
  setAnchorIndex,
  code1Source,
  descSource,
  getVal,
  onBack,
  onConfirm,
}) {
  const preview = useMemo(() => rowsAll.slice(0, PREVIEW_COUNT), [rowsAll]);

  return (
    <div>
      <h3>5) Kies startregel</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={onConfirm}>Verder</button>
      </div>

      <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f7f7f7" }}>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Anker</th>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Rij</th>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Code1</th>
            <th align="left" style={{ borderBottom: "1px solid #ddd" }}>Omschrijving</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((r, i) => {
            const c1 = normalizeStr(getVal(r, code1Source));
            const desc = normalizeStr(getVal(r, descSource));

            return (
              <tr key={i} style={i === anchorIndex ? { background: "#fff3cd" } : undefined}>
                <td style={{ borderBottom: "1px solid #eee" }}>
                  <input
                    type="radio"
                    checked={i === anchorIndex}
                    onChange={() => setAnchorIndex(i)}
                  />
                </td>
                <td style={{ borderBottom: "1px solid #eee", color: "#666" }}>{i + 1}</td>
                <td style={{ borderBottom: "1px solid #eee" }}>{c1}</td>
                <td style={{ borderBottom: "1px solid #eee" }}>{desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 10, color: "#666" }}>
        Kies de eerste relevante regel van je meetstaat.
      </div>
    </div>
  );
}
