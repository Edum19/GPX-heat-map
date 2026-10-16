// Guardar/cargar sesión: rutas ya procesadas en un único archivo compacto (.gpxheat).
// Formato: JSON con coordenadas en enteros delta (1e-5° ≈ 1 m), comprimido con gzip si el navegador puede.
// El archivo se guarda en TU equipo; nada se sube a ningún sitio.
import { buildRoute } from './routes.js';

const R = 1e5;

async function pipe(bytes, stream) {
  const w = stream.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function saveSession(routes) {
  const out = { v: 1, routes: [] };
  for (const r of routes) {
    const segs = r.segs.map((s) => {
      const a = [];
      let pl = 0, po = 0;
      for (let i = 0; i < s.n; i++) {
        const lon = s.xs[i] * 360 - 180;
        const lat = (Math.asin(Math.tanh(Math.PI * (1 - 2 * s.ys[i]))) * 180) / Math.PI;
        const la = Math.round(lat * R), lo = Math.round(lon * R);
        a.push(la - pl, lo - po); pl = la; po = lo;
      }
      const o = { a };
      if (s.tt) {
        o.t = []; let pt = 0;
        for (let i = 0; i < s.n; i++) { const t = Math.round(s.tt[i]); o.t.push(t - pt); pt = t; }
      }
      return o;
    });
    out.routes.push({ n: r.name, k: r.key, d: r.date, s: segs });
  }
  const bytes = new TextEncoder().encode(JSON.stringify(out));
  const data = typeof CompressionStream === 'function' ? await pipe(bytes, new CompressionStream('gzip')) : bytes;
  return new Blob([data], { type: 'application/octet-stream' });
}

export async function loadSession(file) {
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('Este navegador no puede abrir sesiones comprimidas');
    bytes = await pipe(bytes, new DecompressionStream('gzip'));
  }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || data.v !== 1 || !Array.isArray(data.routes)) throw new Error(`${file.name}: no es una sesión válida`);
  const routes = [];
  for (const o of data.routes) {
    const segs = o.s.map((sg) => {
      const pts = [];
      let la = 0, lo = 0, t = 0;
      for (let i = 0; i < sg.a.length; i += 2) {
        la += sg.a[i]; lo += sg.a[i + 1];
        t = sg.t ? t + sg.t[i / 2] : NaN;
        pts.push([la / R, lo / R, t]);
      }
      return pts;
    });
    const r = buildRoute(o.n, o.k, segs, o.d || '');
    if (r) routes.push(r);
  }
  return routes;
}
