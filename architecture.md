# Arquitectura de SoccerTag (Node + MySQL)

## Objetivo
Aplicación tablet-first para etiquetar acciones de fútbol en tiempo real, con persistencia en MySQL y exportación posterior a JSON (y Google Sheets vía backend).

## Componentes
- **Frontend estático (HTML + CSS + JS)**:
  - Servido directamente desde `public/` por Fastify.
  - UI de etiquetado con botones grandes y cronómetro en el navegador.
- **Backend Node/Fastify**:
  - Servidor HTTP (`server/index.ts`) que sirve los estáticos y expone APIs REST.
  - Migraciones mínimas para crear tablas `matches` y `events` en MySQL.
- **Persistencia en MySQL**:
  - `matches`: información básica del partido (`match_id`, equipos, fecha).
  - `events`: cada acción etiquetada con tiempo de partido, periodo y selecciones.
- **Export**:
  - JSON consolidado `{ meta, events[] }` vía `GET /api/matches/:id/export`.
  - Ruta `/export` usando cliente de Google Sheets (`server/sheets/client.ts`) para escritura remota.

## Flujo de datos
1. El frontend llama a `POST /api/matches` al iniciar un partido; el backend genera `matchId` y crea la fila en `matches`.
2. Durante el juego, cada vez que se etiqueta una acción:
   - El navegador calcula `tMatchMs` con el cronómetro.
   - Se hace `POST /api/events` con `matchId`, `period`, `tMatchMs` y las selecciones.
   - El backend inserta una fila en `events`.
3. “Undo last” llama a `DELETE /api/events/last?matchId=...`, que borra el último evento del partido usando transacción.
4. Al terminar: se puede leer `{ meta, events }` mediante `GET /api/matches/:id/export` y descargarlo o enviarlo a Sheets.

## Modelo de datos (conceptual)
```ts
interface MatchMeta {
  matchId: string;
  createdAt: string;
  teams: { home: string; away: string };
  configVersion: number;
}

interface MatchEvent {
  matchId: string;
  period: "1T" | "2T";
  tMatchMs: number;
  tWall: string;
  selections: {
    [category: string]: string[];
  };
  notes?: string;
}
```

## Principios clave
- **Tablet-first**: layout fijo, botones grandes, mínimo scroll.
- **Simplicidad**: frontend estático sin bundler; solo Node + MySQL.
- **Event-based**: cada acción es un evento independiente, fácilmente exportable y analizable.
