# Proposal: Geotano Core

## Intent

Complete geography quiz game (flags, capitals, continents) with friend chat, rankings, and bilingual UI. Zero-budget greenfield — all UN countries seeded from REST Countries v5.

## Scope

**In**: Quiz engine (timer, lives, streaks, scoring), 5 game modes, JWT auth, friend system (username + invite link), real-time chat, global+frends rankings (forever + daily), dark/light mode, Spanish/English i18n, responsive mobile-first UI.

**Out**: OAuth, push notifications, read receipts, audio, admin panel, seasons, Redis.

## Capabilities

### New
- `user-auth`: register/login, JWT stateless auth, unique username enforcement
- `countries-data`: seeded geography (flags, capitals, continents, codes) from REST Countries v5
- `quiz-gameplay`: question engine, timer countdown, lives system, streak tracking, score calculation
- `game-modes`: 5 variants (flag→country, capital→country, country→flag, continent, free mixed)
- `friend-system`: bidirectional requests, username search, shareable invite links
- `friend-chat`: real-time WebSocket (Socket.io) between accepted friends
- `rankings`: global + friends leaderboards, per category, cumulative forever + daily snapshots
- `dark-light-mode`: localStorage-persisted theme toggle via Tailwind `class` strategy
- `i18n`: react-i18next, en.json + es.json, language toggle in settings

### Modified
None — greenfield project.

## Approach

Turborepo + pnpm monorepo: `apps/frontend` (Vite+React+Tailwind+shadcn), `apps/backend` (Fastify+Drizzle), `packages/shared` (types). REST Countries v5 seeded into Neon PostgreSQL. Quiz engine in backend; TanStack Query on frontend. Socket.io on Fastify for chat. JWT + bcrypt for auth. Render (web) + Neon (DB). Mobile-first responsive via Tailwind breakpoints.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Render cold starts 30-60s | High | cron-job.org ping; acceptable for casual game |
| Neon 3 GB storage limit | Low | Tiny dataset — monitor growth |
| JWT without refresh tokens | Med | Add refresh rotation before real users |
| Socket.io on free Render | Med | Chat is secondary; cold start tolerable |

## Rollback Plan

`drizzle-kit drop` + revert Git commit. Greenfield — no production data at risk.

## Dependencies

REST Countries v5 API (free tier), Render free tier, Neon free tier PostgreSQL, cron-job.org (keep-alive pings).

## Success Criteria

- [ ] 5 game modes work with real country data
- [ ] Register, login, play full quiz session
- [ ] Scores persist on global leaderboard
- [ ] Add friends via username and invite link
- [ ] Real-time chat between accepted friends
- [ ] Dark/light mode persists across sessions
- [ ] UI renders correctly at 320px+ and desktop
- [ ] Spanish/English toggle functional
