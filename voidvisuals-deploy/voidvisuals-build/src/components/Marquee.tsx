import React from 'react';
import { MARQUEE_WORDS } from '../data/vvData';

/** Endless word strip. The track is rendered twice so the -50% loop never shows a seam. */
export const Marquee: React.FC<{ words?: string[] }> = ({ words = MARQUEE_WORDS }) => {
  const loop = [...words, ...words];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((word, i) => (
          <span key={`${word}-${i}`}>{word}</span>
        ))}
      </div>
    </div>
  );
};
