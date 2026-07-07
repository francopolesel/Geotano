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
    'auth.login': 'Log In',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.usernamePlaceholder': 'Enter your username',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.noAccount': "Don't have an account?",
    'auth.register': 'Register',
    'auth.orDivider': 'or',
    'auth.googleNotConfigured': 'Google auth not configured',
    'auth.validation.usernameRequired': 'Username is required',
    'auth.validation.passwordRequired': 'Password is required',
    'auth.validation.passwordMin': 'Password must be at least 8 characters',
    'auth.resetInstructions': 'Enter your email to receive reset instructions.',
    'auth.emailPlaceholder': 'your@email.com',
    'auth.resetSent': 'Check your email for reset instructions.',
    'auth.sendReset': 'Send Reset Email',
    'common.loading': 'Loading...',
    'errors.common.googleFailed': 'Google sign-in failed',
    'errors.common.resetEmailFailed': 'Failed to send reset email',
  };
  return dict[key] ?? key;
};

// ─── Shared mutable refs (used inside vi.mock factories) ───────────────────

const storeState = vi.hoisted(() => ({
  error: null as string | null,
  isLoading: false,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockSetAuth = vi.hoisted(() => vi.fn());
const mockClearError = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockGoogleInit = vi.hoisted(() => vi.fn());
const mockGoogleRender = vi.hoisted(() => vi.fn());

// Capture the Google credential callback so tests can invoke it
let googleCredentialCallback: ((response: { credential: string }) => void) | null = null;

// ─── Module mocks ──────────────────────────────────────────────────────────

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
      login: mockLogin,
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

vi.mock('../../components/LanguageToggle', () => ({
  LanguageToggle: () => <div data-testid="language-toggle">LanguageToggle</div>,
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo-mock.png' }));

import { LoginPage } from './LoginPage';

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderPage() {
  return render(<LoginPage />);
}

function getUsernameInput() {
  return screen.getByPlaceholderText('Enter your username');
}
function getPasswordInput() {
  return screen.getByPlaceholderText('Enter your password');
}
function getSubmitBtn() {
  return screen.getByRole('button', { name: 'Log In' });
}
function getForgotPasswordBtn() {
  return screen.getByText('Forgot password?');
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.error = null;
    storeState.isLoading = false;
    googleCredentialCallback = null;

    // Set up window.google so the component skips script loading
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
    // Clean up any leftover google mock
    if (!('google' in window)) {
      (window as any).google = undefined;
    }
  });

  // ── Render basic structure ───────────────────────────────────────────────

  it('should render logo, title and tagline', () => {
    renderPage();
    expect(screen.getByAltText('Geotano')).toBeInTheDocument();
    expect(screen.getByText('Geotano')).toBeInTheDocument();
    expect(screen.getByText('Geo quiz app')).toBeInTheDocument();
  });

  it('should render username and password inputs', () => {
    renderPage();
    expect(getUsernameInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it('should render submit button and register link', () => {
    renderPage();
    expect(getSubmitBtn()).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('should render language toggle', () => {
    renderPage();
    expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
  });

  // ── Google OAuth ─────────────────────────────────────────────────────────

  it('should initialize Google sign-in on mount', () => {
    renderPage();
    expect(mockGoogleInit).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-google-client-id' }),
    );
    expect(mockGoogleRender).toHaveBeenCalled();
  });

  it('should show spinner during Google auth', async () => {
    // Don't resolve the post so loading stays true
    mockPost.mockImplementationOnce(() => new Promise(() => {}));

    renderPage();

    // Invoke the Google credential callback
    expect(googleCredentialCallback).toBeTruthy();
    googleCredentialCallback!({ credential: 'google-token' });

    await waitFor(() => {
      expect(screen.getByTestId('auth-spinner')).toBeInTheDocument();
    });
  });

  it('should handle Google credential on success', async () => {
    mockPost.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: 'user-1', username: 'googleuser' },
    });

    renderPage();
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

    renderPage();
    googleCredentialCallback!({ credential: 'bad-token' });

    await waitFor(() => {
      expect(screen.getByText('Google auth failed')).toBeInTheDocument();
    });
  });

  // ── Server error from store ──────────────────────────────────────────────

  it('should show server error from store', () => {
    storeState.error = 'Invalid credentials';
    renderPage();
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('should show spinner during form submit', () => {
    storeState.isLoading = true;
    renderPage();
    expect(screen.getByTestId('auth-spinner')).toBeInTheDocument();
  });

  // ── Form validation ──────────────────────────────────────────────────────

  it('should show validation error for empty username', async () => {
    renderPage();
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for empty password', async () => {
    renderPage();
    fireEvent.change(getUsernameInput(), { target: { value: 'testuser' } });
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for short password', async () => {
    renderPage();
    fireEvent.change(getUsernameInput(), { target: { value: 'testuser' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'short' } });
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 8 characters'),
      ).toBeInTheDocument();
    });
  });

  it('should show both validation errors when both fields are empty', async () => {
    renderPage();
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should clear server error on form submit', async () => {
    storeState.error = 'Server error';
    renderPage();

    fireEvent.change(getUsernameInput(), { target: { value: 'testuser' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
    fireEvent.click(getSubmitBtn());

    // clearError should be called even before validation
    expect(mockClearError).toHaveBeenCalled();
  });

  // ── Form submission ──────────────────────────────────────────────────────

  it('should call login and navigate on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.change(getUsernameInput(), { target: { value: 'testuser' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should not navigate when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid'));
    renderPage();

    fireEvent.change(getUsernameInput(), { target: { value: 'testuser' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
    fireEvent.click(getSubmitBtn());

    await waitFor(() => {
      // Error is set in store so the component re-renders with error text
      // Since we mock login as rejecting, navigate should NOT be called
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ── Forgot Password ──────────────────────────────────────────────────────

  it('should toggle forgot password form', () => {
    renderPage();
    expect(screen.queryByText('Enter your email to receive reset instructions.')).not.toBeInTheDocument();

    fireEvent.click(getForgotPasswordBtn());
    expect(screen.getByText('Enter your email to receive reset instructions.')).toBeInTheDocument();

    // Click again to hide
    fireEvent.click(getForgotPasswordBtn());
    expect(screen.queryByText('Enter your email to receive reset instructions.')).not.toBeInTheDocument();
  });

  it('should not submit forgot password with empty email', async () => {
    renderPage();
    fireEvent.click(getForgotPasswordBtn());

    const sendBtn = screen.getByRole('button', { name: 'Send Reset Email' });
    expect(sendBtn).toBeDisabled();

    // Even if we enable and click, the handler checks resetEmail.trim()
    // Let's just verify it doesn't call the API
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should show spinner during forgot password submission', async () => {
    mockPost.mockImplementationOnce(() => new Promise(() => {}));
    renderPage();

    fireEvent.click(getForgotPasswordBtn());
    const emailInput = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-spinner')).toBeInTheDocument();
    });
  });

  it('should call reset API and show success', async () => {
    mockPost.mockResolvedValueOnce({});
    renderPage();

    fireEvent.click(getForgotPasswordBtn());
    const emailInput = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'user@test.com',
      });
      expect(screen.getByText('Check your email for reset instructions.')).toBeInTheDocument();
    });
  });

  it('should show error on reset failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Email not found'));
    renderPage();

    fireEvent.click(getForgotPasswordBtn());
    const emailInput = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(emailInput, { target: { value: 'unknown@test.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));

    await waitFor(() => {
      expect(screen.getByText('Email not found')).toBeInTheDocument();
    });
  });

  // ── Register link ────────────────────────────────────────────────────────

  it('should link to register page', () => {
    renderPage();
    const registerLink = screen.getByText('Register');
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
  });
});
