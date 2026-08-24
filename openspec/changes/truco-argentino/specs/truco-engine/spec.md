# Delta for truco-engine (NEW capability)

> New capability declared by the proposal — no existing main spec. This delta is all-ADDED.
> Sources pinned during spec phase: pagat.com "Argentinean Truco", nhfournier.es, es.wikipedia "Truco (juego de naipes)", clarín.com rules guide. Where the launch brief diverged from canonical sources, canonical wins and the divergence is flagged in the change notes (all-three-parda rule below).
> Scope: 1v1 Truco Argentino WITHOUT Flor (standard casual variant; envido uses best two of three suited cards).

## ADDED Requirements

### Requirement: Pure deterministic rules core

The engine MUST be a pure TypeScript module with zero I/O: no `Date.now`, no `Math.random`, no network, no DB access. All randomness MUST enter via an injected RNG function `rng: () => number` supplied at match creation. Applying the same action sequence to the same initial state MUST always produce the identical resulting state.

#### Scenario: Deterministic replay

- GIVEN a seeded RNG and a recorded action log
- WHEN the log is replayed twice from the same initial state
- THEN both runs produce deep-equal final states

#### Scenario: No hidden nondeterminism

- GIVEN any exported engine function
- WHEN it is invoked with the same arguments twice
- THEN it returns equal outputs and does not mutate its inputs (state transitions return new state)

### Requirement: Deck composition

The engine MUST use a 40-card Spanish deck. Suits are `oro`, `copa`, `espada`, `basto`. Ranks per suit are exactly `1,2,3,4,5,6,7,10,11,12` (8s and 9s do not exist). Card identity MUST be the string `{rank}{suit}`, e.g. `7espada`, `12copa`.

#### Scenario: Deck contents

- GIVEN a fresh deck
- WHEN its cards are enumerated
- THEN it contains exactly 40 unique cards: every combination of the 4 suits × ranks {1..7,10,11,12}, each once

### Requirement: Card hierarchy total order (normative)

The engine MUST rank cards by strength tiers 14 (strongest) down to 1 (weakest). Cards in the same tier have EQUAL strength (a baza between same-tier cards is a parda). The complete order MUST be:

| Tier | Strength | Cards |
|---|---|---|
| 14 | highest | `1espada` |
| 13 | | `1basto` |
| 12 | | `7espada` |
| 11 | | `7oro` |
| 10 | | all four `3*` (3oro, 3copa, 3espada, 3basto) |
| 9 | | all four `2*` |
| 8 | | `1oro`, `1copa` (anchos falsos) |
| 7 | | all four `12*` |
| 6 | | all four `11*` |
| 5 | | all four `10*` |
| 4 | | `7copa`, `7basto` (sietes falsos) |
| 3 | | all four `6*` |
| 2 | | all four `5*` |
| 1 | lowest | all four `4*` |

#### Scenario: Bravas beat everything

- GIVEN any card X not in {1espada, 1basto, 7espada, 7oro}
- WHEN compared against any of those four
- THEN X loses

#### Scenario: Tier equality

- GIVEN `3oro` and `3basto`
- WHEN compared
- THEN they are equal in strength (neither beats the other)

#### Scenario: False anchors and sevens

- GIVEN `1copa` vs `12oro`, and `7copa` vs `6espada`
- WHEN compared respectively
- THEN `1copa` wins and `7copa` wins

### Requirement: Envido value calculation

The engine MUST compute an envido value per hand: figure cards (10, 11, 12) count 0; other ranks count face value. If two or more cards share a suit, the value is 20 plus the sum of the TWO best suited cards' values (with three of a suit, the two highest values count). If all three suits differ, the value is the single highest card's value.

#### Scenario: Same-suit pair

- GIVEN hand [`5oro`, `11oro`, `3espada`]
- WHEN envido is computed
- THEN the value is 25 (5 + 0 + 20)

#### Scenario: Maximum and minimum

- GIVEN hand [`7copa`, `6copa`, `1espada`] → 33; GIVEN hand [`10oro`, `11copa`, `12espada`] → 0

#### Scenario: Three of a suit without Flor

- GIVEN hand [`6basto`, `3basto`, `2basto`]
- WHEN envido is computed (Flor-less variant)
- THEN the value is 29 (6 + 3 + 20), ignoring the 2

### Requirement: Envido betting chain and exact stake matrix

