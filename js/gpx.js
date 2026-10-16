// Lee un GPX (solo en el navegador). Devuelve segmentos [[lat, lon], ...] y el año.
export function parseGPX(text, fileName = 'archivo.gpx') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`${fileName}: GPX no válido`);

  const toSeg = (nodes) => {
    const seg = [];
    for (const n of nodes) {
      const lat = parseFloat(n.getAttribute('lat'));
      const lon = parseFloat(n.getAttribute('lon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) seg.push([lat, lon]);
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

  // Año: del nombre (AAAA-MM-DD...) o, si no, de la primera etiqueta <time>.
  let year = 0;
  const base = fileName.split(/[\\/]/).pop();
  let m = base.match(/^(\d{4})-\d{2}-\d{2}/);
  if (m) year = +m[1];
  else {
    const t = doc.getElementsByTagName('time')[0];
    m = t && t.textContent.match(/^\s*(\d{4})-/);
    if (m) year = +m[1];
  }
  return { segs, year };
}
