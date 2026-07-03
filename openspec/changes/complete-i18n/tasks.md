# Tasks: Complete i18n Overhaul

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700–900 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (exception accepted) |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + translation keys + frontend strings | Single PR | User accepted exception — no review limit |

## Phase 1: Foundation — Hooks, Components, Translation Keys

- [ ] 1.1 Create `apps/frontend/src/hooks/useLanguage.ts` — `useLanguage` hook with `lang`, `setLang`, `formatDate`, `formatTime` using `Intl.DateTimeFormat` with i18n locale
- [ ] 1.2 Create `apps/frontend/src/components/LanguageToggle.tsx` — shared toggle (pill button \/ text label) with top-bar variant + mobile FAB variant, reads/writes `localStorage` + `i18n.changeLanguage()`
- [x] 1.3 Modify `apps/frontend/src/i18n/en.json` — add ~55–70 keys (domains: `errors.*`, `friends.*`, `chat.*`, `settings.*`, `auth.*`, `profile.*`, `achievements.*`, `app.*`, `notifications.*`)
- [x] 1.4 Modify `apps/frontend/src/i18n/es.json` — add same keys as en.json + 5 missing `quiz.leave*` keys; verify full key parity (216 keys each, perfect parity)

## Phase 2: Component Wiring — Global Toggle

- [x] 2.1 Modify `apps/frontend/src/components/AppShell.tsx` — replace `LanguageSwitcher` import with `LanguageToggle`; add to top-bar (desktop) + floating FAB (mobile <640px); translate hamburger `aria-label`
- [x] 2.2 Modify `apps/frontend/src/features/auth/LoginPage.tsx` — remove inline LanguageToggle; import shared `LanguageToggle mobile`; translate hardcoded strings (OR, placeholders, google messages, error fallbacks)
- [x] 2.3 Modify `apps/frontend/src/features/auth/RegisterPage.tsx` — same pattern as LoginPage

## Phase 3: Backend Quiz Localization

- [ ] 3.1 Modify `apps/backend/src/services/quizEngine.ts` — add `lang` param to `getQuestionText()`/`getAnswerText()`; return ES templates with `nameEs`/`capitalEs` when `lang=es`, fallback to EN otherwise
- [ ] 3.2 Modify `apps/backend/src/routes/quiz.ts` — accept `?lang` query param; forward to `startSession` and `submitAnswer`; default `en`

## Phase 4: Backend Error Translation

- [ ] 4.1 Modify `apps/backend/src/routes/auth.ts` — add `errorCode` field to all error responses (e.g. `INVALID_CREDENTIALS`, `EMAIL_EXISTS`)
- [ ] 4.2 Modify `apps/backend/src/routes/friends.ts` — add `errorCode` field to all error responses (e.g. `FRIENDS_NOT_FOUND`, `ALREADY_FRIENDS`)

## Phase 5: Frontend Hardcoded String Cleanup

- [ ] 5.1 Modify `apps/frontend/src/lib/api.ts` — append `?lang=` from `i18n.language` on every request; replace "Session expired" with `t('errors.session_expired')`
- [ ] 5.2 Modify `apps/frontend/src/store/authStore.ts` — translate catch fallback messages via `i18n.t()`
- [ ] 5.3 Modify `apps/frontend/src/store/friendsStore.ts` — translate ~10 catch fallback messages via `i18n.t()`
- [ ] 5.4 Modify `apps/frontend/src/features/friends/FriendsPage.tsx` — replace ~15 hardcoded strings with `t()`
- [ ] 5.5 Modify `apps/frontend/src/features/friends/ChatPage.tsx` — translate "Online"/"Offline", "Select a friend", "Back to Friends"
- [ ] 5.6 Modify `apps/frontend/src/features/settings/SettingsPage.tsx` — translate placeholders, validation text, catch fallbacks
- [ ] 5.7 Modify `apps/frontend/src/features/profile/ProfilePage.tsx` — translate "User ID is missing"
- [ ] 5.8 Modify `apps/frontend/src/components/NotificationBell.tsx` — translate `getDescription()` fallback format string
- [ ] 5.9 Modify `apps/frontend/src/components/ui/AchievementBadge.tsx` — translate GOLD/SILVER/BRONZE tier labels
- [ ] 5.10 Modify `apps/frontend/src/features/quiz/QuizPage.tsx` — translate leave modal `||` fallbacks and streak fallback text

## Phase 6: Testing

- [ ] 6.1 Unit test `useLanguage` — `formatDate`/`formatTime` return locale-aware output for `en` and `es`
- [ ] 6.2 Unit test `quizEngine.getQuestionText()`/`getAnswerText()` — `lang='es'` uses `nameEs`/`capitalEs`; `lang='en'` uses English; invalid lang falls back to `en`
- [ ] 6.3 Unit test `api.ts` interceptor — assert `?lang=` appended matching `i18n.language` value
- [ ] 6.4 Integration test — LanguageToggle switches locale; page re-renders in selected language
- [ ] 6.5 E2E grep scan — verify zero residual hardcoded English strings in modified files

## Phase 7: Cleanup

- [ ] 7.1 Delete `apps/frontend/src/components/LanguageSwitcher.tsx`
- [ ] 7.2 Scan all files for remaining imports of `LanguageSwitcher`; replace any missed references
