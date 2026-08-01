/**
 * Reserved display-name guard.
 *
 * "geocreator" is reserved for the platform creator (francopolesel99) so the
 * verified badge remains unambiguous. Any other user attempting to register or
 * rename to it gets a 409 RESERVED_DISPLAY_NAME.
 */

export const RESERVED_DISPLAY_NAME = 'geocreator';
export const CREATOR_USERNAME = 'francopolesel99';

/** Trim + case-insensitive match against the reserved display name. */
export function isReservedDisplayName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === RESERVED_DISPLAY_NAME;
}

/** True when the given username belongs to the platform creator. */
export function isCreator(username: string | null | undefined): boolean {
  return (username ?? '').toLowerCase() === CREATOR_USERNAME;
}