The engine MUST model envido bets as an accumulating chain starting from the first sung bet. First-bet accepted values: `envido` = 2, `realEnvido` = 3. Each raise adds: `envido` raise = +2, `realEnvido` raise = +3. Raise ordering constraint: any number of `envido` raises MAY be followed by any number of `realEnvido` raises; a `realEnvido` MUST NOT be answered with an `envido` raise. `faltaEnvido` MUST be terminal (only Quiero/No Quiero answers). On `quiero`, the accumulated stake is awarded to the comparison winner. On `no quiero`, the previous accumulation is awarded to the last bettor: 1 if refusing the FIRST bet, otherwise the stake accumulated before the last raise.

| Chain (in order) | Accepted pays | Refusal pays |
|---|---|---|
| Envido | 2 | 1 |
| Real Envido (direct) | 3 | 1 |
| Falta Envido (direct) | falta formula | 1 |
| Envido → Re-envido | 4 | 2 |
| Envido → Real Envido | 5 | 2 |
| Real Envido → Real Envido | 6 | 3 |
| Envido → Re-envido → Real Envido | 7 | 4 |
| Envido → Falta Envido | falta formula | 2 |
| Envido → Real Envido → Falta Envido | falta formula | 5 |

#### Scenario: Accept accumulates

- GIVEN chain Envido → Real Envido → Real Envido answered `quiero`
- WHEN the envido settles
- THEN the winner receives 8 points (pagat.com example: 2+3+3)

#### Scenario: Refusal pays prior stake

- GIVEN chain Envido → Real Envido answered `no quiero`
- THEN the real-envido singer receives 2 points without any card reveal

#### Scenario: Refusing first bet

- GIVEN a lone Envido answered `no quiero`
- THEN the singer receives exactly 1 point

#### Scenario: Raise rights and closure

- GIVEN A sang Envido and B answered `quiero`
- WHEN A attempts another envido bet in the same hand
- THEN the action MUST be rejected (quiero/no quiero close betting permanently for the hand)
- AND only B could have raised, and only before answering

#### Scenario: Illegal raise order

- GIVEN pending bet Real Envido
- WHEN the responder answers with an `envido` raise
- THEN the action MUST be rejected (`realEnvido` cannot be answered by the lower `envido` raise)

### Requirement: Falta Envido settlement

Accepted Falta Envido MUST award the winner of the envido comparison exactly `target − max(scoreA, scoreB)` points (the points the LEADING side lacks to reach the target), computed at settlement time. If scores are equal, the value is `target − score`. The winner of a tied comparison MUST be the mano side ("ganar de mano"). On refusal, payout follows the standard refusal rule (prior stake). Falta Envido MUST NOT be raisable.

#### Scenario: Trailer wins falta envido

- GIVEN target 30, scores A=25, B=20, falta envido accepted, B wins the comparison
- THEN B receives 5 points (what the leader lacked)

#### Scenario: Leader wins falta envido ends match

- GIVEN target 30, scores A=28, B=22, falta envido accepted, A wins the comparison
- THEN A receives 2 points, reaches 30, and the match ends immediately

#### Scenario: Equal scores whole game

- GIVEN scores 0–0 (or any tie), target 30, falta envido accepted
- THEN the comparison winner receives 30 points and wins the match

#### Scenario: Tie goes to mano

- GIVEN both players hold envido value 28 and falta envido was accepted
- THEN the mano side wins the award

### Requirement: Envido timing window and precedence over truco

The engine MUST allow opening envido only while NO card of the current hand has been played AND no truco bet has been accepted this hand AND envido betting has not been closed. Once the first card of the hand hits the table, envido initiation MUST be rejected. While an envido bet awaits an answer, truco initiation MUST be rejected (bets respect the order Envido-before-Truco). Conversely, if truco is pending and no envido has been opened, the challenged side MAY answer by OPENING envido instead; the envido contest then resolves completely BEFORE the pending truco must still be answered by the originally challenged side. If the envido award ends the match, the pending truco is voided and the hand ends.

#### Scenario: After first card rejected

- GIVEN the mano already played card 1 of baza 1
- WHEN either player attempts to sing envido
- THEN the action MUST be rejected with a window-closed error and state is unchanged

#### Scenario: After truco accepted rejected

- GIVEN truco was sung and answered `quiero`
- WHEN the other player sings envido
- THEN the action MUST be rejected

#### Scenario: Envido takes precedence over pending truco

