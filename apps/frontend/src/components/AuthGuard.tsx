import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import type { UserProfile } from '@geotano/shared';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const hasFetched = useRef(false);

  // On mount, refresh user profile from the server to ensure localStorage
  // (which is per-device) has the latest data. This fixes cross-device sync
  // issues where a bio saved on mobile doesn't appear on desktop until the
  // server returns the authoritative profile.
  useEffect(() => {
    if (!isAuthenticated || !token || hasFetched.current) return;
    hasFetched.current = true;

    api.get<UserProfile>('/auth/me')
      .then((user) => {
        useAuthStore.getState().setAuth(token, user);
      })
      .catch(() => {
        // Silently ignore — if the network fails, the hydrated localStorage
        // data is still available and the user can continue.
      });
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
