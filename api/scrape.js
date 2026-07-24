import puppeteer from 'puppeteer-core';

const CONCURRENCIA = 6; // páginas simultáneas dentro del mismo browser

async function scrapeUPS(page, waybill) {
  const url = `https://www.ups.com/track?loc=es_MX&tracknum=${waybill}&requester=ST/`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('body', { timeout: 8000 });

  const datos = await page.evaluate(() => {
    const texto = document.body.innerText;
    const estadosConocidos = [
      'Entregado', 'Delivered',
      'En camino', 'Out for Delivery',
      'En tránsito', 'In Transit',
      'Excepción', 'Exception',
      'Etiqueta creada', 'Label Created'
    ];
    //CUANDO EL ESTADO SE ACTULIZA
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

async function procesarItem(browser, item) {
  const page = await browser.newPage();
  try {
    const datos = await scrapeUPS(page, item.waybill);
    return {
      waybill: item.waybill,
      carrier: item.carrier,
      status: datos.status,
      deliveryDate: datos.deliveryDate,
    };
  } catch (errorItem) {
    console.error(`Error en tracking ${item.waybill}:`, errorItem.message);
    return {
      waybill: item.waybill,
      carrier: item.carrier,
      status: `Error: ${errorItem.message}`,
      deliveryDate: null,
    };
  } finally {
    await page.close();
  }
}

// Procesa en sub-lotes de tamaño CONCURRENCIA, en paralelo cada sub-lote
async function procesarConConcurrencia(browser, items) {
  const resultados = [];
  for (let i = 0; i < items.length; i += CONCURRENCIA) {
    const subLote = items.slice(i, i + CONCURRENCIA);
    const resultadosSubLote = await Promise.all(
      subLote.map((item) => procesarItem(browser, item))
    );
    resultados.push(...resultadosSubLote);
  }
  return resultados;
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
    const surfskyResponse = await fetch('https://api-us1.surfsky.io/profiles/one_time', {
      method: 'POST',
      headers: {
        'X-Cloud-Api-Token': process.env.SURFSKY_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!surfskyResponse.ok) {
      const errorText = await surfskyResponse.text();
      throw new Error(`Error de Surfsky API: ${surfskyResponse.status} - ${errorText}`);
    }

    const surfskyData = await surfskyResponse.json();
    const wsEndpoint = surfskyData.ws_url;

    if (!wsEndpoint) {
      throw new Error("No se encontró la URL del WebSocket en la respuesta de Surfsky: " + JSON.stringify(surfskyData));
    }

    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

    const resultados = await procesarConConcurrencia(browser, items);

    await browser.close();
    return res.status(200).json({ resultados });
  } catch (error) {
    if (browser) await browser.close();
    console.error("Error crítico:", error.message);
    return res.status(500).json({ error: error.message });
  }
}