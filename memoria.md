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

## 2026-09-01 - Aviso version 1.1.4

- Se actualizo el aviso de version del monitor a `latestVersionCode=6` y `latestVersionName=1.1.4`.
- El mensaje indica que esta version quita completamente los anuncios de la seccion Novedades.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-09-01 - Aviso version 1.1.5 sin AdMob

- Se actualizo el aviso de version del monitor a `latestVersionCode=7` y `latestVersionName=1.1.5`.
- El mensaje indica que esta version elimina AdMob de la app y deja solo publicidades propias del panel.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-09-01 - Aviso version 1.1.6 sin banners en Novedades

- Se actualizo en produccion `/api/public/app-version` a `latestVersionCode=8` y `latestVersionName=1.1.6` usando `/api/admin/app-version`.
- El mensaje indica que Novedades queda sin ningun banner publicitario.
- Verificacion: `npm.cmd run build` termino correctamente.

## 2026-09-02 - Estado backend ETA hasta Etapa 3

### Etapa 1 - Geometria y paradas

- Estado: terminada y desplegada.
- Commit principal: `3415d24 Add route geometry and stop projections`.
- Archivos principales:
  - `app/data/routeGeometry.ts`
  - `app/data/stopProjections.ts`
- Se cargo geometria IDA/VUELTA desde KML.
- La geometria incluye `cumulativeDistanceMeters`.
- Se implemento `projectPointOntoRoute()`.
- Se implemento proyeccion de paradas sobre el recorrido.
- El diagnostico expone `lineGeometryReady` y `stopEtaReady`.
- Distancia maxima actual para considerar una parada sobre recorrido: `maxDistanceFromRouteMeters = 100`.
- Se usa cache en memoria y Redis.
- Endpoint diagnostico: `/api/admin/route-geometry`.
- La direccion IDA/VUELTA se determina por nombre de `Placemark`, no por el orden de los `LineString` del KML.
- Los KML no deben descargarse en el futuro hot path de usuarios.
- Proteccion del endpoint:
  - Commit: `3724c42 Protect route geometry admin endpoint`.
  - Sin autenticacion responde `401`.
  - Con autenticacion administrativa responde `200`.
  - No registrar credenciales Basic Auth en `memoria.md`.
- Piloto validado: `2-peron`.
  - Geometria IDA: aproximadamente `14165 m`.
  - Geometria VUELTA: aproximadamente `16280 m`.
  - Parada piloto: `2-peron-a12d14c1`.
  - `direction = ida`.
  - `stopMeasureMeters` aproximadamente `14165`.
  - `distanceFromRouteMeters` aproximadamente `75`.
  - `projectionValid = true`.
  - `stopEtaReady = true`.
  - Diagnostico: `order_missing`.
  - Se verifico que la parada esta realmente cerca del final del recorrido IDA y que `projectPointOntoRoute()` actuo correctamente al proyectarla contra el extremo final del recorrido.

### Etapa 2 - Proyeccion del vehiculo

- Estado: terminada y desplegada.
- Commit: `9b2e6d9 Add vehicle route projection and stop state logic`.
- Archivo principal: `app/data/vehicleRouteProjection.ts`.
- Se implemento proyeccion del vehiculo sobre IDA/VUELTA.
- Reutiliza `projectPointOntoRoute()`.
- Se implemento deteccion de direccion.
- Calcula `vehicleMeasureMeters`.
- Calcula `distanceRemainingMeters`.
- Estados actuales:
  - `approaching`
  - `arriving`
  - `passed`
  - `no_prediction`
- Constantes actuales:
  - `MAX_VEHICLE_DISTANCE_FROM_ROUTE_METERS = 100`
  - `AMBIGUOUS_ROUTE_DISTANCE_DIFFERENCE_METERS = 30`
  - `COURSE_COMPATIBILITY_DEGREES = 60`
  - `ARRIVING_BEFORE_METERS = 80`
  - `PASSED_AFTER_METERS = 40`
- Seleccion de direccion:
  - si solamente una geometria esta dentro de `100 m`, usarla;
  - si ambas estan dentro de `100 m` pero una es claramente mas cercana por `>=30 m`, usar la mas cercana;
  - si estan geometricamente ambiguas, utilizar `course`;
  - la diferencia angular se calcula correctamente incluyendo cruce `0/360`;
  - `course` compatible es `<=60` grados;
  - si no puede determinar direccion con seguridad, devuelve `no_prediction`.
