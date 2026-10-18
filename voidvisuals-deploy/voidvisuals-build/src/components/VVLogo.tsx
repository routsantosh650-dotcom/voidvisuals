import React, { useId } from 'react';

/** The studio mark: a "V" cut in the aurora gradient. */
export const VVLogo: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`vv-${id}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c5cff" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#ff7bd5" />
        </linearGradient>
      </defs>
      <path
        d="M3.6 5.4 12 19.2 20.4 5.4"
        stroke={`url(#vv-${id})`}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.1" r="1.85" fill={`url(#vv-${id})`} opacity="0.9" />
    </svg>
  );
};
