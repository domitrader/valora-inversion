import React, { useMemo, useState } from 'react';
import {
  X,
  BarChart3,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import assetHistoryData from '../data/degiroAssetTransactions.json';

interface RawTx {
  d: string; // Fecha
  t: string; // Hora
  q: number; // Cantidad (>0 compra, <0 venta)
  p: number; // Precio unitario
  f: number; // Comisiones + AutoFX (EUR)
  net: number; // Total EUR
}

interface AssetStats {
  tradesCount: number;
  buysCount: number;
  sellsCount: number;
  firstTrade: string;
  lastTrade: string;
  totalBoughtQty: number;
  totalSoldQty: number;
  totalBoughtEur: number;
  totalSoldEur: number;
  txFeesEur: number;
  autoFxEur: number;
  totalFeesEur: number;
  minBuyPrice: number;
  maxBuyPrice: number;
  minSellPrice: number;
  maxSellPrice: number;
  priceCurrency: string;
  peakCapitalEur: number;
  netCashFlowEur: number;
  breakEvenPriceEur: number;
}

interface AssetHistoryRecord {
  stats: AssetStats;
  transactions: RawTx[];
}

interface AssetHistoryModalProps {
  position: PositionItem;
  hideFigures: boolean;
  onClose: () => void;
}

const HISTORY_MAP = assetHistoryData as Record<string, AssetHistoryRecord>;

export function getAssetHistoryCount(positionId: string): number {
  return HISTORY_MAP[positionId]?.stats?.tradesCount || 0;
}

export const AssetHistoryModal: React.FC<AssetHistoryModalProps> = ({
  position,
  hideFigures,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'txs'>('stats');
  const [txFilter, setTxFilter] = useState<'all' | 'buys' | 'sells'>('all');

  const record = HISTORY_MAP[position.id];
  const stats = record?.stats;
  const allTxs = record?.transactions || [];

  const filteredTxs = useMemo(() => {
    if (txFilter === 'buys') return allTxs.filter(t => t.q > 0);
    if (txFilter === 'sells') return allTxs.filter(t => t.q < 0);
    return allTxs;
  }, [allTxs, txFilter]);

  // Cálculos en vivo basados en la cotización actual
  const liveNetPnl = stats
    ? Number((position.totalValue + stats.netCashFlowEur).toFixed(2))
    : position.unrealizedGainLoss;

  const liveRoiPct =
    stats && stats.peakCapitalEur > 0
      ? Number(((liveNetPnl / stats.peakCapitalEur) * 100).toFixed(2))
      : position.unrealizedGainLossPct;

  const isPositive = liveNetPnl >= 0;
  const isCapitalRecovered = stats ? stats.netCashFlowEur >= 0 : false;
  const curSymbol = stats?.priceCurrency === 'USD' ? '$' : '€';

  const fmtUnitPrice = (val: number) => {
    if (hideFigures) return '••••';
    return `${val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${curSymbol}`;
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-xs shrink-0 ${
                position.logoBg || 'bg-slate-800'
              }`}
            >
              {position.logoText || position.ticker.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                {position.name}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {position.exchange || position.market} • {position.isin || position.ticker}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas superiores */}
        <div className="px-5 pt-3 pb-2 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'stats'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-500" />
              <span>Estadísticas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('txs')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'txs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-500" />
              <span>Transacciones ({stats?.tradesCount || 0})</span>
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!stats ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No hay historial de transacciones registrado para este activo.</p>
            </div>
          ) : activeTab === 'stats' ? (
            <>
              {/* Tarjeta Hero: Beneficio Neto Real + Rentabilidad sobre Capital Máximo */}
              <div
                className={`rounded-2xl p-4 border ${
                  isPositive
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/50'
                    : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Beneficio Neto Real (con comisiones)
                  </span>
                  {isCapitalRecovered && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" />
                      Capital recuperado
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div
                    className={`text-2xl font-black tracking-tight flex items-center gap-1.5 ${
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    <span>
                      {liveNetPnl > 0 ? '+' : ''}
                      {formatEUR(liveNetPnl, hideFigures)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-black px-2.5 py-1 rounded-xl ${
                      isPositive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {liveRoiPct > 0 ? '+' : ''}
                    {liveRoiPct.toFixed(2)}%
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Rentabilidad real sobre tu capital máximo arriesgado simultáneamente ({formatEUR(stats.peakCapitalEur, hideFigures)}).
                </p>
              </div>

              {/* Cuadrícula de métricas clave */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Precio Equilibrio (Break-Even)
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                    {isCapitalRecovered
                      ? '0,00 € (Libre)'
                      : hideFigures
                        ? '••••'
                        : `${stats.breakEvenPriceEur.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 3,
                          })} €`}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isCapitalRecovered ? 'Todo lo que queda es ganancia' : 'Para quedar en 0,00 € netos'}
                  </span>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    Comisiones Pagadas
                  </span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                    -{formatEUR(stats.totalFeesEur, hideFigures)}
                  </span>
                  <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70 block mt-0.5">
                    {stats.autoFxEur > 0
                      ? `DEGIRO ${formatEUR(stats.txFeesEur, hideFigures)} + FX ${formatEUR(stats.autoFxEur, hideFigures)}`
                      : `En ${stats.tradesCount} operaciones`}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Total Comprado
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                    {formatEUR(stats.totalBoughtEur, hideFigures)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {stats.buysCount} compras ({stats.totalBoughtQty} títulos)
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Total Vendido
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                    {formatEUR(stats.totalSoldEur, hideFigures)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {stats.sellsCount} ventas ({stats.totalSoldQty} títulos)
                  </span>
                </div>
              </div>

              {/* Rango de precios y fechas */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    Periodo operado
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                    {stats.firstTrade} → {stats.lastTrade}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Compra mín. / máx.</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                    {fmtUnitPrice(stats.minBuyPrice)} / {fmtUnitPrice(stats.maxBuyPrice)}
                  </span>
                </div>
                {stats.sellsCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Venta mín. / máx.</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                      {fmtUnitPrice(stats.minSellPrice)} / {fmtUnitPrice(stats.maxSellPrice)}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Filtros de transacciones */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTxFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    txFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({stats.tradesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilter('buys')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    txFilter === 'buys'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Compras ({stats.buysCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilter('sells')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    txFilter === 'sells'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Ventas ({stats.sellsCount})
                </button>
              </div>

              {/* Lista de transacciones */}
              <div className="space-y-2">
                {filteredTxs.map((tx, idx) => {
                  const isBuy = tx.q > 0;
                  return (
                    <div
                      key={`${tx.d}-${tx.t}-${idx}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isBuy
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isBuy ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                isBuy
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {isBuy ? 'Compra' : 'Venta'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {tx.d} · {tx.t}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                            {isBuy ? `+${tx.q}` : tx.q} × {fmtUnitPrice(tx.p)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-black ${
                            tx.net >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {tx.net > 0 ? '+' : ''}
                          {formatEUR(tx.net, hideFigures)}
                        </div>
                        {tx.f > 0 && (
                          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Comis: -{formatEUR(tx.f, hideFigures)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
