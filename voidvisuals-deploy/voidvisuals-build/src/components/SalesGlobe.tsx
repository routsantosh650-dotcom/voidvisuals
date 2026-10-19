import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';
import './SalesGlobe.css';

/*
 * SalesGlobe — a dot-matrix world map repurposed as a sales map: every glowing
 * node is a place where a VoidVisuals website is live. Technique mirrors the
 * sibling site's GlobalNetworkMap (hand-authored continent polygons sampled on a
 * ~10px grid with a point-in-polygon test, drawn as circles; quadratic arcs with
 * travelling SVG <animateMotion> packets; glow + ring + core nodes with a label
 * pill) but is re-skinned to the Aurora Ember tokens and India-weighted content.
 */

type Kind = 'india' | 'world';

interface SalesNode {
  id: string;
  name: string;
  x: number; // 0..1000 viewBox units
  y: number; // 0..480 viewBox units
  label: string; // pill detail, e.g. "6 sites live"
  kind: Kind; // india -> --flame, world -> --gold
  dx?: number; // label pill offset (default 0)
  dy?: number; // label pill offset (default -26, i.e. above the dot)
}

/*
 * ---------------------------------------------------------------------------
 * HOW THE NODE COORDINATES WERE DERIVED  (viewBox 0 0 1000 480)
 * The viewBox is a 25:12 ratio, so longitude/latitude map LINEARLY and evenly
 * (1 unit = 1° in both axes). Every OVERSEAS node is computed straight from the
 * real city lat/long with:
 *     x = (lon + 180) / 360 * 1000        y = (90 - lat) / 180 * 480
 * e.g. London (51.5N, 0.1W) -> (500,103); Dubai (25.2N, 55.3E) -> (653,173);
 * Singapore (1.4N, 103.8E) -> (788,236); Sydney (33.9S, 151.2E) -> (920,330).
 * Those land exactly where the projection says, on the matching continent below.
 *
 * India (Mumbai 19N/73E -> x703,y190; Bengaluru 13N/78E -> x716,y206) spans only
 * ~45x40 units under that strict projection, so 9 domestic cities would pile up.
 * The India outline is therefore drawn as a deliberately ENLARGED subcontinent box
 * (x 690-756, y 143-234) and the 9 city dots keep true relative geography —
 * Noida/Delhi · Jaipur · Lucknow north, Ahmedabad · Surat · Mumbai down the west
 * coast, Kolkata east, Hyderabad · Bengaluru south — hand-spread so no two dots
 * are closer than ~12 units. Each India coordinate was verified to sit INSIDE the
 * India polygon with the same point-in-polygon test the dot matrix uses (see
 * isPointInPolygon), so every node rests on the landmass these polygons produce.
 * ---------------------------------------------------------------------------
 */

const SALES_NODES: SalesNode[] = [
  // 9 Indian cities (kind: 'india' -> --flame), laid out across the enlarged subcontinent polygon
  { id: 'delhi', name: 'Noida · Delhi', x: 718, y: 159, label: '6 sites live', kind: 'india', dy: -26 },
  { id: 'jaipur', name: 'Jaipur', x: 703, y: 167, label: '2 sites live', kind: 'india', dx: -18, dy: 22 },
  { id: 'lucknow', name: 'Lucknow', x: 729, y: 171, label: '1 site live', kind: 'india', dy: -26 },
  { id: 'ahmedabad', name: 'Ahmedabad', x: 697, y: 181, label: '2 sites live', kind: 'india', dx: -22, dy: -4 },
  { id: 'kolkata', name: 'Kolkata', x: 748, y: 182, label: '2 sites live', kind: 'india', dx: 24, dy: -2 },
  { id: 'surat', name: 'Surat', x: 699, y: 193, label: '3 sites live', kind: 'india', dx: -20, dy: 8 },
  { id: 'mumbai', name: 'Mumbai', x: 708, y: 202, label: '9 sites live · HQ', kind: 'india', dx: -16, dy: 26 },
  { id: 'hyderabad', name: 'Hyderabad', x: 723, y: 212, label: '3 sites live', kind: 'india', dx: 22, dy: 4 },
  { id: 'bengaluru', name: 'Bengaluru', x: 718, y: 224, label: '5 sites live', kind: 'india', dy: 28 },
  // 6 overseas (kind: 'world' -> --gold), straight from the strict world projection above
  { id: 'dubai', name: 'Dubai', x: 653, y: 173, label: '1 site live', kind: 'world', dx: -16, dy: -4 },
  { id: 'singapore', name: 'Singapore', x: 788, y: 236, label: 'Minecraft network', kind: 'world', dy: 26 },
  { id: 'london', name: 'London', x: 500, y: 103, label: '2 sites live', kind: 'world', dy: -24 },
  { id: 'frankfurt', name: 'Frankfurt', x: 524, y: 106, label: '1 site live', kind: 'world', dx: 20, dy: 22 },
  { id: 'toronto', name: 'Toronto', x: 280, y: 124, label: '1 site live', kind: 'world', dy: -24 },
  { id: 'sydney', name: 'Sydney', x: 920, y: 330, label: '2 sites live', kind: 'world', dx: -18, dy: -4 },
];

