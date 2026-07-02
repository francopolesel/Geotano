# Internationalization Specification

## Purpose

Spanish/English bilingual UI via react-i18next with JSON translations.

## Requirements

### Requirement: Engine
MUST use react-i18next with en.json and es.json files.
- **Render**: GIVEN locale "es", WHEN component calls `t("key")`, THEN Spanish text displayed.

### Requirement: Toggle
MUST provide settings toggle that switches locale without page reload.
- **Switch**: GIVEN current locale "en", WHEN user selects Spanish, THEN UI re-renders in Spanish.

### Requirement: Persistence
MUST save locale to localStorage and restore on load.
- **Reload**: GIVEN Spanish saved, WHEN page reloads, THEN UI renders in Spanish.
