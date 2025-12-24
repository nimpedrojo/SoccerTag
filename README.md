# SoccerTag (MVP)

Aplicación web tablet-first para etiquetado de acciones de fútbol en tiempo real, offline-first y con export a JSON / Google Sheets.

## ¿Qué es?
- UI tipo tablero con botones grandes y selección múltiple por categoría.
- Cronómetro de partido (start/pause/reset) para capturar `tMatchMs`.
- Cada acción genera un `MatchEvent` persistido inmediatamente en IndexedDB.
- Export post-partido a JSON descargable y a Google Sheets (vía backend opcional).

## Requisitos
- Node.js 18+ y npm

## Arrancar en local
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Ejecutar el frontend (Vite):
   ```bash
   npm run dev
   ```
   Abre el enlace que muestra Vite (por defecto http://localhost:5173).
3. Backend de export (Fastify):
   ```bash
   # crea .env.local (frontend) y .env (o .env.server) para backend; ver ejemplos abajo
   npm run dev:server
   ```
   Escucha en http://localhost:3000/export con CORS abierto.

### Modo depuración (local)
- Frontend (Vite/React):
  - Arranca con `npm run dev -- --host` si necesitas probar desde otra device en la red.
  - Habilita logs verbosos en el navegador: abrir DevTools → Console.
- Backend Fastify (export a Sheets) si lo usas:
  - Ejecuta con `npm run dev:server` (usa `tsx watch` sobre `server/index.ts`).
  - Build y arranque compilado: `npm run build:server` (compila a `server/dist`) y luego `npm run start:server`.
  - Usa `DEBUG=fastify* npm run dev:server` para más trazas.
  - Variables de entorno necesarias:
    - `PORT` (opcional, por defecto 3000)
    - `HOST` (opcional, por defecto 0.0.0.0)
    - `GSHEET_ID`
    - `GSHEET_CLIENT_EMAIL`
    - `GSHEET_PRIVATE_KEY` (con saltos de línea escapados `\n` o en bloque multilinea)

## Despliegue en VPS (producción)
Supone un VPS con Node 18+, firewalld/ufw permitiendo HTTP/HTTPS y dominio apuntado.

1. Copiar el código al VPS (git clone o rsync).
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Construir frontend:
   ```bash
   npm run build
   ```
4. Backend Fastify (para Google Sheets):
   ```bash
   npm run build:server
   npm run start:server
   ```
   Configurar servicio systemd para mantenerlo corriendo (ejecuta `npm run start:server` en el cwd del proyecto).
5. Servir estáticos:
   - Copiar `dist/` a `/var/www/soccertag` (por ejemplo) y servir con Nginx/Caddy.
   - Alternativa temporal: `npm run preview` detrás de proxy (no recomendado para prod).
6. Reverse proxy (ejemplo Nginx):
   - Ruta `/` → estáticos (`dist/`).
   - Ruta `/export` → backend Fastify en `localhost:3000`.
   - Forzar HTTPS (Let’s Encrypt).
7. Variables de entorno en el VPS:
   ```
   PORT=3000
   HOST=0.0.0.0
   GSHEET_ID=...
   GSHEET_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
   GSHEET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
8. PWA:
   - Asegura servir con HTTPS para habilitar service worker y modo offline.
   - Configura caché HTTP para assets estáticos (immutable).

## Estado del MVP
- UI, cronómetro, selecciones, captura y persistencia local listos.
- Export a JSON y ejemplo de backend a Google Sheets incluidos.
- Cola de reintentos offline para export: documentada en `docs/next-steps.md` (fase futura).
- Nota: el proyecto usa Service Account para Sheets; no se requiere OAuth de usuario ni refresh token (se eliminó el script de refresh).

## Entornos / .env
- Frontend: define `VITE_EXPORT_ENDPOINT` (ej. `http://localhost:3000/export`) en `.env.local`.
- Backend: usa `.env` (o variables en el entorno) con `GSHEET_ID`, `GSHEET_CLIENT_EMAIL`, `GSHEET_PRIVATE_KEY`, `PORT`, `HOST`.
- Consulta `.env.example` para ver claves y formato del `PRIVATE_KEY`.
