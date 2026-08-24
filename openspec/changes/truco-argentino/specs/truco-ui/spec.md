# Delta for truco-ui (NEW capability)

> New capability — all-ADDED. Presentation layer for both game modes. Reuses existing tokens (`index.css` CSS variables, Tailwind v4 CSS-first), `lib/sounds.ts` synth SFX, `soundStore`, i18next flat keys, and the register-on-connect socket handler pattern. `components/game/` is the natural home for shared pieces. All navigation changes are ADDITIVE to quiz surfaces (zero requirement changes to existing specs).

## ADDED Requirements

### Requirement: Additive routes and entry points

The SPA MUST expose `/truco` (menu: vs CPU / vs friend, difficulty & target pickers), `/truco/cpu` (CPU match), and `/truco/match/:matchId` (multiplayer match) as siblings inside the existing AppShell children. AppShell `navItems` gains exactly one Truco entry with an i18n label key. HomePage gains one cross-game button navigating to `/truco`. These additions MUST NOT alter any existing quiz route, guard, or page behavior.

#### Scenario: Menu routes reachable

- GIVEN an authenticated user
- WHEN navigating to /truco, /truco/cpu, /truco/match/:id
- THEN each renders its screen inside AppShell without touching quiz routes

#### Scenario: Quiz untouched

- GIVEN the additive diff applied
- WHEN the full frontend suite runs
- THEN every pre-existing quiz test passes unmodified

### Requirement: Table layout zones

Every match screen MUST present three fixed zones: TOP rival zone (opponent avatar, nickname, their score against target, face-down remaining-card count, turn indicator); CENTER table zone (current baza cards positioned per owner, per-baza outcome markers won/tied, and call feedback banners); BOTTOM my zone (my score, my hand of up to 3 playable cards, and the contextual action bar). Both modes (CPU and multiplayer) MUST use the same layout components.

#### Scenario: Zone composition invariant

- GIVEN any mid-hand state snapshot in either mode
- THEN the three zones render with exactly the data items listed above and nothing player-relevant is missing

### Requirement: Valid-actions-only rendering

The UI MUST derive interactivity exclusively from the engine's legal actions for the viewing player: cards are clickable only when playing a card is legal and it is the viewer's turn; call buttons (Envido / Real Envido / Falta Envido / Truco / Retruco / Vale Cuatro) render enabled ONLY when singing is legal in the current state; when a bet awaits MY answer I see Quiero / No Quiero plus only my legal raises; when a bet awaits the OPPONENT I see a waiting indicator and no answer controls. The UI MUST NOT implement its own rules logic to guess legality.

#### Scenario: Only legal calls shown

- GIVEN a state where the first card was already played
- THEN no envido button is rendered or enabled anywhere in my action bar

#### Scenario: Responder-only answers

- GIVEN the opponent's retruco is pending on me
- THEN I see Quiero / No Quiero (and Vale Cuatro if entitled), while the opponent sees only a waiting indicator

#### Scenario: Turn gating

- GIVEN it is the opponent's turn to play
- THEN all my cards are non-interactive

### Requirement: CSS/SVG Spanish deck contract

Card faces MUST be drawn with pure CSS/SVG (no raster/external assets): rank numeral plus suit glyph for oro (coin), copa (cup), espada (sword), basto (baton). A single `PlayingCard` component contract MUST serve both modes with props accepting either a card id (`{rank}{suit}`) or faceDown, plus a size variant; all 40 distinct cards MUST be visually distinguishable, and the face-down back MUST be uniform. Rendering MUST be deterministic (snapshot-testable).

#### Scenario: Forty unique faces

- GIVEN all 40 card ids rendered
- THEN each produces a visually unique snapshot and none equals the face-down back

#### Scenario: No asset requests

- GIVEN any card rendered
- THEN no network image request is made (CSS/SVG only)

### Requirement: Responsive constraint — 360px minimum

At a 360px-wide viewport the match screen MUST be fully usable with NO horizontal scrolling (container scrollWidth ≤ clientWidth): the hand, table zone, and action bar must fit and remain operable. Layout scales up to desktop without breaking zone composition.

#### Scenario: No horizontal overflow at 360px

