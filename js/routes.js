import { hav, mx, my, thin } from './geo.js';

export const MIN_STEP_M = 4; // descarta puntos a menos de N metros

// Convierte segmentos crudos en una ruta lista para dibujar.
export function buildRoute(name, key, rawSegs, year) {
  let km = 0, off = 0;
  const segs = [];
  for (const raw of rawSegs) {
    const seg = thin(raw, MIN_STEP_M);
    if (seg.length < 2) continue;
    const n = seg.length;
    const xs = new Float64Array(n), ys = new Float64Array(n), cum = new Float64Array(n);
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      const [lat, lon] = seg[i];
      if (i > 0) {
        const d = hav(seg[i - 1][0], seg[i - 1][1], lat, lon);
        km += d;
        acc += d * 1000;
      }
      const x = mx(lon), y = my(lat);
      xs[i] = x; ys[i] = y; cum[i] = off + acc;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    off += acc;
    segs.push({ xs, ys, cum, n, x0, x1, y0, y1 });
  }
  return segs.length ? { name, key, year, segs, km, total: off } : null;
}
