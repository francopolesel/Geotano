# Delta for truco-cpu-mode (NEW capability)

> New capability — all-ADDED. Client-side vs-CPU experience. Zero backend surface: the CPU controller runs the shared `truco-engine` in the frontend.

## ADDED Requirements

### Requirement: Hard information firewall (no cheating)

The CPU decision layer MUST receive ONLY a `CpuDecisionInput` containing: its own hand, the public history (cards played per baza with owners, calls and answers, envido results), both scores, target, mano/leader flags, whose turn it is, and pending bet state. It MUST NOT receive, read, or infer through any exposed path: the opponent's current hand, the undealt deck order, or the opponent's private envido value before an accepted showdown. The type MUST make hidden fields unrepresentable, and a runtime test MUST assert their absence from the object handed to the decider.

#### Scenario: Input shape excludes hidden info

- GIVEN a mid-hand public state
- WHEN `CpuDecisionInput` is built for the CPU
- THEN it contains no `opponentHand`, no undealt-deck ordering, and no unresolved opponent envido value
- AND decisions made with this input are identical whether or not hidden data exists anywhere else in memory

#### Scenario: Fair-play regression guard

- GIVEN the engine's full state (including opponent cards) is available to the caller
- WHEN the CPU picks an action
- THEN the picked action is a pure function of `CpuDecisionInput` + seed only

### Requirement: Deterministic, injectable randomness

All CPU stochastic choices MUST flow from one injectable seeded RNG passed to the controller. Two runs with the same seed and same game inputs MUST produce byte-identical action sequences.

#### Scenario: Seeded reproducibility

- GIVEN seed S and difficulty D
- WHEN a full match is simulated twice
- THEN both action logs are identical element-by-element

### Requirement: Config menu and personas

The vs-CPU entry MUST let the player choose difficulty (`easy|medium|hard`), target score (`15|30`, default 30), and MUST present a pool of at least 8 distinct CPU personas (name + avatar). Persona selection MAY be manual or derived deterministically from the seed. Choices persist across sessions via store-owned localStorage keys.

#### Scenario: Difficulty selection drives behavior

- GIVEN three matches started from the menu with easy, medium, hard
- THEN each uses the corresponding strategy contract below

#### Scenario: Persona variety

- GIVEN 10 fresh matches with default persona picking
- THEN at least 4 distinct personas appear (seeded-batch assertion)

### Requirement: Easy difficulty — observable behavior contract

Easy MUST always emit a legal action (100% of decisions, verified by property tests over ≥5,000 seeded decision points). Card plays MUST be drawn uniformly at random among legal cards (over a large seeded sample every legal card is chosen within ±20% of uniform). Easy MUST initiate envido or truco in ≤10% of eligible windows combined. Easy MUST fold (answer `no quiero`) even strong hands sometimes: in a seeded batch, hands containing `1espada` or `1basto` are folded pre-truco in ≥5% of occurrences. Think delay MUST be a fixed constant (default 700 ms) applied uniformly to every CPU action, not derived from hand quality; tests assert the scheduling constant, never wall-clock time.

#### Scenario: Never illegal

- GIVEN 50 seeded Easy games
- WHEN every CPU decision is checked against the engine's legal actions for that state
- THEN zero illegal actions occur

#### Scenario: Random-ish play

- GIVEN a state where all 3 cards are legal
- WHEN 10,000 seeded Easy card choices are sampled
- THEN each card's frequency lies within 20% of 1/3

#### Scenario: Rarely bets but folds winners sometimes

- GIVEN a seeded batch of 200 hands against Easy
- THEN Easy-initiated bets occur in ≤10% of eligible windows
- AND at least one hand holding 1espada/1basto was folded before truco

#### Scenario: Fixed delay

- GIVEN any Easy decision
- THEN the requested think delay equals the configured constant regardless of hand strength

### Requirement: Medium difficulty — heuristic contract