- GIVEN A sang truco (no cards played yet) and B responds by singing envido
- WHEN the envido contest completes with A answering
- THEN envido points settle first, and afterwards the original truco call STILL requires B's quiero/no quiero answer
- AND if the envido award ended the match, the pending truco is voided

### Requirement: Truco chain, raise rights, and deadlines

The engine MUST implement: base hand prize 1; `truco` raises to 2; `retruco` to 3; `valeCuatro` to 4 (terminal maximum). Only the side that answered `quiero` to the last level MAY sing the next level. Refusals end the hand immediately: refusing `truco` awards 1 to the truco singer; refusing `retruco` awards 2 to its singer; refusing `valeCuatro` awards 3 to its singer. Singing is legal only for the player whose turn it is to act, only while the hand is live (no pending bet awaiting their own answer, hand not ended, match not finished). A player with a pending own bet MUST wait for the answer; playing a card while any bet awaits the opponent is rejected (explicit answers required; physical implicit-accept-by-playing is deliberately excluded for determinism).

#### Scenario: Refuse retruco

- GIVEN A sang truco, B answered quiero, B sang retruco
- WHEN A answers `no quiero`
- THEN the hand ends immediately and B scores exactly 2 points

#### Scenario: Only accepter may raise

- GIVEN A sang truco and B answered `quiero`
- WHEN A attempts retruco
- THEN the action MUST be rejected (raise right belongs to B alone)

#### Scenario: Vale cuatro terminal

- GIVEN truco→quiero→retruco→quiero and vale cuatro answered `quiero`
- THEN the hand plays out for exactly 4 points and no further bet is legal

#### Scenario: Deadline at hand end

- GIVEN the third baza resolved and the hand ended
- WHEN any player attempts truco
- THEN the action MUST be rejected

#### Scenario: Must answer before acting

- GIVEN B's truco is pending on A
- WHEN A attempts to play a card
- THEN the action MUST be rejected until A answers quiero/no quiero (or raises where entitled)

### Requirement: Bazas resolution and parda cascade

Each baza MUST be won by the strongest card played; equal-strength cards produce a parda (nobody wins it). The mano leads baza 1. The winner of a baza leads the next; after a parda the SAME player leads again. Hand outcome MUST follow this exact cascade:

