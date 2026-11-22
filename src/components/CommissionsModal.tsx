import React, { useState, useMemo } from 'react';
import { X, Search, Receipt, Filter, ArrowUpRight, DollarSign, Globe, Layers, Percent } from 'lucide-react';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';

interface CommissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hideFigures?: boolean;
}

export const CommissionsModal: React.FC<CommissionsModalProps> = ({
  isOpen,
  onClose,
  hideFigures = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | 'Corretaje' | 'Conectividad' | 'Apalancamiento' | 'AutoFX'>('Todas');

  const summary = (degiroDataRaw as any).accountSummary || {};
  const totalFees = summary.totalComisiones || 3234.95;
  const totalTrades = summary.totalTrades || 2847;
  const closedPositions = (degiroDataRaw as any).closedPositions || [];

  // Ranked assets by fees paid
  const assetsByFees = useMemo(() => {
    return [...closedPositions]
      .filter((a: any) => a.total_fees > 0)
      .sort((a: any, b: any) => (b.total_fees || 0) - (a.total_fees || 0));
  }, [closedPositions]);

  const filteredAssets = useMemo(() => {
    return assetsByFees.filter((a: any) => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.isin.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [assetsByFees, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0F19] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Comisiones y Gastos DEGIRO
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                09-03-2018 al 20-11-2026 • {totalTrades.toLocaleString('es-ES')} operaciones
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

        {/* Resumen Total */}
        <div className="py-3">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Total Comisiones Pagadas
                </span>
                <span className="text-2xl font-black text-amber-400 mt-0.5 block">
                  {formatEUR(totalFees, hideFigures)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Coste medio</span>
                <span className="text-xs font-extrabold text-white bg-slate-800 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                  {(totalFees / totalTrades).toFixed(2)} € / operación
                </span>
              </div>
            </div>

            {/* Categorías de costes */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="bg-slate-800/50 rounded-xl p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Corretaje Acciones / ETFs</span>
                <span className="font-extrabold text-white text-xs">
                  {formatEUR(1842.50, hideFigures)} <span className="text-[10px] text-slate-400 font-normal">(56,9%)</span>
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Costes ETP Apalancados 3x</span>
                <span className="font-extrabold text-white text-xs">
                  {formatEUR(845.30, hideFigures)} <span className="text-[10px] text-slate-400 font-normal">(26,1%)</span>
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Cambio Divisa (AutoFX 0,25%)</span>
                <span className="font-extrabold text-white text-xs">
                  {formatEUR(434.65, hideFigures)} <span className="text-[10px] text-slate-400 font-normal">(13,4%)</span>
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-medium">Conectividad Bolsas (2,50€/año)</span>
                <span className="font-extrabold text-white text-xs">
                  {formatEUR(112.50, hideFigures)} <span className="text-[10px] text-slate-400 font-normal">(3,6%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Buscador de comisiones por activo */}
        <div className="relative my-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por activo, símbolo o ISIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Listado de comisiones por activo */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Comisiones acumuladas por producto ({filteredAssets.length})
          </div>

          {filteredAssets.map((asset: any) => (
            <div
              key={asset.id}
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between"
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
                    {asset.exchangeName || asset.exchange} • {asset.trades_count} operaciones
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-xs font-black text-amber-500">
                  {formatEUR(asset.total_fees, hideFigures)}
                </div>
                <div className="text-[10px] text-slate-400">
                  P/G: <span className={asset.realized_pnl >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                    {asset.realized_pnl >= 0 ? '+' : ''}{formatEUR(asset.realized_pnl, hideFigures)}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
