import React from 'react';

export default function ScanLocationSelect({ opciones, valor, onChange }) {
  return (
    <div className="card">
      <h2>2. Seleccionar Scan Location</h2>
      <select value={valor || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>-- Selecciona una ubicación --</option>
        {opciones.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    </div>
  );
}