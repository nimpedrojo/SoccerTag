# Arquitectura de SoccerTag (MVP)

## Objetivo
Aplicación tablet-first para etiquetar acciones de fútbol en tiempo real, offline-first, con exportación posterior a JSON y Google Sheets.

## Componentes
- **Frontend (React + Vite + TS + PWA)**: UI de etiquetado con botones grandes; cronómetro; selección múltiple; capa de servicios para eventos.
- **Persistencia local (IndexedDB vía `idb`)**: Guarda `MatchMeta` y cada `MatchEvent` de forma inmediata (append-only) y permite undo del último evento.
- **Sin backend en vivo**: El etiquetado funciona 100% local; la red solo se usa en export.
- **Export**:
  - JSON consolidado `{ meta, events[] }`.
  - Opción A: Endpoint Node/Fastify (Service Account) para escribir en Google Sheets.
  - Opción B: Google Apps Script (web app) para evitar backend propio.
- **PWA / sincronización**: Service worker para cache de assets; cola/reintento de export cuando vuelve la conexión.

## Flujo de datos
1. Se crea `MatchMeta` al iniciar partido y se guarda en IndexedDB.
2. Durante el juego: cada acción produce `MatchEvent` con `tMatchMs` y `tWall`; se persiste inmediatamente.
3. “Undo last” elimina el último evento del match en la base local (no toca la metadata).
4. Al terminar: se lee `{ meta, events }` → se genera JSON descargable y/o se POSTea al backend/Apps Script. Si no hay red, se encola y reintenta al volver online.

## Modelos (obligatorio)
```ts
interface MatchEvent {
  eventId: string;            // UUID
  matchId: string;
  period: "1T" | "2T";
  tMatchMs: number;           // tiempo de partido en ms
  tWall: string;              // ISO timestamp real
  selections: {
    [category: string]: string[];
  };
  notes?: string;
}

interface MatchMeta {
  matchId: string;
  createdAt: string;
  teams: { home: string; away: string };
  configVersion: number;
}
```

## Principios clave
- **Tablet-first**: layout fijo, botones grandes, mínimo scroll.
- **Offline-first**: ningún evento depende de la red; todo se guarda local.
- **Event-based**: cada acción es un evento independiente; se evita estado global complejo.
- **Simplicidad evolutiva**: modular, sin sobre-ingeniería en el MVP.
