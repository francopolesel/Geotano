# Design: Complete i18n Overhaul

## Technical Approach

Five independent work streams: (1) global LanguageToggle component replacing two ad-hoc switchers, (2) ~70 new `t()` keys across 15 frontend files, (3) backend `?lang=` param in quiz endpoint using `nameEs`/`capitalEs`, (4) backend error translation via `?lang=` param (not `Accept-Language`), (5) i18n-aware date/time formatters. All backend changes are backward-compatible — default `en` when no `?lang` present.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Toggle placement | `AppShell` top-bar, plus mobile FAB | Sidebar only, auth-page only | Spec requires visibility on ALL pages at ALL breakpoints. Auth pages (Login/Register) render outside AppShell, so they need a standalone rendered toggle too. |
| Mobile toggle | Floating pill button bottom-right | Hamburger menu, top-bar | Spec: accessible in under 2 taps, visible at <640px without hamburger. |
| Auth page toggle | Remove inline `LanguageToggle`, render new `LanguageToggle` directly in LoginPage/RegisterPage | Import shared component | Both auth pages already have the same inline component — extract to shared `LanguageToggle` replacing the old `LanguageSwitcher`. |
| Backend lang param | `?lang=` query on quiz endpoint | `Accept-Language` header, cookie | Spec says `?lang=` explicitly. Simpler for the frontend to pass, no header parsing. |
| Error translation | Backend returns error codes (`errorCode` field), frontend maps via `t()` | Backend returns translated strings | Avoids maintaining translation bundles on the backend. Frontend already has i18next. Backend sends structured errors like `{ errorCode: "FRIENDS_NOT_FOUND", message: "..." }`. |
| Date/time formatting | New `useLanguage` hook wrapping `Intl.DateTimeFormat` with locale from i18n | Direct `toLocaleString()` calls | `toLocaleString(undefined, ...)` uses browser default, not the app's current language. Need explicit locale. |
| Quiz question templates | Backend stores both EN/ES question template strings | Single template with switch | Question templates are few (5 types × 2 lang = 10 strings). No DB schema change needed — hardcode in `quizEngine.ts`. |

## Data Flow

```
Frontend                           Backend
───────────────────────────────────────────────────────
LoginPage/RegisterPage
  └─ <LanguageToggle /> ── i18n.changeLanguage()
     └─ localStorage.setItem('locale')
     └─ api requests now include ?lang=es (via api.ts interceptor)

AppShell (authenticated pages)
  └─ top-bar <LanguageToggle /> ── same pattern
  └─ mobile FAB visible <640px

QuizPage ──GET /api/quiz/session?mode=X&lang=es──→ quiz.ts
  ←── { questionText, options } with nameEs/capitalEs

api.ts ── appends ?lang= from i18n.language on every request
  └─ Backend returns { errorCode, message }
  └─ Frontend maps errorCode via t(`errors.${errorCode}`)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/frontend/src/components/LanguageToggle.tsx` | Create | New global language toggle — used by AppShell, LoginPage, RegisterPage |
| `apps/frontend/src/hooks/useLanguage.ts` | Create | Hook exposing `lang`, `setLang`, `formatDate`, `formatTime` |
| `apps/frontend/src/i18n/en.json` | Modify | Add ~55 new keys (errors, placeholders, labels) |
| `apps/frontend/src/i18n/es.json` | Modify | Add same ~55 keys + fill 5 missing quiz.leave* keys |
| `apps/frontend/src/components/AppShell.tsx` | Modify | Replace `LanguageSwitcher` with `LanguageToggle` in top-bar + mobile FAB |
| `apps/frontend/src/components/LanguageSwitcher.tsx` | Delete | Replaced by LanguageToggle |
| `apps/frontend/src/features/auth/LoginPage.tsx` | Modify | Remove inline `LanguageToggle`, import shared one; translate hardcoded strings |
| `apps/frontend/src/features/auth/RegisterPage.tsx` | Modify | Same as LoginPage |
| `apps/frontend/src/lib/api.ts` | Modify | Append `?lang=` to all requests; remove hardcoded "Session expired" string |
| `apps/frontend/src/store/authStore.ts` | Modify | Translate catch fallback messages via `i18n.t()` |
| `apps/frontend/src/store/friendsStore.ts` | Modify | Translate 10+ catch fallback messages via `i18n.t()` |
| `apps/frontend/src/features/friends/FriendsPage.tsx` | Modify | Replace ~15 hardcoded strings with `t()` |
| `apps/frontend/src/features/friends/ChatPage.tsx` | Modify | Translate "Online"/"Offline", "Select a friend", "Back to Friends" |
| `apps/frontend/src/features/settings/SettingsPage.tsx` | Modify | Translate hardcoded placeholders, validation text, catch fallbacks |
| `apps/frontend/src/features/profile/ProfilePage.tsx` | Modify | Translate "User ID is missing" |
| `apps/frontend/src/components/NotificationBell.tsx` | Modify | Translate `getDescription()` fallback format |
| `apps/frontend/src/components/ui/AchievementBadge.tsx` | Modify | Translate GOLD/SILVER/BRONZE tier labels |
| `apps/frontend/src/features/quiz/QuizPage.tsx` | Modify | Translate leave modal fallbacks (`||` operator), streak fallback text |
| `apps/backend/src/routes/quiz.ts` | Modify | Accept `?lang` param, forward to `startSession`/`submitAnswer` |
| `apps/backend/src/services/quizEngine.ts` | Modify | `getQuestionText()`/`getAnswerText()` accept `lang` param, use ES templates + `nameEs`/`capitalEs` |
| `apps/backend/src/routes/auth.ts` | Modify | Add `errorCode` field to error responses |
| `apps/backend/src/routes/friends.ts` | Modify | Add `errorCode` field to error responses |

