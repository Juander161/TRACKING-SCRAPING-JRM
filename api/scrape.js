import puppeteer from 'puppeteer-core';

async function scrapeUPS(page, waybill) {
  const url = `https://www.ups.com/track?loc=es_MX&tracknum=${waybill}&requester=ST/`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 15000 });
  
  const datos = await page.evaluate(() => {
    const texto = document.body.innerText;
    const estadosConocidos = [
      'Entregado', 'Delivered',
      'En camino', 'Out for Delivery',
      'En tránsito', 'In Transit',
      'Excepción', 'Exception',
      'Etiqueta creada', 'Label Created'
    ];
    const estadoEncontrado = estadosConocidos.find((e) => texto.includes(e));
    const matchFecha = texto.match(
      /(?:Entregado|Delivered)[^0-9]{0,20}(\d{1,2}\/\d{1,2}\/\d{2,4})/i
    );
    
    return {
      status: estadoEncontrado || 'Desconocido',
      deliveryDate: matchFecha ? matchFecha[1] : null,
    };
  });
  
  return datos;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  const { items } = req.body;
  
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere un arreglo "items"' });
  }
  
  let browser;
  try {
    // 1. Traducimos tu CURL a una petición Fetch de JavaScript para Surfsky
    const surfskyResponse = await fetch('https://api-us1.surfsky.io/profiles/one_time', {
      method: 'POST',
      headers: {
        'X-Cloud-Api-Token': '4433f7d2cbf84a1399464fc6362b3bad', // <-- PON TU TOKEN REAL AQUÍ
        'Content-Type': 'application/json'
      }
    });

    if (!surfskyResponse.ok) {
      const errorText = await surfskyResponse.text();
      throw new Error(`Error de Surfsky API: ${surfskyResponse.status} - ${errorText}`);
    }

    // 2. Extraemos la respuesta que nos da Surfsky
    const surfskyData = await surfskyResponse.json();
    
    // Imprimimos la respuesta en Vercel por si necesitamos ajustar el nombre de la variable
    console.log("Respuesta de Surfsky:", surfskyData);

    // Generalmente, estas APIs devuelven la URL en una propiedad llamada websocket, wsUrl, o endpoint.
    // Ajustaremos esto si Surfsky usa un nombre diferente en su documentación.
    const wsEndpoint = surfskyData.ws_url;

    if (!wsEndpoint) {
      throw new Error("No se encontró la URL del WebSocket en la respuesta de Surfsky: " + JSON.stringify(surfskyData));
    }

    // 3. Nos conectamos usando la URL que nos dio Surfsky
    browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });
    
    const page = await browser.newPage();
    const resultados = [];
    
    for (const item of items) {
      try {
        const datos = await scrapeUPS(page, item.waybill);
        resultados.push({
          waybill: item.waybill,
          carrier: item.carrier,
          status: datos.status,
          deliveryDate: datos.deliveryDate,
        });
      } catch (errorItem) {
        console.error(`Error en tracking ${item.waybill}:`, errorItem.message);
        resultados.push({
          waybill: item.waybill,
          carrier: item.carrier,
          status: `Error: ${errorItem.message}`,
          deliveryDate: null,
        });
      }
    }
    
    await browser.close();
    return res.status(200).json({ resultados });
  } catch (error) {
    if (browser) await browser.close();
    console.error("Error crítico de conexión con Surfsky:", error.message);
    return res.status(500).json({ error: error.message });
  }
}