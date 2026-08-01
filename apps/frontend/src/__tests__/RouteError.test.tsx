import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { RouteError } from '../components/RouteError';

function renderRouteError() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RouteError />,
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
}

describe('RouteError', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a friendly error screen with reload and home actions', () => {
    renderRouteError();

    expect(screen.getByText('Unexpected error')).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
    expect(screen.getByText('Go to home')).toBeTruthy();
  });

  it('reloads the page when Reload is clicked', () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    // jsdom's location.reload is not redefinable — replace the whole object
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    renderRouteError();

    fireEvent.click(screen.getByText('Reload'));

    expect(reloadSpy).toHaveBeenCalledOnce();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('logs the router error for observability', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <RouteError />,
          loader: () => {
            throw new Error('boom');
          },
        },
      ],
      { initialEntries: ['/'] },
    );
    render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>,
    );

    // The error boundary renders after the loader rejects (async)
    await screen.findByText('Unexpected error');

    expect(errorSpy).toHaveBeenCalled();
  });
});
