# Tasks: Truco Argentino

> Session preflight: auto Â· hybrid store Â· SINGLE PR with work-unit commits Â· unlimited review budget Â· STRICT TDD (Vitest v3). Session preflight overrides `openspec/config.yaml` `tdd: false`.
> Phasing: batches follow design Â§Work-unit commit plan (TDD-safe order: pure engine â†’ backend â†’ frontend). `P#` tags mark which proposal phase (P1â€“P7) each task serves; P1's "route skeleton + nav entry" lands in CU4 as the first frontend commit because strict TDD pins the engine GWT suite before any UI/backend consumption.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | â‰ˆ 10,000 total (range 9,000â€“11,500) |
| Per batch | CU1 â‰ˆ 700 Â· CU2 â‰ˆ 2,900 Â· CU3 â‰ˆ 1,500 Â· CU4 â‰ˆ 850 Â· CU5 â‰ˆ 2,800 Â· CU6 â‰ˆ 1,050 Â· CU7 â‰ˆ 250 |
| 400-line budget risk | High (â‰ˆ25Ã— the default budget; accepted â€” unlimited review budget granted, user selected single PR `size:exception`) |
| Chained PRs recommended | No â€” single PR honored per explicit user choice; review commit-by-commit (each work unit is green and independently revertible). Fallback if review bandwidth shrinks: CU1+CU2 (zero-app-impact shared engine) splits off cleanly as PR-1 with no rework. |
| Suggested split | Single PR Â· 7 work-unit commits (design Â§Work-unit commit plan) |
| Delivery strategy | exception-ok (single-pr + size:exception resolved at session start) |
| Chain strategy | size:exception |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size:exception
400-line budget risk: High
```

### Suggested Work Units (= design Â§Work-unit commit plan)

| Unit | Goal (commit message) | Notes |
|------|----------------------|-------|
| CU1 | `feat(shared): truco deck, hierarchy, envido math + rng` | base = main; suite green |
| CU2 | `feat(shared): truco state machine, actions, scoring, views` (+GWT suite) | depends on CU1 |
| CU3 | `feat(backend): truco schema, migration, service, routes, socket pushes` (+tests) | depends on CU2 |
| CU4 | `feat(frontend): truco shell â€” routes, nav, cross-game buttons, i18n, sounds, stores` (+parity test) | additive-only to quiz |
| CU5 | `feat(frontend): truco CPU mode â€” AI difficulties, controller, table UI` (+tests) | depends on CU4 |
| CU6 | `feat(frontend): truco multiplayer screen â€” query hook, socket handlers, invites` (+tests) | depends on CU3+CU4 |
| CU7 | `docs(openspec): reconcile proposal default-target wording` | docs only |

Standing conventions for every task: pnpm workspace commands from repo root; errors `{ message }`(+errorCode); dates `.toISOString()`; API calls via `apps/frontend/src/lib/api.ts`; user-facing text ONLY via i18next keys in BOTH `i18n/en.json` and `es.json` (parity gate live after task 4.2); zero new dependencies.

---

## Phase 1 â€” Engine foundations (CU1 Â· P2/P3)

**S6 LAYERING PIN (binding for all engine tasks, CU1â€“CU2):** `types`, `deck`, `hierarchy`, `envido`, `rng` import NOTHING intra-module; `state`, `actions`, `events`, `errors` depend only downward; `engine`, `legalActions`, `view` sit on top. Prevents import cycles during TDD commits 1â€“2. Verify per task with a quick import grep before committing.

- [x] **1.1 [P2] Enable shared-package tests + scaffold truco tree**
  - Files: `packages/shared/package.json`; `packages/shared/src/truco/index.ts` (barrel, initially empty); `packages/shared/src/truco/__tests__/` (dir).
  - Do: add `"test": "vitest run"` script (D1 â€” vitest devDep already present; root `pnpm test` picks it up via turbo).
  - Tests: `pnpm --filter @geotano/shared vitest run` executes (empty suite OK).
  - Done: turbo runs shared tests; no runtime deps added.

- [x] **1.2 [P2][REDâ†’GREEN] Deck composition + injected RNG**
  - Files (RED): `packages/shared/src/truco/__tests__/deck.test.ts`, `__tests__/rng.test.ts`. Files (GREEN): `deck.ts`, `rng.ts`, `types.ts` (Suit/Rank/CardId/Rng).
  - Do: (a) RED â€” spec scenario *Deck contents*: exactly 40 unique cards = 4 suits Ã— ranks {1..7,10,11,12}, id format `{rank}{suit}` (e.g. `7espada`); rng same-seed sequence equality. Run â†’ fail. (b) GREEN â€” `DECK_40` constant; `shuffle(deck, rng)` Fisher-Yates consuming injected rng only; `mulberry32(seed)` (D3).
  - Tests: shared suite.
  - Done: green; grep proves zero `Math.random` in engine src.

- [x] **1.3 [P3][REDâ†’GREEN] Card hierarchy total order**
  - Files (RED): `__tests__/hierarchy.test.ts`. (GREEN): `hierarchy.ts`.
  - Do: (a) RED â€” scenarios *Bravas beat everything*, *Tier equality* (`3oro`â‰¡`3basto`), *False anchors and sevens* (`1copa`>`12oro`, `7copa`>`6espada`), spot rows for every tier 14â†’1 per spec table. (b) GREEN â€” `TIER_TABLE: Record<CardId, 1..14>`; `compareCards(a,b) => 'win1'|'win2'|'parda'`.
  - Done: green; pure functions only.

- [x] **1.4 [P3][REDâ†’GREEN] Envido value calculation**
  - Files (RED): `__tests__/envido.test.ts`. (GREEN): `envido.ts`.
  - Do: (a) RED â€” *Same-suit pair* ([`5oro`,`11oro`,`3espada`] = 25); *Maximum and minimum* ([`7copa`,`6copa`,`1espada`] = 33; all-figures = 0); *Three of a suit without Flor* ([`6basto`,`3basto`,`2basto`] = 29, lowest dropped). (b) GREEN â€” `computeEnvido(hand)`: figures 10/11/12 = 0; suited pair/trio = 20 + best two; all-different = highest face value.
  - Done: green.

- [x] **1.5 [CU1 gate] Barrel wiring + commit**
  - Files: `packages/shared/src/index.ts` (add `export * from './truco/index.js'`; barrel re-exports current surface).
  - Done: shared suite + root typecheck green. Commit CU1.

## Phase 2 â€” State machine, actions, scoring, views (CU2 Â· P3, completes P2 core)

Every task = RED (failing GWT cases in `packages/shared/src/truco/__tests__/`) â†’ GREEN (implement). Respect S6 layering.

- [x] **2.1 [P3][REDâ†’GREEN] Types, error taxonomy, events, transitions table**
  - Files (RED): `__tests__/stateMachine.test.ts`. (GREEN): `types.ts` (TrucoState, TrucoPhase, PlayerSlot, TrucoAction union, EngineResult per D4), `errors.ts` (TrucoErrorCode = exactly the spec list `E_OUT_OF_TURN â€¦ E_STATE_FORBIDDEN`), `events.ts` (TrucoEvent discriminated union per D4), `state.ts` (`TRANSITIONS: Record<TrucoPhase, readonly TrucoActionType[]>` per *Explicit state machine* requirement).
  - RED: taxonomy exhaustiveness (every code exported, unique); *Full legal path enumeration testable* (table matches requirement exactly); *Betting sub-phase round trip* shape.
  - Done: green.

- [x] **2.2 [P2â†’P3][REDâ†’GREEN] createMatch/deal + play_card + turn flow**
  - Files: `engine.ts` (`createMatch({targetPoints 15|30, mano?}, rng)`; `applyAction(state, action, deps?{rng})` exhaustive `(phase, action.type)` switch), `state.ts` helpers.
  - RED: *Deterministic replay*; *No hidden nondeterminism* (rejected action returns ORIGINAL state ref; new state per transition); *Out-of-turn play* â†’ `E_OUT_OF_TURN`; *Mano swaps every hand*; rng consumed ONLY at deal boundaries â€” mid-hand actions RNG-free (D3).
  - Done: green; dealt hands + remaining deck live INSIDE state.

- [x] **2.3 [P3][REDâ†’GREEN] Bazas cascade & parda**
  - RED: *Win first two ends hand* (baza 3 never played); *Parda second baza hands it to baza-one winner*; won-b1+parda-b2 immediate; *Double parda then decider*; *Split with tied third* (earliest untied); *All three parda* â†’ MANO wins (canonical rule superseding launch brief); *Parda keeps leader*.
  - Done: green; `baza_resolved`/`hand_ended` events emitted.

- [x] **2.4 [P3][REDâ†’GREEN] Envido chain & stake matrix**
  - Files: `state.ts` betting substate `{openBet?, stake, lastRaise, awaitingResponder}`; `engine.ts` envido handlers.
  - RED (table-driven over ALL 9 matrix rows): *Accept accumulates* (Envidoâ†’Realâ†’Real, quiero = 8); *Refusal pays prior stake* (= 2 to singer); *Refusing first bet* (= 1); *Raise rights and closure* (only responder may raise, only pre-answer; post-answer bets rejected); *Illegal raise order* (`realEnvido` answered with `envido` raise â†’ `E_ILLEGAL_RAISE_ORDER`); falta terminal (answers only).
  - Done: green; `call_sung`/`answered`/`envido_showdown` events.

- [x] **2.5 [P3][REDâ†’GREEN] Falta Envido settlement + timing windows + pending-truco precedence**
  - RED: *Trailer wins falta envido* (target 30, 25/20 â†’ B +5); *Leader wins falta envido ends match* (28/22 â†’ A +2 = 30, immediate); *Equal scores whole game* (0-0 â†’ winner gets 30); *Tie goes to mano* (28-28 â†’ mano); falta not raisable (`E_ILLEGAL_RAISE_ORDER`); *After first card rejected* (`E_ENVIDO_WINDOW_CLOSED`, state unchanged); *After truco accepted rejected*; *Envido takes precedence over pending truco* (envido settles fully, THEN original truco still needs its answer; award ending the match VOIDS pending truco).
  - GREEN: falta formula computed AT settlement: `target âˆ’ max(scores)` (tie â†’ `target âˆ’ score`); window guards; `pendingTruco` parked/resurfaced (envido settled & match continues â†’ `truco_betting`, same responder).
  - Done: green.

- [x] **2.6 [P3][REDâ†’GREEN] Truco chain, raise rights, deadlines**
  - RED: *Refuse retruco* (A no-quiero on B's retruco â†’ hand ends, B = exactly 2); *Only accepter may raise* (A trucoâ†’B quieroâ†’A retruco REJECTED); *Vale cuatro terminal* (plays for 4, nothing further legal); refuse truco = 1; *Deadline at hand end* (`E_TRUCO_WINDOW_CLOSED`); *Must answer before acting* (`E_AWAITING_OWN_BET`; playing while ANY bet awaits opponent also rejected â€” explicit answers only, implicit-accept-by-playing excluded per D5).
  - Done: green.

- [x] **2.7 [P3][REDâ†’GREEN] Scoring & match end**
  - RED: *Envido ends match before truco counts* (target 15 @14 +2 â†’ 16, no truco/bazas points); *Win threshold inclusive* (exactly 30 AND 31); *Configurable 15-point game*; DEFAULT TARGET = 30 pinned at engine level (consistency with S4 server default); scores never decrease (seeded random-match property sweep).
  - GREEN: envido settles FIRST; every award checks `score >= target` â†’ immediate `match_end` voiding later phases.
  - Done: green; `points_awarded`/`match_ended` events.

- [x] **2.8 [P3][REDâ†’GREEN] legalActions + buildView + CPU input builder**
  - Files: `legalActions.ts`, `view.ts`, `__tests__/legalActions.test.ts`, `__tests__/view.test.ts`.
  - RED: legality derived from `TRANSITIONS` + guards over PUBLIC context subset `TrucoPublicContext` (never hidden info); per-phase enumeration matches *Explicit state machine* exactly (waiting_for_players:start; playing:play_card+calls per windows; betting phases: responder answers/raises; hand_end/match_end:none); *Opponent hand never leaks* (buildView strips opponent hand â†’ count; unresolved opponent envido excluded; settled showdown values become public history); public info identical for both viewers; `buildCpuDecisionInput` structurally omits `opponentHand`/deck order/unresolved opponent envido â€” type level + runtime key-absence test (firewall foundation for 5.1).
  - Done: green.

- [x] **2.9 [CU2 gate]** `__tests__/determinism.test.ts`: recorded full-match replay Ã—2 â†’ deep-equal; sweep proving every `E_*` exercised somewhere in the suite; full shared suite + `pnpm test` green. Commit CU2.

## Phase 3 â€” Backend (CU3 Â· P5) â€” service/routes tests BEFORE any UI consumption

- [x] **3.1 [P5] Schema + inline migration (repo convention: INLINE, not drizzle-kit)**
  - Files: `apps/backend/src/db/schema/trucoMatches.ts` (drizzle table per D7 DDL); `apps/backend/src/db/schema/index.ts` (export); `apps/backend/src/db/index.ts` (append idempotent block `-- 0009: Truco matches` inside `runMigrations()`: table + partial unique index `truco_matches_code_active_idx` WHERE status IN ('waiting','ready','playing') + host/status indexes).
  - Done: backend typecheck green; SQL verbatim per D7; no drizzle-kit flow introduced.

- [x] **3.2 [P5][RED] Service unit tests**
  - Files: `apps/backend/src/__tests__/trucoService.test.ts` (hoisted `vi.mock` db/auth/socket per `matchService.test.ts` precedent; fake timers for expiry; rowCount-sequence to force conflicts).
  - Cases: `generateRoomCode` matches `^[A-HJ-NP-Z2-9]{6}$`, crypto source, retry on unique violation (*Code shape and uniqueness*); `createMatch` â€” body `targetPoints` OPTIONAL, SERVER DEFAULTS 30 (**S4**), friendId invite REQUIRES friendship else 403 NOT_FRIENDS, emits `truco:invite`; `joinByCode` â€” 404 unknown/expired, 409 `match_not_joinable` unless waiting, join â†’ status ready + `truco:player-joined {matchId, players:[{userId,nickname}Ã—2]}`; `startMatch` â€” **W1 CREATOR-ONLY, pinned wording: guest start â†’ 403 FORBIDDEN**, 409 `match_not_startable` unless ready, deals hand 1 server-side with crypto rng, versionâ†’1 status playing, emit reason 'start'; `applyPlayerAction` â€” 403 non-participant, actor from authenticated user NEVER body, engine rejection passthrough E_* with NO mutation/version bump, tx `UPDATE â€¦ SET engine_state, version=old+1 â€¦ WHERE id AND version=$expected`, rowCount 0 â‡’ `version_conflict`(409), match_end persists winner/finishedAt/status finished + emits `truco:finished` + final state-changed reason 'finish', client-sent state fields IGNORED; `getMatchView` â€” per-viewer buildView delegation, 404 unknown, 403 non-participant; `deleteExpiredTrucoMatches` â€” deletes >24h on `updated_at` incl. finished.
  - Done: RED confirmed (service absent).

- [x] **3.3 [P5][GREEN] Implement `apps/backend/src/services/trucoService.ts`**
  - Full D8 surface; JSONB wrapper `{schemaVersion:1, state}` read-path validation + identity `migrateState(v, raw)` stub at v1 (D6); version merged into DTO by service.
  - Done: 3.2 green.

- [x] **3.4 [P5][RED] Route tests**
  - Files: `apps/backend/src/__tests__/truco.routes.test.ts` (app build + hoisted service mocks, `matches.routes.test.ts` precedent).
  - Cases per D8 route table: POST `/api/truco/matches` (authGuard 401; MISSING_FIELD 400; 403 friendship on invite path); GET `/api/truco/matches/code/:code` â€” **S3: ADDITIVE CONVENIENCE ENDPOINT** (beyond delta-spec minimum; kept for join-UX pre-check; intentional documented surface for archive â€” public-minimal `{matchId,status}`, 404 CODE_NOT_FOUND); POST `/code/:code/join` happy + *Third player rejected* (409); POST `/:id/start` â€” **W1: guest start â†’ 403 errorCode FORBIDDEN** asserted by name; GET `/:id` per-viewer 404/403; POST `/:id/actions` `{expectedVersion, action}` â†’ `{view, matchEnded}`, 400 `{errorCode:E_*}`, 409 `version_conflict`; *Replay safety* (verbatim retry after success â†’ 409, never double-applied); error/date shapes per repo conventions.
  - Done: RED confirmed.

- [x] **3.5 [P5][GREEN] Implement `apps/backend/src/routes/truco.ts` + registration + cleanup wiring**
  - Files: `routes/truco.ts` (6 endpoints; socket emits live IN ROUTE LAYER per precedent â€” push payloads carry IDs/version/reason ONLY, hands never, D9); `routes/index.ts` (register); `src/index.ts` (register `deleteExpiredTrucoMatches` beside `deleteExpiredMatches` hourly cleanup).
  - Done: 3.4 green; `pnpm test:backend` fully green (quiz suites untouched).

- [x] **3.6 [CU3 gate]** `pnpm test:backend` + typecheck; additive-only diff audit. Commit CU3.

## Phase 4 â€” Frontend shell (CU4 Â· P1 + P7 infra)

- [x] **4.1 [P1][REDâ†’GREEN] Routes + nav + cross-game entries**
  - RED: `apps/frontend/src/app/__tests__/trucoRouting.test.tsx` (mock feature pages; `/truco`, `/truco/cpu`, `/truco/match/:matchId` render inside AppShell; *Quiz untouched* â€” existing suites unmodified).
  - GREEN: `apps/frontend/src/app/App.tsx` (3 sibling routes after match-history line); `components/AppShell.tsx` (navItems + `{to:'/truco', label:'truco.title'}`); `features/quiz/HomePage.tsx` (ONE button below greeting â†’ `/truco`); create `features/truco/TrucoMenuPage.tsx` (skeleton + reciprocal Geotano button â†’ `/`), `TruCpuPage.tsx`, `TrucoMatchPage.tsx` (placeholders).
  - i18n (FIRST strings â€” both locales): `truco.title`, `truco.menu.*`, `truco.action.geotano`.
  - Done: routing green; `HomePage.test.tsx`/`AppShell.test.tsx` still pass.

- [x] **4.2 [P1] i18n parity gate (none exists today â€” design Reconciliation #2)**
  - Files: `apps/frontend/src/__tests__/i18nParity.test.ts`.
  - Tests: recursive key-set equality en vs es, failure lists missing keys.
  - Done: passes now; permanent gate for all later string tasks.

- [x] **4.3 [P7] Zustand stores + boot hydration**
  - Files: `store/trucoPrefsStore.ts` (key `truco-prefs-v1`: difficulty/target/personaIndex); `store/truCpuStatsStore.ts` (key `truco-cpu-stats-v1`: gamesPlayed/wins/losses/byDifficulty{easy,medium,hard:{games,wins,losses}} + derived selectors win%, mostPlayedDifficulty; `recordMatchResult`); `store/index.ts`; `main.tsx` (hydrate truco Ã—2 PLUS `soundStore.hydrate()` â€” currently never called at boot; REQUIRED for mute persistence, D12).
  - Tests: `src/__tests__/trucoStores.test.ts` â€” persist round-trip; *Key namespace isolation* (writes touch ONLY `truco-*` keys); *Stats accumulate* (win Medium + loss Hard â†’ 2/1/1 + per-difficulty).
  - Done: green.

- [x] **4.4 [P7] Sound functions (ALL gated by soundStore)**
  - Files: `lib/sounds.ts` â€” add `playTrucoDeal, playTrucoCardPlayed, playTrucoCallEnvido, playTrucoCallTruco, playTrucoQuiero, playTrucoNoQuiero, playTrucoBazaWon, playTrucoHandEnded, playTrucoMatchWon, playTrucoMatchLost` (existing oscillator pattern; every fn early-returns unless `isEnabled()` â€” *Mute silences truco*: muting in Settings kills all truco audio; *Trigger coverage* 10/10).
  - Tests: `src/__tests__/trucoSounds.test.ts` â€” with soundEnabled=false persisted, zero WebAudio calls across all 10; enabled path synthesizes.
  - Done: green.

- [x] **4.5 [CU4 gate]** `pnpm test:frontend` + parity green; diff audit (quiz files touched: HomePage.tsx only, one button). Commit CU4.

## Phase 5 â€” CPU mode (CU5 Â· P4 + P6 layout + P2-playable)

- [x] **5.1 [P4][RED] AI contracts pt.1 â€” fairness & determinism**
  - Files: `apps/frontend/src/features/truco/ai/__tests__/ai.test.ts` (seeded mulberry32; fake timers for delay constants).
  - Cases: *Input shape excludes hidden info* (runtime key-absence on `CpuDecisionInput`, pairs with 2.8 builder); *Fair-play regression guard* (decide pure over input+seed); *Seeded reproducibility* (full match twice â†’ identical logs); *Never illegal* (Easy, 50 seeded games â†’ 0 illegal).
  - Done: RED confirmed (`ai/` absent).

- [x] **5.2 [P4][GREEN] AI implementations**
  - Files: `features/truco/ai/{types,easy,medium,hard,index}.ts` â€” `decide(): TrucoAction` pure; `PERSONAS` â‰¥8 name+avatar (inline monogram/SVG, deterministic `seed % n`); difficulty factory. Knobs per D10 table: Easy uniform cards / initiate â‰¤10% / fold-strong â‰¥5% / fixed 700ms; Medium tier heuristic (initiate truco â‰¥80% w/ two tierâ‰¥10; accept â‰¥80% w/ tierâ‰¥10; envido â‰¥27 sing â‰¥90% incl. the 31 case; junk fold â‰¥90%; NEVER fold 1espada+1basto pre-retruco); Hard visible-card counting, trap lines (save 1espada for baza 3 â‰¥90%), bluff band 10â€“25% over â‰¥300 windows, marker-aware falta discipline (opponent within 3 â†’ refuse unless tierâ‰¥11, â‰¥95%).
  - Done: 5.1 green.

- [x] **5.3 [P4][RED] AI contracts pt.2 â€” statistical bounds & separation**
  - Extend `ai.test.ts`: *Random-ish play* (10k Easy samples Â±20% of 1/3); *Rarely bets but folds winners sometimes* (200-hand batch); *Strong hand raises*/*Junk folds*/*Envido threshold* fixed-hand repeated-seed assertions; *Counts played cards* (four 3s visible â†’ commits tier-9 line); *Holds the macho for baza 3*; *Bluff frequency bounded*; *Marker-aware falta discipline*; *Pairwise separation* (â‰¥200 games/difficulty, shared seeds; aggression + fold-rate gaps exceed documented thresholds, e.g. Easy folds â‰¥5% strong vs Hard â‰¤1%); *Persona variety* (10 seeded matches â†’ â‰¥4 distinct).
  - Done: GREEN by iterating knobs ONLY â€” never hidden-info shortcuts (fairness is spec, not tuning material).

- [x] **5.4 [P4][REDâ†’GREEN] CPU controller hook**
  - Files: `features/truco/hooks/useTruCpuGame.ts`; `hooks/__tests__/useTruCpuGame.test.tsx` (fake timers).
  - Do (D10 loop): human action â†’ `applyAction` â†’ while `playerToAct === cpu` && !matchEnd: `setTimeout(delayConstant)` â†’ `ai.decide(buildCpuDecisionInput(state, cpuSlot), rng)` â†’ `applyAction`; rng seeded from menu; ZERO network calls; match_end records `truCpuStatsStore.recordMatchResult`; `reset()` for Play Again (same difficulty/target, zero residual state â€” *Play again restarts cleanly*).
  - RED: scheduling CONSTANT asserted (never wall-clock); stats recorded; reset clears.
  - Done: green.

- [x] **5.5 [P6][REDâ†’GREEN] PlayingCard primitive**
  - Files: `apps/frontend/src/components/game/PlayingCard.tsx` (empty dir EXISTS â€” generic primitive lands here, serves BOTH modes); `components/game/__tests__/PlayingCard.test.tsx`.
  - Props `{card?: CardId; faceDown?: boolean; size?: 'sm'|'md'|'lg'; onClick?}`; CSS/SVG only â€” numeral + suit glyphs (oro coin / copa cup / espada sword / basto baton inline paths); *Forty unique faces* (snapshot all 40 ids, each unique, none equals the uniform back); *No asset requests* (zero `<img>`/url()); deterministic snapshots; alt via `t('truco.card.alt')` + `t('truco.suit.*')` (both locales).
  - **W2 proxy assertions start HERE and repeat in 5.6**: fixed-width classes (`w-[â€¦]`/clamp-based arbitrary values â€” never viewport-% widths), root containers `overflow-x-hidden`, flex children `min-w-0`/shrink-safe, ActionBar `flex-wrap`. jsdom computes no scrollWidth â€” honest proxy per design Â§Testing Strategy; real measurement is the manual gate in Phase 8.
  - Done: green.

- [x] **5.6 [P6][REDâ†’GREEN] Table components + valid-actions-only**
  - Files: `features/truco/components/{TrucoTable,RivalZone,TableZone,MyZone,ActionBar,CallFeedbackBanner,EndScreen}.tsx`; `components/__tests__/table.test.tsx`.
  - *Zone composition invariant*: TOP rival (avatar, nickname, score/target, face-down count, turn indicator) / CENTER (baza cards per owner, won/tied markers, banner) / BOTTOM (my score, hand â‰¤3, ActionBar). Both modes reuse these.
  - Valid-actions-only: ActionBar renders EXCLUSIVELY from `legalActions(publicCtx, mySlot)` â€” cards clickable only when legal AND my turn (*Turn gating*); call buttons enabled only when legal (*Only legal calls shown*: after first card, zero envido controls); pending-on-me â†’ Quiero/No Quiero + entitled raises (*Responder-only answers*: retruco on me shows Vale Cuatro if legal); pending-on-opponent â†’ waiting indicator, NO answer controls. ZERO UI-side rules logic.
  - CallFeedbackBanner: latest TrucoEvents â€” caller + localized call + outcome; persists until superseded; accepted showdown reveals BOTH values + winner highlight (*Full chain visible* ends "No quiero â€” +2 to {winner}"; *Showdown reveals values*).
  - EndScreen: Won/Lost (+Draw conditional, unreachable v1 â€” parity with shared pattern), final scores + target, four actions Play Again / Change Mode(`/truco`) / Back(history) / Geotano(`/`) (*Winner view*).
  - i18n (both locales): `truco.call.*`, `truco.answer.*`, `truco.difficulty.*`, `truco.turn.you|opponent`, `truco.score`, `truco.target`, `truco.end.*`, `truco.action.*`. Sounds: wire the 10 gated fns to their trigger events.
  - Done: green.

- [x] **5.7 [P2/P4][REDâ†’GREEN] TruCpuPage assembly + menu CPU side**
  - Files: `features/truco/TruCpuPage.tsx` (hook + TrucoTable + EndScreen); extend `TrucoMenuPage.tsx` (difficulty/target/persona pickers â†” `trucoPrefsStore`, default target **30** per S4; Start; stats card using 4.3 selectors); `__tests__/TruCpuPage.test.tsx`, `TrucoMenuPage.test.tsx`.
  - Cases: *Prefs survive reload* (Hard+15 preselected); *Difficulty selection drives behavior*; persona rendered; minimal playable-loop render test (deal â†’ play â†’ baza outcome visible).
  - Done: green; manual smoke â€” full CPU match winnable on Easy.

- [x] **5.8 [CU5 gate]** `pnpm test:frontend`; AI suite runtime budget check (<60s â€” reduce sample counts ONLY down to spec minimums); manual CPU smoke all difficulties. Commit CU5.

## Phase 6 â€” Multiplayer screen (CU6 Â· P5 + P6/P7 finish)

- [x] **6.1 [P5][REDâ†’GREEN] Socket listener plumbing**
  - Files: `apps/frontend/src/lib/socket.ts` â€” additive register-on-connect `truco:*` listeners delegating to `setTrucoHandlers({onStateChanged,onInvite,onPlayerJoined,onFinished})` (mirror of `setMatchFinishedHandler`; page sets handler in effect, cleanup nulls).
  - Tests: `src/lib/__tests__/socket.truco.test.ts` (mock socket.io-client) â€” *Listener hygiene* (mount/unmount/remount across reconnect â†’ exactly ONE handler set per event); defensive ignore of any push carrying hand data.
  - Done: green; `lib/socket.ts` internals otherwise untouched (non-goal).

- [x] **6.2 [P5][RED→GREEN] Query hook**
  - Files: `features/truco/hooks/useTrucoMultiplayer.ts`; `hooks/__tests__/useTrucoMultiplayer.test.tsx` (mock api/socket â€” `MultiplayerPage.test.tsx` precedent).
  - Do: TanStack Query `['truco-match', id]`; mutation postAction `{expectedVersion, action}`; on 409 `version_conflict` â†’ invalidate/refetch authoritative, NO local mutation (*Concurrent conflicting actions*, *Replay safety* UX); `truco:state-changed` â†’ `invalidateQueries(['truco-match', id])` (*Instant opponent update* ~1s).
  - **S5 DO-NOT-REVERT NOTE:** poll fallback = TanStack `refetchInterval: 10_000` living ON THE QUERY â€” deliberately NOT `setInterval` like MultiplayerPage (design D9): Query-native polling shares cache/dedup/lifecycle, auto-cancels on unmount, and converges identically when sockets are down (*Poll fallback*); reverting reintroduces the timer-leak/duplicate-fetch class of bugs the design rejected.
  - Reload restores from GET (*Reload mid-betting*: pending retruco answerable immediately); NO auto-forfeit; `user:online/offline` presence marks opponent absence; invite handler prompts navigate.
  - Done: green â€” hook returns snapshot/view/mySlot/opponentUserId/opponentPresence/postAction/actionError; 409â†invalidate-only recovery pinned; presence honest ('unknown' for non-friend opponents, server gates presence by friendship). `onInvite` navigation wiring lands with the match page (6.3). 14 tests.

- [x] **6.3 [P5][RED→GREEN] Match page + menu create/join + API client**
  - Files: `features/truco/TrucoMatchPage.tsx` (hook + shared table components + EndScreen); extend `TrucoMenuPage.tsx` (create w/ target picker → POST `/api/truco/matches`; join-by-code input → S3 convenience pre-check GET → POST join → navigate); `lib/api.ts` truco client fns (centralized headers/auth per conventions); `__tests__/TrucoMatchPage.test.tsx`.
  - Cases: creator sees Start only from `ready`; guest sees waiting state, no start control (**W1 mirrored in UI**); actions via ActionBar with current version; match_end → EndScreen + `truco:finished` handled; multiplayer Play Again = REMATCH via re-create with friendId (D8: no new endpoint); 409 third-player message surfaced; i18n `truco.multi.*` + `truco.error.*` (both locales).
  - Done: green. Landed across commits 4344156 (menu create/join-by-code + typed trucoApi), 8872e91 (lobby states, W1 mirrored), bcd42c7 (table view, presence indicator, 409 syncing banner) and 89f59c3 (EndScreen wiring, friend rematch + NOT_FRIENDS menu fallback, reload-mid-betting pin). Multiplayer sounds intentionally absent: REST DTO carries no event stream per D8/D9 redaction and no Phase 6 task mandates it — trigger coverage lives in CU4/CU5 surfaces.

- [x] **6.4 [CU6 gate]** `pnpm test` full monorepo; manual two-browser flow IF local DB available (create→join→start→actions→end→reload mid-betting). Commit CU6.
  - Done: root pnpm test green (shared 143 + backend 471 + frontend 744); check-types green (fixed pre-existing Wrapper children TS2741 from bcd42c7 in 89f59c3). Manual two-browser flow NOT run in apply env (no local DB/browser automation) — deferred to Phase 8 verification gate #6, whose automated stand-ins (route/service suites incl. version_conflict + cold-start persistence logic) are green.

## Phase 7 â€” Docs & reconciliation (CU7 Â· P7)

- [x] **7.1 Proposal wording fix (design Reconciliation #1):** edit `openspec/changes/truco-argentino/proposal.md` question-round item 1 â†’ "configurable 15/30, default 30 (spec-pinned)"; mark assumptions 2â€“5 confirmed-by-design.
- [x] **7.2 Docs** (follow repo docs convention â€” README section or `docs/`): start-a-match (CPU + friend), engine overview (location, S6 layering, purity/RNG injection), AI difficulties + fairness firewall, multiplayer (version concurrency, pushes + S5 poll rationale, resume semantics), routing/nav, adding a difficulty/rules, running tests (single-test commands per `.github/copilot-instructions.md`). Include S3 additive-endpoint and W1 creator-only notes so future edits don't regress them.
  - Done: `docs/truco.md` created (repo had no docs/ dir; content spans shared+backend+frontend so a repo-level guide beats a feature-local README). Covers match start, S6 engine layout + state/action model, rules-modification map (file â†’ guarding suites), AI firewall + step-by-step new-difficulty recipe, CAS multiplayer flow + redaction + S5 poll rationale, routing touchpoints, test commands (incl. `pnpm --filter @geotano/shared exec vitest run` quirk), i18n parity gate, W1/S3/S4/S5 guardrails. Reconciliation extras in same unit: config.yaml testing block updated to Vitest-v3 strict-TDD reality (explore.md suggestion); planning artifacts staged for the PR trail.

## Phase 8 â€” Final verification gate (no commit) â€” maps to PRD Â§33 acceptance

> Status note (apply batch G): AUTOMATED gates executed post-CU7 â€” root `pnpm test` green (1,358: shared 143 + backend 471 + frontend 744), `pnpm build` green, `pnpm check-types` green. MANUAL gates PENDING for verify/human: two-browser multiplayer walkthrough (#6), full CPU matches on all three difficulties by hand (#3 partial â AI contract suites green), devtools illegal-action probe (#7 manual half), and the 360Ã—640 visual walkthrough with desktop scale-up (#10). Not checked here; verify phase owns them.
>
> Status note (remediation, complete): consolidated review fixes landed as fb24b2a (CI gate), 19ad9cf + cb7e9ea (engine envido turn guard, backend corrupt-state degrade / friendId guard / opaque 500s), 894e3a1 + 08c1b12 + 933ee20 (personaAt centralization, rival avatar slot + hard-AI per-hand think delays, global invite banner), bb147ca (start-CAS WHERE structural pin), 13d8b6a (shared turn-query helper isAwaitingOpponent, stale-board banner, benign-race amber recovery for E_OUT_OF_TURN / E_STATE_FORBIDDEN, rematch error banner), 1a66de0 + 75f28d4 (envido stake constants with spec citation, unreachable branch + dead export removal, statusOf + TRUCO_DIFFICULTIES single-sourcing), 709b7d3 (docs touch-up). Post-remediation automated gates re-run green: shared 145 + backend 483 + frontend 768 = 1,396 tests, check-types 3/3, build green. Manual gates above remain pending.

1. **Geotano intact** â€” full `pnpm test` green; pre-existing 988 quiz tests unmodified; additive-only diff audit (quiz surfaces touched: `HomePage.tsx` one button only).
2. **Nav both ways** â€” AppShell item â†’ `/truco` renders; HomePage button; `/truco` reciprocal Geotano button â†’ `/` (tests + manual click-through).
3. **CPU match playable all difficulties** â€” manual full matches Easy/Medium/Hard; AI contract suites green; distinctness proven (Pairwise separation).
4. **Full rules correct** â€” shared GWT suite green covering every named scenario (hierarchy tiers, parda cascade Ã—6, envido stake matrix Ã—9, falta formulas, truco chain deadlines, targets 15/30/default-30).
5. **Marker correct** â€” scoreboard reflects envido-first settlement, refusal payouts, inclusive â‰¥target end; scores never decrease (engine property + RivalZone/MyZone display tests).
6. **Multiplayer joinable (if infra allows)** â€” two-session manual create/join/start/play/end + reload persistence; automated stand-in: route/service suites (incl. version_conflict, cold-start persistence logic).
7. **Invalid actions rejected** â€” client ActionBar gating tests + server 400 `E_*` passthrough tests; manual devtools probe (out-of-turn play, envido after first card) â†’ rejected, state unchanged.
8. **Tests pass** â€” `pnpm test` (turbo, shared included) green.
9. **Build passes** â€” `pnpm build` + `pnpm lint` + `pnpm check-types` green.
10. **Responsive (W2)** â€” automated proxies green (fixed card widths `w-[â€¦]`, `min-w-0`/flex-shrink patterns, `overflow-x-hidden` game container, wrapped action bar) PLUS **explicit MANUAL VISUAL CHECK**: 360Ã—640 walkthrough of menu/table/action bar/end screen with zero horizontal scroll and every control visible/tappable; desktop scale-up preserves zone composition. NO Playwright, NO new deps.

Plus proposal criteria: i18n parity green Â· sounds mute-respect verified Â· prefs/stats persisted under namespaced `truco-*` keys Â· docs present (7.2).
