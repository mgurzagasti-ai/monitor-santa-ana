# Santa Ana Fleet Monitor

Panel web Next.js para monitorear la flota desde Traccar.

## Uso

1. Instalar dependencias:

```powershell
npm install
```

2. Ejecutar en desarrollo:

```powershell
npm run dev
```

3. Abrir la URL que muestre la consola. Por defecto intenta `http://localhost:3002` y, si esta ocupado, busca otro puerto libre.

Tambien se puede iniciar con doble clic desde Windows:

```cmd
start-web-monitor.cmd
```

Si la carpeta `web-monitor` esta dentro de `E:\AppColectivos\BusTracker_Android`, la API puede leer la configuracion Traccar desde `../local.properties`. Si se copia a otro lugar, crear `.env.local` usando `.env.example`.

## Pruebas de carga con k6

Instalar k6 desde https://k6.io/docs/get-started/installation/ y ejecutar contra una instancia local o de pruebas:

```powershell
k6 run .\load-tests\monitor-api.k6.js
```

Modos disponibles:

```powershell
$env:BASE_URL="http://localhost:3002"; $env:MODE="load"; k6 run .\load-tests\monitor-api.k6.js
$env:BASE_URL="http://localhost:3002"; $env:MODE="stress"; k6 run .\load-tests\monitor-api.k6.js
$env:BASE_URL="http://TU_SERVIDOR"; $env:MODE="fivek"; k6 run .\load-tests\monitor-api.k6.js
```

No conviene empezar directo con `MODE=fivek` contra una PC local ni contra Traccar demo. `/api/fleet` y `/api/route` consultan Traccar por detras, asi que una prueba grande tambien carga ese servicio. Para 5000 usuarios, usar un servidor de staging/produccion, monitorear CPU/RAM/red y subir por etapas.
