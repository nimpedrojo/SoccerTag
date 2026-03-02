# Estructura de proyecto (Node + MySQL)

Pensado para un servidor Node/Fastify sencillo, frontend estático y persistencia en MySQL.

```
/
├─ public/              # Frontend estático (index.html, styles.css, app.js)
├─ server/              # Backend Node/Fastify
│  ├─ index.ts          # Entrada principal del servidor
│  ├─ db.ts             # Conexión a MySQL y migraciones mínimas
│  ├─ routes/
│  │  ├─ app.ts         # APIs de dominio (matches, events, export JSON)
│  │  └─ export.ts      # Ruta /export para Google Sheets
│  └─ sheets/           # Cliente de Google Sheets (Service Account)
├─ docs/                # Documentación (arquitectura, decisiones)
├─ README.md            # Guía de uso y despliegue
├─ package.json         # Scripts npm y dependencias
└─ tsconfig.server.json # Configuración de TypeScript para el servidor
```

Responsabilidades clave
- `public/index.html`: layout básico tablet-first con cronómetro y tablero de botones.
- `public/app.js`: lógica de UI y llamadas `fetch` a las APIs.
- `server/db.ts`: conexión a MySQL y creación de tablas `matches` y `events`.
- `server/routes/app.ts`: creación de partidos, registro de eventos, undo y export JSON.
- `server/routes/export.ts` + `server/sheets/client.ts`: integración opcional con Google Sheets.
