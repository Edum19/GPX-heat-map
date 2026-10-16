// Añadir un mapa base nuevo = añadir una entrada aquí.
export const BASEMAPS = {
  'OpenStreetMap': {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
  },
  'Oscuro (CARTO)': {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO', maxZoom: 20,
  },
  'Claro (CARTO)': {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO', maxZoom: 20,
  },
  'Topográfico (OpenTopoMap)': {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap', maxZoom: 17,
  },
};
