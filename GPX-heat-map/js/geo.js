// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Edum19. Este programa es software libre: consulta el archivo LICENSE.
// Utilidades geográficas. Mercator normalizado: x e y en [0, 1].
export const mx = (lon) => (lon + 180) / 360;
export const my = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

// Distancia haversine en km.
export function hav(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180;
  const x = Math.sin(((lat2 - lat1) * p) / 2);
  const y = Math.sin(((lon2 - lon1) * p) / 2);
  return 12742 * Math.asin(Math.sqrt(x * x + Math.cos(lat1 * p) * Math.cos(lat2 * p) * y * y));
}

// Distancia aproximada en metros (rápida, suficiente para filtrar puntos).
export function distM(a, b) {
  const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.hypot((b[1] - a[1]) * k * 111320, (b[0] - a[0]) * 110540);
}

// Descarta puntos a menos de `step` metros del anterior (conserva primero y último).
export function thin(seg, step) {
  const out = [seg[0]];
  for (let i = 1; i < seg.length - 1; i++) {
    if (distM(out[out.length - 1], seg[i]) >= step) out.push(seg[i]);
  }
  out.push(seg[seg.length - 1]);
  return out;
}

export function percentile(vals, q) {
  const v = Float64Array.from(vals).sort();
  return v[Math.min(v.length - 1, Math.max(0, Math.floor(q * (v.length - 1))))];
}
