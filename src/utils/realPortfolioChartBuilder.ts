import degiroChartsData from '../data/degiroChartsData.json';
import { ChartDataPoint, TimeRange } from '../types/portfolio';

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface YearEntry {
  year: number;
  netPnl: number;
  months: { m: number; netPnl: number; trades: number; roiPct: number }[];
}

interface WeekEntry {
  w: string;
  label: string;
  netPnl: number;
  fees: number;
  trades: number;
}

const yearlyAsc: YearEntry[] = [...(degiroChartsData.yearly as YearEntry[])].sort(
  (a, b) => a.year - b.year
);

const weeklyByYear = (degiroChartsData.weeklyByYear || {}) as Record<string, WeekEntry[]>;

// Construye toda la serie mensual real acumulada (2018 → 2026)
function buildAllRealMonthlyPoints(): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  let cumulative = 0;

  // Detectar último mes con actividad en el último año para no añadir meses futuros en 0
  const latestYear = yearlyAsc[yearlyAsc.length - 1]?.year || 2026;
  const latestYearObj = yearlyAsc[yearlyAsc.length - 1];
  let lastActiveMonth = 12;
  if (latestYearObj) {
    const activeMonths = latestYearObj.months.filter(m => m.trades > 0 || m.netPnl !== 0);
    if (activeMonths.length > 0) {
      lastActiveMonth = activeMonths[activeMonths.length - 1].m;
    }
  }

  let started = false;
  for (const yr of yearlyAsc) {
    for (const mo of yr.months) {
      if (yr.year === latestYear && mo.m > lastActiveMonth) break;
      if (!started && mo.trades === 0 && mo.netPnl === 0) continue;
      started = true;
      cumulative = Number((cumulative + mo.netPnl).toFixed(2));
      result.push({
        date: `${yr.year}-${String(mo.m).padStart(2, '0')}`,
        label: `${MONTH_SHORT[mo.m - 1]} ${String(yr.year).slice(2)}`,
        value: cumulative,
        change: Number(mo.netPnl.toFixed(2)),
        changePct: mo.roiPct,
      });
    }
  }
  return result;
}

// Construye toda la serie semanal real acumulada (2018 → 2026)
function buildAllRealWeeklyPoints(): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  let cumulative = 0;
  const years = Object.keys(weeklyByYear)
    .map(Number)
    .sort((a, b) => a - b);

  for (const yr of years) {
    const weeks = weeklyByYear[String(yr)] || [];
    for (const wk of weeks) {
      cumulative = Number((cumulative + wk.netPnl).toFixed(2));
      result.push({
        date: `${yr}-${wk.w}`,
        label: `${wk.label} ${String(yr).slice(2)}`,
        value: cumulative,
        change: Number(wk.netPnl.toFixed(2)),
      });
    }
  }
  return result;
}

const ALL_MONTHLY = buildAllRealMonthlyPoints();
const ALL_WEEKLY = buildAllRealWeeklyPoints();

export interface RealChartResult {
  points: ChartDataPoint[];
  subtitle: string;
}

/**
 * Construye series 100% reales (sin datos simulados) para la cartera DEGIRO
 * a partir de las 2.847 operaciones auditadas (2018–2026) + cotizaciones en vivo de hoy.
 */
export function buildRealDegiroChartData(
  range: TimeRange,
  liveCuentaCompleta: number,
  liveDiaBp: number,
  liveDiaBpPct: number,
  liveTotalBp: number
): RealChartResult {
  if (range === '1D') {
    const prevClose = Number((liveCuentaCompleta - liveDiaBp).toFixed(2));
    return {
      subtitle: 'Valor cuenta hoy (en vivo)',
      points: [
        { date: 'open', label: 'Cierre ant.', value: prevClose, change: 0, changePct: 0 },
        {
          date: 'live',
          label: 'Ahora (vivo)',
          value: Number(liveCuentaCompleta.toFixed(2)),
          change: Number(liveDiaBp.toFixed(2)),
          changePct: Number(liveDiaBpPct.toFixed(2)),
        },
      ],
    };
  }

  const appendLivePoint = (pts: ChartDataPoint[]): ChartDataPoint[] => {
    const baseVal = pts.length > 0 ? pts[0].value : 0;
    const prevVal = pts.length > 0 ? pts[pts.length - 1].value : 0;
    const diffFromStart = Number((liveTotalBp - baseVal).toFixed(2));
    const pctFromStart =
      Math.abs(baseVal) > 1 ? Number(((diffFromStart / Math.abs(baseVal)) * 100).toFixed(2)) : 0;
    return [
      ...pts,
      {
        date: 'live-today',
        label: 'Hoy (vivo)',
        value: Number(liveTotalBp.toFixed(2)),
        change: Number((liveTotalBp - prevVal).toFixed(2)),
        changePct: pctFromStart,
      },
    ];
  };

  switch (range) {
    case '1S': {
      const slice = ALL_WEEKLY.slice(-4);
      return {
        subtitle: 'B/P acumulado real · últimas semanas',
        points: appendLivePoint(slice),
      };
    }
    case '1M': {
      const slice = ALL_WEEKLY.slice(-8);
      return {
        subtitle: 'B/P acumulado real · último mes',
        points: appendLivePoint(slice),
      };
    }
    case '3M': {
      const slice = ALL_WEEKLY.slice(-16);
      return {
        subtitle: 'B/P acumulado real · últimos 3 meses',
        points: appendLivePoint(slice),
      };
    }
    case 'YTD': {
      const latestYear = String(yearlyAsc[yearlyAsc.length - 1]?.year || 2026);
      // Incluir diciembre del año anterior como punto de partida real del año
      const idx = ALL_MONTHLY.findIndex(p => p.date.startsWith(`${latestYear}-`));
      const startIdx = idx > 0 ? idx - 1 : 0;
      const slice = ALL_MONTHLY.slice(startIdx);
      return {
        subtitle: `B/P acumulado real · Año ${latestYear}`,
        points: appendLivePoint(slice),
      };
    }
    case '1A': {
      const slice = ALL_MONTHLY.slice(-13);
      return {
        subtitle: 'B/P acumulado real · últimos 12 meses',
        points: appendLivePoint(slice),
      };
    }
    case '5A':
    default: {
      // Últimos 5 años reales completos (60 meses reales + hoy en vivo)
      const slice = ALL_MONTHLY.slice(-60);
      return {
        subtitle: 'B/P acumulado real · últimos 5 años (auditado)',
        points: appendLivePoint(slice),
      };
    }
  }
}
