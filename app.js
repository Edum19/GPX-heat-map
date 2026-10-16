import { parseGPX } from './gpx.js';
import { buildRoute } from './routes.js';
import { HeatLayer } from './heat.js';
import { TileLayer, STYLES } from './tiles.js';
import { percentile } from './geo.js';
import { speedColor } from './colormap.js';
import { renderStats } from './stats.js';
import { saveSession, loadSession } from './session.js';

const $ = (id) => document.getElementById(id);

let W = 0, H = 0, dpr = 1, cx = 0.5, cy = 0.5, zoom = 2;
let dirty = true, tdirty = true, useMap = true, sel = 'all', intTouched = false;
let mode = 'density', domain = [0, 40];
let routes = [];

const heat = new HeatLayer($('heat'));
const tiles = new TileLayer($('tiles'), () => { tdirty = true; });

// ---------- helpers ----------
const view = () => ({ W, H, dpr, cx, cy, zoom });
const scale = () => 256 * Math.pow(2, zoom);
const cropD = () => ($('crop').checked ? +$('cropd').value : 0);
const say = (t) => { $('msg').textContent = t || ''; };

function visible() {
  const from = $('dfrom').value, to = $('dto').value;
  return routes.filter((r) =>
    (sel === 'all' || r.year === +sel) &&
    (!from || (r.date && r.date >= from)) &&
    (!to || (r.date && r.date <= to)));
}

function updateDomain() {
  if (mode !== 'speed') return;
  const vals = [];
  for (const r of visible()) for (const s of r.segs) {
    if (!s.spd) continue;
    const step = Math.max(1, Math.floor(s.n / 60));
    for (let i = 0; i < s.n; i += step) if (Number.isFinite(s.spd[i])) vals.push(s.spd[i]);
  }
  if (vals.length) {
    const lo = percentile(vals, 0.05);
    domain = [lo, Math.max(percentile(vals, 0.95), lo + 5)];
  } else domain = [0, 1];
  say(vals.length ? '' : 'Ninguna ruta visible tiene marcas de tiempo; no se puede colorear por velocidad.');
}

