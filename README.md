# GPX-heat-map

Mapa de calor a partir de archivos GPX. Todo se procesa en el navegador del usuario: los GPX nunca se suben a ningún servidor.

## Estructura
- `index.html`: interfaz
- `js/gpx.js`: lectura de GPX
- `js/geo.js`: distancia y densificación de puntos
- `js/basemaps.js`: mapas base (añade uno nuevo aquí)
- `js/app.js`: estado, controles y render

## Desarrollo local
Es un sitio estático sin build. Por ejemplo: `npx serve .` o `python -m http.server`.

## Despliegue
Vercel > Add New Project > importar este repo. Framework: "Other", sin build command ni output directory.

## Ideas para ampliar
Filtro por fechas/actividad, exportar PNG, colores del degradado, estadísticas por ruta, soporte FIT/TCX.
