import { useRef, useState } from "react";
import { formatCompactCurrency, formatCurrency } from "../utils/format";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function MiniSparkline({ data = [], color = "#7c3aed", width = 104, height = 34 }) {
  const values = data.length ? data.map((item) => item.value ?? item) : [0, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / range) * (height - 6);
    return [x, y];
  });

  const path = points
    .map(([x, y], index) => (index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  data = [],
  height = 250,
  color = "#7c3aed",
  formatValue = formatCurrency,
  compactFormat = formatCompactCurrency,
  label = "Revenue"
}) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);
  const width = 760;
  const padding = { top: 18, right: 14, bottom: 30, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const count = Math.max(data.length, 1);
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  const step = innerWidth / Math.max(count - 1, 1);

  const points = data.map((item, index) => {
    const x = padding.left + index * step;
    const y = padding.top + innerHeight - ((Number(item.value) || 0) / max) * innerHeight;
    return { x, y, item };
  });

  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const control = (point.x - previous.x) / 2;
      return `C ${previous.x + control} ${previous.y}, ${point.x - control} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
    : "";

  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const gradientId = `area-gradient-${color.replace(/[^a-z0-9]/gi, "")}`;

  const handleMove = (event) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !data.length) return;
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = clamp(Math.round((relativeX - padding.left) / step), 0, data.length - 1);
    setHovered(index);
  };

  const active = hovered !== null ? points[hovered] : null;

  return (
    <div
      className="area-chart"
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHovered(null)}
      style={{ height }}
    >
      {active ? (
        <div
          className="area-chart__tooltip"
          style={{
            left: `${(active.x / width) * 100}%`,
            top: `${Math.max((active.y / height) * 100 - 18, 2)}%`
          }}
        >
          <span>{active.item.fullLabel || active.item.label}</span>
          <strong>{formatValue(active.item.value)}</strong>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label} chart`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                className="area-chart__grid"
                strokeDasharray={ratio === 1 ? "0" : "4 6"}
              />
              <text x={padding.left - 10} y={y + 4} className="area-chart__axis" textAnchor="end">
                {compactFormat(max * (1 - ratio))}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {active ? (
          <g>
            <line
              x1={active.x}
              y1={padding.top}
              x2={active.x}
              y2={padding.top + innerHeight}
              stroke={color}
              strokeOpacity="0.35"
              strokeDasharray="4 5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={active.x} cy={active.y} r="5" fill="#fff" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </g>
        ) : null}

        {data.map((item, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={`${item.label}-${index}`}
              x={padding.left + index * step}
              y={height - 8}
              className="area-chart__axis"
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            >
              {item.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function DonutChart({ segments = [], size = 176, thickness = 20, centerLabel, centerValue }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution chart">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const circle = (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(length - 3, 0)} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return circle;
          })}
      </svg>
      <div className="donut__center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

export function BarList({ items = [], formatValue = (value) => value, color = "#7c3aed" }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-list__row" key={item.label}>
          <div className="bar-list__meta">
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
          <div className="bar-list__track">
            <span
              className="bar-list__fill"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: item.color || color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