const HQ_ID = 'mumbai';

// Faint arcs out from the Mumbai HQ to far-flung locations. controlYOffset bows the
// quadratic's midpoint up (negative) / down (positive).
const ARCS: Array<{ to: string; controlYOffset: number }> = [
  { to: 'singapore', controlYOffset: 22 },
  { to: 'london', controlYOffset: -52 },
  { to: 'frankfurt', controlYOffset: -48 },
  { to: 'dubai', controlYOffset: -32 },
];

/*
 * Stylised continent outlines in 1000x480 equirectangular space (same technique as
 * the reference; the India polygon is the intentionally enlarged subcontinent box
 * described above). Together these drive the dot-matrix fill.
 */
const CONTINENT_POLYGONS: Array<Array<[number, number]>> = [
  // North America
  [
    [120, 95], [210, 80], [300, 95], [330, 120], [300, 150], [270, 185],
    [235, 215], [200, 235], [165, 205], [140, 160], [115, 125],
  ],
  // Greenland
  [
    [365, 50], [430, 45], [445, 85], [395, 100], [360, 78],
  ],
  // South America
  [
    [250, 285], [310, 292], [360, 330], [345, 392], [305, 452], [275, 462], [258, 400], [240, 335],
  ],
  // Europe (London, Frankfurt)
  [
    [470, 80], [540, 72], [585, 90], [580, 125], [545, 150], [500, 150], [475, 120], [462, 100],
  ],
  // Africa
  [
    [465, 210], [560, 205], [620, 250], [628, 320], [585, 410], [530, 420], [498, 355], [460, 285],
  ],
  // Mainland Asia (Siberia -> China -> SE Asia)
  [
    [588, 78], [742, 66], [898, 86], [928, 145], [866, 205], [812, 250], [760, 205], [748, 165], [700, 150], [640, 150], [596, 130],
  ],
  // India — enlarged subcontinent for node legibility (Noida/Delhi, Jaipur, Lucknow, Ahmedabad, Kolkata, Surat, Mumbai, Hyderabad, Bengaluru)
  [
    [688, 150], [712, 143], [748, 152], [756, 175], [744, 202], [724, 234], [700, 208], [690, 175],
  ],
  // Arabia (Dubai)
  [
    [632, 150], [662, 146], [680, 158], [676, 180], [656, 196], [636, 182], [626, 164],
  ],
  // Malay peninsula + Sumatra (Singapore)
  [
    [756, 180], [786, 192], [800, 225], [792, 252], [770, 235], [760, 205],
  ],
  // Japan
  [
    [900, 150], [925, 160], [915, 205], [890, 195],
  ],
  // Indonesia (maritime SEA)
  [
    [760, 260], [860, 258], [872, 292], [770, 296],
  ],
  // Australia (Sydney)
  [
    [840, 300], [940, 295], [962, 355], [905, 405], [838, 380],
  ],
  // New Zealand
  [
    [968, 380], [984, 376], [982, 405], [964, 400],
  ],
];

function isPointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const ARC_COUNT = ARCS.length;

