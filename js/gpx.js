// Parseo de GPX 100% en el navegador. Devuelve segmentos de [lat, lon].
export function parseGPX(text, fileName = 'archivo.gpx') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`${fileName}: GPX no válido`);

  const toSeg = (nodes) => {
    const seg = [];
    for (const n of nodes) {
      const lat = parseFloat(n.getAttribute('lat'));
      const lon = parseFloat(n.getAttribute('lon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) seg.push([lat, lon]);
    }
    return seg;
  };

  const segments = [];
  doc.querySelectorAll('trkseg').forEach((s) => {
    const seg = toSeg(s.querySelectorAll('trkpt'));
    if (seg.length > 1) segments.push(seg);
  });
  // Rutas (rte) como respaldo si no hay tracks
  if (!segments.length) {
    doc.querySelectorAll('rte').forEach((r) => {
      const seg = toSeg(r.querySelectorAll('rtept'));
      if (seg.length > 1) segments.push(seg);
    });
  }
  return { name: fileName, segments };
}
