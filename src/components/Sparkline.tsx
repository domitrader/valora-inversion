import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  isPositive?: boolean;
  strokeWidth?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 72,
  height = 24,
  isPositive,
  strokeWidth = 1.75,
}) => {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-0" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Calcule points
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((val - min) / range) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const strokeColor = isPositive === undefined
    ? (data[data.length - 1] >= data[0] ? '#10B981' : '#EF4444')
    : (isPositive ? '#10B981' : '#EF4444');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {/* Línea sutil de referencia base */}
      <line
        x1="2"
        y1={height - 2}
        x2={width - 2}
        y2={height - 2}
        stroke="#E2E8F0"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Trazo del sparkline */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
