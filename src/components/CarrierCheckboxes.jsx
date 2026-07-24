import React from 'react';

export default function CarrierCheckboxes({ carriers, seleccionados, onToggle, onBuscar, cargando }) {
  if (!carriers.length) return null;

  return (
    <div className="card">
      <h2>3. Seleccionar carriers a procesar</h2>
      <div className="carrier-list">
        {carriers.map((carrier) => (
          <label key={carrier} className="carrier-item">
            <input
              type="checkbox"
              checked={seleccionados.includes(carrier)}
              onChange={() => onToggle(carrier)}
            />
            {carrier}
          </label>
        ))}
      </div>
      <button className="primary" onClick={onBuscar} disabled={cargando || seleccionados.length === 0}>
        {cargando ? 'Buscando...' : 'Buscar'}
      </button>
    </div>
  );
}