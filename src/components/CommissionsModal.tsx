import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Receipt,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Globe,
  Layers,
  Percent,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';
import historicalAssetsRaw from '../data/historicalAssetStats.json';

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
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Abierta' | 'Cerrada'>('Todos');
  const [typeFilter, setTypeFilter] = useState<'Todos' | 'Acciones' | 'ETFs' | 'Cripto'>('Todos');
  const [sortBy, setSortBy] = useState<'fees-desc' | 'net-desc' | 'net-asc' | 'trades-desc' | 'name-asc'>('fees-desc');
  const [isExpandedView, setIsExpandedView] = useState(false);

  const summary = (degiroDataRaw as any).accountSummary || {};
  const totalFees = summary.totalComisiones || 3236.95;
  const totalTrades = summary.totalTrades || 2849;
  const grossRealizedPnl = summary.historicoCerradoPnl || 28160.97;
  const netRealizedPnl = grossRealizedPnl - totalFees; // 24.911,02 €

  // Unificar y deduplicar activos desde historicalAssetStats.json
  const allAssets = useMemo(() => {
    const rawList = Array.isArray(historicalAssetsRaw) ? historicalAssetsRaw : [];
    const map = new Map<string, any>();

    rawList.forEach((item: any) => {
      const isin = (item.isin || '').trim().toUpperCase();
      const key = isin || item.name;

      // Asignar bandera según país
      let flag = '📄';
      if (isin.startsWith('US')) flag = '🇺🇸';
      else if (isin.startsWith('ES')) flag = '🇪🇸';
      else if (isin.startsWith('IE')) flag = '🇮🇪';
      else if (isin.startsWith('DE')) flag = '🇩🇪';
      else if (isin.startsWith('FR')) flag = '🇫🇷';
      else if (isin.startsWith('NL')) flag = '🇳🇱';
      else if (isin.startsWith('CH')) flag = '🇨🇭';
      else if (isin.startsWith('SE')) flag = '🇸🇪';
      else if (isin.startsWith('GB')) flag = '🇬🇧';
      else if (isin.startsWith('LU')) flag = '🇱🇺';
      if (item.name?.toUpperCase().includes('BITCOIN') || item.type === 'Cripto') flag = '₿';

      const fees = Number(item.total_fees || 0);
      const pnl = Number(item.realized_pnl || 0);
      const net = pnl - fees;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          isin,
          name: item.name || 'Activo',
          type: item.type || 'Acciones',
          status: item.status || (item.shares > 0 ? 'Abierta' : 'Cerrada'),
          shares: item.shares || 0,
          trades_count: item.trades_count || 1,
          total_fees: fees,
          realized_pnl: pnl,
          net_pnl: net,
          flag,
        });
      } else {
        // Si hay duplicado (como Taiwan Semi), combinar cifras
        const existing = map.get(key);
        existing.total_fees += fees;
        existing.realized_pnl += pnl;
        existing.net_pnl = existing.realized_pnl - existing.total_fees;
        existing.trades_count += item.trades_count || 0;
        if (item.status === 'Abierta') existing.status = 'Abierta';
      }
    });

    return Array.from(map.values());
  }, []);

  // Filtrado y ordenación
  const filteredAssets = useMemo(() => {
    return allAssets
      .filter((a: any) => {
        const matchesSearch =
          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.isin.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Todos' || a.status === statusFilter;
        const matchesType = typeFilter === 'Todos' || a.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'fees-desc') return b.total_fees - a.total_fees;
        if (sortBy === 'net-desc') return b.net_pnl - a.net_pnl;
        if (sortBy === 'net-asc') return a.net_pnl - b.net_pnl;
        if (sortBy === 'trades-desc') return b.trades_count - a.trades_count;
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [allAssets, searchTerm, statusFilter, typeFilter, sortBy]);

  // Totales de la selección actual
  const currentFilteredFees = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + a.total_fees, 0);
  }, [filteredAssets]);

  const currentFilteredNet = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + a.net_pnl, 0);
  }, [filteredAssets]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-[#0B0F19] w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all ${
          isExpandedView ? 'h-[96vh]' : 'max-h-[92vh]'
        }`}
      >
        {/* 1. Cabecera Fija */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Comisiones y Beneficio Neto
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  DEGIRO
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                09-03-2018 al 25-11-2026 • {totalTrades.toLocaleString('es-ES')} operaciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpandedView(!isExpandedView)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              title={isExpandedView ? 'Vista compacta' : 'Desplegar pantalla completa'}
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

        {/* 2. Tarjeta Resumen: P/G Bruto - Comisiones = Beneficio Neto Real */}
        {!isExpandedView && (
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
              {/* Tarjeta destacada de la resta final */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                    ★ BENEFICIO NETO FINAL (LIMPIO)
                  </span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    +{formatEUR(netRealizedPnl, hideFigures)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Resultado neto real tras descontar todas las comisiones
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Comisiones Totales</span>
                  <span className="text-base font-extrabold text-amber-400 block">
                    -{formatEUR(totalFees, hideFigures)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {(totalFees / totalTrades).toFixed(2)} € / op.
                  </span>
                </div>
              </div>

              {/* Ecuación de la resta visual */}
              <div className="grid grid-cols-3 gap-2 pt-3 text-center text-xs">
                <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400 block">1. Ganancia Bruta</span>
                  <span className="font-extrabold text-emerald-400 text-xs">
                    +{formatEUR(grossRealizedPnl, hideFigures)}
                  </span>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400 block">2. Menos Gastos</span>
                  <span className="font-extrabold text-amber-400 text-xs">
                    -{formatEUR(totalFees, hideFigures)}
                  </span>
                </div>
                <div className="bg-emerald-950/60 rounded-xl p-2 border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-300 block font-bold">3. Beneficio Real</span>
                  <span className="font-extrabold text-emerald-300 text-xs">
                    +{formatEUR(netRealizedPnl, hideFigures)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Controles: Filtros, Buscador y Ordenación */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar activo, símbolo o ISIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={() => setIsExpandedView(!isExpandedView)}
              className="text-xs px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 shrink-0 flex items-center gap-1"
            >
              {isExpandedView ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isExpandedView ? 'Ver Resumen' : 'Expandir'}</span>
            </button>
          </div>

          {/* Filtros tipo chips */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1">
              {(['Todos', 'Abierta', 'Cerrada'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {st === 'Todos' ? `Todos (${allAssets.length})` : st === 'Abierta' ? 'Abiertas (5)' : 'Cerradas (112)'}
                </button>
              ))}
            </div>

            {/* Selector de ordenación */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none shrink-0"
            >
              <option value="fees-desc">Mayor Comisión Pagada ↓</option>
              <option value="net-desc">Mayor Beneficio Neto ↓</option>
              <option value="net-asc">Menor Beneficio / Pérdida ↑</option>
              <option value="trades-desc">Más Operaciones Realizadas ↓</option>
              <option value="name-asc">Nombre Alfabético A-Z</option>
            </select>
          </div>
        </div>

        {/* 4. Listado Desplegado Hacia Abajo (Scroll fluido con tarjetas bien separadas y coloreadas) */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-100/70 dark:bg-[#070A11] rounded-2xl mx-2">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Listado Completo ({filteredAssets.length} activos)</span>
            <span className="text-[10px] font-semibold text-slate-500">
              🟢 Ganancia neta • 🔴 Pérdida neta
            </span>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p>No se encontraron activos con los filtros indicados.</p>
            </div>
          ) : (
            filteredAssets.map((asset: any) => {
              const isPositiveNet = asset.net_pnl >= 0;
              const isPositiveGross = asset.realized_pnl >= 0;

              // Color por tipo de activo
              const typeBadgeColor =
                asset.type === 'ETFs'
                  ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  : asset.type === 'Cripto'
                  ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';

              // Borde y acento según si el resultado neto es positivo o negativo
              const cardBorder = isPositiveNet
                ? 'border-emerald-300 dark:border-emerald-800/80 shadow-xs hover:border-emerald-500'
                : 'border-rose-300 dark:border-rose-800/80 shadow-xs hover:border-rose-500';

              const accentBarColor = isPositiveNet ? 'bg-emerald-500' : 'bg-rose-500';

              return (
                <div
                  key={asset.id}
                  className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-3.5 pl-4 border ${cardBorder} shadow-sm transition-all hover:shadow-md`}
                >
                  {/* Barra lateral de color para separar visualmente */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBarColor}`} />

                  {/* Fila Superior: Logo, Nombre, ISIN, Tipo y Estado */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold shrink-0 mt-0.5 shadow-2xs">
                        {asset.flag}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[190px]">
                            {asset.name}
                          </h4>
                        </div>

                        {/* Badges distintivos de Tipo y Estado */}
                        <div className="flex items-center gap-1.5 text-[10px] mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md font-bold border ${typeBadgeColor}`}>
                            {asset.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              asset.status === 'Abierta'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {asset.status}
                          </span>
                          <span className="text-slate-400 font-medium">
                            {asset.trades_count} ops.
                            {asset.shares > 0 ? ` • ${asset.shares} títulos` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Beneficio Neto Destacado */}
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider">
                        Beneficio Neto
                      </span>
                      <span
                        className={`text-base font-black ${
                          isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositiveNet ? '+' : ''}{formatEUR(asset.net_pnl, hideFigures)}
                      </span>
                    </div>
                  </div>

                  {/* Fila Inferior: Desglose de la resta (P/G Bruto - Comisión = Neto) */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1.5 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[9px] text-slate-400 block font-semibold">P/G Bruto</span>
                      <span className={`font-bold ${isPositiveGross ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                        {isPositiveGross ? '+' : ''}{formatEUR(asset.realized_pnl, hideFigures)}
                      </span>
                    </div>

                    <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-xl p-1.5 border border-amber-300/60 dark:border-amber-700/60">
                      <span className="text-[9px] text-amber-800 dark:text-amber-300 block font-bold">Comisión</span>
                      <span className="font-black text-amber-600 dark:text-amber-400">
                        -{formatEUR(asset.total_fees, hideFigures)}
                      </span>
                    </div>

                    <div
                      className={`rounded-xl p-1.5 border ${
                        isPositiveNet
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      <span className="text-[9px] block font-extrabold uppercase tracking-wider">Neto Real</span>
                      <span className="font-black text-xs">
                        {isPositiveNet ? '+' : ''}{formatEUR(asset.net_pnl, hideFigures)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 5. Pie de Página Fijo con Totales */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-slate-400 text-[10px] block">Total Selección ({filteredAssets.length} activos)</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Comisiones: <strong className="text-amber-500">{formatEUR(currentFilteredFees, hideFigures)}</strong> • Neto: <strong className={currentFilteredNet >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{formatEUR(currentFilteredNet, hideFigures)}</strong>
            </span>
          </div>

          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-extrabold hover:bg-slate-800 transition shrink-0"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
