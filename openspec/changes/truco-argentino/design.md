# Design: Truco Argentino

## Technical Approach

Hybrid architecture per proposal: one pure-TS engine in `@geotano/shared/src/truco` consumed by BOTH the client-side CPU controller and the server-authoritative multiplayer validator; Postgres JSONB row + monotonic `version` per multiplayer match; REST actions validated through the engine; additive `truco:*` socket pushes over the existing single connection with ≤10s poll fallback. Zero new runtime dependencies. All quiz surfaces receive additive-only edits (nav item, HomePage button, route siblings). Strict TDD: engine GWT scenarios green before any UI/backend work.

## Architecture Decisions

### D1: Engine location & packaging
**Choice**: `packages/shared/src/truco/`, source-exported via existing barrel (`src/index.ts` gains `export * from './truco/index.js'`). Add `"test": "vitest run"` to `packages/shared/package.json` (vitest devDep already present; root `pnpm test` → turbo picks it up automatically).
**Rejected**: separate `packages/truco-engine` package (proposal already rejected; premature).
**Rationale**: shared pkg is consumed identically by both apps today (`workspace:*`, TS source exports).

### D2: State machine encoding
**Choice**: single flat `TrucoState` interface with explicit `phase: TrucoPhase` field + exported `TRANSITIONS: Record<TrucoPhase, readonly TrucoActionType[]>` table; `applyAction` dispatches via exhaustive `(phase, action.type)` switch; guards per action produce typed errors. `legalActions(ctx, playerId)` reads the same table + guard predicates.
**Rejected**: discriminated union of whole-state variants.
**Rationale**: flat shape serializes to JSONB losslessly, redaction (`buildView`) handles one shape, versioning migrates one shape; the spec mandates a queryable transition table derivable from `(phase, action)` — a union-of-states would force N×M mapping anyway. No hidden branches: every rejection names a code.

### D3: Determinism & RNG injection
**Choice**: `type Rng = () => number`; injected ONLY at creation/deal boundaries: `createMatch(opts, rng)` and hand transitions triggered by explicit `deal` semantics inside `applyAction` receive `rng` via optional third arg (`deps?: { rng }`). After each deal, concrete hands + remaining deck array live INSIDE state, so all mid-match actions are RNG-free → server replays are deterministic without persisting an RNG function. `mulberry32(seed)` provided in `shared/truco/rng.ts` for CPU/tests; backend passes crypto-based rng at `start`.
**Rejected**: storing seed and lazily shuffling (leaks future deck to clients via any state export; complicates resume).

### D4: Action/result/error model
```ts
type EngineResult =
  | { ok: true;  state: TrucoState; events: TrucoEvent[] }
  | { ok: false; errorCode: TrucoErrorCode; message?: string };
```
No throws; rejected action returns the ORIGINAL state reference untouched (side-effect-free per spec). `TrucoErrorCode` = exactly the spec taxonomy (`E_OUT_OF_TURN … E_STATE_FORBIDDEN`). `TrucoEvent` discriminated union (`card_played | call_sung | answered | envido_showdown | baza_resolved | points_awarded | hand_ended | match_ended`) drives UI call-feedback and backend `reason`.

### D5: Rules encoding highlights
- Hierarchy: `TIER_TABLE: Record<CardId, 1..14>` + `compareCards(a,b) => 'win1'|'win2'|'parda'`; equality = parda.
- Envido: `computeEnvido(hand)` (20 + best two suited values; figure=0; three-suited ignores lowest). Chain modeled as accumulating substate `{ openBet?, stake, lastRaise, awaitingResponder }`; refusal pays `stake - lastRaise` (first-bet refusal pays 1); falta formula computed AT settlement: `target − max(scores)`; comparison tie → mano.
- Pending-truco resurfacing: while envido_betting runs, `pendingTruco` stays parked in state; settle → if match continues and pendingTruco exists → phase `truco_betting` same responder; if envido award ended match → voided.
- Bazas cascade: encoded exactly as spec items 1–6; all-parda → mano wins; parda keeps leader.
- Scoring: envido settles first; every award checks `score >= target` → immediate `match_end`, voiding later phases.

### D6: Versioning of persisted state
JSONB column stores `{ schemaVersion: 1, state: TrucoState }`. Read path validates wrapper; forward-migration function stub `migrateState(v, raw)` (identity at v1).

