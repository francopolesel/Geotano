import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvatarLightboxProps {
  avatarUrl: string;
  displayName: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvatarLightbox({ avatarUrl, displayName, onClose }: AvatarLightboxProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <img
        src={avatarUrl}
        alt={displayName}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70"
      >
        ✕
      </button>
    </div>
  );
}
