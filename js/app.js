import { parseTrackFile, extOf, TRACK_EXTS, SESSION_EXT } from './formats.js';
import { buildRoute } from './routes.js';
import { HeatLayer } from './heat.js';
import { TileLayer, STYLES } from './tiles.js';
import { percentile } from './geo.js';
import { PALETTES, colorAt, speedColor } from './colormap.js';
import { renderStats } from './stats.js';
import { saveSession, loadSession } from './session.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const isMobile = () => window.matchMedia('(max-width:760px)').matches;

const area = $('map-area');
let W = 1, H = 1, dpr = 1, cx = 0.5, cy = 0.5, zoom = 2;
let dirty = true, tdirty = true, useMap = true, sel = 'all', intTouched = false;
let mode = 'density', palette = 'lima', domain = [0, 40];
let routes = [], selected = null;

const heat = new HeatLayer($('heat'));
const tiles = new TileLayer($('tiles'), () => { tdirty = true; });

// ---------- helpers ----------
const view = () => ({ W, H, dpr, cx, cy, zoom });
const scale = () => 256 * Math.pow(2, zoom);
const cropD = () => ($('crop').checked ? +$('cropd').value : 0);
const clampY = () => { cy = Math.max(0, Math.min(1, cy)); };

// kind: '' | 'warn' | 'err'. El texto de la primera línea hace de etiqueta (ERROR, AVISO).
function say(text, kind = '') {
  const m = $('msg');
  m.className = kind;
  m.textContent = text || '';
}
function progress(i, n) {
  const p = $('prog');
  if (!n) { p.hidden = true; return; }
  p.hidden = false; p.max = n; p.value = i;
}

function visible() {
  const from = $('dfrom').value, to = $('dto').value;
  return routes.filter((r) =>
    (sel === 'all' || r.year === +sel) &&
    (!from || (r.date && r.date >= from)) &&
    (!to || (r.date && r.date <= to)));
}

let noSpeed = false;
function updateDomain() {
  if (mode !== 'speed') { noSpeed = false; return; }
  const vals = [];
  for (const r of visible()) for (const s of r.segs) {
    if (!s.spd) continue;
    const step = Math.max(1, Math.floor(s.n / 60));
    for (let i = 0; i < s.n; i += step) if (Number.isFinite(s.spd[i])) vals.push(s.spd[i]);
  }
  noSpeed = !vals.length;
  if (vals.length) {
    const lo = percentile(vals, 0.05);
    domain = [lo, Math.max(percentile(vals, 0.95), lo + 5)];
  } else domain = [0, 1];
  if (routes.length && noSpeed) say('AVISO\nNinguna ruta visible tiene marcas de tiempo; no se puede colorear por velocidad.', 'warn');
  else if ($('msg').className === 'warn') say('');
}

function updateLegend() {
  const stops = PALETTES[palette].stops, speed = mode === 'speed';
  $('legend').hidden = !routes.length;
  if (!routes.length) return;
  const ts = [0, 0.25, 0.5, 0.75, 1];
  const cols = ts.map((t) => `rgb(${(speed ? speedColor(stops, t) : colorAt(stops, 0.12 + 0.88 * t)).join(',')}) ${t * 100}%`);
  $('lg-bar').style.background = `linear-gradient(90deg, ${cols.join(',')})`;
  $('lg-title').textContent = speed ? 'Velocidad' : 'Pasadas por la zona';
  $('lg-lo').textContent = speed ? (noSpeed ? 'sin datos' : `${Math.round(domain[0])} km/h`) : 'Menos';
  $('lg-hi').textContent = speed ? (noSpeed ? '' : `${Math.round(domain[1])} km/h`) : 'Más';
}

function readout() {
  const D = cropD();
  let n = 0, km = 0, sec = 0;
  for (const r of visible()) {
    if (D && r.total <= 2 * D) continue;
    n++; km += D ? (r.total - 2 * D) / 1000 : r.km;
    if (r.hasTime) sec += r.sec;
  }
  $('r-routes').textContent = nf.format(n);
  $('r-km').textContent = nf.format(km);
  $('r-time-box').hidden = !(sec > 0) || !!D;
  $('r-time').textContent = nf1.format(sec / 3600);
}

