import type { PlayerSlot, TrucoAction, TrucoView } from '@geotano/shared';
import { legalActions } from '@geotano/shared';
import type { ReactNode } from 'react';
import { RivalZone } from './RivalZone';
import { TableZone } from './TableZone';
import { MyZone } from './MyZone';
import { isAwaitingOpponent } from '../lib/turnQuery';

/**
 * Full match table (both CPU and multiplayer modes).
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

export function TrucoTable({
  view,
  mySlot,
  myName,
  opponentName,
  onAction,
  rivalAvatar,
}: TrucoTableProps) {
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

  return (
    <div
      data-testid="truco-table"
      className="mx-auto flex min-h-0 w-full max-w-lg flex-col gap-2 overflow-x-hidden p-2"
    >
      {/* TOP: rival */}
      <RivalZone
        name={opponentName}
        score={view.scores[rivalSlot]}
        targetPoints={view.targetPoints}
        handCount={view.opponentHandCount}
        isTurn={rivalIsTurn}
        avatar={rivalAvatar}
      />

      {/* CENTER: table */}
      <TableZone
        openBazaPlays={view.openBazaPlays}
        bazas={view.bazas}
        mySlot={mySlot}
        names={names}
        history={view.history}
      />

      {/* BOTTOM: me */}
      <MyZone
        name={myName}
        score={view.scores[mySlot]}
        targetPoints={view.targetPoints}
        myHand={view.myHand}
        actions={actions}
        awaitingOpponent={awaitingOpponent}
        onAction={onAction}
      />
    </div>
  );
}
