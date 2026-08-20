# Memoria persistente

## 2026-08-03

- Proyecto ubicado en `E:\MonitorColectivos\santa-ana-fleet-monitor-20260803-130152\web-monitor`.
- Se configuro Traccar contra `https://demo4.traccar.org` usando `.env.local`.
- Usuario configurado: `mgurzagasti@gmail.com`.
- La clave de Traccar queda solo en `.env.local`; no repetirla en archivos de memoria, README ni codigo fuente.
- Dispositivo principal configurado: `TRACCAR_DEVICE_ID=17752`.
- Flota local configurada con `FLEET_DEVICES` para la linea `49 BIS`, etiqueta `Santa Ana 49 BIS`, color `#f57c00`.
- Se agrego `.npmrc` para que la cache de npm usada desde este proyecto apunte al disco E:
  - `.npm-cache`
- Nota: npm no permite configurar `prefix` desde una `.npmrc` de proyecto; si se necesitan paquetes globales, configurar el prefijo a nivel de usuario apuntando a E.
- Mantener instalaciones, builds y archivos nuevos dentro de esta carpeta del disco E para evitar consumo de espacio en C.
- `npm run dev` y `npm start` usan `scripts/next-free-port.mjs` para buscar un puerto libre desde `PORT` o `3002` antes de iniciar Next. Se evita `3001` porque el usuario lo usa para otra app.
- Se reviso `E:\AppColectivos\BusTracker_Android`: Android compila correctamente usando JDK, SDK, Gradle y cache desde `E:`.
- Recomendacion actual: usar la app Android como producto principal para el celular y este `web-monitor` separado como panel de monitoreo; evitar trabajar sobre la copia vieja `E:\AppColectivos\BusTracker_Android\web-monitor` para no duplicar cambios.
- Se agrego `start-web-monitor.cmd` para iniciar el panel desde Windows manteniendo la cache npm dentro de esta carpeta en `E:`.
- Se actualizo el README para indicar que el puerto puede variar si `3002` esta ocupado.

## 2026-08-05

- Se cambio el marcador circular del monitor por un icono tipo colectivo.
- El marcador muestra el numero interno asignado, o la linea como respaldo.
- `/api/fleet` ahora expone `course` desde Traccar para orientar el colectivo cuando el GPS manda rumbo.
- Se cambio el panel lateral del monitor a modo desplegable para que el mapa use todo el ancho.
- Se agrego interpolacion visual del marcador entre reportes GPS para simular movimiento fluido sin alterar datos reales.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-08-11

- Se preparo infraestructura de paradas por linea en el monitor web.
- Nuevo modelo en `app/data/lineStops.ts`; por ahora `lineStops` queda vacio hasta cargar puntos reales.
- Nuevas APIs:
  - `/api/line-stops`
  - `/api/public/line-stops`
  - `/api/public/line-stops?lineId=49bis`
- El mapa web ya puede dibujar paradas como puntos circulares cuando existan.
- El panel lateral muestra `Paradas cercanas` y calcula distancia aproximada en linea recta desde el colectivo seleccionado.
- Estado actual esperado: `Sin paradas cargadas para esta linea.`
- Pendiente recomendado: crear modo edicion desde el monitor para agregar paradas haciendo clic en el mapa, seleccionando linea, nombre, sentido y orden; guardar en JSON o base de datos.
- Commit/push realizado: `f9330ef Add line stops support to monitor` en `mgurzagasti-ai/monitor-santa-ana`.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-08-11 - Editor de paradas en monitor

- Se implemento modo edicion de paradas desde el panel lateral del monitor.
- El boton de `+` en el encabezado, o `Editar` dentro de `Paradas cercanas`, abre el editor.
- Flujo de carga:
  - elegir linea;
  - completar nombre;
  - elegir sentido `Ida`, `Vuelta` o `Ida y vuelta`;
  - opcionalmente poner orden;
  - hacer clic en el mapa para tomar latitud/longitud;
  - guardar parada.
- Las paradas se persisten en `app/data/lineStops.json`.
- `/api/line-stops` ahora permite:
  - `GET` para listar;
  - `POST` para crear;
  - `DELETE ?id=...` para borrar.
- `/api/public/line-stops` sigue siendo de lectura para la APK.
- Se probo crear y borrar una parada temporal por API en `localhost:3002`; el archivo quedo nuevamente con `[]`.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-08-20 - Persistencia de paradas en produccion

- Se corrigio el guardado de paradas en Vercel: `app/data/lineStops.ts` ahora usa Upstash Redis cuando `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` estan configuradas.
- El JSON `app/data/lineStops.json` queda como respaldo local/desarrollo.
- Si Redis esta configurado y Vercel rechaza escritura local con `EROFS`, el guardado no falla.
- Si Redis no esta configurado en un servidor de solo lectura, la API devuelve un mensaje claro indicando que falta configurar Redis.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-08-20 - Orden masivo de paradas

- Se agrego `PATCH /api/line-stops` para actualizar el orden de paradas existentes en bloque.
- Se preparo el orden de linea 15 usando las trazas `IDA LINEA 15` y `VUELTA LINEA 15` del KML publico.
- Se protegio `/api/line-stops` con la misma autenticacion basica del monitor; `/api/public/line-stops` sigue abierto para la APK.
- Verificacion: `npm.cmd run build` termino correctamente.
