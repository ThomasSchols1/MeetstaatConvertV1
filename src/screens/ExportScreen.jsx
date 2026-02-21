// src/screens/ExportScreen.jsx
import React from 'react';

export default function ExportScreen({ onBack, onCSV, onXLSX }) {
  return (
    <div>
      <h3>Export</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack}>Terug</button>
        <button onClick={onCSV}>Download CSV</button>
        <button onClick={onXLSX}>Download XLSX</button>
      </div>
    </div>
  );
}
