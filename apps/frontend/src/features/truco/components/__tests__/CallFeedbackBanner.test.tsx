import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { TrucoEvent } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { CallFeedbackBanner } from '../CallFeedbackBanner';

const NAMES = { A: 'Ana', B: 'Bruno' };

function renderBanner(history: TrucoEvent[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CallFeedbackBanner history={history} names={NAMES} />
    </I18nextProvider>,
  );
}

afterEach(() => cleanup());

describe('CallFeedbackBanner — call and answer announcements', () => {
  it('shows the full chain: Envido → Real Envido → No quiero — +2 to the winner', () => {
    const history: TrucoEvent[] = [
      { type: 'call_sung', actor: 'A', call: 'sing_envido' },
      { type: 'call_sung', actor: 'B', call: 'sing_real_envido' },
      { type: 'answered', player: 'A', answer: 'no_quiero', bet: 'envido' },
      { type: 'points_awarded', side: 'B', amount: 2, reason: 'envido_refused' },
    ];
    renderBanner(history);

    expect(screen.getByTestId('banner-call-sing_envido')).toHaveTextContent('Ana');
    expect(screen.getByTestId('banner-call-sing_envido')).toHaveTextContent('Envido');
    expect(screen.getByTestId('banner-call-sing_real_envido')).toHaveTextContent('Bruno');
    expect(screen.getByTestId('banner-answer-no_quiero')).toHaveTextContent('No quiero');
    // Refusal clearly indicates points awarded and to whom.
    const payout = screen.getByTestId('banner-points');
    expect(payout).toHaveTextContent('+2');
    expect(payout).toHaveTextContent('Bruno');
  });

  it('accepted envido showdown reveals BOTH values with the winner highlighted', () => {
    const history: TrucoEvent[] = [
      { type: 'call_sung', actor: 'B', call: 'sing_envido' },
      { type: 'answered', player: 'A', answer: 'quiero', bet: 'envido' },
      {
        type: 'envido_showdown',
        values: { A: 28, B: 31 },
        winner: 'B',
      },
      { type: 'points_awarded', side: 'B', amount: 2, reason: 'envido_accepted' },
    ];
    renderBanner(history);

    expect(screen.getByText(/28/)).toBeDefined();
    expect(screen.getByText(/31/)).toBeDefined();
    const winner = screen.getByTestId('showdown-winner');
    expect(winner).toHaveTextContent('Bruno');
  });

  it('persists only the current event cluster — older hands stay out', () => {
    const history: TrucoEvent[] = [
      { type: 'card_played', player: 'A', card: '1espada' },
      { type: 'baza_resolved', baza: 1, winner: 'A' },
      { type: 'hand_ended', winner: 'A' },
    ];
    renderBanner(history);
    expect(screen.queryByTestId(/^banner-/)).toBeNull();
  });

  it('announces truco-family calls with their localized names', () => {
    renderBanner([{ type: 'call_sung', actor: 'B', call: 'sing_truco' }]);
    expect(screen.getByTestId('banner-call-sing_truco')).toHaveTextContent('Truco');
  });
});
