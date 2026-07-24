import React, { useMemo, useState } from 'react';
import { exportarReporteExcel } from '../utils/exportExcel.js';

const COLOR_PROCESADO = '#2e7d32';
const COLOR_NO_PROCESADO = '#c62828';
const TAMANO_PAGINA = 100;

function construirResumenPorCarrier(resultados) {
  const grupos = {};
  resultados.forEach((r) => {
    if (!grupos[r.carrier]) grupos[r.carrier] = [];
    grupos[r.carrier].push(r);
  });

  return Object.entries(grupos)
    .map(([carrier, items]) => {
      const total = items.length;
      const procesados = items.filter((r) => r.deliveryDate).length;
      const noProcesados = total - procesados;
      return {
        carrier, total, procesados, noProcesados,
        porcentajeProcesado: ((procesados / total) * 100).toFixed(1),
        porcentajeNoProcesado: ((noProcesados / total) * 100).toFixed(1),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export default function ResultsReport({ resultados }) {
  const [pagina, setPagina] = useState(0);
  const [busquedaWaybill, setBusquedaWaybill] = useState('');
  const [filtroCarrier, setFiltroCarrier] = useState('');

  const resumenPorCarrier = useMemo(() => construirResumenPorCarrier(resultados), [resultados]);
  const carriersDisponibles = useMemo(
    () => [...new Set(resultados.map((r) => r.carrier))].sort(), [resultados]
  );

  const resultadosFiltrados = useMemo(() => {
    return resultados.filter((r) => {
      const coincideWaybill = busquedaWaybill
        ? String(r.waybill).toLowerCase().includes(busquedaWaybill.toLowerCase())
        : true;
      const coincideCarrier = filtroCarrier ? r.carrier === filtroCarrier : true;
      return coincideWaybill && coincideCarrier;
    });
  }, [resultados, busquedaWaybill, filtroCarrier]);

  const totalPaginas = Math.ceil(resultadosFiltrados.length / TAMANO_PAGINA) || 1;
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaActual * TAMANO_PAGINA;
  const filasVisibles = resultadosFiltrados.slice(inicio, inicio + TAMANO_PAGINA);

  function handleFiltroChange(setter) {
    return (valor) => { setter(valor); setPagina(0); };
  }

  if (!resultados.length) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>4. Estado general de los envíos</h2>
        <button className="primary" onClick={() => exportarReporteExcel(resultados)}>
          Descargar reporte Excel
        </button>
      </div>
      <p>{resultados.length} trackings procesados en total</p>

      <h3>Resumen por Carrier</h3>
      <table>
        <thead>
          <tr>
            <th>Carrier</th><th>Total</th><th>Procesados</th>
            <th>% Procesado</th><th>No Procesados</th><th>% No Procesado</th>
          </tr>
        </thead>
        <tbody>
          {resumenPorCarrier.map((r) => (
            <tr key={r.carrier}>
              <td>{r.carrier}</td><td>{r.total}</td><td>{r.procesados}</td>
              <td><span className="badge" style={{ background: COLOR_PROCESADO }}>{r.porcentajeProcesado}%</span></td>
              <td>{r.noProcesados}</td>
              <td><span className="badge" style={{ background: COLOR_NO_PROCESADO }}>{r.porcentajeNoProcesado}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Detalle de trackings</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Buscar por waybill..." value={busquedaWaybill}
          onChange={(e) => handleFiltroChange(setBusquedaWaybill)(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #cbd5e1', flex: 1, minWidth: 200 }}
        />
        <select
          value={filtroCarrier} onChange={(e) => handleFiltroChange(setFiltroCarrier)(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">Todos los carriers</option>
          {carriersDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button className="primary" onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={paginaActual === 0}>
          Anterior
        </button>
        <span>Página {paginaActual + 1} de {totalPaginas} ({resultadosFiltrados.length} resultados)</span>
        <button className="primary" onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={paginaActual >= totalPaginas - 1}>
          Siguiente
        </button>
      </div>

      <table>
        <thead>
          <tr><th>Waybill</th><th>Carrier</th><th>Estado</th><th>Fecha de entrega</th><th>Procesado</th></tr>
        </thead>
        <tbody>
          {filasVisibles.map((r) => (
            <tr key={r.waybill}>
              <td>{r.waybill}</td><td>{r.carrier}</td><td>{r.status}</td><td>{r.deliveryDate || '—'}</td>
              <td><span className="badge" style={{ background: r.deliveryDate ? COLOR_PROCESADO : COLOR_NO_PROCESADO }}>{r.deliveryDate ? 'Sí' : 'No'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