export const SalesGlobe: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [activeId, setActiveId] = useState<string>(HQ_ID);
  const [paused, setPaused] = useState(false);

  // Dot-matrix: sample every continent polygon on a ~10px grid, once.
  const worldDots = useMemo<Array<[number, number]>>(() => {
    const dots: Array<[number, number]> = [];
    const step = 10;
    for (let x = 45; x <= 965; x += step) {
      for (let y = 36; y <= 456; y += step) {
        if (CONTINENT_POLYGONS.some((poly) => isPointInPolygon(x, y, poly))) {
          dots.push([x, y]);
        }
      }
    }
    return dots;
  }, []);

  const reduced = useMemo(() => prefersReducedMotion(), []);

  // Auto-cycle: highlight the next node every ~2.6s, pausing while the map is hovered/
  // focused and disabled entirely under prefers-reduced-motion.
  const activeRef = useRef(0);
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    SALES_NODES.forEach((n, i) => map.set(n.id, i));
    return map;
  }, []);
  useEffect(() => {
    activeRef.current = indexById.get(activeId) ?? 0;
  }, [activeId, indexById]);

  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setInterval(() => {
      const next = (activeRef.current + 1) % SALES_NODES.length;
      activeRef.current = next;
      setActiveId(SALES_NODES[next].id);
    }, 2600);
    return () => window.clearInterval(id);
  }, [reduced, paused]);

  const hq = SALES_NODES.find((n) => n.id === HQ_ID) ?? SALES_NODES[0];

  return (
    <section className="section" id="sales">
      <div className="shell">
        {!compact ? (
          <div className="section-head">
            <span className="eyebrow">Sales map · live launches</span>
            <h2 className="display">
              <span data-split>Where our sites</span> <i>are live</i>
            </h2>
            <p className="lead" data-reveal="up" data-delay="0.15">
              Mostly Indian businesses — Mumbai, Delhi NCR, Bengaluru and more — plus a
              growing set of overseas launches. Hover a node to see what shipped there.
            </p>
          </div>
        ) : null}

        <div className={`sales-globe${compact ? ' is-compact' : ''}`}>
          <div className="sg-head">
            <span className="sg-status">
              <span className="sg-pulse" aria-hidden="true" />
              {`${SALES_NODES.length} locations · all sites live`}
            </span>
            <span className="sg-legend" aria-hidden="true">
              <span className="sg-legend-item">
                <span className="sg-legend-swatch is-india" /> India
              </span>
              <span className="sg-legend-item">
                <span className="sg-legend-swatch is-world" /> Overseas
              </span>
            </span>
          </div>

          <div className="sg-card">
            <div
              className="sg-map"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              <svg
                viewBox="0 0 1000 480"
                role="img"
                aria-label="VoidVisuals sales map showing live sites across India and overseas"
              >
                <defs>
                  <radialGradient id="sgGlowFlame" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--flame)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="var(--flame)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="sgGlowGold" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* faint latitude / longitude graticule */}
                <g className="sg-graticule" aria-hidden="true">
                  {[120, 240, 360].map((gy) => (
                    <line key={`lat-${gy}`} x1={0} y1={gy} x2={1000} y2={gy} />
                  ))}
                  {[200, 400, 600, 800].map((gx) => (
                    <line key={`lon-${gx}`} x1={gx} y1={0} x2={gx} y2={480} />
                  ))}
                </g>

                {/* dot-matrix continents */}
                <g className="sg-dotmatrix" aria-hidden="true">
                  {worldDots.map((dot) => (
                    <circle key={`${dot[0]}_${dot[1]}`} cx={dot[0]} cy={dot[1]} r={1.7} />
                  ))}
                </g>

                {/* routing arcs out of the HQ node */}
                <g aria-hidden="true">
                  {ARCS.map((arc, i) => {
                    const to = SALES_NODES.find((n) => n.id === arc.to);
                    if (!to) return null;
                    const d = `M ${hq.x} ${hq.y} Q ${(hq.x + to.x) / 2} ${
                      (hq.y + to.y) / 2 + arc.controlYOffset
                    } ${to.x} ${to.y}`;
                    return (
                      <g key={arc.to}>
                        <path className="sg-arc" d={d} />
                        <circle className="sg-packet" r={2.4}>
                          <animateMotion
                            dur={`${(2.6 + (i % ARC_COUNT) * 0.7).toFixed(1)}s`}
                            repeatCount="indefinite"
                            path={d}
                          />
                        </circle>
                      </g>
                    );
                  })}
                </g>

                {/* interactive nodes */}
                {SALES_NODES.map((node) => {
                  const isActive = node.id === activeId;
                  const color = node.kind === 'india' ? 'var(--flame)' : 'var(--gold)';
                  const glow = node.kind === 'india' ? 'url(#sgGlowFlame)' : 'url(#sgGlowGold)';
                  const text = `${node.name} · ${node.label}`;
                  const width = Math.max(72, text.length * 6.05 + 18);
                  const dx = node.dx ?? 0;
                  const dy = node.dy ?? -26;
                  const lx = node.x + dx - width / 2;
                  const ly = node.y + dy - 11;
                  return (
                    <g
                      key={node.id}
                      className={`sg-node is-${node.kind}${isActive ? ' is-active' : ''}`}
                      tabIndex={0}
                      role="button"
                      aria-label={text}
                      onMouseEnter={() => setActiveId(node.id)}
                      onFocus={() => setActiveId(node.id)}
                    >
                      <circle className="sg-node-glow" cx={node.x} cy={node.y} r={30} fill={glow} />
                      <circle
                        className="sg-node-ring"
                        cx={node.x}
                        cy={node.y}
                        r={9}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.5}
                      />
                      <circle className="sg-node-core" cx={node.x} cy={node.y} r={4.2} fill={color} />
                      <circle className="sg-focus-ring" cx={node.x} cy={node.y} r={16} />
                      <g className={`sg-label${isActive ? ' is-on' : ''}`}>
                        <rect className="sg-label-bg" x={lx} y={ly} width={width} height={22} rx={7} />
                        <text
                          className="sg-label-text"
                          x={node.x + dx}
                          y={node.y + dy}
                          dominantBaseline="middle"
                        >
                          {text}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
