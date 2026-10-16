// Panel de estadísticas sobre las rutas visibles (con los filtros activos).
const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const CELL = 65536;      // rejilla de ~0,5 km
const MIN_SEP_CELLS = 6; // separación mínima entre zonas listadas (~3 km)

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function groups(rs, mode) {
  const g = new Map();
  const add = (k, km) => g.set(k, (g.get(k) || 0) + km);
  for (const r of rs) {
    if (!r.date) { add('Sin fecha', r.km); continue; }
    if (mode === 'year') add(r.date.slice(0, 4), r.km);
    else if (mode === 'month') add(r.date.slice(0, 7), r.km);
    else add(DOW[(new Date(r.date + 'T00:00:00Z').getUTCDay() + 6) % 7], r.km);
  }
  let rows = [...g.entries()];
  if (mode === 'dow') rows.sort((a, b) => DOW.indexOf(a[0]) - DOW.indexOf(b[0]));
  else rows.sort((a, b) => (a[0] < b[0] ? 1 : -1)); // más reciente primero
  return rows;
}

function topZones(rs, n = 6) {
  const count = new Map();
  for (const r of rs) {
    const seen = new Set();
    for (const s of r.segs) {
      for (let i = 0; i < s.n; i++) {
        seen.add(Math.floor(s.xs[i] * CELL) * CELL + Math.floor(s.ys[i] * CELL));
      }
    }
    for (const k of seen) count.set(k, (count.get(k) || 0) + 1);
  }
  const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3000);
  const chosen = [];
  for (const [k, c] of sorted) {
    const gx = Math.floor(k / CELL), gy = k % CELL;
    if (chosen.some((z) => Math.max(Math.abs(z.gx - gx), Math.abs(z.gy - gy)) < MIN_SEP_CELLS)) continue;
    chosen.push({ gx, gy, count: c, x: (gx + 0.5) / CELL, y: (gy + 0.5) / CELL });
    if (chosen.length >= n) break;
  }
  return chosen;
}

const toLat = (y) => (Math.asin(Math.tanh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const toLon = (x) => x * 360 - 180;

// opts: {group:'year'|'month'|'dow', onRoute(r), onZone(x, y)}
export function renderStats(root, rs, opts) {
  root.replaceChildren();
  if (!rs.length) { root.append(el('p', 'muted', 'No hay rutas con los filtros actuales.')); return; }

  let km = 0, sec = 0, moveKm = 0;
  const days = new Set();
  for (const r of rs) { km += r.km; if (r.hasTime) { sec += r.sec; moveKm += r.moveKm; } if (r.date) days.add(r.date); }

  const kv = el('div', 'kv');
  const add = (k, v) => { kv.append(el('span', 'k', k), el('span', 'v', v)); };
  add('Rutas', nf.format(rs.length));
  add('Distancia total', `${nf.format(km)} km`);
  add('Media por ruta', `${nf1.format(km / rs.length)} km`);
  add('Días con rutas', nf.format(days.size));
  if (sec > 0) {
    add('Tiempo en movimiento', `${nf1.format(sec / 3600)} h`);
    add('Velocidad media', `${nf1.format(moveKm / (sec / 3600))} km/h`);
  }
  root.append(kv);

  // Distancia por periodo
  const label = { year: 'año', month: 'mes', dow: 'día de la semana' }[opts.group];
  root.append(el('h3', null, `Km por ${label}`));
  const rows = groups(rs, opts.group);
  const max = Math.max(...rows.map((r) => r[1]), 1);
  const chart = el('div', 'chart');
  for (const [k, v] of rows) {
    const row = el('div', 'bar-row');
    const wrap = el('div', 'bar-wrap');
    const bar = el('div', 'bar');
    bar.style.width = `${(v / max) * 100}%`;
    wrap.append(bar);
    row.append(el('span', 'bl', k), wrap, el('span', 'bv', nf.format(v)));
    chart.append(row);
  }
  root.append(chart);

  // Rutas más largas
  root.append(el('h3', null, 'Rutas más largas'));
  const list = el('ol', 'top');
  for (const r of [...rs].sort((a, b) => b.km - a.km).slice(0, 5)) {
    const li = el('li');
    const b = el('button', 'link', `${r.name} · ${nf1.format(r.km)} km`);
    b.title = 'Ver en el mapa';
    b.onclick = () => opts.onRoute(r);
    li.append(b);
    list.append(li);
  }
  root.append(list);

  // Zonas más repetidas
  root.append(el('h3', null, 'Zonas más repetidas'));
  const zl = el('ol', 'top');
  for (const z of topZones(rs)) {
    const li = el('li');
    const b = el('button', 'link', `${z.count} rutas · ${toLat(z.y).toFixed(3)}, ${toLon(z.x).toFixed(3)}`);
    b.title = 'Ir a esta zona';
    b.onclick = () => opts.onZone(z.x, z.y);
    li.append(b);
    zl.append(li);
  }
  root.append(zl);
  root.append(el('small', 'muted', 'Las zonas cuentan en cuántas rutas distintas aparece cada área de ~0,5 km.'));
}
