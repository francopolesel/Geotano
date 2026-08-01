import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { VerifiedBadge } from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('should render an svg with role="img" and aria-label="Verified"', () => {
    render(<VerifiedBadge />);

    const badge = screen.getByRole('img', { name: 'Verified' });
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('svg');
  });

  it('should pass className through via cn', () => {
    const { container } = render(<VerifiedBadge className="ml-1" />);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('ml-1');
  });
});
