import { hav, mx, my, thin } from './geo.js';

export const MIN_STEP_M = 4;     // descarta puntos a menos de N metros
const SPEED_WIN_M = 30;          // ventana para suavizar la velocidad
const MAX_KMH = 300;             // por encima se considera error de GPS
const MAX_GAP_S = 120;           // huecos mayores no cuentan como tiempo en movimiento

// Velocidad suavizada (km/h) en cada punto, usando ~30 m a cada lado.
function speeds(cum, tt, n) {
  const v = new Float32Array(n);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    while (lo + 1 <= i && cum[i] - cum[lo + 1] >= SPEED_WIN_M) lo++;
    if (hi < i) hi = i;
    while (hi < n - 1 && cum[hi] - cum[i] < SPEED_WIN_M) hi++;
    const dt = tt[hi] - tt[lo], dd = cum[hi] - cum[lo];
    const s = dt > 0 ? (dd / dt) * 3.6 : NaN;
    v[i] = s >= 0 && s <= MAX_KMH ? s : NaN;
  }
  return v;
}

// rawSegs: [[ [lat, lon, t?], ... ], ...]  ·  date: 'AAAA-MM-DD' o ''
export function buildRoute(name, key, rawSegs, date = '') {
  let km = 0, off = 0, sec = 0, moveKm = 0, hasTime = false;
  let X0 = 1, X1 = 0, Y0 = 1, Y1 = 0;
  const segs = [];
  for (const raw of rawSegs) {
    const seg = thin(raw, MIN_STEP_M);
    if (seg.length < 2) continue;
    const n = seg.length;
    const xs = new Float64Array(n), ys = new Float64Array(n), cum = new Float64Array(n), tt = new Float64Array(n);
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      const [lat, lon, t] = seg[i];
      tt[i] = typeof t === 'number' ? t : NaN;
      if (i > 0) {
        const d = hav(seg[i - 1][0], seg[i - 1][1], lat, lon);
        km += d; acc += d * 1000;
        const dt = tt[i] - tt[i - 1];
        if (dt > 0 && dt <= MAX_GAP_S) { sec += dt; moveKm += d; }
      }
      const x = mx(lon), y = my(lat);
      xs[i] = x; ys[i] = y; cum[i] = off + acc;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    off += acc;
    const timed = tt.every(Number.isFinite);
    if (timed) hasTime = true;
    segs.push({ xs, ys, cum, n, x0, x1, y0, y1, tt: timed ? tt : null, spd: timed ? speeds(cum, tt, n) : null });
    if (x0 < X0) X0 = x0; if (x1 > X1) X1 = x1; if (y0 < Y0) Y0 = y0; if (y1 > Y1) Y1 = y1;
  }
  if (!segs.length) return null;
  return { name, key, date, year: date ? +date.slice(0, 4) : 0, segs, km, total: off, sec, moveKm, hasTime,
    x0: X0, x1: X1, y0: Y0, y1: Y1 };
}