- La logica no consulta Traccar directamente.
- La logica no hace HTTP.
- No llama `getFleetSnapshot()` dentro de la funcion pura.
- La logica no modifica el fleet snapshot.
- No modifica `fleet.ts`.
- No modifica `/api/public/fleet`.
- No altera anti-stampede.
- Ante direccion ambigua prefiere `no_prediction`.
- Tests acumulados despues de Etapa 2: `24`.

### Etapa 3 - ETA V1

- Estado: implementada y con commit local, todavia sin push/deploy.
- Commit local: `b4cd78a Add ETA V1 estimation logic`.
- Archivos:
  - `app/data/etaEstimate.ts`
  - `tests/etaEstimate.test.ts`
- Objetivo: convertir el estado de Etapa 2 y `distanceRemainingMeters` en una estimacion inicial de minutos.
- ETA V1 todavia no usa:
  - historicos;
  - trafico;
  - machine learning;
  - velocidad historica por tramo;
  - Redis ETA;
  - CDN ETA.
- Constantes actuales:
  - `MIN_USABLE_SPEED_KMH = 5`
  - `MAX_USABLE_SPEED_KMH = 60`
  - `DEFAULT_URBAN_SPEED_KMH = 15`
  - `MAX_POSITION_AGE_SECONDS = 120`
- Comportamiento por estado:
  - `approaching`: calcula ETA.
  - `arriving`: `etaMinutes = 0`.
  - `passed`: `etaMinutes = null`.
  - `no_prediction`: `etaMinutes = null`.
- Politica de velocidad:
  - Entre `5` y `60 km/h`: usa velocidad GPS actual.
  - `null`, `NaN`, `Infinity`, `0` o menor que `5`: fallback a `15 km/h`.
  - Mayor que `60`: limitada a `60 km/h`.
- Redondeo:
  - `distanceKm = distanceRemainingMeters / 1000`.
  - `etaHours = distanceKm / effectiveSpeedKmh`.
  - `etaMinutesRaw = etaHours * 60`.
  - `etaMinutes = max(1, ceil(etaMinutesRaw))`.
- Politica GPS:
  - `fixTime` invalido: `etaMinutes = null`, `reason = invalid_fix_time`.
  - Posicion mayor a `120` segundos: `etaMinutes = null`, `reason = stale_position`.
  - `currentTime` se recibe explicitamente.
  - No se usa `Date.now()` interno en la logica pura.
- Resultado interno incluye conceptualmente:
  - `etaMinutes`;
  - `etaMinutesRaw`;
  - `effectiveSpeedKmh`;
  - `confidence`;
  - `reason` interno cuando corresponde.
- Valores contemplados para `confidence`:
  - `current_speed`;
  - `default_speed`;
  - `arriving`;
  - `not_available`.
- Verificacion posterior a Etapa 3:
  - `npm test`: `45/45` tests pasaron.
  - `npx tsc --noEmit`: paso.
  - `npm run build`: paso.
- No se pudo probar ETA real de `2-peron` porque en el snapshot disponible en ese momento no habia vehiculo de esa linea.
- No se inventaron datos.

### Produccion actual

- Produccion todavia esta en `9b2e6d9` porque `b4cd78a` no fue pusheado.
- Vercel esta conectado a GitHub `main` y despliega automaticamente cuando se hace push.
- Flujo de despliegue:
  - commit local;
  - push `origin/main`;
  - GitHub;
  - deploy automatico de Vercel.
- Hacer commit local no despliega; el push a `main` provoca el deploy automatico de Vercel.

### Arquitectura importante

- Flujo actual:
  - Android APK
  - Next.js backend en Vercel
  - CDN / cache
  - Redis
  - Traccar en VPS
- Las credenciales de Traccar permanecen backend-only.
- Android no se conecta directamente a Traccar.
- `/api/public/fleet`:
  - Publico.
  - Polling Android aproximado cada `30` segundos.
  - CDN activo.
  - Snapshot Redis.
  - Cache interno.
  - Anti-stampede activo.
  - Stale snapshot.
  - Fallback controlado.
  - Rate limit especifico de fleet actualmente `600/min/IP`.
- El rate limit de fleet se aumento desde `120/min/IP` porque el limite anterior produjo `429` reales y "Sin conexion con monitor" en Android para IP compartida/CGNAT.
- No cambiar el contrato publico de `/api/public/fleet` sin revisar compatibilidad con la APK existente.

