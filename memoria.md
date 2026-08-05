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
