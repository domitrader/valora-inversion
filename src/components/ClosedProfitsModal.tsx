import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Award,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const summary = (degiroDataRaw as any).accountSummary || {};
  const closedPositions = (degiroDataRaw as any).closedPositions || [];
  const totalPnl = summary.historicoCerradoPnl || 28160.97;
  const totalTrades = summary.totalTrades || 2849;

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

  const toggleAllExpanded = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<string, boolean> = {};
    filteredAssets.forEach((a: any) => {
      updated[a.id] = nextState;
    });
    setExpandedCards(updated);
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-[#0B0F19] w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all ${
          isExpandedView ? 'h-[96vh]' : 'max-h-[92vh]'
        }`}
      >
        {/* Cabecera */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Beneficio Realizado Cerrado
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  DEGIRO
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                116 activos cerrados • {totalTrades.toLocaleString('es-ES')} operaciones auditadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpandedView(!isExpandedView)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              title={isExpandedView ? 'Vista compacta' : 'Expandir a pantalla completa'}
            >
              {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resumen Principal */}
        {!isExpandedView && (
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
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
        )}

        {/* Controles de Búsqueda y Botón para Expandir TODAS las Casillas */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por activo, ticker o ISIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={toggleAllExpanded}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shrink-0 ${
                allExpanded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
              }`}
            >
              <Layers size={13} />
              <span>{allExpanded ? 'Contraer' : 'Expandir Todas'}</span>
            </button>
          </div>

          {/* Filtros tipo chips */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1">
              {(['all', 'gainers', 'losers'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOutcomeFilter(filter)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    outcomeFilter === filter
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'gainers' ? 'Ganadores' : 'Perdedores'}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[11px] bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
            >
              <option value="pnl-desc">Mayor ganancia ↓</option>
              <option value="pnl-asc">Mayor pérdida ↑</option>
              <option value="trades-desc">Más operaciones ↓</option>
              <option value="name-asc">Nombre A-Z</option>
            </select>
          </div>
        </div>

        {/* Listado Desplegado con Tarjetas Separadas por Colores */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-100/70 dark:bg-[#070A11] rounded-2xl mx-2">
          {filteredAssets.map((asset: any) => {
            const isG = asset.realized_pnl >= 0;
            const isRowExpanded = allExpanded || !!expandedCards[asset.id];
            const netReal = asset.realized_pnl - (asset.total_fees || 0);

            const cardBorder = isG
              ? 'border-emerald-300 dark:border-emerald-800/80 shadow-xs'
              : 'border-rose-300 dark:border-rose-800/80 shadow-xs';
            const accentBar = isG ? 'bg-emerald-500' : 'bg-rose-500';

            return (
              <div
                key={asset.id}
                className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border ${cardBorder} shadow-sm transition hover:shadow-md`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBar}`} />

                <div
                  onClick={() => toggleCard(asset.id)}
                  className="p-3.5 pl-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
                      {asset.flag || '📄'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[190px]">
                        {asset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {asset.exchangeName || asset.exchange} • {asset.trades_count} operaciones
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-black ${isG ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {isG ? '+' : ''}{formatEUR(asset.realized_pnl, hideFigures)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Comisiones: {formatEUR(asset.total_fees, hideFigures)}
                      </div>
                    </div>

                    <button className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isRowExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Detalle Expandido */}
                {isRowExpanded && (
                  <div className="p-3 pt-0 pl-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-2 my-2">
                      <div className="bg-white dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block">Total Comprado</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatEUR(asset.total_bought_val || 0, hideFigures)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block">Total Vendido</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatEUR(asset.total_sold_val || 0, hideFigures)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500">
                      <span>Periodo: <strong>{asset.first_trade || '-'}</strong> al <strong>{asset.last_trade || '-'}</strong></span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Neto: {isG ? '+' : ''}{formatEUR(netReal, hideFigures)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <button
            onClick={toggleAllExpanded}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <Layers size={13} />
            <span>{allExpanded ? 'Contraer casillas' : 'Expandir todas las casillas'}</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-extrabold hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
