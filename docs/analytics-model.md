# Modelo de analytics de SoccerTag

Este documento describe el modelo de datos de analytics introducido en las fases 0, 0B y 1, así como el diccionario de campos relevante para el ETL y los endpoints de reporting.

## Tablas de catálogo

- `seasons`
  - `id` (INT, PK)
  - `code` (VARCHAR, UNIQUE): código corto de la temporada (por ejemplo `2024-25`).
  - `name` (VARCHAR): nombre descriptivo de la temporada.
  - `start_date` (DATE, nullable): fecha de inicio.
  - `end_date` (DATE, nullable): fecha de fin.
  - `created_at` (DATETIME): marca de creación.

- `teams`
  - `id` (INT, PK)
  - `code` (VARCHAR, UNIQUE, nullable): código corto opcional del equipo.
  - `name` (VARCHAR): nombre del equipo.
  - `created_at` (DATETIME): marca de creación.

- `players`
  - `id` (INT, PK)
  - `team_id` (INT, FK → `teams.id`)
  - `number` (INT, nullable): dorsal del jugador.
  - `name` (VARCHAR, nullable): nombre del jugador.
  - `created_at` (DATETIME): marca de creación.

- `event_types`
  - `id` (INT, PK)
  - `code` (VARCHAR, UNIQUE): código de evento estable para analytics.
  - `name` (VARCHAR): etiqueta mostrada en la UI.
  - `created_at` (DATETIME): marca de creación.
  - Seeds iniciales:
    - `GOAL` → `Gol`
    - `SHOT_OFF` → `Tiro fuera`
    - `SHOT_ON` → `Tiro a puerta`
    - `FOUL` → `Falta`
    - `YELLOW_CARD` → `Tarjeta amarilla`
    - `RED_CARD` → `Tarjeta roja`
    - `SUBSTITUTION` → `Cambio`

- `zones`
  - `id` (INT, PK)
  - `code` (VARCHAR, UNIQUE): código de zona basado en la cuadrícula de 1 a 12.
  - `name` (VARCHAR): etiqueta descriptiva (por ejemplo `Zona 1`).
  - `created_at` (DATETIME): marca de creación.

## matches / events (raw)

Se mantiene el modelo existente para compatibilidad, añadiendo campos de analytics:

- `matches`
  - `id` (INT, PK)
  - `match_id` (VARCHAR, UNIQUE): identificador externo del partido (UUID).
  - `created_at` (DATETIME)
  - `home_team` (VARCHAR): nombre libre del equipo local (raw).
  - `away_team` (VARCHAR): nombre libre del equipo visitante (raw).
  - `season_id` (INT, FK → `seasons.id`, nullable)
  - `date` (DATE, nullable)
  - `venue` (VARCHAR, nullable)
  - `round` (VARCHAR, nullable)
  - `home_team_id` (INT, FK → `teams.id`, nullable)
  - `away_team_id` (INT, FK → `teams.id`, nullable)
  - `notes` (TEXT, nullable)
  - `home_goals` (INT, default 0)
  - `away_goals` (INT, default 0)

- `events`
  - `id` (INT, PK)
  - `match_id` (VARCHAR): FK lógica a `matches.match_id`.
  - `period` (VARCHAR): `1T`, `2T`, etc.
  - `t_match_ms` (INT): tiempo de partido en milisegundos.
  - `t_wall` (DATETIME): timestamp absoluto.
  - `selections` (TEXT): JSON raw de la UI con la estructura:
    ```json
    {
      "evento": ["Gol"],
      "equipo": ["propio" | "rival"],
      "jugador": ["9"],
      "zona": ["1"]
    }
    ```
  - `notes` (TEXT, nullable)
  - `created_at` (DATETIME)

> Nota: `events.selections` se mantiene sin cambios para asegurar compatibilidad hacia atrás con export a JSON y otras integraciones.

## Tabla de hechos `fact_events`

Tabla normalizada (modelo estrella) construida a partir de `events` mediante un proceso ETL idempotente.

- `fact_events`
  - `id` (BIGINT, PK)
  - `source_event_id` (INT, UNIQUE): referencia al `events.id` original.
  - `match_id` (VARCHAR): copia de `events.match_id`.
  - `period` (VARCHAR): copia de `events.period`.
  - `minute` (INT, nullable): minuto de juego (`floor(t_match_ms / 60000)`).
  - `t_match_ms` (INT): copia de `events.t_match_ms`.
  - `t_wall` (DATETIME): copia de `events.t_wall`.
  - `event_type_id` (INT, FK → `event_types.id`, nullable).
  - `team_id` (INT, FK → `teams.id`, nullable).
  - `player_id` (INT, FK → `players.id`, nullable).
  - `zone_id` (INT, FK → `zones.id`, nullable).
  - `notes` (TEXT, nullable): copia de `events.notes`.
  - `created_at` (DATETIME): momento de inserción en `fact_events`.

### Índices recomendados

