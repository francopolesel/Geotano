# Dark/Light Mode Specification

## Purpose

Persisted theme toggle using Tailwind `class` strategy.

## Requirements

### Requirement: Toggle
MUST provide UI toggle that switches `dark` class on `<html>`.
- **Switch**: GIVEN light mode, WHEN user clicks toggle, THEN `dark` class applied + UI re-renders.

### Requirement: Persistence
MUST save preference to localStorage and restore before first paint.
- **Reload**: GIVEN dark mode saved, WHEN page loads, THEN `dark` class applied without flash.

### Requirement: Default
SHOULD respect prefers-color-scheme as default until first toggle.
- **First visit**: GIVEN new user with OS dark mode, WHEN first page load, THEN dark by default.
