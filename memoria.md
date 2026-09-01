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

## Configuracion GPS santa01 - 21/08/2026

- GPS configurado por SMS y conectado correctamente a Traccar demo.
- Modelo/protocolo detectado: GT06 / QS111.
- IMEI / Unique ID: 359015562902671.
- Nombre en Traccar: santa01.
- Servidor GPS: demo4.traccar.org.
- Puerto GPS Traccar: 5023.
- APN Claro Argentina: igprs.claro.com.ar.
- Estado verificado: en linea y reportando ubicacion real en Jujuy.
- Coordenada real observada en Traccar: -24.19006, -65.28474.
- Comando de consulta usado: CXZT.
- Intervalo recomendado para no abusar del demo de Traccar: SZCS#FREQ=60.
- Implementacion monitor: commit 307f76f Add GPS assignment manager to monitor subido a origin/main.
- Flujo monitor: boton + -> Cargar GPS -> seleccionar santa01 / 359015562902671 -> cargar interno -> elegir linea -> Guardar GPS.
- Nota: la asignacion actual del monitor se guarda en localStorage del navegador como santaAnaMonitorDevices. Para uso multiusuario centralizado conviene migrarlo a Redis/Base de datos.

## 2026-08-28 - Publicidad propia en produccion

- Se implemento un sistema simple de publicaciones publicitarias propias administrado desde el monitor web, sin necesidad de actualizar la APK para cambiar banners.
- Panel disponible en `/admin/ads`, protegido con autenticacion basica usando `ADS_ADMIN_PASSWORD` y fallback a `MONITOR_OPERATOR_PASSWORD`.
- API publica disponible en `/api/ads/active?placement=...` para que la APK consulte publicaciones activas.
- API admin disponible en `/api/admin/ads/publications` para listar, crear, editar y borrar publicaciones.
- Persistencia: usa Upstash Redis cuando estan configuradas `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`; `app/data/adPublications.json` queda como respaldo local/desarrollo.
- Las publicaciones se consideran disponibles si estan activas, dentro del rango de fechas y asignadas al placement consultado.
- `MAIN_BOTTOM` funciona como fallback global: una publicacion marcada como Principal puede mostrarse tambien en Lineas, Mapa, Favoritos y Perfil.
- El panel permite configurar titulo, texto corto, URL HTTPS de imagen, boton, tipo/direccion de destino, fechas, prioridad, segundos de rotacion y ubicaciones.
- Se agrego boton visible para borrar publicaciones desde la lista del panel.
- Produccion en Vercel quedo desplegada desde `main`; ultimo despliegue verificado como `Ready` en `Production`.
- Commits relevantes:
  - `fd46f4e Add owned advertising admin`
  - `30eda7f Clarify ad admin form feedback`
  - `d320028 Show delete action in ads list`
  - `c512619 Use main ad placement as global fallback`
- Verificacion: `npm.cmd run build` termino correctamente y Vercel mostro el deploy `c512619` listo en produccion.
## 2026-08-30 - Correccion de publicidad local

- Se leyeron los documentos `.md` para retomar contexto de modificaciones.
- Se corrigio `app/data/advertising.ts` para que las publicaciones nuevas no puedan quedar con `id` vacio.
- Se activo correctamente el fallback global de `MAIN_BOTTOM` en `/api/ads/active`, usando la funcion `isPlacementMatch` al filtrar publicaciones activas.
- Se corrigieron los IDs vacios del respaldo local `app/data/adPublications.json`.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-08-30 - Responsive admin de publicidades

- Se ajusto la pagina protegida /admin/ads para celulares.
- El layout ahora apila paneles, usa botones al ancho disponible y evita que textos largos oculten controles.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-30 - IDs unicos en publicaciones

- Se corrigio la lectura de publicaciones para reparar automaticamente IDs vacios o duplicados.
- Esto evita que al seleccionar o borrar una publicacion se afecten varias publicaciones antiguas con el mismo ID.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-30 - Imagen opcional en publicidades

- Se hizo opcional el campo URL de imagen HTTPS en /admin/ads.
- La API ya permite guardar publicaciones sin imagen cargada.
- El formulario muestra el campo como opcional.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-30 - Carga de foto en publicidades

- Se agrego un boton Cargar foto en la pagina protegida /admin/ads.
- La imagen seleccionada se reduce en el navegador y se guarda embebida en la publicacion, sin requerir una URL externa.
- Se agrego boton Quitar imagen y se mantiene la opcion de pegar una URL manualmente.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-30 - Imagenes de publicidades en Vercel Blob

- Se reemplazo la carga embebida de fotos por subida real a Vercel Blob desde /api/admin/ads/images.
- Las publicaciones guardan imageUrl, imageStorage e imagePath; Redis conserva solo metadatos y la URL.
- Al borrar una publicacion o reemplazar su imagen, se borra tambien el blob anterior cuando corresponde.
- Se agrego la dependencia @vercel/blob.
- Requisito de produccion: configurar/conectar Vercel Blob para disponer de BLOB_READ_WRITE_TOKEN.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-30 - Limite de imagenes Blob

- Se ajusto el limite de subida de imagenes de publicidades a 4 MB para respetar el limite de uploads por servidor de Vercel.
- La validacion se aplica en el formulario y en /api/admin/ads/images.
- Verificacion: 
pm.cmd run build termino correctamente.


## 2026-08-31 - Produccion publicidad y prueba interna Android