- `UNIQUE (source_event_id)`
- `INDEX (match_id)`
- `INDEX (match_id, period, minute)`
- `INDEX (team_id)`
- `INDEX (player_id)`
- `INDEX (zone_id)`

## Tabla `match_lineups`

Modelo de alineaciones por partido:

- `match_lineups`
  - `id` (BIGINT, PK)
  - `match_id` (VARCHAR): identificador del partido (`matches.match_id`).
  - `team_id` (INT, FK → `teams.id`)
  - `player_id` (INT, FK → `players.id`)
  - `minute_in` (INT, nullable): minuto de entrada en el campo.
  - `minute_out` (INT, nullable): minuto de salida (sustitución u otro motivo).
  - `created_at` (DATETIME)

> La lógica detallada de convocatoria y cambios se puede construir sobre esta tabla, actualizando `minute_in`/`minute_out` a partir de los eventos de tipo `Cambio` o de acciones manuales en la UI.

## Proceso ETL `events → fact_events`

Archivo: `server/etl-events.ts`  
Script: `npm run etl:events -- [--matchId <matchId>] [--since <ISO>]`

- El proceso lee eventos desde la tabla `events`:
  - Opcionalmente filtrados por `match_id` (`--matchId`).
  - Opcionalmente filtrados por `created_at >= since` (`--since` con fecha/hora en ISO).
  - Sólo se consideran eventos que no tienen aún registro en `fact_events` (se filtra por ausencia en `fact_events.source_event_id`).
- Para cada fila:
  - Parseo seguro de `events.selections` (JSON):
    - `evento` → se usa el primer valor como nombre y se busca un `event_types.name` coincidente.
    - `equipo` → se espera `propio` o `rival`; se resuelve contra `matches.home_team` / `matches.away_team`.
      - Si el equipo no existe en `teams`, se crea automáticamente (`teams.name = home_team/away_team`), manteniendo idempotencia.
    - `jugador` → dorsal (`string`); se busca en `players` por `team_id` + `number`.
    - `zona` → código de zona; se busca en `zones.code`.
  - Cálculo de `minute` como entero (`floor(t_match_ms / 60000)`).
  - Inserción en `fact_events` con `INSERT IGNORE` para mantener idempotencia basada en `source_event_id`.

### Manejo de errores y casos no resueltos

- Si no se puede parsear `selections` como JSON:
  - Se loguea un warning y se continúa con un objeto vacío.
- Mapeos que no se pueden resolver:
  - `event_type_id`, `team_id`, `player_id`, `zone_id` se insertan como `NULL`.
  - Se emiten logs de warning indicando el `event_id` y el valor sin resolver.

## Endpoints de catálogo

- `GET /catalog/event-types`
  - Devuelve: `[{ id, code, name }]`
- `GET /catalog/zones`
  - Devuelve: `[{ id, code, name }]`
- `GET /catalog/teams`
  - Devuelve: `[{ id, code, name }]`
- `GET /catalog/seasons`
  - Devuelve: `[{ id, code, name, startDate, endDate }]`
- `GET /catalog/players?teamId=<id>`
  - Devuelve: `[{ id, teamId, number, name }]`

## Endpoints de reporting

Todos basados en la tabla `fact_events`:

- `GET /reports/match/:matchId/summary`
  - Devuelve un resumen de conteos por tipo de evento y equipo:
    - `eventType`: nombre del evento (`event_types.name`).
    - `homeCount`: número de eventos asociados al equipo local.
    - `awayCount`: número de eventos asociados al equipo visitante.
    - `total`: total de eventos por tipo.

- `GET /reports/match/:matchId/timeline`
  - Devuelve la secuencia ordenada de eventos:
    - `id`: id de `fact_events`.
    - `period`
    - `minute`
    - `tMatchMs`
    - `eventType`
    - `teamName`
    - `playerNumber`
    - `playerName`
    - `zoneCode`

- `GET /reports/match/:matchId/zones`
  - Agregado por zona:
    - `zoneCode`
    - `zoneName`
    - `total`: número de eventos en esa zona.

Además, al registrar un evento desde `/api/events`:

- Si `selections.evento[0] === "Gol"` y `selections.equipo[0]` es:
  - `"propio"` → se incrementa `matches.home_goals`.
  - `"rival"` → se incrementa `matches.away_goals`.

Esta actualización de marcador se hace en la misma transacción que la inserción en `events` para mantener consistencia.

## Compatibilidad hacia atrás

- Las tablas y endpoints existentes (`matches`, `events`, `/api/matches`, `/api/events`, `/api/matches/:id/export`) se mantienen sin cambios de contrato.
- La UI sigue escribiendo en `events.selections` utilizando los mismos códigos (`evento`, `equipo`, `jugador`, `zona`).
- El modelo de analytics es adicional:
  - Se llena mediante el proceso ETL (`fact_events`).
  - Proporciona una capa estable de reporting sin romper integraciones actuales que consumen el JSON de export.
