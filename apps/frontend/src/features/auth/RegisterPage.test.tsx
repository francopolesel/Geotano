import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Env ───────────────────────────────────────────────────────────────────
vi.hoisted(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
});

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string) => {
  const dict: Record<string, string> = {
    'app.name': 'Geotano',
    'app.tagline': 'Geo quiz app',
    'auth.register': 'Register',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.usernamePlaceholder': 'Enter your username',
    'auth.emailPlaceholder': 'your@email.com',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.orDivider': 'or',
    'auth.googleNotConfigured': 'Google auth not configured',
    'auth.hasAccount': 'Already have an account?',
    'auth.login': 'Log In',
    'auth.validation.usernameRequired': 'Username is required',
    'auth.validation.usernameMin': 'Username must be at least 3 characters',
    'auth.validation.emailRequired': 'Email is required',
    'auth.validation.emailInvalid': 'Invalid email format',
    'auth.validation.passwordRequired': 'Password is required',
    'auth.validation.passwordMin': 'Password must be at least 8 characters',
    'common.loading': 'Loading...',
    'errors.common.googleFailed': 'Google sign-in failed',
  };
  return dict[key] ?? key;
};

// ─── Shared mutable refs ───────────────────────────────────────────────────
const storeState = vi.hoisted(() => ({
  error: null as string | null,
  isLoading: false,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());
const mockSetAuth = vi.hoisted(() => vi.fn());
const mockClearError = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockGoogleInit = vi.hoisted(() => vi.fn());
const mockGoogleRender = vi.hoisted(() => vi.fn());

let googleCredentialCallback: ((response: { credential: string }) => void) | null = null;

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => T(key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const store = {
      register: mockRegister,
      setAuth: mockSetAuth,
      isLoading: storeState.isLoading,
      error: storeState.error,
      clearError: mockClearError,
    };
    return selector ? selector(store) : store;
  },
}));

vi.mock('../../lib/api', () => ({
  api: { post: mockPost },
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo-mock.png' }));

import { RegisterPage } from './RegisterPage';

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.error = null;
    storeState.isLoading = false;
    googleCredentialCallback = null;

    mockGoogleInit.mockImplementation((config: any) => {
      googleCredentialCallback = config.callback;
    });
    window.google = {
      accounts: {
        id: {
          initialize: mockGoogleInit,
          renderButton: mockGoogleRender,
        },
      },
    };
  });

  afterEach(() => {
    if (!('google' in window)) {
      (window as any).google = undefined;
    }
  });

  // ── Render basic structure ───────────────────────────────────────────────

  it('should render logo, title and tagline', () => {
    render(<RegisterPage />);
    expect(screen.getByAltText('Geotano')).toBeInTheDocument();
    expect(screen.getByText('Geotano')).toBeInTheDocument();
    expect(screen.getByText('Geo quiz app')).toBeInTheDocument();
  });

  it('should render username, email and password inputs', () => {
    render(<RegisterPage />);
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('should render submit button and login link', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  // ── Google OAuth ─────────────────────────────────────────────────────────

  it('should initialize Google sign-in on mount', () => {
    render(<RegisterPage />);
    expect(mockGoogleInit).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-google-client-id' }),
    );
    expect(mockGoogleRender).toHaveBeenCalled();
  });

  it('should handle Google credential on success', async () => {
    mockPost.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: 'user-1', username: 'googleuser' },
    });

    render(<RegisterPage />);
    googleCredentialCallback!({ credential: 'google-token' });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/google', {
        credential: 'google-token',
        clientId: 'test-google-client-id',
      });
      expect(mockSetAuth).toHaveBeenCalledWith(
        'jwt-token',
        { id: 'user-1', username: 'googleuser' },
      );
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should show error on Google credential failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Google auth failed'));

    render(<RegisterPage />);
    googleCredentialCallback!({ credential: 'bad-token' });

    await waitFor(() => {
      expect(screen.getByText('Google auth failed')).toBeInTheDocument();
    });
  });

  // ── Server error from store ──────────────────────────────────────────────

  it('should show server error from store', () => {
    storeState.error = 'Username taken';
    render(<RegisterPage />);
    expect(screen.getByText('Username taken')).toBeInTheDocument();
  });

  it('should show loading state from store', () => {
    storeState.isLoading = true;
    render(<RegisterPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ── Form validation ──────────────────────────────────────────────────────

  it('should show validation error for empty username', async () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for short username', async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('should show validation error for empty email', async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'testuser' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email', async () => {
    render(<RegisterPage />);
    const usernameInput = screen.getByPlaceholderText('Enter your username');
    const emailInput = screen.getByPlaceholderText('your@email.com');

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

    // Submit form directly to ensure state is flushed
    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });
  });

  it('should show validation error for short password', async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  // ── Form submission ──────────────────────────────────────────────────────

  it('should call register and navigate on valid submit', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('testuser', 'test@test.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should not navigate when register fails', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Username taken'));
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should clear server error on form submit', () => {
    storeState.error = 'Server error';
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(mockClearError).toHaveBeenCalled();
  });

  // ── Login link ───────────────────────────────────────────────────────────

  it('should link to login page', () => {
    render(<RegisterPage />);
    const loginLink = screen.getByText('Log In');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
  });
});
