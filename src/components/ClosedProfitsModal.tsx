import React, { useState, useMemo } from 'react';
import { X, Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Filter, Award, CheckCircle2 } from 'lucide-react';
import { AssetType } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';

interface ClosedProfitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hideFigures?: boolean;
}

export const ClosedProfitsModal: React.FC<ClosedProfitsModalProps> = ({
  isOpen,
  onClose,
  hideFigures = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'Todos' | AssetType>('Todos');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'gainers' | 'losers'>('all');
  const [sortBy, setSortBy] = useState<'pnl-desc' | 'pnl-asc' | 'trades-desc' | 'name-asc'>('pnl-desc');

  const summary = (degiroDataRaw as any).accountSummary || {};
  const closedPositions = (degiroDataRaw as any).closedPositions || [];
  const totalPnl = summary.historicoCerradoPnl || 28145.97;
  const totalTrades = summary.totalTrades || 2847;

  // Key metrics
  const winnersCount = closedPositions.filter((p: any) => p.realized_pnl > 0).length;
  const winRate = closedPositions.length > 0 ? (winnersCount / closedPositions.length) * 100 : 0;
  const grossProfit = closedPositions.filter((p: any) => p.realized_pnl > 0).reduce((acc: number, p: any) => acc + p.realized_pnl, 0);
  const grossLoss = closedPositions.filter((p: any) => p.realized_pnl < 0).reduce((acc: number, p: any) => acc + p.realized_pnl, 0);

  const filteredAssets = useMemo(() => {
    return closedPositions.filter((a: any) => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.isin.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'Todos' || a.type === selectedType;
      const matchesOutcome =
        outcomeFilter === 'all' ||
        (outcomeFilter === 'gainers' && a.realized_pnl > 0) ||
        (outcomeFilter === 'losers' && a.realized_pnl < 0);

      return matchesSearch && matchesType && matchesOutcome;
    }).sort((a: any, b: any) => {
      if (sortBy === 'pnl-desc') return b.realized_pnl - a.realized_pnl;
      if (sortBy === 'pnl-asc') return a.realized_pnl - b.realized_pnl;
      if (sortBy === 'trades-desc') return b.trades_count - a.trades_count;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [closedPositions, searchTerm, selectedType, outcomeFilter, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0F19] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Beneficio Realizado Cerrado
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                116 activos cerrados • {totalTrades.toLocaleString('es-ES')} operaciones auditadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumen Principal */}
        <div className="py-3">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Beneficio Neto Cerrado Total
                </span>
                <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                  +{formatEUR(totalPnl, hideFigures)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Tasa de Acierto</span>
                <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                  {winRate.toFixed(1)}% acierto
                </span>
              </div>
            </div>

            {/* Ganancias brutas vs pérdidas */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Ganancias Brutas (+{winnersCount} activos)</span>
                <span className="font-extrabold text-emerald-400 text-xs mt-0.5 block">
                  +{formatEUR(grossProfit, hideFigures)}
                </span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Pérdidas Brutas (-{closedPositions.length - winnersCount} activos)</span>
                <span className="font-extrabold text-rose-400 text-xs mt-0.5 block">
                  {formatEUR(grossLoss, hideFigures)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="space-y-2 mb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por activo, símbolo o ISIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1">
            <div className="flex gap-1">
              {(['all', 'gainers', 'losers'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOutcomeFilter(filter)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    outcomeFilter === filter
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'gainers' ? 'Ganadores' : 'Perdedores'}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[11px] bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="pnl-desc">Mayor ganancia</option>
              <option value="pnl-asc">Mayor pérdida</option>
              <option value="trades-desc">Más operaciones</option>
              <option value="name-asc">Nombre A-Z</option>
            </select>
          </div>
        </div>

        {/* Listado de Activos Cerrados */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-1">
          {filteredAssets.map((asset: any) => {
            const isG = asset.realized_pnl >= 0;
            return (
              <div
                key={asset.id}
                className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {asset.flag || '📄'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[190px]">
                      {asset.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {asset.exchangeName || asset.exchange} • {asset.trades_count} ops
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`text-xs font-black ${isG ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isG ? '+' : ''}{formatEUR(asset.realized_pnl, hideFigures)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Comisiones: {formatEUR(asset.total_fees, hideFigures)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-extrabold hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
