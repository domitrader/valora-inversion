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
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Línea horizontal de referencia inicial (discontinua como en Stock Events) */}
          <line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="2 3"
          />

          {/* Relleno con degradado */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Línea principal */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
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
                  r="4"
                  fill="#FFFFFF"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
              </g>
            );
          })()}
        </svg>

        {/* Botón flotante para ampliar el gráfico (como el botón circular en la captura) */}
        <button
          onClick={onExpand}
          title="Ampliar gráfico"
          className="absolute right-4 bottom-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selector de rango temporal idéntico al de la captura de pantalla */}
      <div className="flex items-center justify-between px-3 mt-1.5 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {TIME_RANGES.map(range => {
            const isActive = selectedRange === range;
            return (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all duration-150 ${
                  isActive
                    ? isPositive
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>

        {/* Icono de rueda de ajustes al final */}
        <button
          onClick={() => alert('Opciones de visualización: Escala logarítmica, Benchmark S&P 500 y Días de cierre configurables.')}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-full active:rotate-45 transition-transform"
          title="Configuración de gráfico"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
