# API REST funcional

## Flujo actual

```text
GPS Ruptela Trace5
        |
     Traccar
        |
 Vercel API /api/fleet
        |
 Monitor web

 Vercel API /api/public/fleet
        |
 APK de usuarios
```

El monitor consulta la API privada publicada en Vercel:

```text
https://monitor-santa-ana.vercel.app/api/fleet
```

La APK consulta la API publica:

```text
https://monitor-santa-ana.vercel.app/api/public/fleet
```

Ambas rutas usan la misma lectura central de flota, que combina:

- Posicion GPS actual desde Traccar.
- Asignacion operativa desde Upstash Redis.
- Datos de linea, interno, color, velocidad y estado GPS.
- Cache de flota para evitar que cada usuario consulte Traccar.

Cuando el operador cambia una asignacion desde el monitor:

```text
Monitor web
   |
PATCH /api/assignments
   |
Vercel guarda en Upstash Redis
   |
borra el cache de flota
   |
/api/fleet y /api/public/fleet devuelven la nueva linea/interno
   |
Monitor y APK actualizan
```

La APK no consulta Upstash directamente. En el flujo normal consulta solo:

```text
APK -> https://monitor-santa-ana.vercel.app/api/public/fleet
```

## Estado actual

La API REST ya es funcional y esta en produccion:

- `/api/fleet`: ruta privada del monitor; devuelve unidad con posicion, linea, interno, velocidad y diagnostico GPS.
- `/api/assignments`: ruta privada; permite leer y actualizar la asignacion GPS/interno/linea.
- `/api/public/fleet`: ruta publica para APK; devuelve flota cacheada.
- `/api/public/lines`: ruta publica para APK; devuelve lineas con cantidad de unidades activas.
- `/api/public/line/[lineId]`: ruta publica para APK; devuelve una linea y sus unidades activas.
- `/api/line-routes`: devuelve recorridos de lineas.
- `/api/route`: devuelve historial GPS reciente.

Tambien ya esta configurado:

- Vercel como hosting de produccion.
- Variables sensibles fuera del repositorio.
- Upstash Redis para persistir asignaciones.
- Upstash Redis para cachear flota por `FLEET_CACHE_TTL_SECONDS`.
- Seguridad del monitor con `MONITOR_OPERATOR_PASSWORD`.
- APK apuntando a `https://monitor-santa-ana.vercel.app`.
- Refresco de la APK cada 60 segundos para reducir carga.

## Pendientes para robustez con muchos usuarios

Ya quedaron implementadas las tres bases de produccion:

- Cache de flota en Redis/memoria.
- Endpoints publicos separados de endpoints operativos.
- Monitor y asignaciones protegidos por clave.

El flujo de cache es:

```text
/api/fleet o /api/public/fleet
   |
lee cache Upstash
   |
si hay dato reciente, responde cache
   |
si no hay dato reciente, consulta Traccar
   |
guarda cache
   |
responde
```

Con ese flujo, aunque entren muchos usuarios, Traccar no recibe una consulta por cada usuario. Recibe como maximo una consulta cada pocos segundos.

Queda recomendado para la siguiente etapa:

- Agregar rate limit por IP si el trafico crece.
- Ejecutar pruebas k6 por etapas antes de ir a miles de usuarios.
- Rotar el token de Upstash que aparecio en capturas y actualizar Vercel.
- Usar una clave fuerte en `MONITOR_OPERATOR_PASSWORD`.