### D7: DB schema (single durable row)
New `apps/backend/src/db/schema/trucoMatches.ts` + migration appended to the INLINE idempotent SQL in `src/db/index.ts runMigrations()` as block `-- 0009: Truco matches` (this IS the repo convention — drizzle-kit config exists but migrations 0004–0008 are inline; follow it, do not introduce drizzle-kit flow).

```sql
CREATE TABLE IF NOT EXISTS "truco_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "host_player_id" uuid NOT NULL REFERENCES "users"("id"),
  "guest_player_id" uuid REFERENCES "users"("id"),
  "status" text DEFAULT 'waiting' NOT NULL,        -- waiting|ready|playing|finished
  "target_points" integer DEFAULT 30 NOT NULL,
  "engine_state" jsonb,                            -- null until start deals hand 1
  "version" integer DEFAULT 0 NOT NULL,
  "winner_user_id" uuid REFERENCES "users"("id"),
  "finished_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "truco_matches_code_active_idx"
  ON "truco_matches" ("code") WHERE "status" IN ('waiting','ready','playing');
CREATE INDEX IF NOT EXISTS "truco_matches_host_idx" ON "truco_matches" ("host_player_id");
CREATE INDEX IF NOT EXISTS "truco_matches_status_updated_idx" ON "truco_matches" ("status", "updated_at");
```
JSONB-vs-columns: JSONB chosen (proposal decision) — one-row atomic swap beats multi-column transactions; scores/status duplicated as columns only for cheap cleanup queries. TTL: `deleteExpiredTrucoMatches()` (24h on `updated_at`, unfinished AND finished retention) registered beside `deleteExpiredMatches` in `index.ts` hourly cleanup.

### D8: Backend service & route table
`services/trucoService.ts`: `generateRoomCode()` (crypto.randomBytes mapped onto 32-char alphabet `[A-HJ-NP-Z2-9]`, insert-retry on unique violation), `createMatch`, `joinByCode`, `startMatch` (engine createMatch+deal, version→1), `applyPlayerAction` (transaction: SELECT row → ownership/status → `engine.applyAction(stored.state, action)` → E\*→400 mapping → `UPDATE … SET engine_state=$new, version=$old+1, status=$derived WHERE id=$id AND version=$expected`; rowCount 0 ⇒ 409 `version_conflict` → persist winner/finishedAt when `match_end`), `getMatchView(matchId, viewerId)` → `buildView`, `deleteExpiredTrucoMatches`.

| Method/Path | Auth | Body | 2xx | Errors |
|---|---|---|---|---|
| POST `/api/truco/matches` | authGuard | `{targetPoints:15\|30, friendId?}` | `{matchId, code, status:'waiting'}` (+`truco:invite` if friendId; friendship REQUIRED on invite path like challenge flow) | 400 MISSING_FIELD, 403 NOT_FRIENDS |
| GET `/api/truco/matches/code/:code` | authGuard | – | `{matchId,status}` public-minimal (join UX pre-check) | 404 CODE_NOT_FOUND |
| POST `/api/truco/matches/code/:code/join` | authGuard | – | `{matchId}` → status ready, emit player-joined | 404, 409 match_not_joinable |
| POST `/api/truco/matches/:id/start` | authGuard | – | viewer DTO, version≥1 | 403 FORBIDDEN (non-creator/non-participant), 404, 409 match_not_startable |
| GET `/api/truco/matches/:id` | authGuard | – | per-viewer DTO | 404, 403 |
| POST `/api/truco/matches/:id/actions` | authGuard | `{expectedVersion, action: TrucoAction}` | `{view, matchEnded}` | 403, 404, 400 `{errorCode: E_*}`, 409 `version_conflict` |

Errors keep repo shape `{ errorCode, message }`; dates `.toISOString()`. Rematch = client re-calls create with `friendId` (no new endpoint). Client-sent state fields ignored entirely (only id/version/action read).

