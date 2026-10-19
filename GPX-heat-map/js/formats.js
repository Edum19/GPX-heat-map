// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Edum19. Este programa es software libre: consulta el archivo LICENSE.
// Lectores de GPX, TCX, KML y FIT. Todos devuelven { segs: [[[lat, lon, t], ...], ...], date: 'AAAA-MM-DD' | '' }
// donde t son segundos epoch o NaN. Todo ocurre en el navegador.
import { parseGPX } from './gpx.js';

export const TRACK_EXTS = ['.gpx', '.tcx', '.kml', '.fit'];
export const SESSION_EXT = '.gpxheat';
export const extOf = (n) => { const m = n.toLowerCase().match(/\.[a-z0-9]+$/); return m ? m[0] : ''; };

const nameDate = (name) => {
  const m = name.split(/[\\/]/).pop().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};
const textDate = (node) => {
  const m = node && node.textContent.match(/^\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};
const xml = (text, name) => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`${name}: archivo no válido`);
  return doc;
};
const ok = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

export async function parseTrackFile(file) {
  const ext = extOf(file.name);
  if (ext === '.fit') return parseFIT(await file.arrayBuffer(), file.name);
  const text = await file.text();
  if (ext === '.tcx') return parseTCX(text, file.name);
  if (ext === '.kml') return parseKML(text, file.name);
  return parseGPX(text, file.name);
}

export function parseTCX(text, name) {
  const doc = xml(text, name);
  const segs = [];
  for (const tr of doc.getElementsByTagName('Track')) {
    const seg = [];
    for (const tp of tr.getElementsByTagName('Trackpoint')) {
      const la = tp.getElementsByTagName('LatitudeDegrees')[0];
      const lo = tp.getElementsByTagName('LongitudeDegrees')[0];
      if (!la || !lo) continue;
      const lat = parseFloat(la.textContent), lon = parseFloat(lo.textContent);
      if (!ok(lat, lon)) continue;
      const tn = tp.getElementsByTagName('Time')[0];
      seg.push([lat, lon, tn ? Date.parse(tn.textContent) / 1000 : NaN]);
    }
    if (seg.length >= 2) segs.push(seg);
  }
  return { segs, date: nameDate(name) || textDate(doc.getElementsByTagName('Time')[0]) };
}

export function parseKML(text, name) {
  const doc = xml(text, name);
  const segs = [];
  // Rutas con tiempo (gx:Track)
  for (const tr of doc.getElementsByTagNameNS('*', 'Track')) {
    const whens = [...tr.getElementsByTagNameNS('*', 'when')].map((w) => Date.parse(w.textContent) / 1000);
    const seg = [];
    [...tr.getElementsByTagNameNS('*', 'coord')].forEach((c, i) => {
      const p = c.textContent.trim().split(/\s+/).map(Number);
      if (ok(p[1], p[0])) seg.push([p[1], p[0], whens[i] ?? NaN]);
    });
    if (seg.length >= 2) segs.push(seg);
  }
  // Líneas sin tiempo
  for (const ls of doc.getElementsByTagNameNS('*', 'LineString')) {
    const c = ls.getElementsByTagNameNS('*', 'coordinates')[0];
    if (!c) continue;
    const seg = [];
    for (const tok of c.textContent.trim().split(/\s+/)) {
      const p = tok.split(',').map(Number);
      if (ok(p[1], p[0])) seg.push([p[1], p[0], NaN]);
    }
    if (seg.length >= 2) segs.push(seg);
  }
  return { segs, date: nameDate(name) || textDate(doc.getElementsByTagNameNS('*', 'when')[0]) };
}

// ---- FIT (Garmin/Wahoo/etc.): lectura mínima de los mensajes "record" (posición + hora) ----
const FIT_EPOCH = 631065600;   // 1989-12-31 UTC en segundos Unix
const SEMI = 180 / 2147483648; // semicírculos -> grados
const FIT_GAP_S = 600;         // un hueco de tiempo mayor parte la ruta en tramos

export function parseFIT(buf, name) {
  const dv = new DataView(buf);
  if (buf.byteLength < 14) throw new Error(`${name}: FIT demasiado corto`);
  const hs = dv.getUint8(0);
  const sig = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11));
  if (hs < 12 || sig !== '.FIT') throw new Error(`${name}: no es un archivo FIT válido`);
  const end = Math.min(buf.byteLength, hs + dv.getUint32(4, true));
  const defs = [];
  const pts = [];
  let pos = hs, lastTs = 0;

  const readData = (d, p, ts) => {
    let lat = 0x7fffffff, lon = 0x7fffffff;
    for (const f of d.fields) {
      if (f.num === 253 && f.size === 4) { const t = dv.getUint32(p, d.le); if (t !== 0xffffffff) { ts = t; lastTs = t; } }
      else if (d.gm === 20 && f.num === 0 && f.size === 4) lat = dv.getInt32(p, d.le);
      else if (d.gm === 20 && f.num === 1 && f.size === 4) lon = dv.getInt32(p, d.le);
      p += f.size;
    }
    p += d.devBytes;
    if (d.gm === 20 && lat !== 0x7fffffff && lon !== 0x7fffffff) {
      const la = lat * SEMI, lo = lon * SEMI;
      if (ok(la, lo)) pts.push([la, lo, ts != null ? ts + FIT_EPOCH : NaN]);
    }
    return p;
  };

  try {
    while (pos < end) {
      const h = dv.getUint8(pos++);
      if (h & 0x80) { // mensaje de datos con marca de tiempo comprimida
        const d = defs[(h >> 5) & 3], off = h & 0x1f;
        if (!d) throw new Error('definición ausente');
        let ts = (lastTs & ~0x1f) + off;
        if (off < (lastTs & 0x1f)) ts += 0x20;
        lastTs = ts;
        pos = readData(d, pos, ts);
      } else if (h & 0x40) { // definición
        const dev = !!(h & 0x20);
        pos++; // reservado
        const le = dv.getUint8(pos++) === 0;
        const gm = dv.getUint16(pos, le); pos += 2;
        const nf = dv.getUint8(pos++);
        const fields = [];
        for (let i = 0; i < nf; i++) { fields.push({ num: dv.getUint8(pos), size: dv.getUint8(pos + 1) }); pos += 3; }
        let devBytes = 0;
        if (dev) { const nd = dv.getUint8(pos++); for (let i = 0; i < nd; i++) { devBytes += dv.getUint8(pos + 1); pos += 3; } }
        defs[h & 0x0f] = { gm, le, fields, devBytes };
      } else { // datos
        const d = defs[h & 0x0f];
        if (!d) throw new Error('definición ausente');
        pos = readData(d, pos, null);
      }
    }
  } catch (e) {
    if (pts.length < 2) throw new Error(`${name}: FIT dañado o no compatible`);
    // si ya hay puntos, se usan los leídos hasta el error
  }

  const segs = [];
  let cur = [];
  for (const p of pts) {
    const prev = cur[cur.length - 1];
    if (prev && Number.isFinite(p[2]) && Number.isFinite(prev[2]) && p[2] - prev[2] > FIT_GAP_S) {
      if (cur.length >= 2) segs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length >= 2) segs.push(cur);
  let date = nameDate(name);
  if (!date) {
    const t = pts.find((p) => Number.isFinite(p[2]));
    if (t) date = new Date(t[2] * 1000).toISOString().slice(0, 10);
  }
  return { segs, date };
}
