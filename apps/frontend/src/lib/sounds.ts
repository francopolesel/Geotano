import { useSoundStore } from '../store/soundStore';

// ─── Audio context (lazy singleton) ─────────────────────────────────────────

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
  }
  // Resume if suspended (browsers require user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return useSoundStore.getState().soundEnabled;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  startTime = 0,
) {
  const c = getCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Short pleasant ascending tone — two quick notes going up */
export function playCorrect() {
  if (!isEnabled()) return;
  playTone(523, 0.1, 'sine', 0.12, 0);      // C5
  playTone(659, 0.15, 'sine', 0.12, 0.1);    // E5
}

/** Short descending buzz */
export function playWrong() {
  if (!isEnabled()) return;
  playTone(300, 0.2, 'square', 0.08, 0);
  playTone(200, 0.25, 'square', 0.08, 0.15);
}

/** Very short click/tap */
export function playClick() {
  if (!isEnabled()) return;
  playTone(800, 0.05, 'sine', 0.08, 0);
}

/** Descending sad tone */
export function playGameOver() {
  if (!isEnabled()) return;
  playTone(440, 0.3, 'sine', 0.1, 0);
  playTone(349, 0.3, 'sine', 0.1, 0.2);
  playTone(262, 0.4, 'sine', 0.1, 0.4);
}

/** Happy ascending fanfare — 3 notes */
export function playGameWin() {
  if (!isEnabled()) return;
  playTone(523, 0.15, 'sine', 0.12, 0);     // C5
  playTone(659, 0.15, 'sine', 0.12, 0.12);   // E5
  playTone(784, 0.25, 'sine', 0.14, 0.24);   // G5
}

// ─── Truco Argentino ────────────────────────────────────────────────────────
// Every trigger has one dedicated function, all gated by the persisted mute
// setting so muting in Settings silences truco completely.

/** Hand deal — quick riff of short card-slide clicks */
export function playTrucoDeal() {
  if (!isEnabled()) return;
  playTone(220, 0.05, 'triangle', 0.08, 0);
  playTone(260, 0.05, 'triangle', 0.08, 0.07);
  playTone(300, 0.06, 'triangle', 0.08, 0.14);
}

/** Card played onto the table — soft tap */
export function playTrucoCardPlayed() {
  if (!isEnabled()) return;
  playTone(600, 0.06, 'sine', 0.09, 0);
}

/** Envido sung — rising two-note call */
export function playTrucoCallEnvido() {
  if (!isEnabled()) return;
  playTone(392, 0.1, 'sine', 0.11, 0);      // G4
  playTone(523, 0.16, 'sine', 0.11, 0.1);    // C5
}

/** Truco sung — bold assertive square */
export function playTrucoCallTruco() {
  if (!isEnabled()) return;
  playTone(330, 0.14, 'square', 0.07, 0);    // E4
  playTone(440, 0.2, 'square', 0.07, 0.13);  // A4
}

/** Quiero (accept) — bright ascending pair */
export function playTrucoQuiero() {
  if (!isEnabled()) return;
  playTone(523, 0.09, 'sine', 0.11, 0);      // C5
  playTone(784, 0.18, 'sine', 0.12, 0.09);   // G5
}

/** No quiero (refuse) — descending dull pair */
export function playTrucoNoQuiero() {
  if (!isEnabled()) return;
  playTone(440, 0.12, 'sine', 0.1, 0);       // A4
  playTone(294, 0.22, 'sine', 0.1, 0.12);    // D4
}

/** Baza won — happy blip up */
export function playTrucoBazaWon() {
  if (!isEnabled()) return;
  playTone(659, 0.08, 'sine', 0.1, 0);       // E5
  playTone(880, 0.14, 'sine', 0.11, 0.08);   // A5
}

/** Hand ended — resolving three-note chime */
export function playTrucoHandEnded() {
  if (!isEnabled()) return;
  playTone(523, 0.1, 'sine', 0.1, 0);        // C5
  playTone(659, 0.1, 'sine', 0.1, 0.1);      // E5
  playTone(784, 0.2, 'sine', 0.11, 0.2);     // G5
}

/** Match won — four-note fanfare */
export function playTrucoMatchWon() {
  if (!isEnabled()) return;
  playTone(523, 0.14, 'sine', 0.12, 0);      // C5
  playTone(659, 0.14, 'sine', 0.12, 0.13);   // E5
  playTone(784, 0.14, 'sine', 0.13, 0.26);   // G5
  playTone(1047, 0.32, 'sine', 0.14, 0.39);  // C6
}

/** Match lost — sad descending tones */
export function playTrucoMatchLost() {
  if (!isEnabled()) return;
  playTone(330, 0.28, 'sine', 0.1, 0);       // E4
  playTone(262, 0.3, 'sine', 0.1, 0.24);     // C4
  playTone(196, 0.45, 'sine', 0.11, 0.5);    // G3
}