### D9: Socket push layer (additive)
Direct-emit loops via `getUserSocketIds(userId)` (matches.ts `emitMatchFinished` precedent), default namespace, NO rooms: `truco:invite {matchId, code, fromUser}`, `truco:player-joined {matchId, players:[{userId,nickname}×2]}`, `truco:state-changed {matchId, version, reason:'start'|'action'|'finish'}`, `truco:finished {matchId, winnerUserId}`. Redaction rule: pushes carry IDs/version/reason ONLY — hands travel exclusively through per-viewer REST DTO (`buildView` strips opponent hand to count; unresolved opponent envido value never included; settled showdown values become public history). Frontend `lib/socket.ts`: register-on-connect listeners inside `connectSocket` delegating to `setTrucoHandlers({onStateChanged,onInvite,onPlayerJoined,onFinished})` (mirror of `setMatchFinishedHandler`; page sets handler in effect, cleanup nulls it → remount/reconnect hygiene). On `state-changed`: `queryClient.invalidateQueries(['truco-match', id])`. Poll fallback: TanStack Query `refetchInterval: 10_000` always active. Reconnect/reload: full restore from GET (no auto-forfeit); opponent absence shown via existing `user:online/offline` presence.

### D10: CPU mode (client-only)
Loop in `hooks/useTruCpuGame.ts`: human action → `applyAction` → if `playerToAct === cpu`, `setTimeout(thinkDelay)` → `ai.decide(buildCpuDecisionInput(state), rng)` → `applyAction` → render. Information firewall: `buildCpuDecisionInput` returns `CpuDecisionInput` whose TYPE structurally omits `opponentHand`, deck order, unresolved opponent envido (compile-level guarantee) + runtime test asserting key absence; decisions are pure `f(input, rng)` (fair-play regression guard). AI layout `features/truco/ai/`: `types.ts` (`CpuDecisionInput`, `decide(): TrucoAction`, `Difficulty`), `easy.ts`, `medium.ts`, `hard.ts`, `index.ts` factory. Knobs:

| Difficulty | Cards | Bets | Folds | Delay |
|---|---|---|---|---|
| Easy | uniform among legal | initiate ≤10% windows | ≥5% strong hands folded | fixed 700ms const |
| Medium | tier heuristic | truco ≥80% w/ two tier≥10; accept ≥80% w/ tier≥10; envido ≥27 sing ≥90%; NEVER fold 1espada+1basto pre-retruco | junk fold ≥90% | short fixed |
| Hard | visible-card counting, trap lines (save 1espada for baza 3 ≥90%), bluff band 10–25%, marker-aware falta discipline ≥95% | probability thresholds | rare | varied-but-fixed constants |

Personas: `PERSONAS` const (≥8 name+avatar), deterministic pick `seed % n`. Stats recorded post-match to `truco-cpu-stats-v1`.

### D11: UI tree, state management, visuals
```
features/truco/
├── TrucoMenuPage.tsx        # difficulty/target/persona pickers, create/join-by-code, CPU stats
├── TruCpuPage.tsx           # uses useTruCpuGame + shared table components
├── TrucoMatchPage.tsx       # uses useTrucoMultiplayer
├── hooks/useTrucoMultiplayer.ts   # Query ['truco-match',id], mutation postAction, socket+poll
├── hooks/useTruCpuGame.ts
├── ai/{types,easy,medium,hard,index}.ts
└── components/{TrucoTable,RivalZone,TableZone,MyZone,ActionBar,CallFeedbackBanner,EndScreen}.tsx
components/game/PlayingCard.tsx    # EMPTY dir exists — generic card primitive lands here
```
State split per repo rule: multiplayer = **TanStack Query** (server state, invalidation on push, 10s refetchInterval); CPU engine state = **local hook state** (page-transient, dies with page by design); prefs/stats = **zustand** stores. Valid actions: ActionBar renders exclusively from engine `legalActions(publicCtx, myViewerSlot)` — `legalActions` accepts a PUBLIC context subset (legality never needs hidden info), so client derives from the redacted view; UI implements zero rules logic. Call feedback: `CallFeedbackBanner` renders latest `TrucoEvent`s (persist until superseded); accepted envido showdown reveals both values + winner highlight. `PlayingCard` props: `{ card?: CardId; faceDown?: boolean; size?: 'sm'|'md'|'lg'; onClick? }` — inline SVG suit glyphs (coin/chalice/sword/baton paths) + numeral, deterministic snapshots, zero network assets. Responsive: flex-col zones, `clamp()` card sizing, wrapped action bar, `max-w` containers; animations CSS transitions/keyframes only. End screen: win/lose/(draw kept conditionally) + Play Again / Change Mode(`/truco`) / Back(history) / Geotano(`/`).

