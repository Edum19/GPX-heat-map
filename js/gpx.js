// Lee un GPX (solo en el navegador).
// Devuelve segmentos [[lat, lon, t], ...] (t = segundos epoch o NaN) y la fecha 'AAAA-MM-DD' ('' si no hay).
export function parseGPX(text, fileName = 'archivo.gpx') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`${fileName}: GPX no válido`);

  const toSeg = (nodes) => {
    const seg = [];
    for (const n of nodes) {
      const lat = parseFloat(n.getAttribute('lat'));
      const lon = parseFloat(n.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const tn = n.getElementsByTagName('time')[0];
      seg.push([lat, lon, tn ? Date.parse(tn.textContent) / 1000 : NaN]);
    }
    return seg;
  };

  const segs = [];
  for (const s of doc.getElementsByTagName('trkseg')) {
    const seg = toSeg(s.getElementsByTagName('trkpt'));
    if (seg.length >= 2) segs.push(seg);
  }
  if (!segs.length) {
    for (const r of doc.getElementsByTagName('rte')) {
      const seg = toSeg(r.getElementsByTagName('rtept'));
      if (seg.length >= 2) segs.push(seg);
    }
  }

  // Fecha: del nombre (AAAA-MM-DD...) o, si no, de la primera etiqueta <time>.
  let date = '';
  const base = fileName.split(/[\\/]/).pop();
  let m = base.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) date = m[1];
  else {
    const t = doc.getElementsByTagName('time')[0];
    m = t && t.textContent.match(/^\s*(\d{4}-\d{2}-\d{2})/);
    if (m) date = m[1];
  }
  return { segs, date };
}
