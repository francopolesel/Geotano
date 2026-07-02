type ClassValue = string | number | null | false | undefined;

/**
 * Utility to merge Tailwind class names.
 * Simplified version of clsx + tailwind-merge for the MVP.
 */
export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ');
}