function refreshStatsPanel() {
  if ($('sp').hidden) return;
  renderStats($('sp-body'), visible(), {
    group: $('sp-group').value,
    onRoute: (r) => { setSelected(r); fitBox(r.x0, r.x1, r.y0, r.y1, 0.15); if (isMobile()) setStats(false); },
    onZone: (x, y) => { cx = x; cy = y; zoom = Math.max(zoom, 14); dirty = tdirty = true; if (isMobile()) setStats(false); },
  });
}
function setStats(open) {
  $('sp').hidden = !open;
  $('stats-btn').setAttribute('aria-pressed', String(open));
  if (open) refreshStatsPanel();
}

// Se llama cuando cambian filtros, modo, paleta o datos.
function refresh() {
  updateDomain(); updateLegend(); readout(); refreshStatsPanel(); dirty = true;
}

function resize() {
  W = Math.max(1, area.clientWidth); H = Math.max(1, area.clientHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  while (W * H * dpr * dpr > 4.5e6 && dpr > 0.5) dpr -= 0.25;
  const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
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

const heatOpts = () => ({ mode, intensity: +$('int').value, width: +$('wid').value, crop: cropD(), domain, highlight: selected });

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

// ---------- selección de una ruta ----------
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
function setSelected(r) {
  selected = r;
  const box = $('sel');
  box.hidden = !r;
  if (r) {
    $('sel-name').textContent = r.name;
    const kv = $('sel-kv');
    kv.replaceChildren();
    const add = (k, v) => { const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = k; b.textContent = v; kv.append(a, b); };
    add('Distancia', `${nf1.format(r.km)} km`);
    if (r.date) add('Fecha', r.date);
    if (r.hasTime && r.sec > 0) { add('Tiempo', fmtTime(r.sec)); add('Media', `${nf1.format(r.moveKm / (r.sec / 3600))} km/h`); }
  }
  $$('#file-list .fl').forEach((b) => b.setAttribute('aria-pressed', String(b._route === r && !!r)));
  dirty = true;
}
$('sel-clear').onclick = () => setSelected(null);

// ---------- interacción con el mapa (arrastrar, zoom, pellizco, teclado) ----------
function zoomAt(px, py, nz) {
  nz = Math.max(2, Math.min(20, nz));
  const s0 = scale(), wx = cx + (px - W / 2) / s0, wy = cy + (py - H / 2) / s0;
  zoom = nz;
  const s1 = scale();
  cx = wx - (px - W / 2) / s1; cy = wy - (py - H / 2) / s1; clampY();
  dirty = tdirty = true;
}
const hc = $('heat');
const rel = (e) => { const r = hc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const ptrs = new Map();
let pd = 0, pcx = 0, pcy = 0;
const pinch = () => {
  const a = [...ptrs.values()];
  return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
};
hc.addEventListener('pointerdown', (e) => {
  hc.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, rel(e));
  if (ptrs.size === 2) { const p = pinch(); pd = p.d; pcx = p.x; pcy = p.y; }
});
hc.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const n0 = rel(e), dx = n0.x - p.x, dy = n0.y - p.y;
  p.x = n0.x; p.y = n0.y;
  if (ptrs.size === 1) {
    const sc = scale();
    cx -= dx / sc; cy -= dy / sc; clampY();
    dirty = tdirty = true;
  } else if (ptrs.size === 2) {
    const n = pinch();
    if (pd > 0) {
      zoomAt(n.x, n.y, zoom + Math.log2(n.d / pd));
      const sc = scale();
      cx -= (n.x - pcx) / sc; cy -= (n.y - pcy) / sc; clampY();
    }
    pd = n.d; pcx = n.x; pcy = n.y;
  }
});
const up = (e) => { ptrs.delete(e.pointerId); pd = 0; };
hc.addEventListener('pointerup', up);
hc.addEventListener('pointercancel', up);
hc.addEventListener('wheel', (e) => { e.preventDefault(); const p = rel(e); zoomAt(p.x, p.y, zoom - e.deltaY * 0.0015); }, { passive: false });
hc.addEventListener('dblclick', (e) => { const p = rel(e); zoomAt(p.x, p.y, zoom + 1); });
hc.addEventListener('keydown', (e) => {
  const step = 80 / scale();
  let used = true;
  switch (e.key) {
    case 'ArrowLeft': cx -= step; break;
    case 'ArrowRight': cx += step; break;
    case 'ArrowUp': cy -= step; break;
    case 'ArrowDown': cy += step; break;
    case '+': case '=': zoomAt(W / 2, H / 2, zoom + 0.5); break;
    case '-': case '_': zoomAt(W / 2, H / 2, zoom - 0.5); break;
    case '0': case 'Home': fit(); break;
    default: used = false;
  }
  if (used) { e.preventDefault(); clampY(); dirty = tdirty = true; }
});
$('zin').onclick = () => zoomAt(W / 2, H / 2, zoom + 1);
$('zout').onclick = () => zoomAt(W / 2, H / 2, zoom - 1);
$('reset').onclick = fit;