Medium MUST use a deterministic hand-strength heuristic over legal knowledge: strength tiers of held cards plus own envido potential. Required observable behaviors (each individually assertable with fixed hands): (a) it initiates truco in ≥80% of turns while holding two tier-≥10 cards; (b) it accepts a plain truco when holding at least one tier-≥10 card in ≥80% of such cases; (c) it folds junk (all cards tier ≤3) against a raise in ≥90% of cases; (d) it sings envido in ≥90% of windows where own envido ≥ 27; (e) it NEVER folds a hand containing both `1espada` and `1basto` before retruco exists. Decisions must be stable: same input → same output.

#### Scenario: Strong hand raises

- GIVEN Medium holds [`1espada`, `3oro`, `2copa`] on its turn with no pending bet
- WHEN asked repeatedly across seeds
- THEN it sings truco in ≥80% of those turns

#### Scenario: Junk folds

- GIVEN Medium holds [`4oro`, `5copa`, `6basto`] facing a truco raise
- THEN it answers `no quiero` in ≥90% of seeded instances

#### Scenario: Envido threshold

- GIVEN Medium computes own envido = 31 and the window is open
- THEN it opens envido in ≥90% of seeded instances

### Requirement: Hard difficulty — counting, probability, bluffs, trap lines

Hard MUST maintain the set of already-visible cards (played cards + its own hand) and MUST condition choices on remaining-card probabilities (e.g., acceptance thresholds tighten as unseen strong cards grow). Required observable contracts: (a) CARD COUNTING — given a baza-2 state where all four 3s are already visible, Hard's estimated probability of winning baza 3 with a tier-9 card reflects that no 3s remain; asserted via its chosen line (it commits the tier-9 card instead of saving a brava); (b) TRAP LINE — holding [`1espada`, `3oro`, `3copa`] after winning baza 1, Hard plays a 3 on baza 2 and SAVES `1espada` for baza 3 in ≥90% of seeds; (c) BLUFF BAND — Hard sings truco holding only tier-≤4 hands in 10–25% of such opportunities (measured over ≥300 seeded opportunities); (d) MARKER-AWARE RISK — when the opponent is within 3 points of target, Hard refuses falta envido unless holding a tier-≥11 card, in ≥95% of seeded cases; (e) it must remain legal-action-perfect like all difficulties.

#### Scenario: Counts played cards

- GIVEN all four 3s were played in bazas 1–2 and Hard holds `2espada` plus `7oro`
- WHEN choosing the baza-3 card
- THEN Hard plays `7oro`-class commitment consistent with "no 3s left" (asserted across seeds)

#### Scenario: Holds the macho for baza 3

- GIVEN Hard won baza 1 holding [`1espada`, `3oro`, `3copa`]
- WHEN bazas 2–3 proceed
- THEN `1espada` appears as the baza-3 play in ≥90% of seeded games

#### Scenario: Bluff frequency bounded

- GIVEN 300 seeded opportunities with junk hands
- THEN Hard-initiated truco occurs in 10–25% of them

#### Scenario: Marker-aware falta discipline

- GIVEN opponent score = target − 1 and Hard holds tier ≤ 8
- WHEN falta envido is sung
- THEN Hard answers `no quiero` in ≥95% of seeds

### Requirement: Difficulties are measurably distinct

Running fixed-seed batches (≥200 games per matchup) MUST show pairwise statistical separation: mean aggression rate (bets initiated per eligible window) and mean fold rate MUST differ between every difficulty pair by more than batch noise (asserted with concrete numeric bounds in tests, e.g., Easy folds ≥5% of strong hands while Hard folds ≤1%).

#### Scenario: Pairwise separation

- GIVEN batches E(200), M(200), H(200) with shared seed sets
- THEN |metric(E) − metric(M)| and |metric(M) − metric(H)| exceed the documented thresholds for aggression and fold-rate metrics

### Requirement: Local stats persistence

After each finished CPU match the client MUST update local stats (gamesPlayed, wins, losses, per-difficulty breakdowns) under store-owned localStorage key `truco-cpu-stats-v1`, hydrated on boot following the existing store pattern (`main.tsx` hydrate call).

#### Scenario: Stats accumulate

- GIVEN one win vs Medium then one loss vs Hard
- WHEN stats are re-read after reload
- THEN gamesPlayed=2, wins=1, losses=1, and per-difficulty counters reflect each result
