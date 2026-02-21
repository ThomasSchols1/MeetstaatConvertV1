import React from "react";
import { TARGET_FIELDS } from "../config/constants";

export default function MappingScreen({ columns, mapping, setMapping, status, onNext, onBack }) {
  return (
    <div>
      <h3>4) Kolommen mappen</h3>

      <table width="100%" cellPadding="6">
        <thead>
          <tr>
            <th>Bronkolom</th>
            <th>Mapping</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              <td>
                <select
                  value={mapping[c]}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const next = { ...mapping, [c]: chosen };
                    if (chosen !== "Niet gebruiken") {
                      for (const k of Object.keys(next)) {
                        if (k !== c && next[k] === chosen) next[k] = "Niet gebruiken";
                      }
                    }
                    setMapping(next);
                  }}
                >
                  {TARGET_FIELDS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!status.ok && (
        <div style={{ color: "red", marginTop: 8 }}>
          {status.errors.map((e) => <div key={e}>{e}</div>)}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={onBack}>Terug</button>
        <button disabled={!status.ok} onClick={onNext}>Verder: Meetstaat preview</button>
      </div>
    </div>
  );
}
