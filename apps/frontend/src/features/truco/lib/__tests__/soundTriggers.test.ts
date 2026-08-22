import { describe, it, expect, vi } from 'vitest';
import { mapEventsToSounds } from '../soundTriggers';
import type { TrucoEvent } from '@geotano/shared';
import type { TrucoSoundSink } from '../soundTriggers';

function spySink(): TrucoSoundSink & { calls: string[] } {
  const calls: string[] = [];
  const record = (name: string) => () => calls.push(name);
  return {
    calls,
    cardPlayed: record('cardPlayed'),
    callEnvido: record('callEnvido'),
    callTruco: record('callTruco'),
    quiero: record('quiero'),
    noQuiero: record('noQuiero'),
    bazaWon: record('bazaWon'),
    handEnded: record('handEnded'),
    matchWon: record('matchWon'),
    matchLost: record('matchLost'),
  };
}

describe('mapEventsToSounds', () => {
  it('maps card plays to the card cue', () => {
    const sink = spySink();
    mapEventsToSounds([{ type: 'card_played', player: 'A', card: '7oro' }], 'A', sink);
    expect(sink.calls).toEqual(['cardPlayed']);
  });

  it('splits envido-family and truco-family calls into different cues', () => {
    const sink = spySink();
    mapEventsToSounds(
      [
        { type: 'call_sung', actor: 'B', call: 'sing_envido' },
        { type: 'call_sung', actor: 'B', call: 'sing_truco' },
        { type: 'call_sung', actor: 'B', call: 'sing_falta_envido' },
        { type: 'call_sung', actor: 'B', call: 'sing_vale_cuatro' },
      ],
      'A',
      sink,
    );
    expect(sink.calls).toEqual(['callEnvido', 'callTruco', 'callEnvido', 'callTruco']);
  });

  it('maps answers and baza resolutions to their cues', () => {
    const sink = spySink();
    mapEventsToSounds(
      [
        { type: 'answered', player: 'B', answer: 'quiero', bet: 'truco' },
        { type: 'answered', player: 'A', answer: 'no_quiero', bet: 'envido' },
        { type: 'baza_resolved', baza: 1, winner: null },
        { type: 'baza_resolved', baza: 2, winner: 'A' },
      ],
      'A',
      sink,
    );
    expect(sink.calls).toEqual(['quiero', 'noQuiero', 'bazaWon']);
  });

  it('ends the hand with handEnded and the match with a side-aware cue', () => {
    const sink = spySink();
    mapEventsToSounds(
      [
        { type: 'hand_ended', winner: 'B' },
        { type: 'match_ended', winner: 'B', scores: { A: 3, B: 30 } },
      ],
      'A',
      sink,
    );
    expect(sink.calls).toEqual(['handEnded', 'matchLost']);
  });

  it('reports matchWon from the human perspective', () => {
    const sink = spySink();
    mapEventsToSounds([{ type: 'match_ended', winner: 'A', scores: { A: 30, B: 12 } }], 'A', sink);
    expect(sink.calls).toEqual(['matchWon']);
  });

  it('ignores empty event batches silently', () => {
    const sink = spySink();
    mapEventsToSounds([], 'A', sink);
    expect(sink.calls).toEqual([]);
  });
});

describe('createSoundSink gate', () => {
  it('plays nothing while sound is disabled in the store', async () => {
    const sounds = await import('../../../../lib/sounds');
    const playSpy = vi.spyOn(sounds, 'playTrucoCardPlayed').mockImplementation(() => {});
    const { createSoundSink } = await import('../soundTriggers');
    const { useSoundStore } = await import('../../../../store/soundStore');

    useSoundStore.getState().setSoundEnabled(false);
    createSoundSink().cardPlayed();

    expect(playSpy).not.toHaveBeenCalled();

    useSoundStore.getState().setSoundEnabled(true);
    createSoundSink().cardPlayed();
    expect(playSpy).toHaveBeenCalledTimes(1);

    playSpy.mockRestore();
  });
});