1. A side winning bazas 1 and 2 wins the hand; baza 3 is not played.
2. Baza 1 parda + baza 2 won: baza-2 winner takes the hand immediately; baza 3 not played.
3. Baza 1 won + baza 2 parda: the baza-1 winner takes the hand immediately; baza 3 not played.
4. Baza 1 parda + baza 2 parda: baza 3 is played and its winner takes the hand.
5. Sides split bazas 1–2, baza 3 decides; if baza 3 is parda, the winner of the EARLIEST untied baza takes the hand.
6. All three bazas parda: the MANO side wins the hand (canonical rule per pagat.com/Fournier/Wikipedia ES — supersedes the launch brief's "re-deal no points").

#### Scenario: Win first two ends hand

- GIVEN A won baza 1 and baza 2
- THEN the hand ends immediately with A as winner and baza 3 is never played

#### Scenario: Parda second baza hands it to baza-one winner

- GIVEN A won baza 1 and baza 2 is parda
- THEN the hand ends immediately with A as winner

#### Scenario: Split with tied third

- GIVEN A won baza 1, B won baza 2, baza 3 is parda
- THEN A wins the hand (earliest untied baza)

#### Scenario: Double parda then decider

- GIVEN bazas 1 and 2 both parda
- WHEN baza 3 is played
- THEN its winner takes the hand

#### Scenario: All three parda

- GIVEN bazas 1, 2 and 3 all parda
- THEN the mano side wins the hand and the corresponding truco/bazas prize

#### Scenario: Parda keeps leader

- GIVEN A led a baza that resulted parda
- WHEN the next baza starts
- THEN A leads again

### Requirement: Turn flow and mano rotation

The engine MUST alternate dealer and mano between hands: whoever was mano becomes pie and vice versa. For the very first hand the engine MUST derive mano/dealer from creation options or the injected RNG when unspecified. The mano plays the first card of baza 1, speaks first in envido showdowns, and wins ALL ties (envido comparison ties, all-parda hands). In bazas 2 and 3 the leader is the previous baza's winner (or the same leader after a parda).

#### Scenario: Mano swaps every hand

- GIVEN hand N had player A as mano
- WHEN hand N+1 is dealt
- THEN player B is mano and leads baza 1

### Requirement: Scoring and match end

Target score MUST be configurable to 15 or 30; DEFAULT 30 (launch-pinned; proposal.md line 98 assumed 15 — reconcile before design). Within a hand, envido points settle FIRST, then truco/bazas points. After every award, if either score ≥ target the match ends IMMEDIATELY: remaining hand phases are voided (e.g., an envido win reaching target cancels the pending truco and unplayed bazas). Bazas/truco prize values: untouched hand 1; truco 2; retruco 3; vale cuatro 4. Scores never decrease.

#### Scenario: Envido ends match before truco counts

- GIVEN target 15, A at 14, A wins an accepted envido of 2
- THEN A reaches 16, the match ends, and no truco/bazas points are scored this hand

#### Scenario: Win threshold inclusive

- GIVEN target 30 and a player reaching exactly 30 or 31
- THEN the match ends in both cases

#### Scenario: Configurable 15-point game

- GIVEN target configured 15
- WHEN a player reaches 15
- THEN the match ends

### Requirement: Invalid action rejection (exhaustive taxonomy)

Every illegal input MUST produce a typed rejection naming a stable error code, leaving state untouched. At minimum the engine MUST reject: `E_OUT_OF_TURN` (acting when not playerToAct); `E_CARD_NOT_OWNED` (playing a card not in actor's hand); `E_CARD_ALREADY_PLAYED`; `E_ENVIDO_WINDOW_CLOSED` (any card played / truco accepted / betting closed); `E_ENVIDO_BETTING_CLOSED` (betting after quiero/no quiero); `E_ILLEGAL_RAISE_ORDER` (envido raise after real envido; raising falta envido); `E_NOT_RESPONDER` (answering/raising without the right); `E_NO_PENDING_BET`; `E_ALREADY_ANSWERED` (double answer); `E_AWAITING_OWN_BET` (playing while own bet pending); `E_TRUCO_WINDOW_CLOSED` (after hand end); `E_NOT_PARTICIPANT` (spectator/third actor); `E_MATCH_FINISHED` (any game action after match end); `E_STATE_FORBIDDEN` (action invalid for current phase).

#### Scenario: Out-of-turn play

- GIVEN it is B's turn to play
- WHEN A plays a card
- THEN rejection `E_OUT_OF_TURN` and state unchanged

#### Scenario: Spectator blocked

- GIVEN a non-participant actor id
- WHEN any game action is submitted
- THEN rejection `E_NOT_PARTICIPANT`

#### Scenario: Action on finished match

- GIVEN state phase = match_end
- WHEN any play/call/answer action arrives
- THEN rejection `E_MATCH_FINISHED`

#### Scenario: Rejection is side-effect free

- GIVEN any rejected action
- WHEN applied
- THEN the returned state deep-equals the pre-action state

### Requirement: Explicit state machine

The engine MUST expose a finite phase machine: `waiting_for_players → dealing → playing ⇄ (envido_betting | truco_betting) → hand_end → dealing … → match_end`. Transitions MUST be only: waiting_for_players→dealing (start), dealing→playing (cards dealt), playing→envido_betting (envido sung), envido_betting→playing (settled, match continues), envido_betting→hand_end (refused-with-match-end or award ending match), envido_betting→truco_betting (pending truco resurfaces after envido settled and match continues), playing→truco_betting (truco/retruco/vale cuatro sung), truco_betting→playing (quiero), truco_betting→hand_end (no quiero), playing→hand_end (fold impossible in-engine except refusal paths; hand decided by cascade), hand_end→dealing (match continues), hand_end→match_end (target reached). Legal actions per phase: `waiting_for_players`: start; `playing`: play_card, sing envido family, sing truco family (per windows above); `envido_betting`: responder's quiero / no quiero / raise; `truco_betting`: responder's quiero / no quiero / next-level raise; `hand_end`, `match_end`: none. No hidden branches: every transition MUST be derivable from (phase, action) alone.

#### Scenario: Full legal path enumeration testable

- GIVEN the exported transition table
- FOR EACH phase
- THEN the set of legal actions is queryable and matches this requirement exactly

#### Scenario: Betting sub-phase round trip

- GIVEN phase playing and an envido sung
- THEN phase is envido_betting with responder = non-singer
- WHEN responder answers quiero
- THEN phase returns to playing and the envido result is part of public history
