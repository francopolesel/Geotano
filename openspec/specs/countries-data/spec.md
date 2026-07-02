# Countries Data Specification

## Purpose

Seed UN countries from REST Countries v5 into the database for quiz use.

## Requirements

### Requirement: Seeding
MUST seed all UN members with name, flag URL, capital, continent, and ISO codes.
- **Full seed**: GIVEN empty table, WHEN seed script runs, THEN all UN countries inserted.
- **Idempotent**: GIVEN existing data, WHEN re-seed, THEN rows updated, never duplicated.

### Requirement: Retrieval
MUST expose GET /api/countries returning all countries.
- **List all**: GIVEN seeded data, WHEN GET /api/countries, THEN all fields returned.

### Requirement: Filtering
SHOULD support ?continent= and ?search= query params.
- **Filter**: GIVEN seeded continents, WHEN GET /api/countries?continent=Europe, THEN only European entries.