### Escalabilidad

- Objetivo futuro potencial: decenas de miles de usuarios.
- Ejemplo de diseno usado:
  - `50.000` usuarios activos;
  - poll cada `30` segundos;
  - aproximadamente `100.000 requests/minuto`;
  - aproximadamente `1.667 requests/segundo`.
- La mayoria del trafico debe ser absorbida por CDN.
- No hacer stress tests fuertes directamente contra produccion sin planificacion.

### Reglas de seguridad

- No exponer publicamente:
  - IMEI.
  - `uniqueId`.
  - `battery`.
  - `satellites`.
  - `ignition`.
  - `power`.
  - Credenciales Traccar.
  - Credenciales Redis.
  - API keys.
  - Passwords.
  - Credenciales Basic Auth.
  - Secrets o `.env`.
  - Diagnosticos GPS innecesarios.
- No escribir secretos dentro de `memoria.md`.

### Android

- Android todavia no consume el nuevo backend ETA.
- La logica actual de ETA Android sigue siendo la anterior hasta una futura actualizacion del APK.
- Actualmente Android conserva su logica anterior de ETA basada en distancia recta/velocidad.
- No modificar Android durante las etapas backend salvo autorizacion explicita.
- Modificar Android requerira posteriormente nueva APK/AAB.

### Proximo paso recomendado

- Despues de aprobar `memoria.md`:
  - Commit separado de `memoria.md`.
  - Push controlado.
  - Vercel desplegara Etapa 3.
  - Verificar produccion.
  - Cerrar Etapa 3.
  - Despues disenar la siguiente etapa del endpoint `/api/public/stop-arrivals`.
- El futuro endpoint `GET /api/public/stop-arrivals` debera combinar:
  - fleet snapshot existente;
  - `RouteGeometry`;
  - `StopProjection`;
  - `VehicleRouteProjection`;
  - `EtaEstimate`.
- Luego debera aplicar cache/CDN apropiado.
- Todavia no implementar ese endpoint.

## 2026-09-03 - ETA etapas 4 y 5, APK 1.1.9 y rate limit fleet

- ETA Etapa 4 terminada: endpoint publico `/api/public/stop-arrivals` implementado.
- ETA Etapa 5 terminada: integracion Android completada.
- APK actual instalada/probada: `versionName=1.1.9`, `versionCode=11`.
- Correccion `/api/public/fleet`: rate limit aumentado a `60000` requests por `60` segundos por IP.
- Correccion `/api/public/fleet`: si no hay IP confiable, no se usa `"unknown"`; se devuelve `null` y queda fail-open.
- Commit backend de la correccion de rate limit fleet: `62bd6a1 Increase fleet rate limit for shared IPs`.
- Prueba real: `/api/public/fleet` y APK funcionan con Wi-Fi.
- Panel de parada/ETA probado en APK.
- Proximo paso: cargar paradas reales y validar ETA con colectivos circulando.

## 2026-09-03 - Estado operativo, monitor reorganizado y verificacion produccion

- APK produccion/prueba actual: `versionName=1.1.9`, `versionCode=11`.
- ETA por parada implementado y probado.
- `/api/public/fleet` corregido para CGNAT: `60000` requests por `60` segundos por IP y fail-open cuando no hay IP confiable.
- Commit de correccion CGNAT fleet: `62bd6a1`.
- Estado operativo de unidades implementado:
  - `EN_SERVICIO`;
  - `FUERA_DE_SERVICIO`;
  - `TALLER`.
- Solo las unidades `EN_SERVICIO` aparecen en `/api/public/fleet` y por lo tanto en la APK.
- Monitor reorganizado:
  - `GPS / Internos`: relacion estable GPS <-> interno.
  - `Operacion de unidades`: relacion diaria interno <-> linea <-> estado operativo.
- Desde `Operacion de unidades` no se modifica GPS ni numero de interno.
- `PATCH /api/assignments` es parcial y conserva los demas datos cuando no vienen en el request.
- Se mantiene la proteccion contra internos duplicados.
- No requiere migracion de datos existentes: los registros sin estado quedan como `EN_SERVICIO` por defecto.
- Reorganizacion final commit: `af57fea`.
- Probado en produccion y funcionando correctamente.
- Publicidad propia: rotacion verificada; los anuncios requieren `imageUrl`.
- Proximo trabajo: continuar carga de paradas reales y validar ETA en servicio real.