function updateLegend() {
  $('legend').hidden = mode !== 'speed';
  if (mode !== 'speed') return;
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${speedColor(t).join(',')}) ${t * 100}%`);
  $('lg-bar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  $('lg-lo').textContent = `${Math.round(domain[0])} km/h`;
  $('lg-hi').textContent = `${Math.round(domain[1])} km/h`;
}

function stats() {
  const D = cropD();
  let n = 0, km = 0;
  for (const r of visible()) {
    if (D && r.total <= 2 * D) continue;
    n++; km += D ? (r.total - 2 * D) / 1000 : r.km;
  }
  $('stats').textContent = routes.length
    ? `${n} rutas · ${Math.round(km).toLocaleString('es-ES')} km`
    : 'Sin rutas cargadas';
}

function refreshStatsPanel() {
  if ($('sp').hidden) return;
  renderStats($('sp-body'), visible(), {
    group: $('sp-group').value,
    onRoute: (r) => fitBox(r.x0, r.x1, r.y0, r.y1, 0.15),
    onZone: (x, y) => { cx = x; cy = y; zoom = Math.max(zoom, 14); dirty = tdirty = true; },
  });
}

// Se llama cuando cambian filtros, modo o datos.
function refresh() {
  updateDomain(); updateLegend(); stats(); refreshStatsPanel(); dirty = true;
}

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  while (W * H * dpr * dpr > 4.5e6 && dpr > 0.5) dpr -= 0.25;
  const w = Math.round(W * dpr), h = Math.round(H * dpr);
  heat.resize(w, h); tiles.resize(w, h);
  dirty = tdirty = true;
}

function fitBox(x0, x1, y0, y1, pad = 0.06) {
  const minSpan = 0.005 / 360;
  x1 = Math.max(x1, x0 + minSpan); y1 = Math.max(y1, y0 + minSpan);
  const px = (x1 - x0) * pad, py = (y1 - y0) * pad;
  x0 -= px; x1 += px; y0 -= py; y1 += py;
  zoom = Math.max(1, Math.min(18, Math.log2(Math.min(W / (256 * (x1 - x0)), H / (256 * (y1 - y0))))));
  cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
  dirty = tdirty = true;
}

function fit() {
  if (!routes.length) return;
  const xs = [], ys = [];
  for (const r of routes) for (const s of r.segs) {
    const step = Math.max(1, Math.floor(s.n / 200));
    for (let i = 0; i < s.n; i += step) { xs.push(s.xs[i]); ys.push(s.ys[i]); }
  }
  fitBox(percentile(xs, 0.01), percentile(xs, 0.99), percentile(ys, 0.01), percentile(ys, 0.99));
}

function heatOpts() {
  return { mode, intensity: +$('int').value, width: +$('wid').value, crop: cropD(), domain };
}

function loop() {
  if (dirty) { dirty = false; heat.render(visible(), view(), heatOpts()); }
  if (tdirty) {
    tdirty = false;
    tiles.draw(view(), useMap);
    const show = useMap && !!tiles.style.url;
    $('attr').style.display = show ? 'block' : 'none';
    $('attr').textContent = tiles.style.attr;
  }
  requestAnimationFrame(loop);
}

// ---------- interacción (arrastrar, zoom, pellizco) ----------
function zoomAt(px, py, nz) {
  nz = Math.max(2, Math.min(20, nz));
  const s0 = scale(), wx = cx + (px - W / 2) / s0, wy = cy + (py - H / 2) / s0;
  zoom = nz;
  const s1 = scale();
  cx = wx - (px - W / 2) / s1; cy = wy - (py - H / 2) / s1;
  cy = Math.max(0, Math.min(1, cy));
  dirty = tdirty = true;
}
const ptrs = new Map();
let pd = 0, pcx = 0, pcy = 0;
const pinch = () => {
  const a = [...ptrs.values()];
  return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
};
const hc = $('heat');
hc.addEventListener('pointerdown', (e) => {
  hc.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const p = pinch(); pd = p.d; pcx = p.x; pcy = p.y; }
});
hc.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    const sc = scale();
    cx -= dx / sc; cy -= dy / sc; cy = Math.max(0, Math.min(1, cy));
    dirty = tdirty = true;
  } else if (ptrs.size === 2) {
    const n = pinch();
    if (pd > 0) {
      zoomAt(n.x, n.y, zoom + Math.log2(n.d / pd));
      const sc = scale();
      cx -= (n.x - pcx) / sc; cy -= (n.y - pcy) / sc; cy = Math.max(0, Math.min(1, cy));
    }
    pd = n.d; pcx = n.x; pcy = n.y;
  }
});
const up = (e) => { ptrs.delete(e.pointerId); pd = 0; };
hc.addEventListener('pointerup', up);
hc.addEventListener('pointercancel', up);
hc.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, zoom - e.deltaY * 0.0015); }, { passive: false });
hc.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, zoom + 1));

// ---------- controles ----------
$('style').innerHTML = STYLES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
$('style').value = STYLES[0].id;
$('style').onchange = (e) => {
  tiles.setStyle(e.target.value);
  $('customurl').hidden = e.target.value !== 'custom';
  tdirty = true;
};
$('customurl').oninput = (e) => {
  STYLES.find((s) => s.id === 'custom').url = e.target.value.trim();
  tdirty = true;
};
$('map').onchange = (e) => { useMap = e.target.checked; tdirty = true; $('pngmap').disabled = !useMap; };
$('int').oninput = () => { intTouched = true; dirty = true; };
$('wid').oninput = () => { dirty = true; };
$('year').onchange = (e) => { sel = e.target.value; refresh(); };
$('dfrom').onchange = $('dto').onchange = refresh;
$('dclear').onclick = () => { $('dfrom').value = ''; $('dto').value = ''; refresh(); };
$('mode').onchange = (e) => { mode = e.target.value; say(''); refresh(); };
$('crop').onchange = $('cropd').oninput = () => {
  const on = $('crop').checked;
  $('cropd').disabled = !on;
  $('cropv').textContent = on
    ? `Ocultando los primeros/últimos ${$('cropd').value} m de cada ruta.`
    : `Oculta los primeros/últimos ${$('cropd').value} m de cada ruta (casa, destinos).`;
  stats(); dirty = true;
};
$('reset').onclick = fit;
$('toggle').onclick = () => { const b = $('body'); b.hidden = !b.hidden; };
$('clear').onclick = () => { routes = []; sel = 'all'; afterChange(); };
$('stats-btn').onclick = () => { $('sp').hidden = !$('sp').hidden; refreshStatsPanel(); };
$('sp-close').onclick = () => { $('sp').hidden = true; };
$('sp-group').onchange = refreshStatsPanel;

// ---------- carga de archivos (todo local) ----------
$('pick').onclick = $('add').onclick = () => $('f-files').click();
$('pickdir').onclick = $('adddir').onclick = () => $('f-dir').click();
$('load-session').onclick = () => $('f-session').click();
$('f-files').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
$('f-dir').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
$('f-session').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('drag'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drag'); } });
window.addEventListener('drop', async (e) => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('drag');
  addFiles(await filesFromDrop(e.dataTransfer));
});

async function filesFromDrop(dt) {
  const items = [...(dt.items || [])];
  if (items.length && items[0].webkitGetAsEntry) {
    const entries = items.map((i) => i.webkitGetAsEntry()).filter(Boolean); // síncrono, antes de cualquier await
    const out = [];
    for (const en of entries) await walk(en, out);
    return out;
  }
  return [...dt.files];
}
async function walk(entry, out) {
  if (entry.isFile) {
    out.push(await new Promise((res, rej) => entry.file(res, rej)));
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const e of batch) await walk(e, out);
    } while (batch.length);
  }
}

async function addFiles(list) {
  const gpx = list.filter((f) => f.name.toLowerCase().endsWith('.gpx'));
  const sessions = list.filter((f) => f.name.toLowerCase().endsWith('.gpxheat'));
  if (!gpx.length && !sessions.length) { say('No se encontró ningún archivo .gpx ni .gpxheat.'); return; }
  const wasEmpty = !routes.length;
  const known = new Set(routes.map((r) => r.key));
  const errors = [];

  for (const f of sessions) {
    say(`Abriendo sesión ${f.name}…`);
    try {
      for (const r of await loadSession(f)) if (!known.has(r.key)) { routes.push(r); known.add(r.key); }
    } catch (err) { errors.push(err.message || `${f.name}: sesión no válida`); }
  }

  let i = 0;
  for (const f of gpx) {
    i++;
    const key = `${f.webkitRelativePath || f.name}|${f.size}`;
    if (known.has(key)) continue;
    say(`Cargando ${i}/${gpx.length}…`);
    try {
      const { segs, date } = parseGPX(await f.text(), f.name);
      const route = buildRoute(f.name, key, segs, date);
      if (route) { routes.push(route); known.add(key); }
      else errors.push(`${f.name}: sin tracks utilizables`);
    } catch (err) { errors.push(err.message); }
    if (i % 5 === 0) await new Promise((r) => setTimeout(r));
  }
  say(errors.length ? errors.slice(0, 6).join('\n') + (errors.length > 6 ? `\n…y ${errors.length - 6} más` : '') : '');
  afterChange();
  if (wasEmpty) fit();
}

function afterChange() {
  $('empty').hidden = routes.length > 0;
  $('nfiles').textContent = routes.length;
  const ul = $('file-list');
  ul.replaceChildren();
  routes.slice(0, 300).forEach((r) => {
    const li = document.createElement('li');
    const s = document.createElement('span');
    s.textContent = `${r.name} · ${r.km.toFixed(1)} km`;
    const b = document.createElement('button');
    b.textContent = '×'; b.title = 'Quitar';
    b.onclick = () => { routes = routes.filter((x) => x !== r); afterChange(); };
    li.append(s, b); ul.append(li);
  });
  const years = [...new Set(routes.map((r) => r.year))].sort((a, b) => b - a);
  $('year').innerHTML = '<option value="all">Todos los años</option>' +
    years.map((y) => `<option value="${y}">${y || 'Fecha desconocida'}</option>`).join('');
  if (sel !== 'all' && !years.includes(+sel)) sel = 'all';
  $('year').value = sel;
  const dates = routes.map((r) => r.date).filter(Boolean).sort();
  $('dfrom').min = $('dto').min = dates[0] || '';
  $('dfrom').max = $('dto').max = dates[dates.length - 1] || '';
  if (!intTouched) $('int').value = Math.round(Math.min(50, Math.max(8, 60 - 8 * Math.log2(Math.max(1, routes.length)))));
  refresh();
}

// ---------- sesión ----------
$('save-session').onclick = async () => {
  if (!routes.length) { say('No hay rutas que guardar.'); return; }
  say('Preparando sesión…');
  try {
    const blob = await saveSession(routes);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'gpx-heatmap.gpxheat'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`Sesión guardada (${(blob.size / 1048576).toFixed(1)} MB).`);
  } catch (e) { say('No se pudo guardar la sesión: ' + e.message); }
};

// ---------- exportar PNG ----------
function composite(withMap) {
  const o = document.createElement('canvas');
  o.width = hc.width; o.height = hc.height;
  const c = o.getContext('2d');
  c.fillStyle = '#0b0d12'; c.fillRect(0, 0, o.width, o.height);
  const st = tiles.style;
  if (withMap) {
    if ('filter' in c) c.filter = st.filter || 'none';
    c.drawImage($('tiles'), 0, 0);
    if ('filter' in c) c.filter = 'none';
  }
  c.drawImage(hc, 0, 0);
  if (withMap && st.attr) {
    const fs = Math.round(11 * dpr);
    c.font = `${fs}px system-ui,Segoe UI,sans-serif`;
    const w = c.measureText(st.attr).width + 10 * dpr, h = fs + 8 * dpr;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(o.width - w - 6 * dpr, o.height - h - 4 * dpr, w, h);
    c.fillStyle = '#e6e6e6'; c.fillText(st.attr, o.width - w - 1 * dpr, o.height - h - 4 * dpr + fs + 2 * dpr);
  }
  return o;
}
function download(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'gpx-heatmap.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        resolve();
      });
    } catch (e) { reject(e); }
  });
}
$('png').onclick = async () => {
  heat.render(visible(), view(), heatOpts());
  if (useMap) tiles.draw(view(), true);
  const withMap = useMap && $('pngmap').checked && !!tiles.style.url;
  try { await download(composite(withMap)); }
  catch (e) {
    say('Este proveedor de mapa no permite exportarlo en el PNG; se ha guardado sin mapa.');
    await download(composite(false));
  }
};

window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('sp').hidden = true; });
window.addEventListener('resize', resize);
// En móvil el menú empieza plegado para dejar ver el mapa; se abre con ☰.
if (window.matchMedia('(max-width:700px)').matches) $('body').hidden = true;
resize(); afterChange(); loop();
