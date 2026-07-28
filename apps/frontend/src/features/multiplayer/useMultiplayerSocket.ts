import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { getSocket } from '../../lib/socket';
import type { QuizQuestion, MatchResult, MatchStartPayload } from '@geotano/shared';

export function useMultiplayerSocket(matchId: string) {
  const store = useMultiplayerStore();
  const opponentAnsweredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMatchStart = (payload: MatchStartPayload) => {
      store.startMatch(payload);
    };

    const onQuestion = (payload: { matchId: string; question: QuizQuestion }) => {
      store.setQuestion(payload.question);
      store.showOpponentAnswered(false);
    };

    const onOpponentAnswered = () => {
      store.showOpponentAnswered(true);
      if (opponentAnsweredTimer.current) {
        clearTimeout(opponentAnsweredTimer.current);
      }
      opponentAnsweredTimer.current = setTimeout(() => {
        store.showOpponentAnswered(false);
      }, 2000);
    };

    const onTimer = (payload: { matchId: string; remainingMs: number }) => {
      store.updateTimer(payload.remainingMs);
    };

    const onEnd = (payload: { matchId: string; result: MatchResult }) => {
      store.endMatch(payload.result);
    };

    socket.on('match:start', onMatchStart);
    socket.on('match:question', onQuestion);
    socket.on('match:opponent_answered', onOpponentAnswered);
    socket.on('match:timer_tick', onTimer);
    socket.on('match:end', onEnd);

    return () => {
      socket.off('match:start', onMatchStart);
      socket.off('match:question', onQuestion);
      socket.off('match:opponent_answered', onOpponentAnswered);
      socket.off('match:timer_tick', onTimer);
      socket.off('match:end', onEnd);
      if (opponentAnsweredTimer.current) {
        clearTimeout(opponentAnsweredTimer.current);
      }
    };
  }, [matchId]);
}
