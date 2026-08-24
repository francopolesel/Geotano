# Proposal: Truco Argentino — Second Game in Geotano

## Intent

Turn Geotano into a two-game platform by adding authentic Truco Argentino (vs CPU and friend 1v1) with **zero regression** to the existing quiz game: today's 988 green tests must stay green through the whole change.

## Problem statement

Geotano currently has one game surface whose contracts (`GameModeSlug`, rankings aggregates, async race multiplayer) are geography-quiz-coupled. Card-game concepts cannot be shoehorned there; real-time turn-based play does not fit the 10s-poll model alone; and memory-only state dies on Render free spin-down/deploys. A second game needs its own engine, durable state store, push channel, and entry surfaces while reusing auth, sockets, sounds, i18n, and TDD conventions.

## Proposed scope (phased, PRD priority order)

| Phase | Priority | Deliverable |
|---|---|---|
| P1 | 1 | Geotano safety: baseline suite green, additive-only policy, `/truco/*` route skeleton + nav/cross-game entry points |
| P2 | 2 | Playable core: pure-TS engine core (deal, play card, baza, basic scoring) + minimal table UI → first playable match |
| P3 | 3 | Full rules: complete card hierarchy, parda resolution & next-leader flow, Envido/Real Envido/Falta Envido chains with correct scoring, Truco/Retruco/Vale Cuatro (Quiero/No Quiero), configurable target (15/30), match-end detection, illegal-action rejection |
| P4 | 4 | vs CPU: Easy/Medium/Hard AI with genuinely distinct behavior over public info only (no cheating), config menu, varied CPU names/avatars |
| P5 | 5 | Friend 1v1 multiplayer: create/join by code, DB-backed server-authoritative state, action REST routes, `truco:*` socket push + poll fallback, round/hand/match end sync |
| P6 | 6 | UX/design: rival-top / table-center / my-cards layout, valid-actions-only input, CSS/SVG Spanish deck, visual call feedback, responsive desktop→mobile without horizontal scroll |
| P7 | 7 | Polish: synth SFX via `lib/sounds.ts` (mutable in settings), end-of-match screen (Ganaste/Perdiste/Empate + Play again/Change mode/Back/Geotano), localStorage prefs/stats (store-owned keys), docs |

## Non-goals

- No 2v2, spectators, in-game chat, tournaments, or external card image assets
- No new infra stack (Redis, socket rooms/namespaces, queues); reuse the single socket connection
- No changes to `GameModeSlug`, quiz rankings, profile aggregates, or existing quiz challenge/match lifecycle
- No rewrite of `lib/socket.ts` internals or `quizEngine`

## Capabilities

> Contract with sdd-spec. Existing specs researched: `game-modes`, `multiplayer-1v1-mode`, `rankings`, `i18n` are quiz-scoped and remain untouched at requirement level.

### New Capabilities
- `truco-engine`: pure-TS rules module in `@geotano/shared` — deck, hierarchy, bazas/parda, envido & truco chains, turn flow, scoring/targets, match end, invalid-action rejection
- `truco-cpu-mode`: client-side vs-CPU experience; three fair AI difficulties; config menu; local stats persistence
- `truco-multiplayer`: server-authoritative DB-backed 1v1 (challenge → play → finish), action validation via shared engine, `truco:*` pushes with polling fallback
- `truco-ui`: presentation layer — CSS/SVG deck, table layout, call feedback/animations, i18n (`truco.*` in both locales), sounds, end screen, settings/persistence

### Modified Capabilities
None. Navigation additions (AppShell item, HomePage button) are additive UI, not requirement changes to any existing spec.

## Approach

Confirmed exploration recommendation (hybrid architecture): the rules engine lives in `packages/shared/src/truco` (source-exported, zero-dep package) and is consumed identically by the frontend CPU controller and the backend authoritative validator — one source of truth, fully unit-testable under strict TDD. Multiplayer state is a Postgres row per match holding JSONB state plus a monotonic `version`; every action is an authenticated REST POST that runs the engine server-side, atomically persists (matchService patterns: authGuard, ownership checks, idempotency), then emits `truco:state-changed` via `getUserSocketIds` for instant opponent refetch; the 10s poll remains fallback. CPU mode never touches the backend. Dedicated `truco_*` tables parallel `match_challenges` rather than generalizing them.

