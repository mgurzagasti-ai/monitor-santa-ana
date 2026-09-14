# Historial tecnico del proyecto

Este archivo resume el estado tecnico del proyecto para poder retomarlo sin depender del historial de chat. No contiene secretos ni reemplaza a `memoria.md`; consolida los hitos y decisiones confirmadas.

## Arquitectura actual

- Backend/monitor activo: `E:\MonitorColectivos\santa-ana-fleet-monitor-20260803-130152\web-monitor`.
- Android activo: `E:\AppColectivos\BusTracker_Android`.
- Flujo principal: APK Android -> backend Next.js en Vercel -> CDN/cache -> Redis -> Traccar.
- Las credenciales de Traccar y Redis permanecen backend-only o en archivos locales/variables de entorno. No copiarlas a documentacion.
- Android no debe conectarse directamente a Traccar en release; usa `BuildConfig.MONITOR_BASE_URL` para consultar el monitor.
- La carpeta `web-monitor` historica dentro del proyecto Android no se usa para cambios nuevos.

## Estado actual confirmado - 2026-09-14

- Backend `HEAD` y `origin/main`: `c84d328 Tune fleet cache TTL for 15s GPS reports`.
- Android `HEAD` y `origin/main`: `5e97ea6 Prepare Android 1.1.15 release`.
- Android preparado actual: `versionCode = 17`, `versionName = "1.1.15"`.
- GPS fisicos: configurados para reportar cada `15 s`.
- Monitor web: polling de fleet cada `30 s` en `app/page.tsx` (`setInterval(loadFleet, 30000)`).
- Android fleet: `USER_LOCATION_REFRESH_MS = 20_000L` en `app/src/main/java/com/bustracker/ui/screens/MapScreen.kt`.
- Android stop-arrivals/ETA: `STOP_ARRIVALS_REFRESH_MS = 15_000L` en `MapScreen.kt`.
- Backend fleet cache TTL default: `15 s` en `app/data/fleet.ts` (`FLEET_CACHE_TTL_SECONDS ?? 15`).
- Backend stale cache: `300 s`.
- Backend refresh lock: `20 s`.
- CDN de `/api/public/fleet`: `s-maxage=5, stale-while-revalidate=25`.
- El monitor web quedo deliberadamente en `30 s`.
- No asumir que todos los clientes deben consultar cada `15 s`; el cambio a 15 s aplica al TTL compartido del backend y al polling de llegadas Android, no al polling de todos los clientes.
- `.env.example` todavia documenta `FLEET_CACHE_TTL_SECONDS=20`; queda pendiente alinearlo a `15`, pero no se cambio en esta pasada.

## Hitos cronologicos

### 2026-07-30 / 2026-08-03 - Base Android y separacion operativa

- Android se configuro para trabajar desde `E:` con SDK, JDK, Gradle y caches fuera de `C:`.
- La app paso a llamarse `Santa Ana Bus`, con mapa centrado en San Salvador de Jujuy y datos iniciales de lineas locales.
- Se definio Android como producto principal y el monitor web activo como proyecto separado en `web-monitor`.
- Se agregaron scripts de build/install para Android y script de arranque del monitor.

### 2026-08-03 / 2026-08-05 - Monitor web y GPS real

- Se creo el monitor web Next.js con mapa Leaflet, posicion GPS, historial y APIs internas.
- Se configuro Traccar desde `.env.local`; las credenciales no deben documentarse.
- `/api/fleet` expone datos de posicion, curso y diagnostico para el monitor.
- El marcador del monitor paso a icono de colectivo con numero interno/linea.
- Se agrego interpolacion visual del marcador entre reportes GPS.

### 2026-08-11 / 2026-08-20 - Paradas, recorridos y persistencia

- Se incorporaron recorridos desde Google My Maps/KML.
- Se agrego infraestructura de paradas por linea en backend: `/api/line-stops` y `/api/public/line-stops`.
- Se implemento editor de paradas desde el monitor.
- Las paradas usan JSON local en desarrollo y Upstash Redis en produccion cuando esta configurado.
- Se agrego orden masivo de paradas y proteccion Basic Auth para APIs administrativas.

### 2026-08-21 - GPS fisico y asignaciones

- Se documento la configuracion inicial de un GPS fisico en Traccar demo.
- El monitor incorporo flujo para cargar GPS, interno y linea.
- Las asignaciones evolucionaron desde `localStorage` hacia fuente centralizada del servidor.

### 2026-08-28 / 2026-09-01 - Publicidad propia y Google Play

