import type { PlayerSlot, TrucoAction, TrucoView } from '@geotano/shared';
import { legalActions } from '@geotano/shared';
import { DECK_40 } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { RivalZone } from './RivalZone';
import { TableZone } from './TableZone';
import { MyZone } from './MyZone';
import { BetModal } from './BetModal';
import { TurnBanner } from './TurnBanner';
import { GameHistory } from './GameHistory';
import { HandEndPanel } from './HandEndPanel';
import { CardsIcon, CoinsIcon, FlameIcon } from './icons';
import { isAwaitingOpponent } from '../lib/turnQuery';
import { usePacing } from '../hooks/usePacing';

/**
 * Full match table (both CPU and multiplayer modes).
 *
 * Composition: a felt surface framed in wood — rival strip on top, plays in
 * the center, my strip at the bottom — plus a prominent turn banner and an
 * elevated bet overlay whenever a call awaits MY response.
 *
 * Valid-actions-only: interactivity is derived EXCLUSIVELY from the engine's
 * `legalActions()` over the redacted view — the UI implements zero rules
 * logic. An illegal action simply never renders.
 */
export interface TrucoTableProps {
  /** Per-viewer redacted DTO (TrucoView satisfies TrucoPublicContext). */
  view: TrucoView;
  mySlot: PlayerSlot;
  myName: string;
  opponentName: string;
  onAction: (action: TrucoAction) => void;
  /** Optional avatar node for the rival zone (CPU persona monogram). */
  rivalAvatar?: ReactNode;
  /** In-flight POST lock: disables all controls while an action settles (G1). */
  isActing?: boolean;
  /**
   * Hand-end freeze (CRITICAL 1). A page that owns its own usePacing instance
   * (CPU suppression) passes this; otherwise TrucoTable derives it internally.
   * When a page owns pacing it MUST pass the single source of truth for the
   * hand-end overlay (handEndOpen + onHandEndContinue) too — otherwise two
   * independent usePacing instances drift and the overlay freezes forever.
   */
  paused?: boolean;
  /** Hand-end overlay open flag from the page-owned usePacing (CRITICAL 1). */
  handEndOpen?: boolean;
  /** Pure-UI release of the hand-end overlay from the page-owned usePacing. */
  onHandEndContinue?: () => void;
}

/** Discreet chip naming the current stake in human terms. */
function StakeChip({ view }: { view: TrucoView }) {
  const { t } = useTranslation();
  // Only show ACCEPTED/SETTLED stakes — no pending calls.
  const level = view.acceptedTrucoLevel;
  const trucoLabel = level === 1
    ? t('truco.stake.simple', { n: 1 })
    : t(`truco.call.${level === 2 ? 'truco' : level === 3 ? 'retruco' : 'valeCuatro'}`);

  // Determine resolved envido type from history: find the last envido call
  // before the envido was closed (envido_showdown or answered with bet='envido').
  let resolvedEnvidoCall: 'sing_envido' | 'sing_real_envido' | 'sing_falta_envido' | null = null;
  if (view.envidoClosed) {
    for (let i = view.history.length - 1; i >= 0; i--) {
      const event = view.history[i];
      if (event.type === 'call_sung' &&
          (event.call === 'sing_envido' || event.call === 'sing_real_envido' || event.call === 'sing_falta_envido')) {
        resolvedEnvidoCall = event.call;
        break;
      }
      // Stop at envido_showdown or envido answer — the resolved call is before this
      if (event.type === 'envido_showdown' ||
          (event.type === 'answered' && event.bet === 'envido')) {
        // Continue searching backwards for the call_sung
        continue;
      }
    }
  }
  const envidoLabel = resolvedEnvidoCall
    ? t(`truco.call.${resolvedEnvidoCall === 'sing_falta_envido' ? 'faltaEnvido' : resolvedEnvidoCall === 'sing_real_envido' ? 'realEnvido' : 'envido'}`)
    : null;

  return (
    <div
      data-testid="truco-stake-chip"
      className="flex min-w-0 flex-col items-end leading-tight"
    >
      <span className="flex items-center gap-1 rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-white/90">
        {level === 1 ? (
          <CardsIcon className="h-3 w-3" />
        ) : (
          <FlameIcon className="h-3 w-3" />
        )}
        {trucoLabel}
      </span>
      {envidoLabel ? (
        <span className="mt-0.5 flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2 py-0.5 text-[9px] font-medium text-white/75">
          <CoinsIcon className="h-2.5 w-2.5" />
          {envidoLabel}
        </span>
      ) : null}
    </div>
  );
}

