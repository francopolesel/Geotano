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
  /** Optional click handler (e.g. to open lightbox) */
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserAvatar({ avatarUrl, username, displayName, className, onClick }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();

  // Show <img> when we have a valid URL and it hasn't errored
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        onError={() => setImgError(true)}
        onClick={onClick}
        className={`shrink-0 rounded-full object-cover ${onClick ? 'cursor-pointer' : ''} ${className ?? 'h-10 w-10'}`}
      />
    );
  }

  // Fallback: coloured circle with initial
  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)] ${onClick ? 'cursor-pointer' : ''} ${className ?? 'h-10 w-10 text-sm'}`}
    >
      {initial}
    </div>
  );
}
