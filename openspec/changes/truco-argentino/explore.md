# Exploration: truco-argentino

> SDD explore phase artifact. Research only — no code was modified.
> Date: 2026-08-21. All findings verified against the working tree (backend 415 tests, frontend 573 tests passing).

## Current State

### 1. Repo layout (verified, no stack drift)

- `pnpm@9.15.0` workspaces (`apps/*`, `packages/*`) + Turborepo 2.3 (`turbo.json`: dev/build/lint/check-types/test; `test` dependsOn `^build`).
- `apps/backend` (`@geotano/backend`): Fastify 5, Drizzle ORM 0.38 + Neon Postgres, Socket.IO 4.8, JWT (jsonwebtoken), tsx dev / tsc build, Vitest 3 (23 test files, 415 tests green).
- `apps/frontend` (`@geotano/frontend`): React 19, Vite 6, TS 5.7, Zustand 5, TanStack Query 5, react-router-dom v7, Tailwind v4 via `@tailwindcss/vite`, i18next 24, socket.io-client 4.8, Vitest 3 + Testing Library (35 files, 573 tests green).
- `packages/shared` (`@geotano/shared`): source-exported TS package (`main: ./src/index.ts`), no build step; exports types + constants only.
- Root scripts: `pnpm dev|build|lint|check-types|test|test:backend|test:frontend`.

### 2. Frontend routing

- Single file defines all routes: `apps/frontend/src/app/App.tsx` (`createBrowserRouter`).
- Structure: public `/login`, `/register` → protected branch wrapped by `<AuthGuard>` → layout branch `<NavSetup/><AppShell/>` → flat route children:
  `/` (HomePage), `quiz`, `friends`, `friends/chat/:userId`, `profile/:userId`, `rankings`, `settings`, `my-profile`, `multiplayer/:matchId`, `match-history`. Catch-all `*` → redirect `/`.
- Guards: `AuthGuard` component (redirects unauthenticated). Route errors: shared `RouteError`.
- **Where truco fits**: add sibling routes inside the AppShell children — e.g. `/truco` (menu), `/truco/cpu`, `/truco/match/:matchId`. No router refactor needed.

### 3. Entry/navigation surfaces

- `apps/frontend/src/components/AppShell.tsx` has a hardcoded `navItems` array (i18n label keys) rendered as sidebar links — a "Truco" entry is a one-line addition plus i18n keys.
- Geotano enters its game via `HomePage` (`features/quiz/HomePage.tsx`): hardcoded `MODE_GROUPS` cards → `navigate('/quiz?mode=<slug>')`.
- Friend challenges enter via `GameModePicker` modal (hardcoded `MODES`) → `POST /api/matches/challenge`; receiver gets a global `ChallengeNotification` overlay (mounted in AppShell) → accept navigates to `/multiplayer/:matchId`.

### 4. Multiplayer infra (CRITICAL findings)

- **Socket.IO server**: initialized in `apps/backend/src/socket/index.ts` AFTER `app.listen` (`initSocket(app)`), single default namespace, no rooms used anywhere. JWT middleware reads `socket.handshake.auth.token` → `(socket as any).userId`. In-memory `userSockets: Map<userId, Set<socketId>>` for multi-device delivery; resets on deploy (documented as acceptable MVP).
- **What sockets do today**: chat (`chat:send`/`chat:message`/`chat:error`), presence (`user:online`/`user:offline`), notification push (`notification:new`), and match pushes (`challenge:invite`, `challenge:accepted`, `match:finished`). **Sockets do NOT run game logic.**
- **Quiz 1v1 multiplayer is async & DB-backed over REST** (`services/matchService.ts`, `routes/matches.ts`): `match_challenges` → `match_games` (questionPool JSONB + per-player order) → `match_answers`. Lifecycle: createChallenge (friendship-checked) → acceptChallenge (generates pool) → startMatchPlay/submitAnswer/finishMatch per player independently → atomic completion (`completeMatchIfBothFinished` re-reads fresh scores; idempotent; monotonic finished flags; raw-SQL atomic score increments). Hourly `deleteExpiredMatches` cleanup (24h TTL) registered in `index.ts`.
- Real-time UX = REST polling every 10s (`POLL_INTERVAL_MS` in MultiplayerPage) + immediate socket push on completion.
- Event naming convention: `domain:event` lowercase. Truco can coexist with `truco:*` events without collision; room ids are unnecessary if we reuse the `getUserSocketIds(userId)` direct-emit pattern.
- **Client socket** (`lib/socket.ts`): module-level singleton; handlers registered inside `connectSocket` so they survive reconnects; pages register callbacks via setter functions (`setChatMessageHandler`, `setMatchFinishedHandler`); SPA navigation bridge via `setNavigateFn` (wired in `NavSetup`). Reconnects are socket.io-automatic (transports websocket+polling). Vite dev proxy forwards `/socket.io` (ws) and `/api`.

