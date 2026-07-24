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
    // AQUÍ ES LA MAGIA: Nos conectamos al Chrome remoto de Browserless
    // REEMPLAZA TU_API_KEY CON LA LLAVE QUE COPIASTE
    // AQUÍ ES LA MAGIA: Nos conectamos al Chrome remoto de Browserless
    browser = await puppeteer.connect({
        browserWSEndpoint: 'wss://production-sfo.browserless.io/?token=4433f7d2cbf84a1399464fc6362b3bad',
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
    console.error("Error crítico de conexión remota:", error.message);
    return res.status(500).json({ error: error.message });
  }
}