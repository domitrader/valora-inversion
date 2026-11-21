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

  if (!isOpen) return null;

  const totalRealizedPnl = ALL_ASSETS.reduce((acc, a) => acc + a.realized_pnl, 0);
  const totalFees = ALL_ASSETS.reduce((acc, a) => acc + a.total_fees, 0);
  const totalTrades = ALL_ASSETS.reduce((acc, a) => acc + a.trades_count, 0);

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

        {/* Resumen Superior */}
        <div className="grid grid-cols-3 gap-2 my-3 text-left">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">P&L Realizado</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              +{formatEUR(totalRealizedPnl, hideFigures)}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Comisiones</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
              {formatEUR(totalFees, hideFigures)}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Operaciones</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
              {totalTrades.toLocaleString('es-ES')} trades
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
            placeholder="Buscar por activo o ISIN (ej: Nasdaq, Apple, NVDA)..."
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

        {/* Lista de activos con su P&L exacto */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredAssets.map(a => {
            const isProfit = a.realized_pnl >= 0;
            const isBitcoin = a.name.toUpperCase().includes('BITCOIN') || a.isin === 'CH0454664001' || a.isin === 'DE000A28M8D0';
            const iconBadge = isBitcoin ? '₿' : a.type === 'ETFs' ? '📈' : '🏢';

            return (
              <div
                key={a.isin}
                className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs shrink-0 font-bold">
                    {iconBadge}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {a.name}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{a.isin}</span>
                      <span>•</span>
                      <span>{a.trades_count} trades</span>
                      <span>•</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold ${
                        a.status === 'Abierta'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-black text-xs ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isProfit ? '+' : ''}{formatEUR(a.realized_pnl, hideFigures)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Comisión: {formatEUR(a.total_fees, hideFigures)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie de modal */}
        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-xs hover:bg-slate-800"
          >
            Cerrar Historial
          </button>
        </div>

      </div>
    </div>
  );
};