### Alternatives considered & rejected
- Socket-native in-memory rooms: state lost on spin-down/deploy, no resumability → rejected
- Socket-driven game logic: diverges from REST/auth/idempotency precedents → rejected
- Pure REST + 10s polling only: unplayable feel for strict turn-based → rejected
- Normalized card/bet tables: multi-row transactions, no v1 query benefit → JSONB chosen
- Separate `packages/truco-engine`: premature; shared package is already source-exported → rejected

## Affected Areas

| Area | Impact |
|---|---|
| `packages/shared/src/truco/*` | New: engine + truco types/constants (`GameId` discriminator; `GameModeSlug` untouched) |
| `apps/backend/src/services/trucoService.ts`, `routes/truco.ts` (+ registration) | New authoritative API |
| `apps/backend/src/db/schema` + migration | New `truco_*` tables only |
| `apps/backend/src/socket/index.ts` | Additive `truco:*` handlers/pushes |
| `apps/frontend/src/app/App.tsx`, `components/AppShell.tsx`, `features/quiz/HomePage.tsx` | Routes, nav item, cross-game buttons (additive) |
| `apps/frontend/src/features/truco/*`, `lib/socket.ts`, `lib/sounds.ts`, `i18n/{en,es}.json` | New UI + additive handlers/SFX/i18n keys |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Quiz regression | High | Additive-only rule; full suite green gate in verify; edits limited to nav/button additions in quiz files |
| Engine subtlety (parda carry, Falta Envido math, raise deadlines) | High | Exhaustive Given/When/Then scenarios in spec phase; strict TDD before UI |
| Concurrent/out-of-order multiplayer actions | Medium | Version check + idempotent apply; conflicts resolved server-side |
| Stale/duplicate socket listeners on remount/reconnect | Medium | Reuse register-on-connect setter pattern from MultiplayerPage |
| i18n parity breakage | Low | Existing parity test gates both locale files |
| Render cold-start resume latency | Low | Full DB persistence; poll fallback |

## Rollback plan

Everything is additive: reverting the single PR removes `/truco/*` routes, nav entries, socket handlers, UI, and shared engine exports; dropping the generated `truco_*` tables removes storage (no backfill exists → lossless). No quiz behavior file is rewritten, so revert risk to Geotano is minimal.

## Dependencies

None new — no extra npm packages (CSS/SVG cards, WebAudio synth, existing socket.io-client/Drizzle). Migration via existing `db:generate`/`db:migrate`.

## Success criteria (PRD §33 checklist)

- [ ] Monorepo suite green; all pre-existing quiz tests untouched and passing
- [ ] Complete rules proven by engine tests (hierarchy, parda, full envido chain, truco chain, 15/30 targets)
- [ ] Illegal actions rejected client-side and server-authoritatively
- [ ] CPU Easy/Medium/Hard demonstrably distinct; public-info-only (no cheating)
- [ ] 1v1 create/join/wait/sync/end works across two sessions; survives page reload
- [ ] Responsive UI, no horizontal scroll; every call visually announced
- [ ] All user-facing text via i18n keys (parity test green); sounds mutable from settings
- [ ] Prefs/stats persisted via store-owned localStorage keys
- [ ] Docs cover start-a-match, engine, AI, multiplayer, routing, adding difficulty/rules, running tests

## Proposal question round (auto mode — resolved)

1. Target score: configurable 15/30, **default 30** (spec-pinned; engine and server agree).
2. Falta Envido awards the points the trailing player lacks to reach target — confirmed by design (formula computed at settlement; tie goes to mano).
3. Truco friend challenges live in friends/truco surfaces, NOT inside the quiz `GameModePicker` modal — confirmed by design.
4. Truco results excluded from global quiz rankings in v1 (own stats surface only) — confirmed by design.
5. Unfinished multiplayer matches expire after 24h mirroring quiz cleanup — confirmed by design (`deleteExpiredTrucoMatches`).
