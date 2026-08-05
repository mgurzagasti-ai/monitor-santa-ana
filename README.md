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
