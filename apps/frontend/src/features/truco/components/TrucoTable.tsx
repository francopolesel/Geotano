import type { PlayerSlot, TrucoAction, TrucoView } from '@geotano/shared';
import { legalActions } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { RivalZone } from './RivalZone';
import { TableZone } from './TableZone';
import { MyZone } from './MyZone';
import { ActionBar } from './ActionBar';
import { BetPanel } from './BetPanel';
import { TurnBanner } from './TurnBanner';
import { GameHistory } from './GameHistory';
import { CardsIcon, CoinsIcon, FlameIcon } from './icons';
import { isAwaitingOpponent } from '../lib/turnQuery';

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
}

/** Discreet chip naming the current stake in human terms. */
function StakeChip({ view }: { view: TrucoView }) {
  const { t } = useTranslation();
  // A pending raise shows its sung level even before acceptance.
  const level = view.trucoAwaiting?.level ?? view.acceptedTrucoLevel;
  const envidoLine = view.envidoAwaiting
    ? t('truco.stake.envidoPending')
    : view.envidoClosed
      ? t('truco.stake.envidoResolved')
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
        {level === 1
          ? t('truco.stake.simple', { n: 1 })
          : `${t(`truco.call.${level === 2 ? 'truco' : level === 3 ? 'retruco' : 'valeCuatro'}`)} · ${level} ${t('truco.banner.pointsUnit')}`}
      </span>
      {envidoLine ? (
        <span className="mt-0.5 flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2 py-0.5 text-[9px] font-medium text-white/75">
          <CoinsIcon className="h-2.5 w-2.5" />
          {envidoLine}
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
}: TrucoTableProps) {
  const { t } = useTranslation();
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  // Computed keys defeat Record inference in TS; branch explicitly instead.
  const names: Record<PlayerSlot, string> =
    mySlot === 'A' ? { A: myName, B: opponentName } : { A: opponentName, B: myName };
  // Legality comes ONLY from the engine, evaluated over the public context.
  const actions = legalActions(view, mySlot);

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

  const actionBar = (
    <ActionBar
      actions={actions}
      onAction={onAction}
      awaitingOpponent={awaitingOpponent}
      waitingForAnswer={waitingForAnswer}
      // Thumb-friendly full-width answers while the bet overlay owns the bar.
      stacked={betPendingMine}
    />
  );

  return (
    <div
      data-testid="truco-table"
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-2 overflow-x-hidden p-2"
    >
      {/* Table header: round status + current stake + history toggle.
          Wrapping is allowed so StakeChip and the toggle never collide with
          the round status on narrow viewports. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
        <span
          data-testid="truco-round-status"
          className="text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]"
        >
          {t('truco.round.status', { hand: view.handNumber, baza: view.bazaNumber })}
        </span>
        <div className="flex min-w-0 shrink items-center gap-2">
          <StakeChip view={view} />
          <GameHistory history={view.history} mySlot={mySlot} names={names} />
        </div>
      </div>

      {/* Wood frame around the felt */}
      <div className="truco-wood-frame rounded-2xl p-1.5 shadow-xl sm:p-2">
        {/* Felt playing surface */}
        <div className="truco-felt-surface relative flex min-w-0 flex-col gap-2 rounded-xl p-2 sm:p-3">
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
            />

            {betPendingMine ? (
              <BetPanel
                family={betFamily}
                title={betTitle}
                explanation={betExplanation}
                answerHint={t('truco.bet.answerHint')}
              >
                {actionBar}
              </BetPanel>
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
          />
        </div>
      </div>
    </div>
  );
}
