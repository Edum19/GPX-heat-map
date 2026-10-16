# GPX-heat-map

Mapa de calor a partir de archivos GPX, portado de `mapit_heatmap.py`. Todo se procesa en el navegador: los GPX nunca se suben a ningún servidor (la política CSP en `vercel.json` ni siquiera permite conexiones salientes de la página, solo carga de teselas de mapa).

## Funciones
- Cargar archivos o carpetas completas (arrastrar o botones)
- Filtro por año (del nombre `AAAA-MM-DD…` o de la primera etiqueta `<time>`)
- Intensidad (automática según nº de rutas), grosor de línea
- Recorte de inicio/fin de cada ruta (privacidad)
- Mapa de fondo: Esri gris oscuro, OSM oscuro/estándar o URL propia
- Guardar PNG (con o sin mapa), ajustar vista

## Estructura
- `js/gpx.js` lectura de GPX · `js/routes.js` construye rutas · `js/heat.js` renderizado · `js/tiles.js` mapas de fondo (añade estilos aquí) · `js/colormap.js` degradado · `js/app.js` interfaz

## Desarrollo local
Sitio estático sin build: `npx serve .` o `python -m http.server`.

## Despliegue
Vercel, framework "Other", sin build command ni output directory.