### 5. Server-side validation patterns

- `services/quizEngine.ts`: authoritative per-session state in in-memory Maps (`questionCache`, `questionPool` keyed by sessionId) + DB rows; strips sensitive fields (`correctAnswer`, internal ids) from client payloads; validates answer against cached state.
- `matchService.ts`: turn/participant ownership checks, time-expiry guards, idempotent re-entry, atomic DB updates, `{ message }` + `errorCode` error shape on routes, `authGuard` preHandler reading `(request as any).user.userId`.
- These are exactly the patterns a server-authoritative truco engine should follow (pure rules module + service wrapper + REST routes + optional socket push).

### 6. Reusable UI

- Design tokens: CSS variables in `apps/frontend/src/index.css` (`--color-background/foreground/primary/secondary/muted/accent/destructive/card/border/ring`), light + `.dark` theme. Tailwind v4 CSS-first (`@import "tailwindcss"` — no tailwind.config file).
- Component inventory: `AppShell`, `AuthGuard`, `RouteError`, `ThemeToggle`, `LanguageToggle`, `NotificationBell`, `ChallengeNotification`, `ui/UserAvatar`, `ui/VerifiedBadge`, `ui/AchievementBadge`, `ui/AvatarLightbox`. `components/game/` exists but is EMPTY (natural home for shared game UI).
- Animations: only a `spin-slow` keyframe + Tailwind hover transitions. No animation library installed.
- Buttons/modals have no shared primitives — pages define local `btnBase` constants and inline modal markup (see QuizPage/MultiplayerPage/GameModePicker). Truco UI should follow this same pragmatic pattern or extract primitives opportunistically.

### 7. Audio

- EXISTS: `lib/sounds.ts` — WebAudio oscillator-synth SFX (`playCorrect/playWrong/playClick/playGameOver/playGameWin`), gated by `store/soundStore.ts` (persisted `soundEnabled` in localStorage). jsdom mock in `test-setup.ts`.
- Truco reuses this infra directly: add new exported synth functions (card deal, envido jingle, truco call) following the same pattern. No audio assets exist anywhere.

### 8. Persistence (localStorage)

- Direct calls, no helper. Keys today: `locale`, `theme`, `soundEnabled`, `auth_token`, `auth_user`. Stores hydrate manually in `main.tsx` (`useThemeStore.getState().hydrate()` etc.). Truco local prefs/stats should follow the same store-owned-key pattern.

### 9. Tests

- Frontend: vitest config embedded in `vite.config.ts` (jsdom, globals, setupFiles `src/test-setup.ts`, include `src/**/*.test.{ts,tsx}`). Testing Library + jest-dom. Co-located feature tests + `src/__tests__/` for lib/store tests.
- Backend: `vitest.config.ts` (node env, include `src/**/*.test.ts`), tests in `src/__tests__/` with route-level and service-level suites (e.g. `matches.routes.test.ts`, `matchService.test.ts`, `socket.test.ts`).
- Commands: `pnpm test` (turbo), single file `pnpm --filter @geotano/backend vitest run src/__tests__/auth.test.ts`, by name `-t "..."`. `@vitest/coverage-v8` installed both sides but NO coverage thresholds configured anywhere.
- Note: `openspec/config.yaml` is stale (says testing None / strict_tdd false) while reality is strict TDD with Vitest — downstream phases should trust the repo, not config.yaml.

### 10. Build/deploy

- Build: turbo build → backend `tsc -p tsconfig.build.json` (dist), frontend `tsc --noEmit && vite build`.
- Deploy: `render.yaml` — backend Web Service (Render free plan, health `/api/health`, start `node dist/index.js`); frontend is a manually-created Render Static Site (`geotano-frontend.onrender.com`). Env vars: backend `DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, GOOGLE_*, SMTP_*`; frontend `VITE_API_URL`. No new env vars required by truco unless desired.
- IMPORTANT: Render free plan spins idle services down — anything held only in backend memory (including truco rooms) is wiped frequently and on every deploy.