## Interfaces / Contracts

```typescript
// apps/frontend/src/hooks/useLanguage.ts
interface UseLanguageReturn {
  lang: 'en' | 'es';
  setLang: (lang: 'en' | 'es') => void;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

// Backend error contract
interface ApiErrorResponse {
  errorCode?: string;  // e.g. "FRIENDS_NOT_FOUND", "SESSION_EXPIRED", "INVALID_CREDENTIALS"
  message: string;     // English fallback
}

// Quiz route — GET /api/quiz/session?mode=X&lang=es
// startSession(userId, modeSlug, lang?) — lang param added
// getQuestionText(country, questionType, lang?) — lang param added
// getAnswerText(country, questionType, lang?) — lang param added
```

## Translation Key Structure

Pattern: `domain.element.modifier`

New key domains:
```
errors.auth.loginFailed        // "Login failed"
errors.auth.registrationFailed // "Registration failed"  
errors.friends.loadFailed      // "Failed to load friends"
errors.friends.requestFailed   // "Failed to send request"
errors.friends.inviteInvalid   // "Invalid invite code"
errors.common.sessionExpired   // "Session expired"
errors.common.generic          // "Something went wrong"
errors.common.saveFailed       // "Failed to save"
```

```
friends.online                 // "Online"
friends.offline                // "Offline" 
friends.selectChat             // "Select a friend to chat with"
friends.back                   // "Back to Friends"
friends.searchPlaceholder      // "Search by username..."
friends.inviteCodeLabel        // "Your invite code"
friends.inviteCodeHint         // "Share this code..."
friends.addByCode              // "Add by invite code"
friends.addByCodeHint          // "Paste a friend's invite code..."
friends.addByCodePlaceholder   // "Paste invite code..."
friends.buttonCopy             // "Copy"
friends.buttonCopied           // "Copied!"
friends.buttonAddFriend        // "Add friend"
friends.adding                 // "Adding..."
friends.addedSuccess           // "Friend added successfully!"
friends.incoming               // "Incoming"
friends.outgoing               // "Outgoing"
friends.noPending              // "No pending requests"
friends.noUsersFound           // "No users found"
friends.emptyHint              // "Search for users or share your invite code to connect!"
friends.findFriends            // "Find friends"
friends.count                  // "{{count}} friend"
friends.count_plural           // "{{count}} friends"
friends.onlineCount            // "{{count}} online"
```

```
chat.online                    // "Online"
chat.offline                   // "Offline"
chat.selectFriend              // "Select a friend to chat with"
chat.back                      // "Back to Friends"
```

```
settings.usernameHint          // "Only letters, numbers, and underscores..."
settings.passwordPlaceholder   // "••••••••"
settings.bioPlaceholder        // "Tell us about yourself..."
settings.emailPlaceholder      // "you@example.com"
```

```
auth.googleError               // "Google sign-in failed"
auth.resetEmailFailed          // "Failed to send reset email"
auth.placeholderUsername       // "geotano_fan"
auth.orDivider                 // "OR"
auth.googleNotConfigured       // "Google sign-in not configured..."
```

```
profile.userIdMissing          // "User ID is missing"
```

```
notifications.fallback         // "{{name}} — {{label}}"
```

```
achievements.tier.gold         // "GOLD"
achievements.tier.silver       // "SILVER"
achievements.tier.bronze       // "BRONZE"
```

```
app.navToggle                  // "Toggle navigation"
```

```
quiz.streakLabel               // "🔥 {{count}} streak"
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useLanguage` hook — formatDate/formatTime with en/es | Render hook in test, assert output matches locale |
| Unit | `getQuestionText()` and `getAnswerText()` with `lang='es'` | Unit test quizEngine with lang param, assert ES field use |
| Unit | API error interceptor appends `?lang=` | Mock fetch, assert URL contains `?lang=en` or `?lang=es` |
| Integration | Language toggle switches locale across all pages | E2E: click toggle, assert page re-renders in selected language |
| Integration | Quiz endpoint with `?lang=es` returns localized content | API test: call with `?lang=es`, assert response uses nameEs |
| E2E | Hardcoded string inventory | Component scan: grep for un-translated English strings post-impl |

## Migration / Rollout

No migration required. Backend `?lang=` param defaults to `en` when absent. Frontend changes are DOM-only — no data or schema changes.

## Open Questions

- [ ] Should the `?lang=` interceptor in `api.ts` also apply to WebSocket connections (chat/socket.ts)? Socket auth already has token; locale could be sent as a socket event.
- [ ] AchievementBadge tier labels (GOLD/SILVER/BRONZE) — should these be translated or kept as universal English terms?
