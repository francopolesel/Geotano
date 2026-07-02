import { useEffect, useRef, useState, useCallback } from 'react';

interface UseTimerOptions {
  durationMs: number;
  onExpire?: () => void;
  /** Stop the timer after expiry; if false, timer keeps counting negatively */
  stopOnExpire?: boolean;
}

interface UseTimerReturn {
  /** Remaining time in milliseconds */
  remainingMs: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** 0..1 fraction of time remaining */
  fraction: number;
  /** Whether the timer has expired */
  expired: boolean;
  /** Whether the timer is currently running */
  running: boolean;
  /** Start the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Reset the timer to full duration */
  reset: () => void;
}

export function useTimer({
  durationMs,
  onExpire,
  stopOnExpire = true,
}: UseTimerOptions): UseTimerReturn {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const elapsedMs = Math.max(0, durationMs - remainingMs);
  const fraction = durationMs > 0 ? remainingMs / durationMs : 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setRunning(true);
    setExpired(false);

    const startTime = Date.now();
    const initialRemaining = durationMs;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, initialRemaining - elapsed);

      setRemainingMs(remaining);

      if (remaining <= 0) {
        setExpired(true);
        if (stopOnExpire) {
          clearTimer();
          setRunning(false);
        }
        onExpireRef.current?.();
      }
    }, 100); // Update every 100ms for smooth timer bar
  }, [durationMs, stopOnExpire, clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setRunning(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setRemainingMs(durationMs);
    setExpired(false);
    setRunning(false);
  }, [durationMs, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    remainingMs,
    elapsedMs,
    fraction,
    expired,
    running,
    start,
    pause,
    reset,
  };
}