### 11. @geotano/shared

- Exports: `types/index.ts` (UserProfile/Auth, Country, `GameModeSlug` closed union of 20 quiz slugs, QuizQuestion/Answer/SessionResult, Friends, Chat, Rankings, Notifications, Achievements, socket payload interfaces, multiplayer Match* types from `types/multiplayer.ts`, ApiError) and `constants/index.ts` (scoring/timer/JWT/API_PREFIX constants).
- Extension rule (from copilot-instructions): keep contracts here; `GameModeSlug` must stay synchronized across `packages/shared/src/types/index.ts`, `apps/backend/src/services/gameModes.ts`, and frontend mode surfaces (HomePage, RankingsPage, quiz params).
- KEY INSIGHT: `GameModeSlug` is a geography-quiz-specific closed union. Truco should NOT be shoehorned into it. Recommended: introduce a separate `GameSlug`/`TrucoVariant` type (or a broader `GameId = 'geotano' | 'truco'` discriminator) rather than widening `GameModeSlug` and forcing every quiz consumer to handle truco.
- The truco RULES ENGINE itself is an excellent candidate for `packages/shared` (pure TS, zero deps): the CPU opponent runs it client-side and the server uses the identical module for authoritative validation of 1v1 actions.

### 12. i18n

- Flat dot-keys (`"quiz.question"`, `"modes.flagGuess"`, `"multiplayer.challengeFrom"`); files `apps/frontend/src/i18n/en.json` + `es.json` (~380 lines each); consumed via `useTranslation()`/`Trans`. `i18n.test.ts` guards parity. Truco adds a `truco.*` namespace to BOTH files (card names, envido/truco/quiero/no quiero, scores, etc.).

### 13. Risk scan (what makes a second game hard)

1. **Async-vs-turnbased mismatch**: existing "multiplayer" lets both players play the same pool independently (race). Truco needs strict alternation with immediate visibility of the opponent's action. The current poll-every-10s UX would feel broken for truco without a push mechanism.
2. **Hardcoded mode lists in 4+ places**: HomePage `MODE_GROUPS`, GameModePicker `MODES`, RankingsPage `MODE_SLUGS`, backend rankings `VALID_MODE_SLUGS`, plus `GameModeSlug` union. A naive "add slug everywhere" approach pollutes quiz surfaces with card-game concepts.
3. **Rankings/profile stats are quiz-coupled**: rankings aggregate `game_sessions ⋈ game_modes`; profile stats count quiz games. Truco results need either their own tables/surfaces or explicit scope separation ("per game" stats).
4. **Single global socket + page-scoped handler setters**: a truco page must use the established pattern (register-on-connect stable handler + refs for fresh state) or risk duplicate/stale listeners across remounts/reconnects.
5. **In-memory volatility**: documented precedent says memory-only state is MVP-acceptable, but Render free spin-down makes memory-only truco rooms unusable in production; state must be DB-backed.
6. **No shared button/modal primitives**: more copy-paste styling unless small primitives are extracted during truco work.
7. **`POST /api/matches/challenge` does not validate `gameModeSlug`** against known modes (only non-empty) — reusable for truco challenges, but validation must be added when generalizing.

## Affected Areas

- `packages/shared/src/types/*` — new truco/game-discriminator contracts, socket payload types; optionally `packages/shared` gains the pure truco rules engine (or a new `packages/truco-engine`).
- `apps/backend/src/services/trucoService.ts` (new) — server-authoritative match state machine mirroring matchService patterns.
- `apps/backend/src/routes/truco.ts` (new) + registration in `routes/index.ts` and `index.ts`.
- `apps/backend/src/db/schema/*` (new truco tables or generalized match tables) + migration.
- `apps/backend/src/socket/index.ts` — add `truco:*` event handlers/pushes alongside chat (no namespace/room changes needed).
- `apps/frontend/src/app/App.tsx` — add `/truco/*` routes.
- `apps/frontend/src/components/AppShell.tsx` — nav item.
- `apps/frontend/src/features/truco/*` (new) — menu, CPU game, multiplayer game, hand UI.
- `apps/frontend/src/lib/socket.ts` — truco handler setters following existing pattern.
- `apps/frontend/src/lib/sounds.ts` — truco SFX.
- `apps/frontend/src/i18n/en.json`, `es.json` — `truco.*` keys.
- `apps/frontend/src/features/multiplayer/GameModePicker.tsx` or friends UI — challenge entry for truco (if friend challenges ship in v1).
- Tests: mirror conventions — backend `src/__tests__/truco*.test.ts`, frontend co-located `features/truco/*.test.tsx`.

