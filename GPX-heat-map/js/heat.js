import { buildLUT, speedColor } from './colormap.js';
const LUT = buildLUT();
const NB = 16; // niveles de color en modo velocidad
const BIN_COLORS = Array.from({ length: NB }, (_, b) => `rgb(${speedColor((b + 0.5) / NB).join(',')})`);
BIN_COLORS.push('#8a8f9c'); // sin datos de tiempo

export class HeatLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.acc = document.createElement('canvas');
    this.actx = this.acc.getContext('2d', { willReadFrequently: true });
  }

  resize(w, h) {
    this.canvas.width = this.acc.width = w;
    this.canvas.height = this.acc.height = h;
  }

  // v = {W,H,dpr,cx,cy,zoom}; o = {mode:'density'|'speed', intensity, width, crop, domain:[lo,hi]}
  render(routes, v, o) {
    if (o.mode === 'speed') this.renderSpeed(routes, v, o);
    else this.renderDensity(routes, v, o);
  }

  renderDensity(routes, v, o) {
    const { W, H, dpr, cx, cy, zoom } = v;
    const sc = 256 * Math.pow(2, zoom), ox = W / 2 - cx * sc, oy = H / 2 - cy * sc;
    const alpha = 0.02 + (o.intensity / 100) * 0.35, D = o.crop;
    const a = this.actx;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'source-over';
    a.fillStyle = '#000';
    a.fillRect(0, 0, this.acc.width, this.acc.height);
    a.setTransform(dpr, 0, 0, dpr, 0, 0);
    a.globalCompositeOperation = 'lighter';
    a.lineCap = 'round'; a.lineJoin = 'round'; a.lineWidth = o.width;
    a.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;

    for (const r of routes) {
      if (D && r.total <= 2 * D) continue;
      const lo = D, hi = r.total - D;
      for (const s of r.segs) {
        if (s.x1 * sc + ox < -20 || s.x0 * sc + ox > W + 20 || s.y1 * sc + oy < -20 || s.y0 * sc + oy > H + 20) continue;
        a.beginPath();
        let lx = 1e9, ly = 1e9, started = false;
        for (let i = 0; i < s.n; i++) {
          if (D) { const c = s.cum[i]; if (c < lo || c > hi) continue; }
          const x = s.xs[i] * sc + ox, y = s.ys[i] * sc + oy;
          if (i > 0 && i < s.n - 1 && Math.abs(x - lx) < 1.2 && Math.abs(y - ly) < 1.2) continue;
          if (!started) { a.moveTo(x, y); started = true; } else a.lineTo(x, y);
          lx = x; ly = y;
        }
        a.stroke();
      }
    }
    const img = a.getImageData(0, 0, this.acc.width, this.acc.height);
    const px = new Uint32Array(img.data.buffer);
    for (let i = 0; i < px.length; i++) px[i] = LUT[px[i] & 255];
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.putImageData(img, 0, 0);
  }

  // Cada tramo se pinta con el color de su velocidad (lento azul -> rápido rojo).
  // Las zonas muy recorridas se vuelven más opacas, así que la densidad también se nota.
  renderSpeed(routes, v, o) {
    const { W, H, dpr, cx, cy, zoom } = v;
    const sc = 256 * Math.pow(2, zoom), ox = W / 2 - cx * sc, oy = H / 2 - cy * sc;
    const D = o.crop, [dlo, dhi] = o.domain, span = Math.max(1e-6, dhi - dlo);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = o.width;
    c.globalAlpha = 0.08 + (o.intensity / 100) * 0.7;
    const bins = Array.from({ length: NB + 1 }, () => []);

    for (const r of routes) {
      if (D && r.total <= 2 * D) continue;
      const lo = D, hi = r.total - D;
      for (const s of r.segs) {
        if (s.x1 * sc + ox < -20 || s.x0 * sc + ox > W + 20 || s.y1 * sc + oy < -20 || s.y0 * sc + oy > H + 20) continue;
        let lx = 1e9, ly = 1e9, started = false;
        for (let i = 0; i < s.n; i++) {
          if (D) { const cm = s.cum[i]; if (cm < lo || cm > hi) continue; }
          const x = s.xs[i] * sc + ox, y = s.ys[i] * sc + oy;
          if (i > 0 && i < s.n - 1 && Math.abs(x - lx) < 1.2 && Math.abs(y - ly) < 1.2) continue;
          if (started) {
            const sp = s.spd ? s.spd[i] : NaN;
            const b = Number.isFinite(sp) ? Math.max(0, Math.min(NB - 1, Math.floor(((sp - dlo) / span) * NB))) : NB;
            bins[b].push(lx, ly, x, y);
          }
          started = true; lx = x; ly = y;
        }
        for (let b = 0; b <= NB; b++) {
          const p = bins[b];
          if (!p.length) continue;
          c.strokeStyle = BIN_COLORS[b];
          c.beginPath();
          for (let k = 0; k < p.length; k += 4) { c.moveTo(p[k], p[k + 1]); c.lineTo(p[k + 2], p[k + 3]); }
          c.stroke();
          p.length = 0;
        }
      }
    }
    c.globalAlpha = 1;
  }
}