// ---------- controles ----------
$('style').innerHTML = STYLES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
$('style').value = STYLES[0].id;
$('style').onchange = (e) => {
  tiles.setStyle(e.target.value);
  $('customurl').hidden = e.target.value !== 'custom';
  tdirty = true;
};
$('customurl').oninput = (e) => { STYLES.find((s) => s.id === 'custom').url = e.target.value.trim(); tdirty = true; };
$('usemap').onchange = (e) => { useMap = e.target.checked; tdirty = true; $('pngmap').disabled = !useMap; };

$('palette').innerHTML = Object.entries(PALETTES).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');
$('palette').value = palette;
$('palette').onchange = (e) => { palette = e.target.value; heat.setPalette(palette); updateLegend(); dirty = true; };

const outs = { int: (v) => v, wid: (v) => `${v} px`, cropd: (v) => `${v} m` };
for (const id of Object.keys(outs)) {
  const show = () => { $(`o-${id}`).textContent = outs[id]($(id).value); };
  show();
  $(id).addEventListener('input', () => { show(); if (id === 'int') intTouched = true; if (id === 'cropd') { cropText(); readout(); refreshStatsPanel(); } dirty = true; });
}
function cropText() {
  $('cropv').textContent = $('crop').checked
    ? `Ocultando los primeros y últimos ${$('cropd').value} m de cada ruta.`
    : 'Oculta el inicio y el final de cada ruta (casa, destinos).';
}
$('crop').onchange = () => { $('cropd').disabled = !$('crop').checked; cropText(); readout(); refreshStatsPanel(); dirty = true; };

$('year').onchange = (e) => { sel = e.target.value; refresh(); };
$('dfrom').onchange = $('dto').onchange = refresh;
$('dclear').onclick = () => { $('dfrom').value = ''; $('dto').value = ''; refresh(); };
$('mode').onchange = (e) => { mode = e.target.value; say(''); refresh(); };
$('sp-group').onchange = refreshStatsPanel;
$('sp-close').onclick = () => setStats(false);
$('stats-btn').onclick = () => setStats($('sp').hidden);
$('clear').onclick = () => { routes = []; sel = 'all'; setSelected(null); afterChange(); };

// Panel: en escritorio se oculta entero; en móvil es una hoja inferior plegable.
$('toggle').onclick = () => {
  const off = document.body.classList.toggle('panel-off');
  $('toggle').setAttribute('aria-expanded', String(!off));
};
$('sheet-toggle').onclick = () => {
  const c = $('panel').classList.toggle('collapsed');
  $('sheet-toggle').setAttribute('aria-expanded', String(!c));
};
function collapseSheet() { if (isMobile()) { $('panel').classList.add('collapsed'); $('sheet-toggle').setAttribute('aria-expanded', 'false'); } }

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('sp').hidden) setStats(false); else if (selected) setSelected(null);
});

// ---------- carga de archivos (todo local) ----------
$$('.js-add').forEach((b) => { b.onclick = () => $('f-files').click(); });
$('adddir').onclick = () => $('f-dir').click();
$('load-session').onclick = () => $('f-session').click();
for (const id of ['f-files', 'f-dir', 'f-session']) {
  $(id).onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
}

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
  const tracks = list.filter((f) => TRACK_EXTS.includes(extOf(f.name)));
  const sessions = list.filter((f) => extOf(f.name) === SESSION_EXT);
  if (!tracks.length && !sessions.length) {
    say(`ERROR\nNo se encontró ningún archivo compatible (${[...TRACK_EXTS, SESSION_EXT].join(', ')}).`, 'err');
    return;
  }
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
  for (const f of tracks) {
    i++;
    const key = `${f.webkitRelativePath || f.name}|${f.size}`;
    if (known.has(key)) continue;
    say(`Procesando ${i} de ${tracks.length} · ${f.name}`);
    progress(i, tracks.length);
    try {
      const { segs, date } = await parseTrackFile(f);
      const route = buildRoute(f.name, key, segs, date);
      if (route) { routes.push(route); known.add(key); }
      else errors.push(`${f.name}: sin tramos de ruta utilizables`);
    } catch (err) { errors.push(err.message); }
    if (i % 5 === 0) await new Promise((r) => setTimeout(r));
  }
  progress(0, 0);
  if (errors.length) say('ERROR\n' + errors.slice(0, 6).join('\n') + (errors.length > 6 ? `\n…y ${errors.length - 6} más` : ''), 'err');
  else say('');
  afterChange();
  if (wasEmpty) { fit(); collapseSheet(); }
}

