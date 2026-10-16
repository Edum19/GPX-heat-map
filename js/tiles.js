// Estilos de mapa de fondo. Para añadir uno nuevo, añade una entrada aquí.
// No uses claves/API privadas: este código es público en el navegador.
const INV = 'invert(1) hue-rotate(180deg) brightness(.82) contrast(.92)';
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const STYLES = [
  { id: 'esri-dark', label: 'Oscuro (Esri gris)', maxz: 16, filter: '',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Sources: Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community' },
  { id: 'osm-dark', label: 'Oscuro (OpenStreetMap invertido)', maxz: 19, filter: INV, url: OSM,
    attr: '© OpenStreetMap contributors' },
  { id: 'osm', label: 'Estándar (OpenStreetMap)', maxz: 19, filter: '', url: OSM,
    attr: '© OpenStreetMap contributors' },
  { id: 'custom', label: 'Personalizado (URL propia)', maxz: 19, filter: '', url: '',
    attr: 'Mapa personalizado' },
];

export class TileLayer {
  constructor(canvas, onUpdate) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onUpdate = onUpdate;
    this.style = STYLES[0];
    this.cache = new Map();
  }

  setStyle(id) { this.style = STYLES.find((s) => s.id === id) || STYLES[0]; }
  resize(w, h) { this.canvas.width = w; this.canvas.height = h; }

  tile(z, x, y) {
    const k = `${this.style.id}|${this.style.url}|${z}/${x}/${y}`;
    let im = this.cache.get(k);
    if (!im) {
      const url = this.style.url.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a');
      im = new Image();
      im.crossOrigin = 'anonymous'; // necesario para poder exportar el PNG con mapa
      im.onload = () => this.onUpdate();
      im.onerror = () => {
        if (im.crossOrigin) { // el servidor no admite CORS: se muestra igual, pero sin exportar
          const im2 = new Image();
          im2.onload = () => this.onUpdate();
          im2.src = url;
          this.cache.set(k, im2);
        }
      };
      im.src = url;
      this.cache.set(k, im);
      if (this.cache.size > 400) this.cache.delete(this.cache.keys().next().value);
    }
    return im;
  }

  draw(v, enabled) {
    const { W, H, dpr, cx, cy, zoom } = v, c = this.ctx, st = this.style;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.style.display = enabled ? 'block' : 'none';
    this.canvas.style.filter = st.filter || 'none';
    if (!enabled || !st.url) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = 256 * Math.pow(2, zoom);
    const z = Math.max(0, Math.min(st.maxz, Math.round(zoom)));
    const n = Math.pow(2, z), ts = 256 * Math.pow(2, zoom - z);
    const ox = W / 2 - cx * sc, oy = H / 2 - cy * sc;
    const x0 = Math.floor((cx - W / 2 / sc) * n), x1 = Math.floor((cx + W / 2 / sc) * n);
    const y0 = Math.max(0, Math.floor((cy - H / 2 / sc) * n)), y1 = Math.min(n - 1, Math.floor((cy + H / 2 / sc) * n));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 80) return;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const im = this.tile(z, ((tx % n) + n) % n, ty);
        if (im.complete && im.naturalWidth) c.drawImage(im, (tx / n) * sc + ox, (ty / n) * sc + oy, ts + 0.5, ts + 0.5);
      }
    }
  }
}
