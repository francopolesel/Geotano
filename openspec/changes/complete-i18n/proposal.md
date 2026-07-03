# Proposal: Complete i18n Overhaul

## Intent

i18next + react-i18next are set up with en/es JSON files, but ~55 hardcoded English strings leak through the UI, `es.json` is missing 5 keys, the language switcher is hidden on mobile and absent from most pages, backend quiz questions are always English, and API errors are untranslated. Users cannot fully use the app in Spanish — the change makes good on the i18n contract.

## Scope

### In Scope
- Global persistent language selector visible on every page, every breakpoint
- 55+ hardcoded English strings → `t()` translation keys across all pages, stores, components
- `es.json` — fill 5 missing `quiz.leave*` keys, full key parity with `en.json`
- Backend quiz questions localized via `?lang=es` using existing `nameEs`/`capitalEs` fields
- Backend API error messages translated (auth, friends)
- Language-aware `toLocaleTimeString`/`toLocaleString` formatters

### Out of Scope
- 3rd-language support (French, Portuguese, etc.)
- RTL layout support
- `Accept-Language` header negotiation (use explicit `?lang=` param)
- Backend admin panel

## Capabilities

### New Capabilities
None — no new behavioral domains. This fills gaps in existing specs.

### Modified Capabilities
- `i18n` — expanded: global persistent language selector (mobile+desktop), 55+ translation keys for hardcoded strings, API error message i18n
- `quiz-gameplay` — new requirement: question texts MUST localize via `?lang=es` using `nameEs`/`capitalEs`

## Approach

1. Replace two ad-hoc switchers (sidebar `LanguageSwitcher` + auth-page `LanguageToggle`) with one persistent component in `AppShell` — sticky top-right on every page including mobile
2. Add `useLanguage` hook exposing `lang`, `setLang`, `formatDate`, `formatTime` helpers
3. Add ~70 translation keys to `en.json`/`es.json`; auto-generate key inventory from component scan for completeness
4. Backend: add `?lang=es` query param support to quiz endpoint — select `nameEs`/`capitalEs` when `lang=es`
5. Backend: translate user-facing error strings in auth/friends APIs
6. Replace `toLocaleString`/`toLocaleTimeString` with i18n-aware wrappers

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/frontend/src/i18n/` | Modified | Extend en.json, fix es.json |
| `apps/frontend/src/components/AppShell.tsx` | Modified | Add global language toggle |
| `apps/frontend/src/pages/*.tsx` | Modified | Hardcoded strings → t() in 10+ pages |
| `apps/frontend/src/stores/{auth,friends}Store.ts` | Modified | Translate error messages |
| `apps/frontend/src/api.ts` | Modified | Translate "Session expired" |
| `apps/frontend/src/components/{AchievementBadge,NotificationBell}.tsx` | Modified | Hardcoded labels → t() |
| `apps/backend/src/routes/quiz.ts` | Modified | Accept `?lang=es`, use nameEs/capitalEs |
| `apps/backend/src/middleware/errors.ts` | Modified | Translate user-facing errors |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed hardcoded string | Med | Component scan after impl; track vs known ~55 gaps |
| Backend scope creep (schema, migrations) | Low | Use existing nameEs/capitalEs — no schema changes |
| Toggle flicker on reload | Low | Read localStorage before React hydrates (existing pattern) |

## Rollback Plan

`git revert` the merge commit. Backend changes are backward-compatible — `?lang=` defaults to `en`, existing clients unaffected. For partial rollback, revert only frontend translations while keeping backend `?lang=` support.

## Dependencies

None — i18next + react-i18next already installed.

## Success Criteria

- [ ] Language selector visible on every page (auth, settings, quiz, friends, chat, profile) at all breakpoints
- [ ] All ~55 previously hardcoded strings resolve via `t()` key
- [ ] `es.json` has exact same keys as `en.json` (zero missing)
- [ ] Quiz questions render in Spanish when `lang=es`, English when `lang=en`
- [ ] API error messages translate with lang context
