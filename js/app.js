import { parseGPX } from './gpx.js';
import { densify, segmentLength } from './geo.js';
import { BASEMAPS } from './basemaps.js';

const MAX_POINTS = 400000; // límite de seguridad para el rendimiento
const $ = (id) => document.getElementById(id);

// Estado: todo vive en memoria del navegador.
const state = { files: [] /* {id, name, segments, km} */, nextId: 1 };

const map = L.map('map', { preferCanvas: true }).setView([40.4, -3.7], 6);
let baseLayer = null;
let heatLayer = null;
const trackLayer = L.layerGroup().addTo(map);

// ---- Mapa base ----
const select = $('basemap');
Object.keys(BASEMAPS).forEach((k) => select.add(new Option(k, k)));
function setBasemap(name) {
  if (baseLayer) map.removeLayer(baseLayer);
  const { url, ...opts } = BASEMAPS[name];
  baseLayer = L.tileLayer(url, opts).addTo(map);
  baseLayer.bringToBack();
}
select.addEventListener('change', () => setBasemap(select.value));
select.value = matchMedia('(prefers-color-scheme: dark)').matches ? 'Oscuro (CARTO)' : 'OpenStreetMap';
setBasemap(select.value);

// ---- Ajustes ----
let timer;
const debounce = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
const fmt = { opacity: (v) => `${v}%`, step: (v) => `${v} m` };
['radius', 'blur', 'max', 'opacity', 'step'].forEach((id) => {
  const el = $(id);
  const out = $(`o-${id}`);
  const show = () => (out.textContent = (fmt[id] || ((v) => v))(el.value));
  show();
  el.addEventListener('input', () => {
    show();
    if (id === 'step') debounce(render, 150);
    else applyHeatOptions();
  });
});
$('show-tracks').addEventListener('change', render);

// ---- Subida de archivos (local) ----
const drop = $('drop');
$('file-input').addEventListener('change', (e) => addFiles(e.target.files));
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

async function addFiles(fileList) {
  const errors = [];
  for (const f of Array.from(fileList)) {
    if (!f.name.toLowerCase().endsWith('.gpx')) { errors.push(`${f.name}: no es .gpx`); continue; }
    try {
      const { segments } = parseGPX(await f.text(), f.name);
      if (!segments.length) { errors.push(`${f.name}: sin puntos de track`); continue; }
      const km = segments.reduce((s, seg) => s + segmentLength(seg), 0) / 1000;
      state.files.push({ id: state.nextId++, name: f.name, segments, km });
    } catch (err) { errors.push(err.message); }
  }
  $('file-input').value = '';
  render();
  if (errors.length) alert(errors.join('\n'));
}

// ---- Render ----
function renderList() {
  const ul = $('file-list');
  ul.replaceChildren();
  for (const f of state.files) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${f.name} · ${f.km.toFixed(1)} km`;
    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.title = 'Quitar';
    btn.onclick = () => { state.files = state.files.filter((x) => x.id !== f.id); render(); };
    li.append(name, btn);
    ul.append(li);
  }
}

const heatOptions = () => ({
  radius: +$('radius').value,
  blur: +$('blur').value,
  max: +$('max').value / 10,
  minOpacity: 0.25,
});

function applyHeatOptions() {
  if (!heatLayer) return;
  heatLayer.setOptions(heatOptions());
  if (heatLayer._canvas) heatLayer._canvas.style.opacity = $('opacity').value / 100;
}

function render() {
  renderList();
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  trackLayer.clearLayers();

  const step = +$('step').value;
  let points = [];
  let totalKm = 0;
  for (const f of state.files) {
    totalKm += f.km;
    for (const seg of f.segments) for (const p of densify(seg, step)) points.push(p);
  }

  let note = '';
  if (points.length > MAX_POINTS) {
    const k = Math.ceil(points.length / MAX_POINTS);
    points = points.filter((_, i) => i % k === 0);
    note = ` (reducido 1/${k} por rendimiento)`;
  }

  $('stats').textContent = state.files.length
    ? `${state.files.length} archivo(s) · ${totalKm.toFixed(1)} km · ${points.length.toLocaleString()} puntos${note}`
    : 'Aún no has cargado ningún archivo.';
  if (!points.length) return;

  heatLayer = L.heatLayer(points, heatOptions()).addTo(map);
  applyHeatOptions();

  if ($('show-tracks').checked) {
    for (const f of state.files)
      for (const seg of f.segments)
        L.polyline(seg, { weight: 1, opacity: 0.5, color: '#fff' }).addTo(trackLayer);
  }
  if (!render.fitted) { fit(); render.fitted = true; }
}

function fit() {
  const b = L.latLngBounds([]);
  for (const f of state.files) for (const seg of f.segments) for (const p of seg) b.extend(p);
  if (b.isValid()) map.fitBounds(b, { padding: [30, 30] });
}

$('fit').addEventListener('click', fit);
$('clear').addEventListener('click', () => { state.files = []; render.fitted = false; render(); });

render();
