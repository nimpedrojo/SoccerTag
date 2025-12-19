# Next Steps (Export y Offline Sync)

## Cola de export / reintento (fase futura)
- **Store `pending_exports` en IndexedDB**: guardar bundles `{ id, matchId, payload, status, attempts, lastError }`.
- **Worker o efecto en foreground**: detectar `navigator.onLine` y flush de la cola; backoff exponencial en fallos.
- **Idempotencia**: usar `matchId` + hash del payload para evitar duplicados en Google Sheets (validar en backend).
- **Visibilidad**: UI que muestre estado de export (pendiente, enviando, error).

## Google Sheets refinado
- **Estructura de hoja**: separar pestañas `meta` y `events`; normalizar columnas (period, tMatchMs, selections JSON).
- **Apps Script alternativa**: web app con validación de origen y token simple; manejo de CORS.
- **Seguridad**: mover credenciales a secretos del servidor; evitar exponer Service Account en frontend.

## PWA / offline
- **Service Worker**: cache de assets y fallback offline; trigger de sync cuando vuelve la conexión.
- **Background Sync (opcional)**: usar `SyncManager` donde esté disponible para flush de cola.

## UX / Tablet
- **Feedback inmediato**: toast al crear evento y al hacer undo.
- **Accesos rápidos**: atajos o gestos para cambiar periodo/posesión sin navegar.

## Testing
- **Unit**: hooks de timer y selections; servicios de eventos/export.
- **E2E**: flujo completo offline→online con mock de backend.
