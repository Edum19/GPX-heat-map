# GPX-heat-map

Mapa de calor a partir de archivos GPX, portado de `mapit_heatmap.py`. Todo se procesa en el navegador: los GPX nunca se suben a ningún servidor (la política CSP en `vercel.json` ni siquiera permite conexiones salientes de la página, solo carga de teselas de mapa).

## Funciones
- Cargar archivos o carpetas completas (arrastrar o botones)
- Filtros: año y rango de fechas (del nombre `AAAA-MM-DD…` o de la primera etiqueta `<time>`)
- Colorear por densidad (calor) o por velocidad (si los GPX llevan marcas de tiempo)
- Estadísticas: km por año, mes o día, tiempo y velocidad media, rutas más largas y zonas más repetidas
- Guardar y cargar sesión (`.gpxheat`, archivo local comprimido con tus rutas ya procesadas)
- Intensidad (automática según nº de rutas), grosor de línea
- Recorte de inicio/fin de cada ruta (privacidad)
- Mapa de fondo: Esri gris oscuro, OSM oscuro/estándar o URL propia
- Guardar PNG (con o sin mapa), ajustar vista

## Estructura
- `js/gpx.js` lectura de GPX · `js/routes.js` construye rutas · `js/heat.js` renderizado · `js/tiles.js` mapas de fondo (añade estilos aquí) · `js/colormap.js` degradados · `js/stats.js` estadísticas · `js/session.js` guardar/cargar sesión · `js/app.js` interfaz

## Desarrollo local
Sitio estático sin build: `npx serve .` o `python -m http.server`.

## Despliegue
Vercel, framework "Other", sin build command ni output directory.

## Nota sobre OpenStreetMap
OSM exige que las peticiones de teselas lleven cabecera `Referer` (política de uso de teselas). Por eso `vercel.json` usa `Referrer-Policy: strict-origin-when-cross-origin` (solo se envía el dominio, nunca la ruta). Es para uso ligero; si la web tiene mucho tráfico, usa un proveedor propio o con clave.
