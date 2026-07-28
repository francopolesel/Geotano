import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGuard } from '../components/AuthGuard';
import { setNavigateFn } from '../lib/socket';
import { AppShell } from '../components/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { HomePage } from '../features/quiz/HomePage';
import { QuizPage } from '../features/quiz/QuizPage';
import { FriendsPage } from '../features/friends/FriendsPage';
import { ChatPage } from '../features/friends/ChatPage';
import { RankingsPage } from '../features/rankings/RankingsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { MyProfilePage } from '../features/profile/MyProfilePage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { MultiplayerPage } from '../features/multiplayer/MultiplayerPage';
import { MatchHistoryPage } from '../features/multiplayer/MatchHistoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Registers the React Router navigate function in socket.ts for SPA-safe navigation. */
function NavSetup() {
  const navigate = useNavigate();
  useEffect(() => { setNavigateFn(navigate); }, [navigate]);
  return null;
}

const router = createBrowserRouter([
  // Public routes — no shell
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Protected routes — with shell layout
  {
    element: <AuthGuard />,
    children: [
      {
        element: <><NavSetup /><AppShell /></>,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'quiz', element: <QuizPage /> },
          { path: 'friends', element: <FriendsPage /> },
          { path: 'friends/chat/:userId', element: <ChatPage /> },
          { path: 'profile/:userId', element: <ProfilePage /> },
          { path: 'rankings', element: <RankingsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'my-profile', element: <MyProfilePage /> },
          { path: 'multiplayer/:matchId', element: <MultiplayerPage /> },
          { path: 'match-history', element: <MatchHistoryPage /> },
        ],
      },
    ],
  },

  // Catch-all redirect
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
