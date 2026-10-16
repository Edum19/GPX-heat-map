const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Inserta puntos intermedios para que no haya huecos entre muestras GPS
// y la intensidad dependa de la distancia recorrida, no de la frecuencia de muestreo.
export function densify(segment, stepM) {
  const out = [segment[0]];
  for (let i = 1; i < segment.length; i++) {
    const a = segment[i - 1], b = segment[i];
    const d = haversine(a, b);
    const n = Math.floor(d / stepM);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    out.push(b);
  }
  return out;
}

export function segmentLength(segment) {
  let d = 0;
  for (let i = 1; i < segment.length; i++) d += haversine(segment[i - 1], segment[i]);
  return d;
}
