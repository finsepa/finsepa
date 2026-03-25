const xLabels = ["Nov'23", "Dec'23", "Jan'24", "Feb'24", "Mar'24", "Apr'24", "May'24", "Jun'24", "Jul'24", "Aug'24", "Sep'24", "Oct'24"];
const yLabels = [100, 90, 80, 70, 60];

// Normalized price points (0-1 y-scale where 0=top, 1=bottom of chart area)
const rawPoints: [number, number][] = [
  [0,    0.82], [0.04, 0.80], [0.08, 0.75], [0.12, 0.77],
  [0.16, 0.72], [0.20, 0.74], [0.24, 0.70], [0.28, 0.68],
  [0.32, 0.65], [0.36, 0.67], [0.40, 0.62], [0.44, 0.58],
  [0.48, 0.55], [0.52, 0.52], [0.56, 0.50], [0.60, 0.48],
  [0.64, 0.45], [0.68, 0.42], [0.70, 0.30], [0.72, 0.35],
  [0.74, 0.28], [0.76, 0.32], [0.78, 0.40], [0.80, 0.38],
  [0.82, 0.35], [0.84, 0.30], [0.86, 0.25], [0.88, 0.22],
  [0.90, 0.20], [0.92, 0.18], [0.94, 0.16], [0.96, 0.14],
  [0.98, 0.12], [1.00, 0.15],
];

// Volume bars (normalized 0-1)
const volumePoints = [0.3,0.4,0.5,0.3,0.6,0.4,0.5,0.7,0.4,0.5,0.6,0.4,0.5,0.3,0.6,0.7,0.5,0.4,0.8,0.6,0.9,0.7,0.6,0.5,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.8,0.7,0.6];

export function StockChart() {
  const svgW = 1000;
  const svgH = 280;
  const padLeft = 12;
  const padRight = 56;
  const padTop = 16;
  const chartH = 200;
  const volH = 40;
  const volTop = padTop + chartH + 8;

  const chartW = svgW - padLeft - padRight;

  const pts = rawPoints.map(([rx, ry]) => ({
    x: padLeft + rx * chartW,
    y: padTop + ry * chartH,
  }));

  const polylineStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${(padLeft + chartW).toFixed(1)},${(padTop + chartH).toFixed(1)} L${padLeft},${(padTop + chartH).toFixed(1)} Z`;

  const lastPt = pts[pts.length - 1];
  const tooltipPtIdx = Math.floor(pts.length * 0.88);
  const tooltipPt = pts[tooltipPtIdx];

  // Y scale: 40–110
  const yMin = 40; const yMax = 110;
  function yToSvg(v: number) { return padTop + ((yMax - v) / (yMax - yMin)) * chartH; }

  return (
    <div className="relative bg-white border border-[#E4E4E7] rounded-lg overflow-hidden" style={{ height: 320 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="absolute inset-0">
        {/* Horizontal grid lines */}
        {yLabels.map((v) => (
          <line key={v} x1={padLeft} y1={yToSvg(v)} x2={padLeft + chartW} y2={yToSvg(v)}
            stroke="#E4E4E7" strokeWidth="0.6" />
        ))}

        {/* Fill area */}
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#chartFill)" />

        {/* Sparkline */}
        <polyline points={polylineStr} fill="none" stroke="#16A34A" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Volume bars */}
        {volumePoints.map((v, i) => {
          const bw = chartW / volumePoints.length - 1;
          const bx = padLeft + i * (chartW / volumePoints.length);
          const bh = v * volH;
          return (
            <rect key={i} x={bx} y={volTop + (volH - bh)} width={bw} height={bh}
              fill="#16A34A" opacity="0.15" rx="1" />
          );
        })}

        {/* Tooltip vertical line */}
        <line x1={tooltipPt.x} y1={padTop} x2={tooltipPt.x} y2={padTop + chartH}
          stroke="#09090B" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
        <circle cx={tooltipPt.x} cy={tooltipPt.y} r="3" fill="#16A34A" />

        {/* Last point dot */}
        <circle cx={lastPt.x} cy={lastPt.y} r="3" fill="#16A34A" />

        {/* Y axis labels */}
        {yLabels.map((v) => (
          <text key={v} x={padLeft + chartW + 6} y={yToSvg(v) + 4}
            fontSize="9" fill="#71717A" fontFamily="Inter, sans-serif">{v}</text>
        ))}

        {/* X axis labels */}
        {xLabels.map((label, i) => {
          const xPos = padLeft + (i / (xLabels.length - 1)) * chartW;
          return (
            <text key={label} x={xPos} y={padTop + chartH + 52}
              fontSize="8.5" fill="#71717A" textAnchor="middle" fontFamily="Inter, sans-serif">
              {label}
            </text>
          );
        })}

        {/* Starting price label */}
        <rect x={padLeft - 2} y={padTop + rawPoints[0][1] * chartH - 9} width={36} height={14} rx="3" fill="#F4F4F5" />
        <text x={padLeft + 16} y={padTop + rawPoints[0][1] * chartH + 2}
          fontSize="8" fill="#71717A" textAnchor="middle" fontFamily="Inter, sans-serif">$53.45</text>
      </svg>

      {/* Tooltip bubble */}
      <div
        className="absolute rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-md text-[12px] leading-5"
        style={{
          left: `${(tooltipPt.x / svgW) * 100}%`,
          top: `${(tooltipPt.y / svgH) * 100 - 22}%`,
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        }}
      >
        <div className="font-semibold text-[#09090B]">Aug 24, 2024</div>
        <div className="flex items-center gap-1.5 text-[#71717A]">
          <span className="h-2 w-2 rounded-full bg-[#16A34A] inline-block" />
          Price: <span className="text-[#09090B] font-medium">$73.24</span>
        </div>
        <div className="text-[#71717A]">Vol: 12,243,850</div>
      </div>

      {/* Current price label */}
      <div
        className="absolute right-1 rounded bg-[#09090B] px-1.5 py-0.5 text-[11px] font-semibold text-white"
        style={{ top: `${(lastPt.y / svgH) * 100}%`, transform: "translateY(-50%)" }}
      >
        $81.65
      </div>
    </div>
  );
}
