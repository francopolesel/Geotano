# Tasks: Geotano Core

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 3,000–5,000+ |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + Backend → PR 2: Frontend → PR 3: Social → PR 4: Rankings/Settings → PR 5: Tests |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Monorepo + shared types + DB schema + auth + seed | PR 1 | Base: main. Foundation & core backend complete. |
| 2 | Router + auth UI + home + quiz gameplay | PR 2 | Depends on PR 1. Frontend core complete. |
| 3 | Friend system API/UI + Socket.io + chat UI | PR 3 | Depends on PR 2. Social features complete. |
| 4 | Rankings API + UI + dark/light + i18n | PR 4 | Depends on PR 3. Settings & leaderboards. |
| 5 | Unit tests + integration tests + responsive QA | PR 5 | Depends on PR 4. Final polish. |

## Phase 1: Foundation & Infrastructure

- [x] 1.1 Init Turborepo + pnpm workspace; create root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.json`
- [x] 1.2 Create `packages/shared/src/types/index.ts` with `Country`, `GameSession`, `QuizQuestion`, `QuestionType`, socket event constants
- [x] 1.3 Scaffold `apps/backend/src/` with Fastify server entry, CORS plugin, env config, health endpoint
- [x] 1.4 Scaffold `apps/frontend/` with Vite + React + Tailwind v4 + shadcn/ui + Zustand + TanStack Query
- [x] 1.5 Create `.env.example`, Dockerfile(s) for backend, Render config stubs

## Phase 2: Core Backend

- [x] 2.1 Define Drizzle schema: `users`, `countries`, `game_sessions`, `game_answers`, `friend_requests`, `friends`, `chat_messages`, `rankings` tables + migrations
- [x] 2.2 Implement auth routes: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` + JWT sign/verify middleware + bcrypt hashing
- [x] 2.3 Create `scripts/seed-countries.ts` — fetch REST Countries v5, upsert all UN members
- [x] 2.4 Build quiz engine: `GET /quiz/session` (start), `POST /quiz/answer` (submit + score), lives/streak/scoring logic
- [x] 2.5 Define game mode configs (5 types) with question generation rules per mode

## Phase 3: Core Frontend

- [x] 3.1 Set up React Router with auth guard, app shell layout (sidebar/nav + main area)
- [x] 3.2 Build register page + login page with form validation and JWT storage
- [x] 3.3 Build home/dashboard page with mode selection cards, start quiz CTA
- [x] 3.4 Build quiz gameplay UI: question display + 4 options + timer bar + lives indicator + streak counter

## Phase 4: Social Features

- [x] 4.1 Implement friend system API (`POST /friends/request`, `GET /friends`, `POST /friends/accept`, `GET /users/search`, invite link) + frontend friends list + search + request UI
- [x] 4.2 Set up Socket.io on Fastify with JWT auth middleware + chat event handlers (`chat:send`, `chat:message`, `user:online`, `user:offline`) + `chat_messages` persistence
- [x] 4.3 Build chat UI: conversation list, message bubbles, input with send, scroll-to-bottom, online indicator

## Phase 5: Rankings & Settings

- [x] 5.1 Implement rankings API (`GET /rankings?scope=global|friends&mode=X&period=forever|daily`) — top 100 + user rank
- [x] 5.2 Build rankings UI: leaderboard table with avatar, username, score columns + mode/period toggles
- [x] 5.3 Implement dark/light toggle: Tailwind `class` strategy, localStorage persistence, `prefers-color-scheme` default
- [x] 5.4 Implement i18n: react-i18next setup, `en.json` + `es.json`, settings toggle without page reload

## Phase 6: Testing & Polish

- [x] 6.1 Unit tests: auth hash/verify, JWT sign/verify, quiz scoring algorithm, Zustand stores
- [x] 6.2 Integration tests: all API routes via Fastify `inject()` with test DB; Socket.io send/receive
- [x] 6.3 Responsive QA pass: 320px+ mobile, tablet, desktop layout verification
