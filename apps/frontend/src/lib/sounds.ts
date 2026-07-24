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
