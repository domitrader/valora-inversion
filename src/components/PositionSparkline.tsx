import React from 'react';

interface PositionSparklineProps {
  data: number[];
  isNegative?: boolean;
  width?: number;
  height?: number;
  showBaseline?: boolean;
}

export const PositionSparkline: React.FC<PositionSparklineProps> = ({
  data,
  isNegative = true,
  width = 65,
  height = 24,
  showBaseline = true,
}) => {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-slate-100 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const usableH = height - pad * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = pad + usableH - ((val - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const baselineY = (height / 2).toFixed(1);
  const strokeColor = isNegative ? '#EF4444' : '#10B981';

  return (
    <svg width={width} height={height} className="overflow-visible flex-shrink-0">
      {showBaseline && (
        <line
          x1="0"
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#E2E8F0"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
