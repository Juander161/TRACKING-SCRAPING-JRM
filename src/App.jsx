import React, { useState } from 'react';
import FileUpload from './components/FileUpload.jsx';
import ScanLocationSelect from './components/ScanLocationSelect.jsx';
import CarrierCheckboxes from './components/CarrierCheckboxes.jsx';
import ResultsReport from './components/ResultsReport.jsx';
import {
  parseTrackingFile,
  extraerScanLocations,
  extraerCarriersPorLocation,
} from './utils/parseFile.js';
import { scrapeBatch } from './scrapers/realScraper.js';

export default function App() {
  const [fileName, setFileName] = useState('');
  const [registros, setRegistros] = useState([]);
  const [scanLocations, setScanLocations] = useState([]);
  const [scanLocationSeleccionado, setScanLocationSeleccionado] = useState('');
  const [carriersDisponibles, setCarriersDisponibles] = useState([]);
  const [carriersSeleccionados, setCarriersSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resultados, setResultados] = useState([]);

  async function handleFileSelected(file) {
    setFileName(file.name);
    setResultados([]);
    const datos = await parseTrackingFile(file);
    setRegistros(datos);
    const locations = extraerScanLocations(datos);
    setScanLocations(locations);
    setScanLocationSeleccionado('');
    setCarriersDisponibles([]);
    setCarriersSeleccionados([]);
  }

  function handleScanLocationChange(valor) {
    setScanLocationSeleccionado(valor);
    const carriers = extraerCarriersPorLocation(registros, valor);
    setCarriersDisponibles(carriers);
    setCarriersSeleccionados(carriers);
    setResultados([]);
  }

  function toggleCarrier(carrier) {
    setCarriersSeleccionados((prev) =>
      prev.includes(carrier) ? prev.filter((c) => c !== carrier) : [...prev, carrier]
    );
  }

  async function handleBuscar() {
    const items = registros.filter(
      (r) => r.scanLocation === scanLocationSeleccionado && carriersSeleccionados.includes(r.carrier)
    );
    
    setCargando(true);
    setProgreso({ hecho: 0, total: items.length });
    setResultados([]);
    
    const datos = await scrapeBatch(items, (hecho, total) => setProgreso({ hecho, total }));
    setResultados(datos);
    setCargando(false);
  }

  return (
    <div className="app">
      <h1>Dashboard de Trackings</h1>
      
      <FileUpload onFileSelected={handleFileSelected} fileName={fileName} />
      
      {scanLocations.length > 0 && (
        <ScanLocationSelect 
          opciones={scanLocations} 
          valor={scanLocationSeleccionado} 
          onChange={handleScanLocationChange} 
        />
      )}
      
      <CarrierCheckboxes
        carriers={carriersDisponibles}
        seleccionados={carriersSeleccionados}
        onToggle={toggleCarrier}
        onBuscar={handleBuscar}
        cargando={cargando}
      />
      
      {cargando && progreso && (
        <div className="card">Procesando {progreso.hecho} de {progreso.total}...</div>
      )}
      
      {/* Aquí ya pasamos la prop scanLocation al reporte */}
      <ResultsReport 
        resultados={resultados} 
        scanLocation={scanLocationSeleccionado} 
      />
    </div>
  );
}