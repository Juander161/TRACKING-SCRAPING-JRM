const TAMANO_LOTE = 8;

// Función de pausa
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeLote(items) {
  const respuesta = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  
  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    throw new Error(`Error del servidor: ${respuesta.status} - ${errorTexto}`);
  }
  
  const datos = await respuesta.json();
  return datos.resultados;
}

export async function scrapeBatch(items, onProgress) {
  const resultados = [];
  
  for (let i = 0; i < items.length; i += TAMANO_LOTE) {
    const lote = items.slice(i, i + TAMANO_LOTE);
    
    try {
      const lotesResueltos = await scrapeLote(lote);
      resultados.push(...lotesResueltos);
    } catch (error) {
      lote.forEach((item) => {
        resultados.push({
          waybill: item.waybill,
          carrier: item.carrier,
          status: `Error: ${error.message}`,
          deliveryDate: null,
        });
      });
      console.error('Error en lote de scraping:', error);
    }
    
    if (onProgress) {
      onProgress(resultados.length, items.length);
    }

    // PAUSA DE 15 SEGUNDOS (15000 ms)
    // Matemáticamente seguro para el límite de 5 llamadas / min de Surfsky
    if (i + TAMANO_LOTE < items.length) {
      console.log("Esperando 15 segundos para respetar los límites de Surfsky...");
      await esperar(15000); 
    }
  }
  
  return resultados;
}