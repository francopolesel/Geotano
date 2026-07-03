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
  /** Optional click handler (e.g. to open lightbox). Stops propagation so parent buttons don't swallow the click. */
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserAvatar({ avatarUrl, username, displayName, className, onClick }: UserAvatarProps) {
  const handleClick = onClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick();
      }
    : undefined;
  const [imgError, setImgError] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();

  // Show <img> when we have a valid URL and it hasn't errored
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        onError={() => setImgError(true)}
        onClick={handleClick}
        className={`shrink-0 rounded-full object-cover ${onClick ? 'cursor-pointer' : ''} ${className ?? 'h-10 w-10'}`}
      />
    );
  }

  // Fallback: coloured circle with initial
  return (
    <div
      onClick={handleClick}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)] ${onClick ? 'cursor-pointer' : ''} ${className ?? 'h-10 w-10 text-sm'}`}
    >
      {initial}
    </div>
  );
}