- Se implemento publicidad propia administrada desde `/admin/ads`.
- La API publica `/api/ads/active?placement=...` alimenta banners en Android.
- Los metadatos usan Redis y las imagenes se suben a Vercel Blob publico.
- Se elimino AdMob de la APK; la publicidad activa es propia del monitor.
- Se preparo la app para Google Play con paquete `ar.com.santaana.bus`.
- Se agrego `/api/public/app-version` y `/admin/app-version` para avisos de version de APK.
- Se generaron bundles release firmados para pruebas internas.

### 2026-09-01 / 2026-09-11 - Autenticacion y Appwrite

- Android usa Appwrite Auth con email/contrasena.
- En `1.1.14`, la autenticacion migro a Appwrite self-hosted en `https://appwrite.santaanasrl.com.ar/v1`.
- Google OAuth fue retirado de la UI y del flujo de autenticacion.
- Recuperacion de contrasena usa la pagina web HTTPS del monitor y fue probada con SMTP self-hosted.
- No almacenar contrasenas, app passwords ni secretos en documentacion.

### 2026-09-02 / 2026-09-08 - ETA y llegadas

- ETA Etapa 1: geometria de recorridos y proyeccion de paradas.
- ETA Etapa 2: proyeccion de vehiculos sobre IDA/VUELTA y estados `approaching`, `arriving`, `passed`, `no_prediction`.
- ETA Etapa 3: estimacion V1 de minutos con velocidad GPS o fallback urbano.
- ETA Etapa 4: endpoint publico `/api/public/stop-arrivals`.
- ETA Etapa 5: integracion Android del panel de llegadas.
- `/api/public/stop-arrivals` puede construir geometria on demand si no esta cacheada.
- Se agrego deteccion generica de `recently_passed`; se publica como `"passed"` por compatibilidad con la APK.
- Historial corto de progreso por `deviceId + lineId + direction` con TTL default `180 s`.
- Constantes ETA documentadas: velocidad urbana default `15 km/h`, posicion maxima usable `120 s`.

### 2026-09-03 / 2026-09-12 - Flota, rate limit y operacion

- `/api/public/fleet` se ajusto para CGNAT: rate limit alto y fail-open cuando no hay IP confiable.
- Se implementaron estados operativos: `EN_SERVICIO`, `FUERA_DE_SERVICIO`, `TALLER`.
- Solo unidades `EN_SERVICIO` aparecen en `/api/public/fleet` y en la APK.
- El monitor se reorganizo en `GPS / Internos` y `Operacion de unidades`.
- El monitor administrativo usa `/api/assignments` del servidor como fuente principal; `localStorage` queda como fallback.
- Se limpiaron assignments huerfanos antiguos y quedo pendiente revisar fisicamente GPS contra internos.

### 2026-09-06 / 2026-09-14 - Android 1.1.12 a 1.1.15

- `1.1.12`: llegadas se muestran solo en panel inferior, con estados controlados por backend.
- `1.1.13`: paradas cercanas disponibles en mapa general, usando ubicacion local del telefono.
- `1.1.14`: migracion de auth a Appwrite self-hosted.
- `1.1.15`: release preparado con `USER_LOCATION_REFRESH_MS = 20_000L` y `STOP_ARRIVALS_REFRESH_MS = 15_000L`.
- La ubicacion del usuario se usa localmente en el telefono y no se envia al servidor segun lo documentado.

### 2026-09-13 / 2026-09-14 - Privacidad, eliminacion de cuenta y TTL fleet

- Se agregaron paginas publicas `/privacy` y `/delete-account`.
- Se agrego `POST /api/public/delete-account-request`.
- Las solicitudes de eliminacion quedan registradas; la eliminacion definitiva de Appwrite queda para una segunda etapa.
- Commit `c84d328` ajusto el TTL default de fleet a `15 s` para aprovechar GPS fisicos reportando cada `15 s`.
- No se modificaron CDN, ETA, stale/fresh, polling Android, polling monitor, rate limits ni Traccar en ese commit.

## Pendientes

- Alinear `.env.example` para documentar `FLEET_CACHE_TTL_SECONDS=15` en lugar de `20`, sin cambiar comportamiento.
- Comparar fisicamente el listado GPS contra internos y corregir asignaciones desde el monitor cuando corresponda.
- `santa25` / `deviceId 26` esta documentado como sin assignment.
- No ejecutar automaticamente ninguna correccion del interno `751`.
- Continuar carga de paradas reales y validar ETA con colectivos circulando.
- Validar en produccion el comportamiento real de `recently_passed`.
- Probar presencialmente `Paradas cercanas` estando a menos de `500 m` de una parada.
- Completar ficha, politicas y configuracion requerida de Google Play antes de solicitar produccion.
- Implementar la segunda etapa de eliminacion definitiva de cuenta con verificacion de identidad.