## Approaches (multiplayer architecture)

1. **Socket-native in-memory rooms**
   - Classic socket.io game rooms; `truco:*` events; `Map<roomId, GameState>` server-side.
   - Pros: real-time feel; simplest mental model; lowest latency.
   - Cons: state lost on deploy AND on Render free spin-down; diverges from the DB-backed match lifecycle; no history/stats; not resumable.
   - Effort: Medium.

2. **DB-backed REST polling (mirror matchService exactly)**
   - Truco match state stored as JSONB row; actions via POST endpoints; clients poll for opponent moves.
   - Pros: durable, survives deploys/spin-down; consistent with existing patterns; free history; works within current infra with zero socket changes.
   - Cons: turn-based play on a 10s poll feels dead; short polling adds load; serialization complexity for full game state.
   - Effort: Medium-High.

3. **Hybrid: DB-authoritative state + Socket.IO change-push (RECOMMENDED)**
   - State lives in Postgres (JSONB column, versioned); every validated action mutates via REST (authGuard, ownership checks, idempotency — same as matchService); server then emits `truco:state-changed` (or targeted `truco:opponent-moved`) to the opponent's sockets via `getUserSocketIds`, triggering an instant refetch. Poll remains as fallback exactly like `match:finished` + 10s poll today.
   - Pros: durability + real-time UX; follows two existing precedents simultaneously (DB match lifecycle + post-mutation socket push); single socket connection reused; `truco:*` naming fits conventions; CPU mode needs none of this (pure client-side engine).
   - Cons: most moving parts; requires careful versioning/conflict handling for concurrent actions.
   - Effort: Medium-High (incremental: CPU first, then multiplayer).

## Recommendation

Approach 3 (hybrid), phased:

1. Put the **truco rules engine as a pure-TS module in `@geotano/shared`** (deck, envido, truco raises, turns, scoring to 15/30 points). Both the CPU opponent (frontend) and the server validator import the identical code — one source of truth, fully unit-testable with strict TDD.
2. Ship **vs CPU first** (frontend-only, zero backend surface) — instant playable value, exercises the engine + UI + sounds + i18n.
3. Add **1v1 vs friends** using the hybrid model: generalize or parallel the challenge lifecycle (friendship check, invite push, accept/decline), persist truco match state in Postgres, validate actions server-side through the shared engine, push `truco:*` notifications over the existing socket connection.
4. Keep truco OUT of `GameModeSlug` and quiz rankings in v1; give truco its own result surfaces (or a scoped section) to avoid touching quiz aggregates.

## Risks

- CRITICAL: Memory-only multiplayer state would be destroyed by Render free spin-down/deploys — truco match state MUST be DB-persisted (drives architecture choice).
- WARNING: `GameModeSlug`/mode-list coupling in 4+ files — adding truco there would leak card-game concepts into every quiz surface; use a separate game discriminator.
- WARNING: Single shared socket with setter-based handlers — truco handlers must follow the register-on-connect pattern or break on reconnect/remount (see MultiplayerPage screenRef pattern).
- WARNING: Turn-based UX depends on the new push path working; without it, 10s polling makes truco unplayable in practice.
- SUGGESTION: No shared modal/button primitives — truco will duplicate styling unless small primitives are extracted opportunistically.
- SUGGESTION: `openspec/config.yaml` is stale (testing null, strict_tdd false) vs actual strict-TDD Vitest setup — update during a later phase.
- SUGGESTION: i18n parity test will fail unless `truco.*` keys land in BOTH en.json and es.json.

## Ready for Proposal

YES. The codebase has clear precedents for every needed piece (DB-backed matches, socket push, auth, sounds, i18n, TDD conventions). The main proposal-phase decisions: (a) confirm hybrid architecture, (b) shared-package engine vs separate package, (c) whether friend challenges for truco reuse/generalize `match_challenges` or get dedicated tables, (d) v1 scope split CPU-first vs shipping both modes together.