- GIVEN the match screen rendered at 360×640
- WHEN measured after layout settles
- THEN horizontal scrollWidth does not exceed clientWidth and every action-bar button is visible/tappable

### Requirement: Call feedback display

EVERY sung call (envido family, truco family) and EVERY answer (quiero / no quiero) MUST be announced visually in the center zone with: caller name, localized call name, and outcome; accepted envido showdowns additionally reveal BOTH envido values. Feedback MUST persist until superseded by the next game event. Refusals MUST clearly indicate the points awarded and to whom.

#### Scenario: Full chain visible

- GIVEN Envido → Real Envido → No Quiero occurred
- THEN the center zone showed each step and finally "No quiero — +2 to {winner}"

#### Scenario: Showdown reveals values

- GIVEN an accepted envido between 28 and 31
- THEN both values are displayed with the comparison winner highlighted

### Requirement: i18n namespace `truco.*` in both locales

All user-facing truco text MUST go through i18next keys under the `truco.*` namespace (plus the nav label key), defined identically in `apps/frontend/src/i18n/en.json` AND `es.json`. Minimum key families: menu (`truco.title`, `truco.menu.vsCpu`, `truco.menu.vsFriend`), difficulties (`truco.difficulty.easy|medium|hard`), calls (`truco.call.envido|realEnvido|faltaEnvido|truco|retruco|valeCuatro`), answers (`truco.answer.quiero|noQuiero`), suits and card alt text (`truco.suit.*`, `truco.card.alt`), turn/score (`truco.turn.you|opponent`, `truco.score`, `truco.target`), end screen (`truco.end.win|lose|draw`, `truco.action.playAgain|changeMode|back|geotano`). The existing i18n parity test MUST pass.

#### Scenario: Parity holds

- GIVEN both locale files updated
- WHEN the parity test runs
- THEN en and es contain identical truco.* key sets

#### Scenario: No hardcoded strings

- GIVEN any truco feature file
- THEN user-visible literals come from t() keys, not inline strings

### Requirement: Sound triggers with mute respect

New synth SFX functions MUST follow the existing `lib/sounds.ts` WebAudio pattern and fire on these triggers: hand deal, card played, call sung (envido-family and truco-family variants), quiero, no quiero, baza won, hand ended, match won, match lost. ALL truco sounds MUST be gated by the existing persisted mute setting (`soundStore.soundEnabled`) so muting in Settings silences truco completely; no new independent audio toggle is required.

#### Scenario: Mute silences truco

- GIVEN soundEnabled = false (persisted)
- WHEN a full CPU hand plays out including deal, plays, calls, and match end
- THEN zero audio functions produce output (all gated)

#### Scenario: Trigger coverage

- GIVEN the enumerated trigger list
- THEN each has one exported sound function invoked from the matching UI event

### Requirement: End-of-match screen

On match_end the screen MUST be replaced by an end panel showing: result title — Won or Lost (a Draw label exists but is unreachable for truco v1 because the mano rule decides every hand; kept conditionally for shared-pattern parity), final scores for both players with the target, and four actions: Play Again (restart same mode/difficulty; in multiplayer starts a rematch flow), Change Mode (navigate to `/truco`), Back (previous screen), Geotano (navigate `/`). All labels via i18n keys.

#### Scenario: Winner view

- GIVEN I reached the target first
- THEN the panel shows the win title, correct final scores, and the four buttons wired to the stated destinations

#### Scenario: Play again restarts cleanly

- GIVEN an ended CPU match
- WHEN Play Again is pressed
- THEN a fresh match starts with the same difficulty and target, no residual state

### Requirement: Store-owned local persistence namespaced `truco-*`

Truco preferences (last difficulty, last target, last persona) MUST persist under localStorage key `truco-prefs-v1`, owned by a Zustand store hydrated on boot following the existing `main.tsx` hydrate pattern (stats live under `truco-cpu-stats-v1` per the CPU spec). Existing non-namespaced keys MUST NOT be reused or repurposed.

#### Scenario: Prefs survive reload

- GIVEN I set Hard and target 15 then reload
- THEN the truco menu preselects Hard and 15

#### Scenario: Key namespace isolation

- GIVEN the full suite runs
- THEN truco writes touch only `truco-*` keys and never `auth_*`, `locale`, `theme`, or `soundEnabled`
