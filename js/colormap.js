// Degradado tipo "magma/inferno". El valor acumulado (0-255) se convierte en color RGBA.
const STOPS = [
  [0, [0, 0, 4]], [0.14, [40, 11, 84]], [0.28, [101, 21, 110]], [0.42, [159, 42, 99]],
  [0.57, [212, 72, 66]], [0.71, [245, 125, 21]], [0.86, [250, 193, 39]], [1, [252, 255, 164]],
];

export function buildLUT() {
  const lut = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.pow(v / 255, 0.6);
    let c = STOPS[STOPS.length - 1][1];
    for (let k = 1; k < STOPS.length; k++) {
      if (t <= STOPS[k][0]) {
        const a = STOPS[k - 1], b = STOPS[k], f = (t - a[0]) / (b[0] - a[0]);
        c = [0, 1, 2].map((j) => a[1][j] + (b[1][j] - a[1][j]) * f);
        break;
      }
    }
    const al = v === 0 ? 0 : Math.round(255 * Math.min(1, t * 2.5));
    lut[v] = ((al << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
  }
  return lut;
}