### D12: Routing / nav / i18n / sounds / persistence
- `App.tsx` AppShell children (after `match-history` line): `truco`, `truco/cpu`, `truco/match/:matchId` — additive only.
- `AppShell.tsx navItems`: insert `{ to: '/truco', label: 'truco.title' }` after match-history entry.
- `HomePage.tsx`: one cross-game button below greeting block → `navigate('/truco')`; TrucoMenuPage gets reciprocal "Geotano" button → `/`.
- i18n families (flat keys, BOTH locales): `truco.title`, `truco.menu.*`, `truco.difficulty.easy|medium|hard`, `truco.target.*`, `truco.persona.*`, `truco.call.envido|realEnvido|faltaEnvido|truco|retruco|valeCuatro`, `truco.answer.quiero|noQuiero`, `truco.suit.oro|copa|espada|basto`, `truco.card.alt`, `truco.turn.you|opponent`, `truco.score`, `truco.end.win|lose|draw`, `truco.action.playAgain|changeMode|back|geotano`, `truco.multi.*`, `truco.error.*`.
- Sounds (`lib/sounds.ts`, oscillator pattern, ALL gated by `isEnabled()`): `playTrucoDeal, playTrucoCardPlayed, playTrucoCallEnvido, playTrucoCallTruco, playTrucoQuiero, playTrucoNoQuiero, playTrucoBazaWon, playTrucoHandEnded, playTrucoMatchWon, playTrucoMatchLost`. Wire `useSoundStore.getState().hydrate()` into `main.tsx` (exists today but is never called at boot — required for mute-persistence guarantee).
- Stores: `store/trucoPrefsStore.ts` (`truco-prefs-v1`: difficulty/target/personaIndex) and `store/truCpuStatsStore.ts` (`truco-cpu-stats-v1`: `{gamesPlayed,wins,losses,byDifficulty:{easy|medium|hard:{games,wins,losses}}}`; win% + mostPlayedDifficulty = derived selectors). Both `hydrate()`-on-boot via `main.tsx` (existing pattern).

## Data Flow

```
Multiplayer action:  Client ──POST /actions{expectedVersion,action}──▶ trucoService
                       ▲                    │ engine.applyAction (server)
                       │ GET view (redacted)│ tx: UPDATE…WHERE version=$v
                    buildView ◀──────────────┘
                       │
      ┌─ truco:state-changed {version} ─▶ both clients → invalidateQueries
      └─ poll ≤10s fallback ────────────▶ converge on version

CPU loop (no network): UI ─▶ applyAction ─▶ [cpu turn] setTimeout ─▶ ai.decide(CpuDecisionInput,rng) ─▶ applyAction ─▶ render
```

## File Changes

| File | Action | Description |
|---|---|---|
| `packages/shared/src/truco/{types,deck,hierarchy,envido,rng,state,actions,events,errors,engine,legalActions,view,index}.ts` | Create | Pure engine (D2–D5) + redaction/CPU-input builders |
| `packages/shared/package.json` | Modify | add `test` script |
| `packages/shared/src/index.ts` | Modify | export truco barrel |
| `packages/shared/src/truco/__tests__/*.test.ts` | Create | GWT engine suite, determinism, taxonomy |
| `apps/backend/src/db/schema/trucoMatches.ts` | Create | drizzle table |
| `apps/backend/src/db/schema/index.ts` | Modify | export table |
| `apps/backend/src/db/index.ts` | Modify | append `-- 0009` inline migration |
| `apps/backend/src/services/trucoService.ts` | Create | lifecycle + transactional apply + cleanup fn |
| `apps/backend/src/routes/truco.ts`, `routes/index.ts`, `src/index.ts` | Create/Modify | route table, registration, hourly cleanup registration |
| `apps/backend/src/socket/index.ts` | Modify | nothing required server-side beyond emits from routes (pushes live in route layer, precedent-compliant) |
| `apps/backend/src/__tests__/truco*.test.ts` | Create | hoisted-mock route/service suites |
| `apps/frontend/src/app/App.tsx` | Modify | 3 sibling routes |
| `apps/frontend/src/components/AppShell.tsx` | Modify | 1 navItems entry |
| `apps/frontend/src/features/quiz/HomePage.tsx` | Modify | 1 cross-game button |
| `apps/frontend/src/features/truco/**` | Create | pages/hooks/ai/components per D10–D11 |
| `apps/frontend/src/components/game/PlayingCard.tsx` | Create | card primitive (empty dir exists) |
| `apps/frontend/src/lib/socket.ts` | Modify | additive truco listeners + `setTrucoHandlers` |
| `apps/frontend/src/lib/sounds.ts` | Modify | 10 gated synth fns |
| `apps/frontend/src/store/trucoPrefsStore.ts`, `truCpuStatsStore.ts`, `store/index.ts` | Create/Modify | prefs/stats persistence |
| `apps/frontend/src/main.tsx` | Modify | hydrate calls (truco ×2 + soundStore) |
| `apps/frontend/src/i18n/{en,es}.json` | Modify | `truco.*` families |
| `apps/frontend/src/__tests__/i18nParity.test.ts` | Create | en/es key-set parity (see Reconciliation) |

