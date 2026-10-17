// Paletas. Cada una es una lista de paradas [posición 0-1, [r, g, b]].
// Sirven tanto para densidad (calor) como para velocidad.
export const PALETTES = {
  lima: { label: 'Lima', stops: [[0, [70, 90, 26]], [0.3, [131, 157, 50]], [0.65, [198, 241, 53]], [1, [240, 241, 235]]] },
  fuego: { label: 'Fuego', stops: [[0, [110, 24, 10]], [0.3, [200, 60, 14]], [0.6, [250, 140, 25]], [0.85, [255, 205, 70]], [1, [255, 244, 200]]] },
  inferno: { label: 'Inferno', stops: [
    [0, [0, 0, 4]], [0.14, [40, 11, 84]], [0.28, [101, 21, 110]], [0.42, [159, 42, 99]],
    [0.57, [212, 72, 66]], [0.71, [245, 125, 21]], [0.86, [250, 193, 39]], [1, [252, 255, 164]]] },
  mono: { label: 'Monocromo', stops: [[0, [90, 95, 92]], [0.5, [190, 196, 190]], [1, [255, 255, 255]]] },
};

export function colorAt(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const a = stops[k - 1], b = stops[k], f = (t - a[0]) / (b[0] - a[0] || 1);
      return [0, 1, 2].map((j) => Math.round(a[1][j] + (b[1][j] - a[1][j]) * f));
    }
  }
  return stops[stops.length - 1][1];
}

// Tabla de 256 colores para el modo densidad (valor acumulado -> RGBA).
export function buildLUT(stops) {
  const lut = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.pow(v / 255, 0.6);
    const c = colorAt(stops, t);
    const al = v === 0 ? 0 : Math.round(255 * Math.min(1, t * 2.5));
    lut[v] = ((al << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }
  return lut;
}

// En velocidad se evita el extremo oscuro para que los tramos lentos se vean sobre el mapa.
const SPEED_MIN = 0.3;
export const speedColor = (stops, t) => colorAt(stops, SPEED_MIN + (1 - SPEED_MIN) * Math.max(0, Math.min(1, t)));
