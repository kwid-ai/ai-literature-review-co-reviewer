import { useRef } from 'react';
import { PrismaStats } from '../types/index.js';
import { downloadSvg } from '../utils/risExporter.js';

interface Props {
  stats: PrismaStats;
  reviewTitle: string;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const W = 800;
const H = 620;
const BOX_W = 320;
const SIDE_W = 240;
const BOX_H = 70;
const LX = 80;          // left column x
const RX = LX + BOX_W + 60; // right column x (exclusion boxes)
const SECTION_H = 36;

const C = {
  identification: '#dbeafe', // blue-100
  screening:      '#fef9c3', // yellow-100
  included:       '#d1fae5', // emerald-100
  headerText:     '#1e3a5f',
  boxFill:        '#ffffff',
  boxStroke:      '#94a3b8',
  arrowStroke:    '#475569',
  sideBoxFill:    '#fff7ed',
  sideBoxStroke:  '#f97316',
  text:           '#1e293b',
  subText:        '#64748b',
};

function Box({
  x, y, w, h, fill, stroke, children,
}: {
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string; children: React.ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {children}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={C.arrowStroke} strokeWidth={1.5}
      markerEnd="url(#arrowhead)"
    />
  );
}

function SectionHeader({ x, y, w, label, fill }: {
  x: number; y: number; w: number; label: string; fill: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={SECTION_H} rx={4} fill={fill} />
      <text x={x + w / 2} y={y + SECTION_H / 2 + 5} textAnchor="middle"
        fill={C.headerText} fontSize={12} fontWeight="700" letterSpacing="1">
        {label.toUpperCase()}
      </text>
    </g>
  );
}

export default function PrismaFlowDiagram({ stats, reviewTitle }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const topReasons = Object.entries(stats.exclusionReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Y positions
  const Y_ID_SECTION = 50;
  const Y_IDENTIFIED  = Y_ID_SECTION + SECTION_H + 12;
  const Y_SC_SECTION  = Y_IDENTIFIED + BOX_H + 40;
  const Y_SCREENED    = Y_SC_SECTION + SECTION_H + 12;
  const Y_INC_SECTION = Y_SCREENED + BOX_H + 40;
  const Y_INCLUDED    = Y_INC_SECTION + SECTION_H + 12;

  const CX_LEFT = LX + BOX_W / 2;  // centre x of left boxes

  // Side exclusion box (aligned with screened row)
  const SIDE_Y = Y_SCREENED;
  const sideLines = [
    `Records excluded: n = ${stats.excluded}`,
    ...topReasons.map(([r, n]) => `• ${r}: ${n}`),
  ];
  const sideBoxH = Math.max(BOX_H, 20 + sideLines.length * 16);

  // Duplication note
  const dupText = stats.duplicatesRemoved > 0
    ? `Duplicates removed: n = ${stats.duplicatesRemoved}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">PRISMA 2020 Flow Diagram</h3>
        <button
          onClick={() => svgRef.current && downloadSvg(svgRef.current, `PRISMA_${reviewTitle.replace(/\s+/g, '_').slice(0,30)}.svg`)}
          className="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
        >
          Download SVG
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          xmlns="http://www.w3.org/2000/svg"
          fontFamily="Inter, system-ui, sans-serif"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={C.arrowStroke} />
            </marker>
          </defs>

          {/* Title */}
          <text x={W / 2} y={22} textAnchor="middle" fontSize={11} fill={C.subText} fontStyle="italic">
            {reviewTitle}
          </text>

          {/* ── IDENTIFICATION ── */}
          <SectionHeader x={LX} y={Y_ID_SECTION} w={BOX_W} label="Identification" fill={C.identification} />
          <Box x={LX} y={Y_IDENTIFIED} w={BOX_W} h={BOX_H} fill={C.boxFill} stroke={C.boxStroke}>
            <text x={CX_LEFT} y={Y_IDENTIFIED + 24} textAnchor="middle" fontSize={12} fontWeight="600" fill={C.text}>
              Records identified from databases
            </text>
            <text x={CX_LEFT} y={Y_IDENTIFIED + 44} textAnchor="middle" fontSize={13} fontWeight="700" fill={C.headerText}>
              n = {stats.identified}
            </text>
          </Box>

          {/* Duplicates note (top-right of identified box) */}
          {dupText && (
            <g>
              <rect x={RX} y={Y_IDENTIFIED} width={SIDE_W} height={50} rx={5}
                fill="#fef2f2" stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4 2" />
              <text x={RX + SIDE_W / 2} y={Y_IDENTIFIED + 18} textAnchor="middle" fontSize={10} fill="#991b1b">
                Records removed before screening:
              </text>
              <text x={RX + SIDE_W / 2} y={Y_IDENTIFIED + 36} textAnchor="middle" fontSize={11} fontWeight="600" fill="#991b1b">
                {dupText}
              </text>
            </g>
          )}

          {/* Arrow: identified → screened */}
          <Arrow x1={CX_LEFT} y1={Y_IDENTIFIED + BOX_H} x2={CX_LEFT} y2={Y_SC_SECTION} />

          {/* ── SCREENING ── */}
          <SectionHeader x={LX} y={Y_SC_SECTION} w={BOX_W} label="Screening" fill={C.screening} />
          <Box x={LX} y={Y_SCREENED} w={BOX_W} h={BOX_H} fill={C.boxFill} stroke={C.boxStroke}>
            <text x={CX_LEFT} y={Y_SCREENED + 24} textAnchor="middle" fontSize={12} fontWeight="600" fill={C.text}>
              Records screened (title &amp; abstract)
            </text>
            <text x={CX_LEFT} y={Y_SCREENED + 44} textAnchor="middle" fontSize={13} fontWeight="700" fill={C.headerText}>
              n = {stats.screened}
            </text>
          </Box>

          {/* Arrow: screened → excluded (horizontal) */}
          <Arrow x1={LX + BOX_W} y1={Y_SCREENED + BOX_H / 2} x2={RX} y2={SIDE_Y + BOX_H / 2} />

          {/* Excluded side box */}
          <Box x={RX} y={SIDE_Y} w={SIDE_W} h={sideBoxH} fill={C.sideBoxFill} stroke={C.sideBoxStroke}>
            <text x={RX + SIDE_W / 2} y={SIDE_Y + 16} textAnchor="middle" fontSize={11} fontWeight="700" fill="#92400e">
              {sideLines[0]}
            </text>
            {sideLines.slice(1).map((line, i) => (
              <text key={i} x={RX + 10} y={SIDE_Y + 34 + i * 15} fontSize={10} fill="#78350f">
                {line}
              </text>
            ))}
          </Box>

          {/* Arrow: screened → included */}
          <Arrow x1={CX_LEFT} y1={Y_SCREENED + BOX_H} x2={CX_LEFT} y2={Y_INC_SECTION} />

          {/* ── INCLUDED ── */}
          <SectionHeader x={LX} y={Y_INC_SECTION} w={BOX_W} label="Included" fill={C.included} />
          <Box x={LX} y={Y_INCLUDED} w={BOX_W} h={BOX_H} fill={C.boxFill} stroke={C.boxStroke}>
            <text x={CX_LEFT} y={Y_INCLUDED + 22} textAnchor="middle" fontSize={12} fontWeight="600" fill={C.text}>
              Studies included
            </text>
            <text x={CX_LEFT} y={Y_INCLUDED + 40} textAnchor="middle" fontSize={10} fill={C.subText}>
              (include + uncertain — awaiting full-text)
            </text>
            <text x={CX_LEFT} y={Y_INCLUDED + 57} textAnchor="middle" fontSize={13} fontWeight="700" fill="#065f46">
              n = {stats.included + stats.maybe}
            </text>
          </Box>

          {/* Legend */}
          {stats.maybe > 0 && (
            <g>
              <rect x={LX} y={Y_INCLUDED + BOX_H + 16} width={BOX_W} height={36} rx={4}
                fill="#fef9c3" stroke="#fde047" strokeWidth={1} />
              <text x={CX_LEFT} y={Y_INCLUDED + BOX_H + 30} textAnchor="middle" fontSize={10} fill="#713f12">
                Of which confirmed include: {stats.included} | Uncertain (full-text needed): {stats.maybe}
              </text>
              <text x={CX_LEFT} y={Y_INCLUDED + BOX_H + 44} textAnchor="middle" fontSize={10} fill={C.subText}>
                Generated by AI Literature Review Co-Reviewer
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
