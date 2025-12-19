# Estructura de proyecto (MVP)

Pensado para Vite + React + TS, PWA offline-first y export post-partido.

```
/
├─ src/                 # Frontend (React)
│  ├─ app/              # Layout raíz, rutas y providers (theme, db init, pwa)
│  ├─ components/       # UI reutilizable (botones grandes, grids, modales)
│  ├─ features/
│  │  ├─ match/         # Inicio/fin de partido, metadata, periodo
│  │  ├─ timer/         # Hook y UI de cronómetro
│  │  ├─ selections/    # Estado de selecciones multi-categoría
│  │  └─ events/        # Crear/guardar eventos, undo, listado
│  ├─ services/         # Lógica de dominio: createMatchEvent, export, retry
│  ├─ db/               # IndexedDB wrapper (idb), esquemas y migrations
│  ├─ pwa/              # Service worker, manifest, offline assets
│  ├─ styles/           # CSS base, variables, layout tablet
│  ├─ config/           # Config estática (categorías, layout de botones)
│  ├─ lib/              # Utilidades (uuid, time helpers)
│  └─ types/            # Tipos compartidos (MatchEvent, MatchMeta, etc.)
│
├─ public/              # Iconos PWA, manifest.webmanifest, splash
├─ docs/                # Documentación (arquitectura, decisiones)
├─ scripts/             # Scripts CLI (ej: export local a JSON)
└─ server/ (fase export) # Node/Fastify o Next API para envío a Google Sheets
   ├─ sheets/           # Cliente de Google Sheets (Service Account)
   ├─ routes/           # Endpoints de import/export
   └─ config/           # Credenciales/entornos (no versionar secretos)
```

Responsabilidades clave
- `src/features/timer`: hook start/pause/reset y cálculo fiable de `tMatchMs`.
- `src/features/selections`: estado por categoría con toggle múltiple y reset.
- `src/features/events`: `createMatchEvent`, persistencia inmediata, undo last.
- `src/services/export`: generación de JSON `{ meta, events[] }` y envío (cola/reintento).
- `src/db`: setup de IndexedDB con stores `match_meta`, `match_events`, `pending_exports`.
- `server/`: capa opcional para Google Sheets (Service Account o Apps Script proxy).
