# API REST funcional

## Flujo actual

```text
GPS Ruptela Trace5
        |
     Traccar
        |
 Vercel API /api/fleet
        |
 Monitor web y APK
```

La APK y el monitor consultan la API publicada en Vercel:

```text
https://monitor-santa-ana.vercel.app/api/fleet
```

`/api/fleet` combina:

- Posicion GPS actual desde Traccar.
- Asignacion operativa desde Upstash Redis.
- Datos de linea, interno, color, velocidad y estado GPS.

Cuando el operador cambia una asignacion desde el monitor:

```text
Monitor web
   |
PATCH /api/assignments
   |
Vercel guarda en Upstash Redis
   |
/api/fleet devuelve la nueva linea/interno
   |
Monitor y APK actualizan
```

La APK no consulta Upstash directamente. En el flujo normal consulta solo:

```text
APK -> https://monitor-santa-ana.vercel.app/api/fleet
```

## Estado actual

La API REST ya es funcional y esta en produccion:

- `/api/fleet`: devuelve la unidad con posicion, linea, interno, velocidad y diagnostico GPS.
- `/api/assignments`: permite leer y actualizar la asignacion GPS/interno/linea.
- `/api/line-routes`: devuelve recorridos de lineas.
- `/api/route`: devuelve historial GPS reciente.

Tambien ya esta configurado:

- Vercel como hosting de produccion.
- Variables sensibles fuera del repositorio.
- Upstash Redis para persistir asignaciones.
- APK apuntando a `https://monitor-santa-ana.vercel.app`.
- Refresco de la APK cada 60 segundos para reducir carga.

## Pendientes para robustez con muchos usuarios

Para muchos usuarios concurrentes, todavia conviene mejorar:

- Cachear `/api/fleet` en Upstash Redis por 10-15 segundos.
- Evitar que cada usuario dispare una consulta nueva a Traccar.
- Agregar rate limit basico.
- Proteger `/api/assignments` para que solo operadores puedan cambiar asignaciones.
- Separar endpoints publicos de endpoints operativos.
- Ejecutar pruebas k6 por etapas antes de ir a miles de usuarios.

La mejora mas importante es cachear `/api/fleet`:

```text
/api/fleet
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
