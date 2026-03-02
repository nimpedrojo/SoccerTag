# SoccerTag (Node + MySQL)

Aplicación web tablet-first servida completamente desde Node.js, con persistencia en MySQL y export a JSON (y backend para Google Sheets opcional).

## ¿Qué es?
- UI tipo tablero con botones grandes para etiquetar acciones de partido.
- Cronómetro en el navegador (start/pause/reset) para capturar el tiempo de partido.
- Flujo de partido: inicio con nombres de equipos, captura de eventos durante el juego y cierre de partido.
- Cada acción genera un evento persistido en MySQL (tablas `matches` y `events`).
- Export post-partido a JSON descargable; el servidor sigue incluyendo la ruta `/export` para integración con Google Sheets.

## Requisitos
- Node.js 18+ y npm  
- MySQL 8+ con una base de datos creada (por ejemplo `soccertag`)

Variables de entorno mínimas para desarrollo:

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=tu_usuario
export DB_PASSWORD=tu_password
export DB_NAME=soccertag
```

> Nota: si usas export a Google Sheets, además necesitarás `GSHEET_ID`, `GSHEET_CLIENT_EMAIL` y `GSHEET_PRIVATE_KEY` como antes.

## Arrancar en local
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Arrancar el servidor Fastify (desarrollo, con recarga):
   ```bash
   npm run dev:server
   ```
3. Abre en el navegador:
   ```text
   http://localhost:3000/
   ```

Al arrancar, el servidor ejecuta migraciones mínimas y crea las tablas si no existen:
- `matches(match_id, created_at, home_team, away_team, ...)`
- `events(match_id, period, t_match_ms, t_wall, selections JSON, notes, created_at, ...)`

## Flujo de uso (MVP)
1. Abre `http://localhost:3000/` (idealmente en una tablet en landscape).
2. Introduce los nombres de equipos (local / visitante) y pulsa **Iniciar partido**.
3. Usa el cronómetro (Iniciar / Pausar / Reset) mientras se juega el partido.
4. Etiqueta acciones utilizando los botones del tablero (ejemplo: Gol, Tiro fuera, Bloque alto, etc.).
5. Cada vez que quieras registrar una acción, pulsa **Registrar evento** (se guarda una fila en `events` ligada al `matchId`).
6. Si te equivocas, pulsa **Undo último** para eliminar el último evento del partido en MySQL.
7. Al terminar el encuentro pulsa **Finalizar partido**; el `matchId` sigue disponible para export.
8. En el panel de export, introduce un `matchId` y pulsa **Export JSON** para obtener `{ meta, events[] }` desde MySQL.

## Endpoints principales
- `POST /api/matches`  
  Crea un partido nuevo. Body:
  ```json
  { "home": "Equipo local", "away": "Equipo visitante" }
  ```
  Respuesta:
  ```json
  { "matchId": "..." }
  ```

- `POST /api/events`  
  Registra un evento:
  ```json
  {
    "matchId": "...",
    "period": "1T",
    "tMatchMs": 123456,
    "selections": { "tiros": ["Gol"], "defensa": ["Bloque alto"] },
    "notes": "opcional"
  }
  ```

- `DELETE /api/events/last?matchId=...`  
  Elimina el último evento del partido.

- `GET /api/matches/:id/export`  
  Devuelve `meta` + `events[]` desde MySQL listo para exportar/analizar.

## Despliegue en VPS (producción)
1. Copiar el código al VPS (git clone o rsync).
2. Configurar MySQL y las variables de entorno (`DB_HOST`, `DB_USER`, etc.).
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Compilar y arrancar el servidor:
   ```bash
   npm run build:server
   npm run start:server
   ```
5. Servir tras un reverse proxy (Nginx/Caddy) apuntando `https://tu-dominio` → `localhost:3000`.

## Estado del MVP
- UI básica servida desde `/public` (sin React/Vite).
- Persistencia de partidos y eventos en MySQL funcionando.
- Export a JSON disponible vía `GET /api/matches/:id/export`.
-,Opcional: ruta `/export` sigue lista para integrar con Google Sheets mediante Service Account.
