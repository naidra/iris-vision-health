import { useMemo, useState } from "react";
import { IRIS_ZONES } from "@/lib/iridology-zones";

interface Props {
  eye: "left" | "right";
  highlightHour?: number | null;
  size?: number;
}

// Renders an SVG iridology chart with 12 clock sectors and 3 concentric rings.
export function IridologyChart({ eye, highlightHour, size = 320 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.46;
  const rInner = size * 0.16;

  const sectors = useMemo(() => {
    return IRIS_ZONES.map((z) => {
      // hour 12 starts at -90° (top)
      const startAngle = ((z.hour - 1) / 12) * 360 - 90 - 15;
      const endAngle = startAngle + 30;
      return { ...z, startAngle, endAngle };
    });
  }, []);

  const arcPath = (start: number, end: number, rO: number, rI: number) => {
    const s = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + rO * Math.cos(s(start));
    const y1 = cy + rO * Math.sin(s(start));
    const x2 = cx + rO * Math.cos(s(end));
    const y2 = cy + rO * Math.sin(s(end));
    const x3 = cx + rI * Math.cos(s(end));
    const y3 = cy + rI * Math.sin(s(end));
    const x4 = cx + rI * Math.cos(s(start));
    const y4 = cy + rI * Math.sin(s(start));
    return `M ${x1} ${y1} A ${rO} ${rO} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rI} ${rI} 0 0 0 ${x4} ${y4} Z`;
  };

  const active = hover ?? highlightHour ?? null;
  const activeZone = sectors.find((s) => s.hour === active);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
        <defs>
          <radialGradient id="iris-grad" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="oklch(0.32 0.07 155)" />
            <stop offset="70%" stopColor="oklch(0.52 0.11 155)" />
            <stop offset="100%" stopColor="oklch(0.78 0.18 145)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={rOuter} fill="url(#iris-grad)" opacity={0.18} />
        {sectors.map((s) => {
          const isActive = active === s.hour;
          return (
            <g key={s.hour}>
              <path
                d={arcPath(s.startAngle, s.endAngle, rOuter, rInner)}
                fill={isActive ? "oklch(0.78 0.18 145 / 0.55)" : "oklch(0.52 0.11 155 / 0.08)"}
                stroke="oklch(0.32 0.07 155 / 0.5)"
                strokeWidth={0.5}
                onMouseEnter={() => setHover(s.hour)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-colors"
              />
              {(() => {
                const mid = (s.startAngle + s.endAngle) / 2;
                const tx = cx + (rOuter + 14) * Math.cos((mid * Math.PI) / 180);
                const ty = cy + (rOuter + 14) * Math.sin((mid * Math.PI) / 180);
                return (
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill="currentColor"
                    className="font-display"
                  >
                    {s.hour}
                  </text>
                );
              })()}
            </g>
          );
        })}
        {/* concentric rings */}
        {[0.32, 0.55, 0.78].map((p, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={rInner + (rOuter - rInner) * p}
            fill="none"
            stroke="oklch(0.32 0.07 155 / 0.25)"
            strokeDasharray="2 3"
          />
        ))}
        {/* pupil */}
        <circle cx={cx} cy={cy} r={rInner} fill="oklch(0.18 0.03 155)" />
      </svg>
      <div className="text-xs text-center min-h-[3em] max-w-[280px]">
        {activeZone ? (
          <>
            <div className="font-semibold text-foreground">
              {eye === "right" ? activeZone.rightEye : activeZone.leftEye}
            </div>
            <div className="text-muted-foreground mt-0.5">{activeZone.note}</div>
          </>
        ) : (
          <span className="text-muted-foreground">
            Hover a sector to see the organ it traditionally maps to ({eye} iris).
          </span>
        )}
      </div>
    </div>
  );
}
