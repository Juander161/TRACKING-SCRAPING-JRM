import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

async function scrapeUPS(page, waybill) {
  const url = `https://www.ups.com/track?loc=en_US&tracknum=${waybill}&requester=ST/`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 15000 });
  
  const datos = await page.evaluate(() => {
    const texto = document.body.innerText;
    const estadosConocidos = [
      'Delivered',
      'Out for Delivery',
      'In Transit',
      'Exception',
      'Label Created',
    ];
    const estadoEncontrado = estadosConocidos.find((e) => texto.includes(e));
    const matchFecha = texto.match(
      /Delivered[^0-9]{0,20}(\d{1,2}\/\d{1,2}\/\d{2,4})/i
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
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
        // IMPRIMIR EL ERROR EN LA CONSOLA DE VERCEL
        console.error(`Error en tracking ${item.waybill}:`, errorItem.message);
        
        resultados.push({
          waybill: item.waybill,
          carrier: item.carrier,
          // MANDAR EL ERROR AL FRONTEND PARA VERLO EN LA TABLA
          status: `Error: ${errorItem.message}`, 
          deliveryDate: null,
        });
      }
    }
    
    await browser.close();
    return res.status(200).json({ resultados });
  } catch (error) {
    if (browser) await browser.close();
    return res.status(500).json({ error: error.message });
  }
}