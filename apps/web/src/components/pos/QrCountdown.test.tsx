// @vitest-environment jsdom

import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QrCountdown } from './QrCountdown';

describe('QrCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders initial MM:SS with zero padding for single-digit seconds', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 75000); // 1 minute 15 seconds
    render(<QrCountdown expiresAt={expiresAt} />);

    expect(screen.getByText('Expires in')).toBeInTheDocument();
    expect(screen.getByText('01:15')).toBeInTheDocument();
  });

  it('pads single-digit minutes and seconds correctly', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 7000); // 7 seconds
    render(<QrCountdown expiresAt={expiresAt} />);

    expect(screen.getByText('00:07')).toBeInTheDocument();
  });

  it('does not trigger warning styling when remaining is above warningThreshold', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 35000); // 35 seconds, default warningThreshold = 30
    const { container } = render(<QrCountdown expiresAt={expiresAt} warningThreshold={30} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass('animate-pulse');
    expect(screen.getByText('00:35')).toBeInTheDocument();
  });

  it('sets warning styling strictly inside (0, warningThreshold]', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 30000); // exactly 30 seconds
    const { container } = render(<QrCountdown expiresAt={expiresAt} warningThreshold={30} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('animate-pulse');
    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('replaces timer with Expired block at exactly zero and does not treat zero as warning', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 2000);
    render(<QrCountdown expiresAt={expiresAt} warningThreshold={30} />);

    expect(screen.getByText('00:02')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('Expires in')).not.toBeInTheDocument();
  });

  it('asserts actual behavior of onExpire: fires on every tick after zero (repeat-fire finding)', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const onExpire = vi.fn();
    const expiresAt = new Date(now + 1000);
    render(<QrCountdown expiresAt={expiresAt} onExpire={onExpire} />);

    expect(onExpire).not.toHaveBeenCalled();

    // Advance to t = 1s (expires)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Advance past zero (t = 2s, 3s) confirming interval continues to fire onExpire
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(3);
  });

  it('tears down interval on unmount so no updates occur post-unmount', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(now);

    const onExpire = vi.fn();
    const expiresAt = new Date(now + 5000);
    const { unmount } = render(<QrCountdown expiresAt={expiresAt} onExpire={onExpire} />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).not.toHaveBeenCalled();
  });
});
