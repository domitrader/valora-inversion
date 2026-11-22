import React, { useState, useMemo } from 'react';
import { AssetType, HistoricalAssetStat } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import historicalDataRaw from '../data/historicalAssetStats.json';
import {
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Layers,
  CheckCircle2,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface HistoricalAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  hideFigures?: boolean;
}

const ALL_ASSETS: HistoricalAssetStat[] = historicalDataRaw as HistoricalAssetStat[];

export const HistoricalAssetModal: React.FC<HistoricalAssetModalProps> = ({
  isOpen,
  onClose,
  hideFigures = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'Todos' | AssetType>('Todos');
  const [sortBy, setSortBy] = useState<'pnl-desc' | 'pnl-asc' | 'trades-desc' | 'name-asc'>('pnl-desc');
  const [selectedAssetIsin, setSelectedAssetIsin] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    return ALL_ASSETS.filter(a => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.isin.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'Todos' || a.type === selectedType;
      return matchesSearch && matchesType;
    }).sort((a, b) => {
      if (sortBy === 'pnl-desc') return b.realized_pnl - a.realized_pnl;
      if (sortBy === 'pnl-asc') return a.realized_pnl - b.realized_pnl;
      if (sortBy === 'trades-desc') return b.trades_count - a.trades_count;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [searchTerm, selectedType, sortBy]);

  // Totales globales de toda la cartera
  const totalRealizedPnl = useMemo(() => ALL_ASSETS.reduce((acc, a) => acc + a.realized_pnl, 0), []);
  const totalFees = useMemo(() => ALL_ASSETS.reduce((acc, a) => acc + a.total_fees, 0), []);
  const totalTrades = useMemo(() => ALL_ASSETS.reduce((acc, a) => acc + a.trades_count, 0), []);

  // Activo seleccionado al hacer clic
  const selectedAsset = useMemo(() => {
    if (!selectedAssetIsin) return null;
    return ALL_ASSETS.find(a => a.isin === selectedAssetIsin || a.name === selectedAssetIsin) || null;
  }, [selectedAssetIsin]);

  // Cifras dinámicas a mostrar arriba (del activo seleccionado o del total)
  const displayedPnl = selectedAsset ? selectedAsset.realized_pnl : totalRealizedPnl;
  const displayedFees = selectedAsset ? selectedAsset.total_fees : totalFees;
  const displayedTrades = selectedAsset ? selectedAsset.trades_count : totalTrades;
  const displayedNet = displayedPnl - displayedFees;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#0B0F19] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">
              📊
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Beneficio Histórico por Activo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                117 activos operados en DEGIRO (2018 - 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Indicador de Activo Seleccionado vs Total */}
        <div className="my-2.5">
          {selectedAsset ? (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/80 rounded-xl px-3 py-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 truncate">
                  {selectedAsset.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 shrink-0">
                  {selectedAsset.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedAssetIsin(null)}
                className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white underline ml-2 shrink-0 flex items-center gap-1"
                title="Volver a los totales globales de la cartera"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Ver Todos</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1 flex items-center justify-between">
              <span>Totales acumulados de toda la cartera</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                Toca cualquier activo para aislarlo 👆
              </span>
            </div>
          )}
        </div>

        {/* Resumen Superior Dinámico (se actualiza automáticamente al tocar un activo) */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-left">
          {/* Caja 1: P&L Realizado */}
          <div
            className={`border rounded-2xl p-2.5 transition-all ${
              selectedAsset
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <span
              className={`text-[10px] font-bold block ${
                selectedAsset ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              P&L Realizado
            </span>
            <span
              className={`text-xs font-black mt-0.5 block ${
                selectedAsset
                  ? 'text-white'
                  : displayedPnl >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-500'
              }`}
            >
              {displayedPnl >= 0 ? '+' : ''}{formatEUR(displayedPnl, hideFigures)}
            </span>
            <span
              className={`text-[9px] block mt-0.5 ${
                selectedAsset ? 'text-emerald-100/90' : 'text-slate-400'
              }`}
            >
              Neto: {formatEUR(displayedNet, hideFigures)}
            </span>
          </div>

          {/* Caja 2: Comisiones */}
          <div
            className={`border rounded-2xl p-2.5 transition-all ${
              selectedAsset
                ? 'bg-amber-500/15 border-amber-300 dark:border-amber-700'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Comisiones</span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
              {formatEUR(displayedFees, hideFigures)}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {(displayedFees / (displayedTrades || 1)).toFixed(2)} € / op.
            </span>
          </div>

          {/* Caja 3: Operaciones */}
          <div
            className={`border rounded-2xl p-2.5 transition-all ${
              selectedAsset
                ? 'bg-blue-500/15 border-blue-300 dark:border-blue-700'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Operaciones</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
              {displayedTrades.toLocaleString('es-ES')} trades
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
              {selectedAsset ? selectedAsset.type : '117 productos'}
            </span>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por activo o ISIN (ej: Microsoft, Apple, NVDA)..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Filtros por tipo (Todos, Acciones, ETFs, Cripto) */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {(['Todos', 'Acciones', 'ETFs', 'Cripto'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSelectedType(f)}
              className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                selectedType === f
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
            <span>{filteredAssets.length} activos</span>
          </div>
        </div>

        {/* Lista de activos interactiva (Al tocar un activo, actualiza las cajas de arriba) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredAssets.map(a => {
            const isProfit = a.realized_pnl >= 0;
            const isBitcoin =
              a.name.toUpperCase().includes('BITCOIN') ||
              a.isin === 'CH0454664001' ||
              a.isin === 'DE000A28M8D0';
            const iconBadge = isBitcoin ? '₿' : a.type === 'ETFs' ? '📈' : '🏢';
            const isSelected = selectedAssetIsin === a.isin;

            return (
              <div
                key={a.isin}
                onClick={() => setSelectedAssetIsin(prev => (prev === a.isin ? null : a.isin))}
                className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : iconBadge}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                      {a.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                      <span>{a.isin}</span>
                      <span>•</span>
                      <span>{a.trades_count} trades</span>
                      <span>•</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          a.status === 'Abierta'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <div className={`font-black text-xs ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {isProfit ? '+' : ''}{formatEUR(a.realized_pnl, hideFigures)}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    Comisión: {formatEUR(a.total_fees, hideFigures)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie de modal */}
        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {selectedAsset ? (
            <button
              onClick={() => setSelectedAssetIsin(null)}
              className="flex-1 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-200 transition"
            >
              Restablecer a Cartera Global
            </button>
          ) : null}
          <button
            onClick={onClose}
            className={`${
              selectedAsset ? 'flex-1' : 'w-full'
            } py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-xs hover:bg-slate-800 transition`}
          >
            Cerrar Historial
          </button>
        </div>

      </div>
    </div>
  );
};
