# GPX-heat-map

Mapa de calor a partir de tus rutas (GPX, TCX, FIT y KML), portado de `mapit_heatmap.py`.
Todo se procesa en el navegador: los archivos nunca se suben a ningún servidor. La política CSP de `vercel.json`
no permite conexiones salientes de la página; solo carga teselas de mapa (imágenes) y tipografías.

## Funciones
- Cargar archivos o carpetas completas (arrastrar o botones). Formatos: GPX, TCX, FIT, KML.
- Filtros por año y rango de fechas (del nombre `AAAA-MM-DD…` o de las marcas de tiempo del archivo)
- Colorear por densidad (calor) o por velocidad (si hay marcas de tiempo), con paletas Lima, Fuego, Inferno y Monocromo
- Seleccionar una ruta de la lista: se resalta y se centra el mapa
- Estadísticas: km por año, mes o día, tiempo y velocidad media, rutas más largas, zonas más repetidas
- Recorte de inicio y final de cada ruta (privacidad)
- Mapa de fondo: Esri gris oscuro, OSM oscuro/estándar o URL propia. Guardar PNG con o sin mapa
- Guardar y cargar sesión (`.gpxheat`, archivo local comprimido con tus rutas ya procesadas)
- Teclado en el mapa: flechas, +/-, 0 para ajustar la vista

## Estilo visual: Motorsport Technical
Paleta, tipografía y reglas de componentes en `css/style.css` (variables en `:root`).
Fondo `#101211`, lima `#C6F135` solo para acciones prioritarias, selección y datos destacados.
Tipografías: Inter (interfaz), Barlow Condensed (cifras y etiquetas), JetBrains Mono (datos técnicos), cargadas desde
Google Fonts con alternativas del sistema. Para alojarlas tú mismo, descarga los `.woff2`, añade `@font-face` en
`css/style.css` y quita `fonts.googleapis.com` / `fonts.gstatic.com` de la CSP en `vercel.json`.

## Estructura
`js/formats.js` lectores TCX/KML/FIT · `js/gpx.js` GPX · `js/routes.js` construye rutas y velocidades · `js/heat.js` dibujo ·
`js/colormap.js` paletas · `js/tiles.js` mapas de fondo (añade estilos aquí) · `js/stats.js` estadísticas ·
`js/session.js` guardar/cargar sesión · `js/app.js` interfaz

## Desarrollo local
Sitio estático sin build: `npx serve .` o `python -m http.server`.

## Despliegue
Vercel, framework "Other", sin build command ni output directory.

## Nota sobre OpenStreetMap
OSM exige cabecera `Referer` en las peticiones de teselas. Por eso `vercel.json` usa
`Referrer-Policy: strict-origin-when-cross-origin` (solo se envía el dominio). Es para uso ligero.

## Licencia
Copyright (C) 2026 Edum19.

Este proyecto es software libre: puedes redistribuirlo y modificarlo bajo los términos de la
**GNU General Public License v3.0** (o, a tu elección, cualquier versión posterior) publicada por la
Free Software Foundation. Se distribuye sin ninguna garantía. Consulta el archivo [`LICENSE`](LICENSE)
o <https://www.gnu.org/licenses/gpl-3.0.html>.

Los mapas de fondo y las tipografías son de terceros y mantienen sus propias licencias y atribuciones
(OpenStreetMap, Esri, Google Fonts bajo SIL OFL).
