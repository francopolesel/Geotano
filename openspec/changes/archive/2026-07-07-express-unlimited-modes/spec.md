# Express + Unlimited Modes Specification

## Purpose

Express (30-question limit) and Unlimited (all-countries) variants for each game mode, with win-screen detection when the player completes the mode successfully rather than losing all lives.

## Requirements

### Requirement: Express mode

MUST end a game session after 30 correct answers, or when lives reach 0, whichever comes first. Express variants SHALL use slug pattern `{mode}-express` (e.g., `flag-guess-express`). Each express config SHALL set `totalQuestions = 30`; the existing `calculateScore` formula MUST apply unchanged.

#### Scenario: Express win — 30 correct with lives remaining

GIVEN an express-mode game with lives remaining, WHEN the player answers the 30th question correctly, THEN the game ends, AND the server returns `win: true` with final score and stats.

#### Scenario: Express loss — lives depleted before 30

GIVEN an express-mode game with fewer than 30 answers, WHEN a wrong or missed answer reduces lives to 0, THEN the game ends with `gameOver: true`, AND the score is persisted, AND no win screen is shown.

### Requirement: Unlimited mode

MUST continue generating questions until all countries for that mode's question type are exhausted, or lives reach 0. Unlimited detection SHALL trigger when `generateQuestionBatch` returns an empty set (no unused countries remaining in `sessionCountryIds`). Unlimited variants SHALL use slug pattern `{mode}-unlimited` (e.g., `flag-guess-unlimited`). `totalQuestions` SHALL be `null`.

#### Scenario: Unlimited win — all countries exhausted with lives

GIVEN an unlimited-mode game with lives remaining, WHEN `generateQuestionBatch` returns empty, THEN the game ends, AND the server returns `win: true` with final score and stats.

#### Scenario: Unlimited loss — lives depleted before exhaustion

GIVEN an unlimited-mode game with unused countries remaining, WHEN a wrong or missed answer reduces lives to 0, THEN the game ends with `gameOver: true`, AND score is persisted.

### Requirement: Win screen

MUST render when QuizPage receives server response with `win: true`. SHALL display congratulation title, final score, correct-count, and longest-streak stats. MUST be visually distinct from the game-over screen. No scoring or lives system changes are introduced.

#### Scenario: Win screen renders with correct data

GIVEN a completed game with `win: true`, WHEN QuizPage processes the response, THEN it renders the win screen with congratulation message, score, and stats, AND the game-over screen is NOT rendered.

### Requirement: New game mode slugs

MUST add 10 new slugs to the `GameModeSlug` union type: `flag-guess-express`, `flag-guess-unlimited`, `capital-guess-express`, `capital-guess-unlimited`, `country-by-flag-express`, `country-by-flag-unlimited`, `continent-express`, `continent-unlimited`, `free-express`, `free-unlimited`.

### Requirement: DB — game_modes.total_questions

MUST add a `total_questions` column to the `game_modes` table, type `integer`, nullable. Express variants SHALL have value `30`. Unlimited and existing modes SHALL have `NULL`.

### Requirement: Seed data

MUST seed 10 new mode rows referencing existing base modes with `variant = 'express'` or `'unlimited'` and the corresponding `total_questions` value.

### Requirement: i18n labels

MUST add English and Spanish keys for: each new mode slug (name + description), win screen title, win screen message, and stats labels (correct answers, longest streak).

#### Scenario: Spanish win screen labels

GIVEN a session with `?lang=es`, WHEN the win screen renders, THEN all labels appear in Spanish.

#### Scenario: English win screen labels

GIVEN a session without `?lang` param, WHEN the win screen renders, THEN all labels appear in English.
