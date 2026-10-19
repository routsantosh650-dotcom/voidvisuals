import React, { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';

interface OfferCountdownProps {
  /** Epoch milliseconds the offer expires. Anything <= 0 means "no countdown". */
  endsAt: number;
}

const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour12: true,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function splitRemaining(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ticking "offer ends in" clock. Renders nothing before a deadline is set and nothing once it
 * passes — the parent uses isOfferExpired() to retire the whole board at that exact second.
 */
export const OfferCountdown: React.FC<OfferCountdownProps> = ({ endsAt }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt || endsAt <= Date.now()) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= endsAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt || endsAt <= 0) return null;

  const msLeft = endsAt - now;
  if (msLeft <= 0) return null;

  const { days, hours, minutes, seconds } = splitRemaining(msLeft);
  const urgent = msLeft < 6 * 60 * 60 * 1000;
  const clock =
    days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return (
    <div
      data-testid="offer-countdown"
      className={`countdown ${urgent ? 'is-urgent' : 'is-live'}`}
    >
      <span className="lbl">
        <Hourglass size={12} className={urgent ? 'spin-slow' : ''} />
        Offer ends in
      </span>
      <span className="clock">{clock}</span>
      <span className="till">till {DEADLINE_FORMAT.format(new Date(endsAt))} IST</span>
    </div>
  );
};

/** True once a set deadline has passed — the offer board hides itself then. */
export function isOfferExpired(endsAt: number, now: number = Date.now()): boolean {
  return Boolean(endsAt && endsAt > 0 && endsAt <= now);
}
