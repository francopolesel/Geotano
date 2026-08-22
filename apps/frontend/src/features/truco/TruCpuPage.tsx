// ---------------------------------------------------------------------------
// Truco vs-CPU screen (CU5 assembly)
// ---------------------------------------------------------------------------
// Composition ONLY: the engine (applyAction) owns every rule, the hook owns
// sequencing/think delays, and the shared components own presentation. This
// file wires prefs → controller → table/end-screen and maps engine events to
// the gated sound cues plus one-shot local stats recording.

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PlayerSlot, TrucoEvent } from '@geotano/shared';
import { TrucoTable } from './components/TrucoTable';
import { EndScreen } from './components/EndScreen';
import { useTruCpuGame } from './hooks/useTruCpuGame';
import { PERSONAS } from './ai';
import {
  createSoundSink,
  mapEventsToSounds,
  type TrucoSoundSink,
} from './lib/soundTriggers';
import { useTrucoPrefsStore } from '../../store/trucoPrefsStore';
import { useTruCpuStatsStore } from '../../store/truCpuStatsStore';

const MY_SLOT: PlayerSlot = 'A';

export function TruCpuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const difficulty = useTrucoPrefsStore((state) => state.difficulty);
  const targetPoints = useTrucoPrefsStore((state) => state.targetPoints);
  const personaIndex = useTrucoPrefsStore((state) => state.personaIndex);
  const personaOverride = PERSONAS[personaIndex % PERSONAS.length] as (
    typeof PERSONAS
  )[number];

  // Sound sink is store-gated internally; create it once per mount.
  const sinkRef = useRef<TrucoSoundSink | null>(null);
  if (!sinkRef.current) sinkRef.current = createSoundSink();
  const onEvents = useCallback((events: readonly TrucoEvent[]) => {
    mapEventsToSounds(events, MY_SLOT, sinkRef.current as TrucoSoundSink);
  }, []);

  const game = useTruCpuGame({
    difficulty,
    targetPoints,
    personaOverride,
    onEvents,
  });

  // One-shot stats recording per finished match (reset on restart).
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!game.finished) {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current || game.winner === null) return;
    recordedRef.current = true;
    useTruCpuStatsStore
      .getState()
      .recordMatchResult(difficulty, game.winner === MY_SLOT);
  }, [game.finished, game.winner, difficulty]);

  if (game.finished && game.winner !== null) {
    return (
      <EndScreen
        winner={game.winner}
        mySlot={MY_SLOT}
        scores={game.scores}
        targetPoints={game.targetPoints}
        myName={t('truco.you')}
        opponentName={personaOverride.name}
        onPlayAgain={game.restart}
        onChangeMode={() => navigate('/truco')}
        onBack={() => navigate(-1)}
        onGeotano={() => navigate('/')}
      />
    );
  }

  return (
    <div data-testid="truco-cpu-page" className="mx-auto w-full max-w-2xl min-w-0 px-2">
      <TrucoTable
        view={game.view}
        mySlot={MY_SLOT}
        myName={t('truco.you')}
        opponentName={personaOverride.name}
        onAction={game.play}
        rivalAvatar={
          <span aria-hidden className="text-xl leading-none">
            {personaOverride.avatar}
          </span>
        }
      />
    </div>
  );
}