export function TrucoTable({
  view,
  mySlot,
  myName,
  opponentName,
  onAction,
  rivalAvatar,
  isActing = false,
  paused,
  handEndOpen,
  onHandEndContinue,
}: TrucoTableProps) {
  const { t } = useTranslation();
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  // Computed keys defeat Record inference in TS; branch explicitly instead.
  const names: Record<PlayerSlot, string> =
    mySlot === 'A' ? { A: myName, B: opponentName } : { A: opponentName, B: myName };
  // Legality comes ONLY from the engine, evaluated over the public context.
  const actions = legalActions(view, mySlot);

  // Pacing sequencer drives the event-derived hand-end overlay (CRITICAL 1)
  // and the pause freeze that suppresses input while it is open. A page that
  // owns pacing for CPU suppression passes handEndOpen + onHandEndContinue +
  // paused to keep ONE source of truth; otherwise we derive an instance here.
  const internalPacing = usePacing({ view });
  const overlayOpen = handEndOpen ?? internalPacing.handEndOpen;
  const overlayContinue = onHandEndContinue ?? internalPacing.advanceHandEnd;

  // Turn query comes from the ONE shared helper (remediation #14a) — the
  // per-component ternary chain it replaces could silently drift.
  const awaitingOpponent = isAwaitingOpponent(view, mySlot);

  const rivalIsTurn =
    view.envidoAwaiting != null || view.trucoAwaiting != null
      ? awaitingOpponent
      : view.playerToAct === rivalSlot && view.phase === 'playing';

  const myIsTurn = view.phase === 'playing' && view.playerToAct === mySlot;

  // A bet pending on MY response supersedes both the turn banner and the
  // inline action bar: the answer controls live only inside the overlay.
  const trucoOnMe = view.trucoAwaiting?.responder === mySlot;
  const envidoOnMe = view.envidoAwaiting?.responder === mySlot;
  const betPendingMine = trucoOnMe || envidoOnMe;
  const waitingForAnswer =
    !betPendingMine &&
    ((view.trucoAwaiting?.responder === rivalSlot) ||
      (view.envidoAwaiting?.responder === rivalSlot));

  // Bet panel copy derived from public fields only.
  let betFamily: 'truco' | 'envido' = 'truco';
  let betTitle = '';
  let betExplanation = '';
  if (trucoOnMe) {
    const level = view.trucoAwaiting!.level;
    betTitle = `¡${t(level === 2 ? 'truco.call.truco' : level === 3 ? 'truco.call.retruco' : 'truco.call.valeCuatro')}!`;
    betExplanation = t('truco.bet.explainTruco', { n: level });
  } else if (envidoOnMe) {
    const awaiting = view.envidoAwaiting!;
    betFamily = 'envido';
    betTitle = `¡${t(
      awaiting.falta
        ? 'truco.call.faltaEnvido'
        : awaiting.realRaised
          ? 'truco.call.realEnvido'
          : 'truco.call.envido',
    )}!`;
    betExplanation = t('truco.bet.explainEnvido');
  }

  // The pause freeze is event-derived internally (pacing) but may be overridden
  // by a page that owns its own pacing instance (CPU suppression) — same source.
  const effectivePaused = paused ?? internalPacing.paused;
  const disabled = isActing || effectivePaused;

  // Compute deck remaining: DECK_40 - dealt cards (6 initial) - played cards
  const dealtCards = 6; // 3 cards each player initially
  const playedCards = view.cardsPlayedThisHand;
  const deckRemaining = Math.max(0, DECK_40.length - dealtCards - playedCards);

  return (
    <>
    <div
      data-testid="truco-table"
      className="mx-auto flex h-[calc(100dvh-80px)] w-full max-w-4xl flex-col gap-2 overflow-x-hidden p-1 overflow-hidden"
    >
      {/* Table header: two rows with clear visual separation.
          Row 1: round status + permanent match score (compact, single line)
          Row 2: stake chip (accepted calls only) + history toggle */}
      <div className="flex min-w-0 flex-col gap-1 px-0.5">
        {/* Row 1: Round status + Match score */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
          <span
            data-testid="truco-round-status"
            className="text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]"
          >
            {t('truco.round.status', { hand: view.handNumber, baza: view.bazaNumber })}
          </span>
          {/* Permanent match score — always visible, never hidden by modals */}
          <span
            data-testid="truco-match-score"
            className="text-sm font-semibold tabular-nums text-[var(--color-foreground)] whitespace-nowrap"
          >
            {mySlot === 'A'
              ? `${t('truco.you')} ${view.scores.A} \u2014 ${opponentName} ${view.scores.B}`
              : `${t('truco.you')} ${view.scores.B} \u2014 ${opponentName} ${view.scores.A}`}
          </span>
        </div>
        {/* Row 2: Stake chip + History toggle */}
        <div className="flex min-w-0 shrink items-center justify-end gap-2 border-t border-white/10 pt-1">
          <StakeChip view={view} />
          <GameHistory history={view.history} mySlot={mySlot} names={names} />
        </div>
      </div>

      {/* Wood frame around the felt */}
      <div className="truco-wood-frame rounded-2xl p-1.5 shadow-xl sm:p-2">
        {/* Felt playing surface */}
        <div className="truco-felt-surface relative flex min-w-0 flex-col gap-3 rounded-xl p-2 sm:p-3">
          {/* TOP: rival (ambient glow while the turn is theirs) */}
          <div>
            <RivalZone
              name={opponentName}
              score={view.scores[rivalSlot]}
              targetPoints={view.targetPoints}
              handCount={view.opponentHandCount}
              isTurn={rivalIsTurn}
              isMano={view.mano === rivalSlot}
              avatar={rivalAvatar}
            />
          </div>

          {/* CENTER: plays (+ bet overlay when a call awaits me) */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            <TableZone
              openBazaPlays={view.openBazaPlays}
              bazas={view.bazas}
              mySlot={mySlot}
              names={names}
              history={view.history}
              phase={view.phase}
              deckRemaining={deckRemaining}
            />

            {betPendingMine ? (
              <BetModal
                family={betFamily}
                title={betTitle}
                explanation={betExplanation}
                actions={actions}
                onAction={onAction}
                disabled={disabled}
                scores={view.scores}
                targetPoints={view.targetPoints}
                mySlot={mySlot}
                opponentName={opponentName}
              />
            ) : null}
          </div>

          {/* Prominent turn banner — superseded by the bet panel */}
          {!betPendingMine ? (
            <TurnBanner myTurn={myIsTurn} rivalTurn={rivalIsTurn} />
          ) : null}

          {/* BOTTOM: me (action bar hidden here while the bet overlay owns it) */}
          <MyZone
            name={myName}
            score={view.scores[mySlot]}
            targetPoints={view.targetPoints}
            myHand={view.myHand}
            actions={actions}
            awaitingOpponent={awaitingOpponent}
            waitingForAnswer={waitingForAnswer}
            showActionBar={!betPendingMine}
            isTurn={myIsTurn}
            isMano={view.mano === mySlot}
            onAction={onAction}
            disabled={disabled}
          />
        </div>
      </div>
    </div>

    {/* Event-derived hand-end overlay (CRITICAL 1): portal, pure-UI release. */}
    <HandEndPanel
      open={overlayOpen}
      history={view.history}
      mySlot={mySlot}
      scores={view.scores}
      onContinue={overlayContinue}
    />
    </>
  );
}
