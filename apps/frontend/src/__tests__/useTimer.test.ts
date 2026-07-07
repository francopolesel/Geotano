import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../hooks/useTimer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with full duration and not running', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 10000 }));

    expect(result.current.remainingMs).toBe(10000);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.fraction).toBe(1);
    expect(result.current.expired).toBe(false);
    expect(result.current.running).toBe(false);
  });

  it('should handle zero duration gracefully', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 0 }));

    expect(result.current.remainingMs).toBe(0);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.fraction).toBe(0);
    expect(result.current.expired).toBe(false);
  });

  it('should start countdown when start is called', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 5000 }));

    act(() => {
      result.current.start();
    });

    expect(result.current.running).toBe(true);
    expect(result.current.expired).toBe(false);

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.remainingMs).toBe(3000);
    expect(result.current.elapsedMs).toBe(2000);
    expect(result.current.fraction).toBeCloseTo(0.6, 1);
  });

  it('should call onExpire when timer reaches zero', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useTimer({ durationMs: 1000, onExpire }));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.expired).toBe(true);
    expect(result.current.remainingMs).toBe(0);
  });

  it('should stop timer automatically when stopOnExpire is true (default)', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 1000 }));

    act(() => {
      result.current.start();
    });

    // Advance past expiry
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.running).toBe(false);
    expect(result.current.expired).toBe(true);
    expect(result.current.remainingMs).toBe(0);
  });

  it('should keep counting when stopOnExpire is false (timer stays running)', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useTimer({ durationMs: 1000, stopOnExpire: false, onExpire }));

    act(() => {
      result.current.start();
    });

    // Advance past expiry
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Still running, expired is true, onExpire should have been called
    expect(result.current.running).toBe(true);
    expect(result.current.expired).toBe(true);
    expect(onExpire).toHaveBeenCalled();
    // remainingMs clamps to 0
    expect(result.current.remainingMs).toBe(0);
  });

  it('should pause the countdown', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 5000 }));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.running).toBe(false);
    const frozenRemaining = result.current.remainingMs;

    // Advance more time — should not affect paused timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.remainingMs).toBe(frozenRemaining);
  });

  it('should reset to initial state', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 5000 }));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.remainingMs).toBe(5000);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.fraction).toBe(1);
    expect(result.current.expired).toBe(false);
    expect(result.current.running).toBe(false);
  });

  it('should start again after reset', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 5000 }));

    // Start and run for 2s
    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(2000); });

    // Reset
    act(() => { result.current.reset(); });

    // Start again
    act(() => { result.current.start(); });
    expect(result.current.running).toBe(true);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.remainingMs).toBe(4000);
  });

  it('should update onExpire callback via ref without re-creating interval', () => {
    const onExpire1 = vi.fn();
    const { result, rerender } = renderHook(
      ({ durationMs, onExpire }) => useTimer({ durationMs, onExpire }),
      { initialProps: { durationMs: 1000, onExpire: onExpire1 } },
    );

    // Change the callback reference
    const onExpire2 = vi.fn();
    rerender({ durationMs: 1000, onExpire: onExpire2 });

    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(1000); });

    // Only the latest callback should have been called
    expect(onExpire1).not.toHaveBeenCalled();
    expect(onExpire2).toHaveBeenCalledTimes(1);
  });

  it('should clean up interval on unmount', () => {
    const { result, unmount } = renderHook(() => useTimer({ durationMs: 5000 }));

    act(() => { result.current.start(); });
    expect(result.current.running).toBe(true);

    unmount();

    // After unmount, advancing time should not throw or cause state updates
    expect(() => {
      vi.advanceTimersByTime(1000);
    }).not.toThrow();
  });
});
