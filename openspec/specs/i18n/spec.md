# Internationalization Specification

## Purpose

Spanish/English bilingual UI via react-i18next with JSON translations.

## Requirements

### Requirement: Engine
MUST use react-i18next with en.json and es.json files.
- **Render**: GIVEN locale "es", WHEN component calls `t("key")`, THEN Spanish text displayed.

### Requirement: Toggle

MUST provide global language selector visible on ALL pages at ALL breakpoints, accessible in under 2 taps/clicks.

#### Scenario: Global access

GIVEN user is on any page (auth, settings, quiz, friends, chat, profile), WHEN user wants to switch language, THEN selector MUST be visible in under 2 taps/clicks.

#### Scenario: Mobile visibility

GIVEN viewport width < 640px, WHEN the language selector renders, THEN it MUST be visible and functional (not hidden behind a hamburger menu requiring >1 tap to reveal).

### Requirement: Persistence
MUST save locale to localStorage and restore on load.
- **Reload**: GIVEN Spanish saved, WHEN page reloads, THEN UI renders in Spanish.

### Requirement: Coverage

55+ hardcoded English strings MUST be replaced with `t()` translation keys. `es.json` MUST have full key parity with `en.json`.

#### Scenario: Full coverage

GIVEN a component with a hardcoded English string, WHEN the component renders in locale "en", THEN the string displays via `t()` key.

#### Scenario: Key parity

GIVEN `en.json` has N keys, WHEN `es.json` is inspected, THEN it MUST have the same N keys.

#### Scenario: Graceful missing key

GIVEN locale "es", WHEN a component calls `t("missing.key")`, THEN the app MUST NOT crash — the key SHOULD fall back to the English value.

### Requirement: API i18n

Backend error messages MUST support translation via `lang` query parameter.

#### Scenario: Translated error

GIVEN a backend request with `?lang=es`, WHEN an error occurs, THEN the response error message MUST be in Spanish.

#### Scenario: Default English

GIVEN a backend request without `?lang` parameter, WHEN an error occurs, THEN the response error message MUST be in English.
