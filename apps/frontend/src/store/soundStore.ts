import { create } from 'zustand';

interface SoundState {
  soundEnabled: boolean;
  toggle: () => void;
  setSoundEnabled: (v: boolean) => void;
  hydrate: () => void;
}

export const useSoundStore = create<SoundState>((set) => ({
  soundEnabled: true,

  toggle: () =>
    set((s) => {
      const next = !s.soundEnabled;
      localStorage.setItem('soundEnabled', String(next));
      return { soundEnabled: next };
    }),

  setSoundEnabled: (v) => {
    localStorage.setItem('soundEnabled', String(v));
    set({ soundEnabled: v });
  },

  hydrate: () => {
    const stored = localStorage.getItem('soundEnabled');
    if (stored !== null) {
      set({ soundEnabled: stored === 'true' });
    }
  },
}));
