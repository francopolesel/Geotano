// ---------------------------------------------------------------------------
// Truco — shared ApiError status mapping (remediation #16)
// ---------------------------------------------------------------------------

/**
 * Thrown values are ApiError-shaped ({status}); map without instanceof so
 * module-mocked api clients in tests behave identically to production.
 */
export function statusOf(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}
