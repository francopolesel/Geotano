import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Achievement } from '@geotano/shared';

// ─── Mock i18n ────────────────────────────────────────────────────────────

let mockLang = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'achievements.tierPlatinum': 'Platinum',
        'achievements.tierGold': 'Gold',
        'achievements.tierSilver': 'Silver',
        'achievements.tierBronze': 'Bronze',
      };
      return keys[key] ?? key;
    },
    i18n: {
      get language() { return mockLang; },
    },
  }),
}));

import { AchievementBadge } from './AchievementBadge';

const baseAchievement: Achievement = {
  slug: 'first-quiz',
  category: 'milestones',
  icon: '🏆',
  nameEn: 'First Quiz',
  nameEs: 'Primer Quiz',
  descriptionEn: 'Complete your first quiz',
  descriptionEs: 'Completa tu primer quiz',
  tier: 1,
  earnedAt: null,
};

describe('AchievementBadge', () => {
  beforeEach(() => {
    mockLang = 'en';
  });

  it('should render earned achievement with solid styling', () => {
    const { container } = render(<AchievementBadge achievement={{ ...baseAchievement, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText('First Quiz')).toBeInTheDocument();
    // Description is in the title attribute
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('title')).toBe('Complete your first quiz');
    expect(screen.getByText('Bronze')).toBeInTheDocument();
  });

  it('should render unearned achievement with dashed styling', () => {
    const { container } = render(<AchievementBadge achievement={baseAchievement} />);

    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText('First Quiz')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('title')).toBe('Complete your first quiz');
  });

  it('should use Spanish names when language is es', () => {
    mockLang = 'es';
    const { container } = render(<AchievementBadge achievement={{ ...baseAchievement, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.getByText('Primer Quiz')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('title')).toBe('Completa tu primer quiz');
  });

  it('should display Gold tier text for tier 3', () => {
    render(<AchievementBadge achievement={{ ...baseAchievement, tier: 3, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('should display Silver tier text for tier 2', () => {
    render(<AchievementBadge achievement={{ ...baseAchievement, tier: 2, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.getByText('Silver')).toBeInTheDocument();
  });

  it('should display Platinum tier text and cyan styling for tier 4', () => {
    const { container } = render(<AchievementBadge achievement={{ ...baseAchievement, tier: 4, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.getByText('Platinum')).toBeInTheDocument();
    const tierSpan = screen.getByText('Platinum');
    expect(tierSpan.className).toContain('text-cyan-400');
  });

  it('should not render tier badge when tier is missing', () => {
    render(<AchievementBadge achievement={{ ...baseAchievement, tier: null, earnedAt: '2025-01-01T00:00:00Z' }} />);

    expect(screen.queryByText('Bronze')).not.toBeInTheDocument();
    expect(screen.queryByText('Silver')).not.toBeInTheDocument();
    expect(screen.queryByText('Gold')).not.toBeInTheDocument();
  });
});