## Interfaces / Contracts

Core signatures (full unions in code):
```ts
createMatch(opts: {targetPoints: 15|30; mano?: PlayerSlot}, rng: Rng): TrucoState;
applyAction(state: TrucoState, action: TrucoAction, deps?: {rng?: Rng}): EngineResult;
legalActions(ctx: TrucoPublicContext, playerId: PlayerSlot): TrucoAction[];
buildView(state: TrucoState, viewerSlot: PlayerSlot): TrucoView;          // REST DTO
buildCpuDecisionInput(state: TrucoState, cpuSlot: PlayerSlot): CpuDecisionInput; // firewall
mulberry32(seed: number): Rng;
```
`TrucoAction` = `{type:'play_card',card}|{type:'sing_envido'|'sing_real_envido'|'sing_falta_envido'|'sing_truco'|'sing_retruco'|'sing_vale_cuatro'}|{type:'quiero'|'no_quiero'}`; actor taken from authenticated user server-side (never body).

## Testing Strategy (STRICT TDD ORDER)

| Order | Suite | Location | Approach |
|---|---|---|---|
| 1 | Engine units FIRST — EVERY truco-engine GWT scenario, determinism replay, error-taxonomy exhaustiveness, transition-table enumeration | `packages/shared/src/truco/__tests__/` | seeded `mulberry32`; frozen inputs; `pnpm --filter @geotano/shared vitest run` |
| 2 | Backend route/service | `apps/backend/src/__tests__/truco.routes.test.ts`, `trucoService.test.ts` | hoisted `vi.mock` db/auth/socket (repo pattern); fake timers expiry; rowCount-sequence 409 simulation |
| 3 | AI statistical | `apps/frontend/src/features/truco/ai/__tests__/ai.test.ts` | seeded batches (≥200 games/difficulty, ≥5000 Easy decisions, 300 bluff windows); fake timers assert delay CONSTANTS; pairwise separation bounds |
| 4 | UI | `apps/frontend/src/features/truco/**/__tests__` + `i18nParity.test.ts` | Testing Library mocking api/socket modules (MultiplayerPage.test.tsx precedent); PlayingCard 40-face snapshots; valid-actions gating; end-screen flows |

Commands: `pnpm test` (turbo: shared now included), `pnpm test:backend`, `pnpm test:frontend`. Responsive 360px constraint enforced via layout-rule assertions + component classes (jsdom computes no scrollWidth — noted honestly; visual check listed as manual gate).

## Work-unit commit plan (single PR)

1. `feat(shared): truco deck, hierarchy, envido math + rng` (+units)
2. `feat(shared): truco state machine, actions, scoring, views` (+GWT suite)
3. `feat(backend): truco schema, migration, service, routes, socket pushes` (+tests)
4. `feat(frontend): truco shell — routes, nav, cross-game buttons, i18n, sounds, stores` (+parity test)
5. `feat(frontend): truco CPU mode — AI difficulties, controller, table UI` (+tests)
6. `feat(frontend): truco multiplayer screen — query hook, socket handlers, invites` (+tests)
7. `docs(openspec): reconcile proposal default-target wording`

## Migration / Rollout

Additive-only; rollback = revert PR + drop `truco_*` tables (no backfill, lossless). Quiz behavior untouched; 988-test green gate at verify.

## Reconciliation (required fixes)

1. `proposal.md` question-round item 1 says default **15** assumed; engine spec pins **DEFAULT 30** → edit proposal wording to "configurable 15/30, default 30 (spec-pinned)" so artifacts agree.
2. UI spec cites an "existing i18n parity test" — NONE exists in repo → this change CREATES `i18nParity.test.ts` (documented here; no spec change needed, requirement satisfied by the new gate).
3. Migrations: drizzle-kit scripts exist but unused; real convention is inline idempotent SQL blocks in `db/index.ts` — design follows the LIVE convention (block 0009).

## Open Questions

- None blocking.
