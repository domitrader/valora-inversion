import React, { useState } from 'react';
import { ChartDataPoint, TimeRange } from '../types/portfolio';
import { formatEUR, formatPercent } from '../utils/calculations';
import { Maximize2, Settings } from 'lucide-react';

interface InteractiveChartProps {
  data: ChartDataPoint[];
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  onExpand?: () => void;
  hideFigures?: boolean;
}

const TIME_RANGES: TimeRange[] = ['1D', '1S', '1M', '3M', 'YTD', '1A', '5A'];

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  selectedRange,
  onRangeChange,
  onExpand,
  hideFigures = false,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-44 flex items-center justify-center text-slate-400">Sin datos</div>;
  }

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Determinar si la tendencia del rango es positiva o negativa
  const startVal = data[0].value;
  const currentVal = hoveredPoint ? hoveredPoint.value : data[data.length - 1].value;
  const isPositive = currentVal >= startVal;
  
  // Color del trazo: salmón/rojo si baja (como en la captura 1), esmeralda si sube
  const strokeColor = isPositive ? '#10B981' : '#F87171';
  const fillColor = isPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

  // Dimensiones del SVG
  const width = 360;
  const height = 140;
  const paddingX = 12;
  const paddingTop = 10;
  const paddingBottom = 16;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  // Puntos calculados
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y, point: d };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - paddingBottom} L ${points[0].x.toFixed(1)} ${height - paddingBottom} Z`;

  // Baseline del valor inicial (línea discontinua horizontal como en la captura)
  const baselineY = paddingTop + chartHeight - ((startVal - minVal) / range) * chartHeight;

  // Manejador táctil y de ratón
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * width;
    
    // Encontrar el punto más cercano
    let closest = points[0];
    let minDist = Math.abs(points[0].x - relativeX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - relativeX);
      if (dist < minDist) {
        minDist = dist;
        closest = points[i];
      }
    }
    setHoveredPoint(closest.point);
  };

  const handlePointerLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="w-full select-none">
      {/* Contenedor del gráfico con posición relativa para el botón de ampliar */}
      <div className="relative w-full h-[148px]">
        {/* Tooltip flotante si está en hover */}
        {hoveredPoint && (
          <div className="absolute top-1 left-4 z-10 bg-slate-900/90 text-white text-xs px-2.5 py-1 rounded-md shadow-md backdrop-blur-sm pointer-events-none flex items-center gap-2">
            <span className="text-slate-300">{hoveredPoint.label}:</span>
            <span className="font-semibold">{formatEUR(hoveredPoint.value, hideFigures)}</span>
            {hoveredPoint.changePct !== undefined && (
              <span className={`text-[11px] ${hoveredPoint.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(hoveredPoint.changePct)}
              </span>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
              <stop offset="75%" stopColor={strokeColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Cuadrícula sutil azulada de fondo */}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={`h-${ratio}`}
              x1={paddingX}
              y1={paddingTop + chartHeight * ratio}
              x2={width - paddingX}
              y2={paddingTop + chartHeight * ratio}
              stroke="#E2EEF9"
              strokeWidth="0.7"
              className="dark:stroke-slate-800/70"
            />
          ))}

          {/* Línea horizontal de referencia inicial */}
          <line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="2 3"
            className="dark:stroke-slate-700"
          />

          {/* Relleno con degradado */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Línea principal */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Indicador interactivo vertical en hover */}
          {hoveredPoint && (() => {
            const pt = points.find(p => p.point.date === hoveredPoint.date) || points[points.length - 1];
            return (
              <g>
                <line
                  x1={pt.x}
                  y1={paddingTop}
                  x2={pt.x}
                  y2={height - paddingBottom}
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  fill="#FFFFFF"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
              </g>
            );
          })()}
        </svg>

        {/* Botón flotante para ampliar el gráfico */}
        <button
          onClick={onExpand}
          title="Ampliar gráfico"
          className="absolute right-4 bottom-2 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/90 border border-sky-100 dark:border-slate-700 shadow-[0_4px_12px_rgba(14,165,233,0.16)] flex items-center justify-center text-[#16325C] dark:text-slate-200 hover:bg-sky-50 active:scale-95 transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selector de rango temporal en cápsula azulada con píldora activa brillante */}
      <div className="flex items-center justify-between gap-2 px-4 mt-2 pb-1">
        <div className="flex-1 flex items-center justify-between bg-[#F2F8FE] dark:bg-slate-900/90 border border-sky-100/90 dark:border-slate-800 rounded-full p-1 shadow-inner overflow-x-auto no-scrollbar">
          {TIME_RANGES.map(range => {
            const isActive = selectedRange === range;
            return (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full transition-all duration-150 ${
                  isActive
                    ? isPositive
                      ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.45)]'
                      : 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_4px_12px_rgba(244,63,94,0.4)]'
                    : 'text-[#16325C]/75 dark:text-slate-400 hover:text-sky-700 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>

        {/* Icono de rueda de ajustes circular */}
        <button
          onClick={() => alert('Opciones de visualización: Escala logarítmica, Benchmark S&P 500 y Días de cierre configurables.')}
          className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 shadow-xs text-[#16325C]/80 dark:text-slate-300 hover:text-sky-600 flex items-center justify-center active:rotate-45 transition-all shrink-0"
          title="Configuración de gráfico"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