function afterChange() {
  if (selected && !routes.includes(selected)) setSelected(null);
  $('nfiles').textContent = routes.length;
  const ul = $('file-list');
  ul.replaceChildren();
  routes.slice(0, 300).forEach((r) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fl'; b._route = r;
    b.setAttribute('aria-pressed', String(r === selected));
    b.title = r.date ? `${r.name} · ${r.date}` : r.name;
    const n = document.createElement('span'); n.className = 'fn'; n.textContent = r.name;
    const k = document.createElement('span'); k.className = 'fk'; k.textContent = `${r.km.toFixed(1)} km`;
    b.append(n, k);
    b.onclick = () => {
      if (selected === r) { setSelected(null); return; }
      setSelected(r); fitBox(r.x0, r.x1, r.y0, r.y1, 0.15); collapseSheet();
    };
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'x'; rm.textContent = '×'; rm.setAttribute('aria-label', `Quitar ${r.name}`);
    rm.onclick = () => { routes = routes.filter((x) => x !== r); afterChange(); };
    li.append(b, rm); ul.append(li);
  });
  const years = [...new Set(routes.map((r) => r.year))].sort((a, b) => b - a);
  $('year').innerHTML = '<option value="all">Todos los años</option>' +
    years.map((y) => `<option value="${y}">${y || 'Fecha desconocida'}</option>`).join('');
  if (sel !== 'all' && !years.includes(+sel)) sel = 'all';
  $('year').value = sel;
  const dates = routes.map((r) => r.date).filter(Boolean).sort();
  $('dfrom').min = $('dto').min = dates[0] || '';
  $('dfrom').max = $('dto').max = dates[dates.length - 1] || '';
  if (!intTouched) { $('int').value = Math.round(Math.min(50, Math.max(8, 60 - 8 * Math.log2(Math.max(1, routes.length))))); $('o-int').textContent = $('int').value; }
  refresh();
}

// ---------- sesión ----------
$('save-session').onclick = async () => {
  if (!routes.length) { say('AVISO\nNo hay rutas que guardar.', 'warn'); return; }
  say('Preparando sesión…');
  try {
    const blob = await saveSession(routes);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'gpx-heatmap.gpxheat'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`Sesión guardada (${(blob.size / 1048576).toFixed(1)} MB).`);
  } catch (e) { say('ERROR\nNo se pudo guardar la sesión: ' + e.message, 'err'); }
};

// ---------- exportar PNG ----------
function composite(withMap) {
  const o = document.createElement('canvas');
  o.width = hc.width; o.height = hc.height;
  const c = o.getContext('2d');
  c.fillStyle = '#101211'; c.fillRect(0, 0, o.width, o.height);
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
    c.fillStyle = 'rgba(24,28,26,.92)'; c.fillRect(o.width - w, o.height - h, w, h);
    c.fillStyle = '#A0AAA2'; c.fillText(st.attr, o.width - w + 5 * dpr, o.height - 6 * dpr);
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
async function exportPng() {
  heat.render(visible(), view(), heatOpts());
  if (useMap) tiles.draw(view(), true);
  const withMap = useMap && $('pngmap').checked && !!tiles.style.url;
  try { await download(composite(withMap)); }
  catch (e) {
    say('AVISO\nEste proveedor de mapa no permite exportarlo en el PNG; se ha guardado sin mapa.', 'warn');
    await download(composite(false));
  }
}
$$('.js-png').forEach((b) => { b.onclick = exportPng; });

// ---------- arranque ----------
new ResizeObserver(resize).observe(area);
window.addEventListener('resize', resize);
if (isMobile()) { $('panel').classList.add('collapsed'); }
resize(); afterChange(); loop();
