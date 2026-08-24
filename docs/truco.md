# Truco Argentino — Developer Guide

Truco Argentino is Geotano's second game: a 1v1 Spanish-deck card game playable vs CPU or a friend. This guide covers how the pieces fit together and how to change them safely. For general repo commands and conventions, see `.github/copilot-instructions.md`.

```
packages/shared/src/truco/        Pure rules engine (zero deps, zero I/O)
apps/backend/src/services/trucoService.ts   Server-authoritative state host
apps/backend/src/routes/truco.ts            REST + socket push layer
apps/frontend/src/features/truco/           Menu, table UI, AI, hooks
```

## Starting a match

**vs CPU (offline, no network):** Home → Truco (`/truco`) → pick difficulty, target points, persona → Start. `TruCpuPage` drives everything through `useTruCpuGame`, which runs the shared engine in-process with a seeded RNG. Difficulty/target/persona persist in localStorage (`truco-prefs-v1`); results accumulate in `truco-cpu-stats-v1`.

**vs friend:** From `/truco`, either create an invite (pick target → POST `/api/truco/matches` with `friendId`; friend gets a `truco:invite` push) or enter a 6-char room code to join. The creator sees Start once the lobby is ready; only the creator can start (see [Guardrails](#guardrails-worth-keeping)). Matches are routed at `/truco/match/:matchId` and driven by `useTrucoMultiplayer`.

## Engine architecture

The engine lives in `packages/shared/src/truco` and is consumed identically by the frontend CPU controller and the backend validator — one source of truth for rules. Modules are layered bottom-up (**S6 layering**; enforced by review, keep it that way):

| Tier | Modules | Imports |
|---|---|---|
| Foundation | `types`, `deck` (40-card deck), `hierarchy` (`TIER_TABLE`, `compareCards`), `envido` (hand values), `rng` (`mulberry32`, Fisher-Yates shuffle) | nothing intra-module |
| Middle | `state` (transitions table, betting substate), `events` (discriminated union), `errors` (`E_*` taxonomy) | foundation only |
| Top | `engine` (`createMatch`, `applyAction`), `legalActions`, `view` (`buildView`, `buildCpuDecisionInput`) | middle + foundation |

Key properties:

- **Determinism**: randomness enters ONLY via the injected `Rng` and ONLY at deal boundaries; mid-hand actions never consume it. Same seed ⇒ identical match.
- **Purity**: `applyAction(state, action)` never mutates. A rejected action returns the ORIGINAL state reference unchanged; accepted transitions produce a new state object.
- **State machine**: `TRANSITIONS` maps each phase (`waiting_for_players`, `dealing`, `playing`, `envido_betting`, `truco_betting`, `hand_end`, `match_end`) to its legal action types. `legalActions(publicCtx, slot)` derives the concrete legal moves from public context only — it can enumerate answers without leaking hidden info.
- **Actions**: `{type:'play_card', card}`, envido/truco sings (`sing_envido` … `sing_vale_cuatro`), and answers (`quiero` / `no_quiero`). Every illegal move yields a typed `E_*` error (`E_OUT_OF_TURN`, `E_ENVIDO_WINDOW_CLOSED`, `E_TRUCO_WINDOW_CLOSED`, `E_ILLEGAL_RAISE_ORDER`, `E_AWAITING_OWN_BET`, …).
- **Views**: `buildView(state, viewerSlot)` redacts the opponent hand and unresolved opponent envido into a per-viewer DTO; both players' public info is byte-identical.

## Modifying rules safely

Change the engine in `packages/shared/src/truco`, never in app code. Each rule family has a guarding suite under `packages/shared/src/truco/__tests__/`:

| Rule family | Engine file | Guarding tests |
|---|---|---|
| Deck composition, shuffling, RNG | `deck.ts`, `rng.ts` | `deck.test.ts`, `rng.test.ts` |
| Card strength tiers, pardas | `hierarchy.ts` | `hierarchy.test.ts` |
| Envido hand values | `envido.ts` | `envido.test.ts` |
| Phases, turn flow, bazas/parda cascade | `state.ts`, `engine.ts` | `stateMachine.test.ts`, `engine.test.ts` |
| Envido chain + stake matrix + Falta Envido | `state.ts`, `engine.ts` | `envidoBets.test.ts` |
| Truco/Retruco/Vale Cuatro chain, deadlines | `state.ts`, `engine.ts` | `trucoBets.test.ts` |
| Legal-move enumeration, view redaction, CPU firewall | `legalActions.ts`, `view.ts` | `legalActions.test.ts`, `view.test.ts` |
| Deterministic replay, full-error-taxonomy sweep | all | `determinism.test.ts` |

Workflow: add/adjust the GWT cases FIRST (strict TDD), then change the engine, then run the shared suite. If a rule change affects what clients may send, check `legalActions.test.ts` (client gating follows it automatically) and the backend rejection tests (`apps/backend/src/__tests__/trucoService.test.ts`, `truco.routes.test.ts`). Never special-case rules in UI or AI code — the ActionBar renders exclusively from `legalActions`, and the AI decides through it too.

## CPU AI

Location: `apps/frontend/src/features/truco/ai/`. Contract (`types.ts`):

```ts
interface TrucoAi {
  decide(input: CpuDecisionInput, rng: Rng): TrucoAction;
  readonly thinkDelayMs: number; // fixed constant, never wall-clock
  readonly thinkDelayFor?: (handNumber: number) => number; // optional per-hand pacing
}
```

**Fairness firewall**: the input passed to `decide` comes from the shared `buildCpuDecisionInput`, which structurally omits the opponent's hand, deck order, and unresolved opponent envido. AIs are pure functions over that input plus the injected rng — cheating is impossible by construction, and seeded matches replay identically. Legal options always come from the engine's `legalActions`; AIs never hand-roll rules.

Difficulties:

- `easy.ts` — uniform-ish card play, rarely sings/folds strategically, 700 ms think delay.
- `medium.ts` — tier heuristics (bets with strong hands, folds junk, sings envido ≥27), 450 ms delay.
- `hard.ts` — counts played cards, saves top cards for the third baza, bluffs within a bounded band, marker-aware Falta Envido discipline; rotates a fixed per-hand delay table (520/640/760 ms by hand number) via `thinkDelayFor`.

Statistical contracts (distinctness, bounded bluff rates, never-illegal moves) are pinned by `ai/__tests__/ai.test.ts`.

### Adding a new difficulty

1. Create `apps/frontend/src/features/truco/ai/<name>.ts` exporting a `TrucoAi` object (pure `decide` + fixed `thinkDelayMs` constant). Use `cpuOptions(input)` from `types.ts` for legal moves and `pick(items, rng)` for reproducible choices.
2. Extend `Difficulty` in `ai/types.ts` and return your implementation from `createAi` in `ai/index.ts`.
3. Add i18n keys `truco.difficulty.<name>` (+ label/description families used by the menu) in **both** `i18n/en.json` and `i18n/es.json`.
4. Add contract tests in `ai/__tests__/ai.test.ts`: purity (same input+seed ⇒ same action), never-illegal over seeded games, and pairwise separation bounds vs existing difficulties.
5. The menu picker reads the union of difficulties — no other UI changes needed if you reuse the difficulty label keys.

## Multiplayer flow

One Postgres row per match (`truco_matches`): `engine_state` JSONB (`{schemaVersion:1, state}`), monotonic `version`, room code, players, status. Migration is an idempotent inline SQL block (`-- 0009`) inside `apps/backend/src/db/index.ts` — repo convention, not drizzle-kit.

Action lifecycle (all REST, authenticated):

1. Client POSTs `/api/truco/matches/:id/actions` with `{expectedVersion, action}`.
2. `trucoService.applyTrucoAction` runs the shared engine server-side; the actor comes from the JWT, never the body. Rejected actions pass through as HTTP 400 with the engine's `E_*` code and no mutation/version bump.
3. Persist uses compare-and-swap: `UPDATE ... SET version = old + 1 ... WHERE id = $id AND version = $expectedVersion`. `rowCount 0` ⇒ 409 `version_conflict`.
4. On success the route emits `truco:state-changed {matchId, version, reason}` (and `truco:finished {matchId, winnerUserId}`) — **IDs/metadata only, never hands**. Hands reach clients exclusively via the redacted per-viewer GET DTO (`buildView`). A verbatim retry after success hits 409, so actions can never double-apply.

Client (`useTrucoMultiplayer`): TanStack Query owns server state; pushes trigger invalidation only; a 409 recovers by refetching authority instead of mutating locally. Poll fallback lives ON THE QUERY as `refetchInterval: 10_000` (S5 decision — deliberately not a raw `setInterval`; do not revert). Reloading restores the exact position from GET — including a pending truco answer — and there is no auto-forfeit. Unfinished/finished rows are swept hourly after 24 h (`deleteExpiredTrucoMatches`).

Presence: `user:online/offline` is broadcast only to friends, so the opponent indicator shows online/offline for friends and honest `unknown` for code-joined strangers.

## Routing between Geotano and Truco

Routes (in `apps/frontend/src/app/App.tsx`, inside the authed shell):

- `/truco` → `TrucoMenuPage` · `/truco/cpu` → `TruCpuPage` · `/truco/match/:matchId` → `TrucoMatchPage`

Touchpoints, all additive:

- `AppShell.tsx`: nav item `{to:'/truco', label:'truco.title'}`.
- `features/quiz/HomePage.tsx`: one button below the greeting → `/truco`.
- `TrucoMenuPage`: reciprocal "Geotano" button → `/`.
- End screens (CPU and multiplayer): Play Again / Change Mode (`/truco`) / Back (history) / Geotano (`/`).

Multiplayer Play Again is a rematch: re-create a match with `{friendId: opponentUserId}` and navigate to the new route (code-joined strangers fall back to `/truco`, since friendship is required server-side). Guarding tests: `crossGameNav.test.tsx`, plus the untouched `AppShell.test.tsx` / `HomePage.test.tsx`.

## Running tests

```bash
pnpm test                 # everything (turbo: shared + backend + frontend)
pnpm test:backend         # apps/backend
pnpm test:frontend        # apps/frontend

# Single file — note the `exec` form (required for @geotano/shared on Windows)
pnpm --filter "@geotano/shared" exec vitest run src/truco/__tests__/envidoBets.test.ts
pnpm --filter @geotano/backend vitest run src/__tests__/truco.routes.test.ts
pnpm --filter @geotano/frontend vitest run src/__tests__/i18nParity.test.ts

# Single case by name
pnpm --filter @geotano/backend vitest run -t "should reject a guest start"

pnpm build && pnpm lint && pnpm check-types
```

The engine suites are seeded and deterministic; AI statistical tests use fixed sample counts sized to spec minimums so the whole frontend suite stays fast.

## i18n parity gate

All user-facing text goes through i18next keys in BOTH `apps/frontend/src/i18n/en.json` and `es.json`. `src/__tests__/i18nParity.test.ts` recursively diffs the key sets and fails listing missing keys — any new `truco.*` key must land in both files in the same change. Truco strings live under the `truco.*` family.

## Guardrails worth keeping

These were deliberate, tested decisions during the original build — don't regress them casually:

- **W1 — creator-only start**: `POST /api/truco/matches/:id/start` returns 403 `FORBIDDEN` for the guest; the UI mirrors it (guest sees waiting state, no start control). Pinned by name in `trucoService.test.ts`, `truco.routes.test.ts`, and match-page tests.
- **S3 — code lookup endpoint**: `GET /api/truco/matches/code/:code` is an additive convenience beyond the delta-spec minimum (join pre-check; returns public-minimal `{matchId,status}`). It is comment-marked in `routes/truco.ts` so archive keeps it intentionally.
- **S4 — default target 30**: `targetPoints` is optional client-side; the server defaults to 30. The engine pins the same default.
- **S5 — query-native poll fallback**: `refetchInterval: 10_000` on the match query, not `setInterval`. See the header comment in `useTrucoMultiplayer.ts` before touching it.
