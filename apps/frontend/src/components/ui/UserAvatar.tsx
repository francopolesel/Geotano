import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserAvatarProps {
  avatarUrl?: string | null;
  username: string;
  displayName?: string | null;
  /** Tailwind size classes. Default: 'h-10 w-10 text-sm' */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserAvatar({ avatarUrl, username, displayName, className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();

  // Show <img> when we have a valid URL and it hasn't errored
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        onError={() => setImgError(true)}
        className={`shrink-0 rounded-full object-cover ${className ?? 'h-10 w-10'}`}
      />
    );
  }

  // Fallback: coloured circle with initial
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)] ${className ?? 'h-10 w-10 text-sm'}`}
    >
      {initial}
    </div>
  );
}
