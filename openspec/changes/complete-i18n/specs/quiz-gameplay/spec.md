# Delta for quiz-gameplay

## ADDED Requirements

### Requirement: Localized questions

Quiz questions MUST use `nameEs`/`capitalEs` fields when `?lang=es` query param is sent, and English templates with `nameEn`/`capitalEn` by default.

#### Scenario: Spanish questions

GIVEN quiz endpoint called with `?lang=es`, WHEN generating a question, THEN `nameEs` and `capitalEs` fields are used for country names and capitals.

#### Scenario: Default English questions

GIVEN quiz endpoint called without `?lang` parameter, WHEN generating a question, THEN `nameEn` and `capitalEn` fields are used.

#### Scenario: Invalid lang falls back to English

GIVEN quiz endpoint called with `?lang=fr`, WHEN generating a question, THEN the system MUST fall back to English (`nameEn`/`capitalEn`).
