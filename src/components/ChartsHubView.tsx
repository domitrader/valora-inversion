import React, { useMemo, useState } from 'react';
import { PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import chartsData from '../data/degiroChartsData.json';
import {
  Flame,
  BarChart3,
  Trophy,
  PieChart,
  ArrowDownUp,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Coins,
} from 'lucide-react';

interface MonthEntry {
  m: number;
  netPnl: number;
  fees: number;
  trades: number;
  roiPct: number;
}

interface YearEntry {
  year: number;
  netPnl: number;
  fees: number;
  trades: number;
  deposits: number;
  withdrawals: number;
  netCashFlow: number;
  peakCapital: number;
  roiPct: number;
  months: MonthEntry[];
}

interface WeekEntry {
  w: string;
  label: string;
  netPnl: number;
  fees: number;
  trades: number;
}

interface RankEntry {
  id: string;
  name: string;
  exchange: string;
  netPnl: number;
  fees: number;
  trades: number;
  isOpen: boolean;
}

interface ChartsHubViewProps {
  positions: PositionItem[];
  hideFigures: boolean;
}

type ChartTab = 'heatmap' | 'rendimiento' | 'ranking' | 'distribucion' | 'flujo';
type PeriodGranularity = 'years' | 'months' | 'weeks';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const DATA = chartsData as {
  yearly: YearEntry[];
  weeklyByYear: Record<string, WeekEntry[]>;
  topWinners: RankEntry[];
  topLosers: RankEntry[];
};

function getHeatColor(val: number, hasTrades: boolean, mode: 'pct' | 'eur'): string {
  if (!hasTrades) return 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600';
  if (val > 0) {
    const strong = mode === 'pct' ? val >= 8 : val >= 2000;
    const med = mode === 'pct' ? val >= 2 : val >= 400;
    if (strong) return 'bg-emerald-600 text-white font-black';
    if (med) return 'bg-emerald-500/80 text-white font-bold';
    return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold';
  }
  if (val < 0) {
    const strong = mode === 'pct' ? val <= -8 : val <= -2000;
    const med = mode === 'pct' ? val <= -2 : val <= -400;
    if (strong) return 'bg-rose-600 text-white font-black';
    if (med) return 'bg-rose-500/80 text-white font-bold';
    return 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold';
  }
  return 'bg-slate-100 dark:bg-slate-800 text-slate-500';
}

export const ChartsHubView: React.FC<ChartsHubViewProps> = ({ positions, hideFigures }) => {
  const [selectedPortfolio] = useState<'degiro'>('degiro');
  const [activeChart, setActiveChart] = useState<ChartTab>('heatmap');

  // Heatmap state
  const [heatMode, setHeatMode] = useState<'pct' | 'eur'>('pct');
  const [selectedCell, setSelectedCell] = useState<{ year: number; month: MonthEntry } | null>(null);

  // Rendimiento state
  const [granularity, setGranularity] = useState<PeriodGranularity>('years');
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Ranking state
  const [rankMode, setRankMode] = useState<'winners' | 'losers'>('winners');

  const yearsList = useMemo(() => DATA.yearly.map(y => y.year), []);
  const selectedYearData = useMemo(
    () => DATA.yearly.find(y => y.year === selectedYear) || DATA.yearly[0],
    [selectedYear]
  );

  // Distribución en vivo de la cartera actual
  const liveDistribution = useMemo(() => {
    const total = positions.reduce((acc, p) => acc + (p.totalValue || 0), 0) || 1;
    const grouped = new Map<string, { label: string; value: number; color: string }>();

    const palette: Record<string, string> = {
      'Oro 3X': '#D97706',
      'Bitcoin ETP/ETN': '#F59E0B',
      'Nasdaq 100 3X': '#2563EB',
      'NVIDIA': '#10B981',
      'Otros': '#64748B',
    };

    for (const p of positions) {
      const upper = p.name.toUpperCase();
      let bucket = 'Otros';
      if (upper.includes('GOLD')) bucket = 'Oro 3X';
      else if (upper.includes('BITCOIN')) bucket = 'Bitcoin ETP/ETN';
      else if (upper.includes('NASDAQ')) bucket = 'Nasdaq 100 3X';
      else if (upper.includes('NVIDIA')) bucket = 'NVIDIA';

      const prev = grouped.get(bucket) || { label: bucket, value: 0, color: palette[bucket] || '#64748B' };
      prev.value += p.totalValue || 0;
      grouped.set(bucket, prev);
    }

    const slices = Array.from(grouped.values())
      .sort((a, b) => b.value - a.value)
      .map(item => ({
        ...item,
        pct: Number(((item.value / total) * 100).toFixed(1)),
      }));

    // Por mercado/país
    const byMarket = new Map<string, number>();
    for (const p of positions) {
      const m = p.exchange === 'TDG' || p.exchange === 'XET' ? '🇩🇪 Alemania (TDG/XET)' : p.exchange === 'MIL' ? '🇮🇹 Italia (MIL)' : '🇺🇸 EE.UU. (NDQ)';
      byMarket.set(m, (byMarket.get(m) || 0) + (p.totalValue || 0));
    }
    const marketSlices = Array.from(byMarket.entries())
      .map(([label, value]) => ({
        label,
        value: Number(value.toFixed(2)),
        pct: Number(((value / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.value - a.value);

    return { total, slices, marketSlices };
  }, [positions]);

  // Datos de barras según granularidad
  const barSeries = useMemo(() => {
    if (granularity === 'years') {
      return [...DATA.yearly]
        .reverse()
        .map(y => ({
          key: String(y.year),
          label: String(y.year),
          sub: `${y.trades} ops`,
          val: y.netPnl,
          pct: y.roiPct,
          fees: y.fees,
        }));
    }
    if (granularity === 'months') {
      return selectedYearData.months.map(m => ({
        key: `${selectedYear}-${m.m}`,
        label: MONTHS_SHORT[m.m - 1],
        sub: `${m.trades} ops`,
        val: m.netPnl,
        pct: m.roiPct,
        fees: m.fees,
      }));
    }
    const wks = DATA.weeklyByYear[String(selectedYear)] || [];
    return wks.map(w => ({
      key: `${selectedYear}-${w.w}`,
      label: w.w,
      sub: w.label,
      val: w.netPnl,
      pct: selectedYearData.peakCapital > 0 ? Number(((w.netPnl / selectedYearData.peakCapital) * 100).toFixed(2)) : 0,
      fees: w.fees,
    }));
  }, [granularity, selectedYear, selectedYearData]);

  const maxAbsBar = useMemo(
    () => Math.max(...barSeries.map(b => Math.abs(b.val)), 1),
    [barSeries]
  );

  return (
    <div className="px-4 pb-24 space-y-3.5">
      {/* Selector de Cartera (preparado para futuras carteras como MyInvestor) */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Cartera Analizada
            </span>
            <span className="text-xs font-black text-slate-950 dark:text-white">
              {selectedPortfolio === 'degiro' ? 'DEGIRO · Domingo (2018–2026)' : 'Global'}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          2.847 ops
        </span>
      </div>

      {/* Selector de Gráficos (1 vista limpia a la vez) */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: 'heatmap', label: 'Mapa de Calor', icon: Flame },
            { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
            { id: 'ranking', label: 'Top Activos', icon: Trophy },
            { id: 'distribucion', label: 'Distribución', icon: PieChart },
            { id: 'flujo', label: 'Flujo y Comis.', icon: ArrowDownUp },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          const active = activeChart === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChart(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
                active
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== 1. MAPA DE CALOR MENSUAL (2026 -> 2018) ==================== */}
      {activeChart === 'heatmap' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">
                Mapa de Calor Mensual
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Rendimiento neto real (comisiones descontadas) · 2026 → 2018
              </p>
            </div>
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setHeatMode('pct')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                  heatMode === 'pct'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setHeatMode('eur')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                  heatMode === 'eur'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                €
              </button>
            </div>
          </div>

          {/* Tabla scrollable horizontalmente para móvil con año fijo y Total al final */}
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <table className="w-full border-separate border-spacing-1 text-[10px] min-w-[540px]">
              <thead>
                <tr className="text-slate-400 font-bold uppercase">
                  <th className="text-left py-1 px-1 sticky left-0 bg-white dark:bg-slate-900 z-10">Año</th>
                  {MONTHS_SHORT.map(m => (
                    <th key={m} className="text-center py-1 px-0.5">
                      {m}
                    </th>
                  ))}
                  <th className="text-right py-1 px-1.5 text-slate-700 dark:text-slate-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {DATA.yearly.map(yr => {
                  const yrVal = heatMode === 'pct' ? yr.roiPct : yr.netPnl;
                  return (
                    <tr key={yr.year}>
                      <td className="font-black text-slate-900 dark:text-white py-1 px-1 sticky left-0 bg-white dark:bg-slate-900 z-10">
                        {yr.year}
                      </td>
                      {yr.months.map(mo => {
                        const val = heatMode === 'pct' ? mo.roiPct : mo.netPnl;
                        const isSelected =
                          selectedCell?.year === yr.year && selectedCell?.month.m === mo.m;
                        return (
                          <td key={mo.m} className="p-0">
                            <button
                              type="button"
                              onClick={() => setSelectedCell({ year: yr.year, month: mo })}
                              className={`w-full py-1.5 px-1 rounded-lg text-center transition-all ${getHeatColor(
                                val,
                                mo.trades > 0,
                                heatMode
                              )} ${isSelected ? 'ring-2 ring-slate-950 dark:ring-white scale-105' : ''}`}
                            >
                              {mo.trades === 0
                                ? '—'
                                : hideFigures
                                  ? '••'
                                  : heatMode === 'pct'
                                    ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%`
                                    : `${val > 0 ? '+' : ''}${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}`}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-0 pl-1">
                        <div
                          className={`py-1.5 px-1.5 rounded-lg text-right font-black whitespace-nowrap ${
                            yrVal >= 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {hideFigures
                            ? '••••'
                            : heatMode === 'pct'
                              ? `${yr.roiPct > 0 ? '+' : ''}${yr.roiPct.toFixed(1)}%`
                              : `${yr.netPnl > 0 ? '+' : ''}${Math.round(yr.netPnl).toLocaleString('es-ES')}€`}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detalle interactivo al pulsar un mes */}
          {selectedCell ? (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-black text-slate-950 dark:text-white">
                  {MONTHS_SHORT[selectedCell.month.m - 1]} {selectedCell.year}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {selectedCell.month.trades} operaciones · Comisiones: -{formatEUR(selectedCell.month.fees, hideFigures)}
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`font-black ${
                    selectedCell.month.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}
                >
                  {selectedCell.month.netPnl > 0 ? '+' : ''}
                  {formatEUR(selectedCell.month.netPnl, hideFigures)}
                </div>
                <div className="text-[10px] font-bold text-slate-400">
                  {selectedCell.month.roiPct > 0 ? '+' : ''}
                  {selectedCell.month.roiPct.toFixed(2)}% s/cap.
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 text-center">
              Toca cualquier mes de la tabla para ver sus operaciones y comisiones exactas.
            </p>
          )}
        </div>
      )}

      {/* ==================== 2. RENDIMIENTO POR AÑO / MES / SEMANA ==================== */}
      {activeChart === 'rendimiento' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">
                Rendimiento Histórico Real
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Beneficio neto descontando comisiones
              </p>
            </div>
          </div>

          {/* Selector Años / Meses / Semanas */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {(
              [
                { id: 'years', label: 'Por Años' },
                { id: 'months', label: 'Por Meses' },
                { id: 'weeks', label: 'Por Semanas' },
              ] as const
            ).map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGranularity(g.id)}
                className={`py-1.5 rounded-xl text-xs font-extrabold transition ${
                  granularity === g.id
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Selector de año si está en Meses o Semanas */}
          {granularity !== 'years' && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {yearsList.map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold shrink-0 transition ${
                    selectedYear === yr
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}

          {/* Barras horizontales limpias y legibles en móvil */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {barSeries.map(item => {
              const isPos = item.val >= 0;
              const widthPct = Math.max(Math.round((Math.abs(item.val) / maxAbsBar) * 100), 2);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 dark:text-white w-10">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.sub}</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-black ${
                          isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                        }`}
                      >
                        {item.val > 0 ? '+' : ''}
                        {formatEUR(item.val, hideFigures)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                        ({item.pct > 0 ? '+' : ''}
                        {item.pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPos ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 3. GANADORES VS PERDEDORES ==================== */}
      {activeChart === 'ranking' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setRankMode('winners')}
              className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                rankMode === 'winners'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Top Ganadores
            </button>
            <button
              type="button"
              onClick={() => setRankMode('losers')}
              className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                rankMode === 'losers'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Top Perdedores
            </button>
          </div>

          <div className="space-y-2.5">
            {(rankMode === 'winners' ? DATA.topWinners : DATA.topLosers).map((item, idx) => {
              const list = rankMode === 'winners' ? DATA.topWinners : DATA.topLosers;
              const maxVal = Math.max(...list.map(x => Math.abs(x.netPnl)), 1);
              const wPct = Math.max(Math.round((Math.abs(item.netPnl) / maxVal) * 100), 4);
              const isWin = item.netPnl >= 0;

              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-400 w-4">#{idx + 1}</span>
                      <span className="font-extrabold text-slate-900 dark:text-white truncate">
                        {item.name}
                      </span>
                      {item.isOpen && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-600 shrink-0">
                          Abierta
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-black shrink-0 ${
                        isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {item.netPnl > 0 ? '+' : ''}
                      {formatEUR(item.netPnl, hideFigures)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${wPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>{item.exchange} · {item.trades} operaciones</span>
                    <span>Comisiones: -{formatEUR(item.fees, hideFigures)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 4. DISTRIBUCIÓN ACTUAL (DONUT EN VIVO) ==================== */}
      {activeChart === 'distribucion' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-black text-slate-950 dark:text-white">
              Distribución Actual de Cartera
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pesos en tiempo real sobre {formatEUR(liveDistribution.total, hideFigures)}
            </p>
          </div>

          {/* Donut SVG */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="4.5"
                  className="dark:stroke-slate-800"
                />
                {(() => {
                  let offset = 0;
                  const circ = 2 * Math.PI * 14; // ~87.96
                  return liveDistribution.slices.map(sl => {
                    const dash = (sl.pct / 100) * circ;
                    const el = (
                      <circle
                        key={sl.label}
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={sl.color}
                        strokeWidth="4.5"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cartera</span>
                <span className="text-sm font-black text-slate-950 dark:text-white">
                  {formatEUR(liveDistribution.total, hideFigures)}
                </span>
              </div>
            </div>
          </div>

          {/* Leyenda por activo */}
          <div className="space-y-2">
            {liveDistribution.slices.map(sl => (
              <div
                key={sl.label}
                className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
                  <span className="font-extrabold text-slate-900 dark:text-white">{sl.label}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-black text-slate-900 dark:text-white">{sl.pct}%</span>
                  <span className="text-[11px] text-slate-400 ml-2">
                    {formatEUR(sl.value, hideFigures)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desglose por Mercado */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Exposición por Mercado
            </span>
            {liveDistribution.marketSlices.map(ms => (
              <div key={ms.label} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{ms.label}</span>
                <span className="font-black text-slate-900 dark:text-white font-mono">
                  {ms.pct}% · {formatEUR(ms.value, hideFigures)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 5. FLUJO DE CAJA Y COMISIONES POR AÑO ==================== */}
      {activeChart === 'flujo' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-black text-slate-950 dark:text-white">
              Ingresos, Retiradas y Comisiones
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Flujo bancario real y gastos de bróker año a año
            </p>
          </div>

          <div className="space-y-2.5">
            {DATA.yearly.map(yr => (
              <div
                key={yr.year}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-950 dark:text-white">{yr.year}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400">
                    <Coins className="w-3 h-3" />
                    Comis: -{formatEUR(yr.fees, hideFigures)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-1.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Ingresado</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatEUR(yr.deposits, hideFigures)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-1.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Retirado</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatEUR(yr.withdrawals, hideFigures)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-1.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Flujo Neto</span>
                    <span
                      className={`font-black ${
                        yr.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {yr.netCashFlow > 0 ? '+' : ''}
                      {formatEUR(yr.netCashFlow, hideFigures)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