- Se corrigio el scroll de /admin/ads cambiando el overflow global de body/html: queda bloqueado solo el eje horizontal con `overflow-x: hidden`.
- Commit/push monitor web: `be2ed25 Fix admin ads page scrolling` en `origin/main`; Vercel desplego produccion correctamente.
- Se configuro Vercel Storage para publicidades:
  - Upstash Redis Free creado como `monitor-santa-ana-ads-data` para metadatos de publicaciones.
  - Blob privado existente `monitor-santa-ana-blob` no sirve para banners publicos porque no permite `access: "public"`.
  - Blob publico nuevo creado como `monitor-santa-ana-ads-public-blo...` con prefijo de variables `ADS_BLOB`.
- Se ajusto /api/admin/ads/images para subir al Blob publico indicando `storeId: process.env.ADS_BLOB_STORE_ID`.
- Commit/push monitor web: `1783ff2 Use public Blob store for ad images` en `origin/main`.
- Variables esperadas en Vercel para publicidad:
  - `BLOB_READ_WRITE_TOKEN` para compatibilidad si se usa el store por defecto.
  - `ADS_BLOB_STORE_ID` y token read-write asociado para el Blob publico nuevo.
  - `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` para Redis.
- Se creo la app en Google Play Console con nombre `Santa Ana Bus` y paquete `ar.com.santaana.bus` porque `com.bustracker` ya estaba en uso fuera de esta cuenta.
- Proyecto Android en `E:\AppColectivos\BusTracker_Android`: se cambio `applicationId` a `ar.com.santaana.bus`, manteniendo `namespace = "com.bustracker"`.
- Version Android actual para Play: `versionCode = 3`, `versionName = "1.1.1"`.
- Se corrigio la firma release: `play-signing.properties` tenia BOM al inicio y la ruta del keystore usaba backslash no escapado. Se quito el BOM y se cambio `storeFile` a `distribution-signing/santa-ana-upload-20260830.jks`.
- `./gradlew.bat signingReport` confirma release con `Config: playRelease`, alias `santa-ana-upload`, certificado valido hasta 2054-01-15.
- AAB firmado generado correctamente en `E:\AppColectivos\BusTracker_Android\app\build\outputs\bundle\release\app-release.aab`.
- Google Play Console acepto el AAB firmado en Prueba interna; quedo `Activo`, version mas reciente `3 (1.1.1)`, disponible para verificadores internos y sin revisar.
- Advertencias vistas en Play: falta archivo de ofuscacion y simbolos de depuracion nativos; son advertencias, no bloquearon la prueba interna.
- Pendiente recomendado: abrir la pestaña `Verificadores`, copiar el enlace de prueba interna, aceptar como tester con el Gmail agregado e instalar desde Google Play. Luego completar la configuracion requerida de ficha/politicas antes de solicitar produccion.

## 2026-09-01 - API publica de version APK

- Se agrego `/api/public/app-version` para que la APK consulte la ultima version disponible.
- Nuevo modelo `app/data/appVersion.ts` con valores iniciales `latestVersionCode=4` y `latestVersionName=1.1.2`.
- La respuesta incluye titulo, mensaje, URL de Google Play, flag `required` y `updatedAt`.
- Se puede ajustar desde variables de entorno en Vercel: `PUBLIC_APP_LATEST_VERSION_CODE`, `PUBLIC_APP_LATEST_VERSION_NAME`, `PUBLIC_APP_VERSION_TITLE`, `PUBLIC_APP_VERSION_MESSAGE`, `PUBLIC_APP_PLAY_STORE_URL`, `PUBLIC_APP_PACKAGE_ID`, `PUBLIC_APP_UPDATE_REQUIRED`.
- Verificacion: `npm.cmd run build` termino correctamente y listo `/api/public/app-version`.

## 2026-09-01 - Admin de version APK

- Se agrego pantalla protegida `/admin/app-version` para administrar el aviso de nueva version de la APK desde el monitor.
- Se agrego API admin `/api/admin/app-version` con `GET` y `POST`.
- `app/data/appVersion.ts` ahora persiste la configuracion en Upstash Redis si esta disponible, con respaldo local `app/data/appVersion.json`.
- La version publicada por defecto queda `latestVersionCode=5`, `latestVersionName=1.1.3`, con mensaje indicando que quita publicidades externas de Novedades.
- Se agrego `NEWS_BOTTOM` como ubicacion de publicidad administrable y se mantiene compatibilidad de tipo con `FAVORITES_BOTTOM` viejo.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-09-01 - Etiqueta Novedades en ubicaciones de publicidad

- Se corrigio el nombre visible de `NEWS_BOTTOM` en el panel de publicidades para que aparezca como `Novedades`.
- `MAIN_BOTTOM` ahora se muestra como `Inicio` para evitar dos botones llamados Principal en Ubicaciones.

## 2026-09-01 - Credenciales admin para version APK

- `/admin/app-version` y `/api/admin/app-version` ahora validan usuario y contrasena por Basic Auth.
- Usuario local configurado en `.env.local`: `APP_VERSION_ADMIN_USER=admin`.
- La contrasena queda en `.env.local` y debe configurarse tambien como variable de entorno en Vercel; no repetirla en memoria ni codigo fuente.
- Si no hay variables especificas de version, mantiene fallback a `ADS_ADMIN_PASSWORD` o `MONITOR_OPERATOR_PASSWORD`.
