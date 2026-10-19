import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

// The studio works on India Standard Time, so the site always shows that clock — even for a
// visitor whose laptop is set to another timezone.
const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour12: true,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export const LiveClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      data-testid="live-ist-clock"
      title="Studio time — India Standard Time (UTC+5:30)"
      className={`chip ${className}`}
      style={{ gap: 8, whiteSpace: 'nowrap', fontSize: 12 }}
    >
      <Clock3 size={13} style={{ color: '#ffb43d' }} />
      <span className="mono">{TIME_FORMAT.format(now)}</span>
      <span style={{ color: '#FFBF7A' }}>IST</span>
      <span className="muted mono live-day">{DAY_FORMAT.format(now)}</span>
    </span>
  );
};
