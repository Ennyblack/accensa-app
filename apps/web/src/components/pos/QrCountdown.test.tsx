// @vitest-environment jsdom

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCountdown } from './QrCountdown';

const startTime = new Date('2026-01-01T00:00:00.000Z').getTime();

describe('QrCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the initial countdown with two-digit minutes and seconds', () => {
    render(<QrCountdown expiresAt={new Date(startTime + 65_000)} />);

    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('pads single-digit seconds and warns at the threshold but not after expiry', () => {
    const { container } = render(
      <QrCountdown expiresAt={new Date(startTime + 65_000)} warningThreshold={10} />,
    );
    const countdown = container.firstElementChild;

    act(() => {
      vi.advanceTimersByTime(55_000);
    });
    expect(screen.getByText('00:10')).toBeInTheDocument();
    expect(countdown).toHaveClass('animate-pulse');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('00:09')).toBeInTheDocument();
    expect(countdown).toHaveClass('animate-pulse');

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(countdown).not.toHaveClass('animate-pulse');
  });

  it('calls onExpire on every tick at zero and clears the interval on unmount', () => {
    const onExpire = vi.fn();
    const { unmount } = render(
      <QrCountdown expiresAt={new Date(startTime + 1_000)} onExpire={onExpire} />,
    );

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('Expired')).toBeInTheDocument();
    // The current implementation calls onExpire at the expiry tick and every
    // subsequent tick while the countdown remains mounted at zero.
    expect(onExpire).toHaveBeenCalledTimes(3);

    unmount();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(3);
  });
});
