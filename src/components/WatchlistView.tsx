import React, { useState } from 'react';
import { WatchlistItem, SortOption } from '../types/portfolio';
import { formatPercent } from '../utils/calculations';
import { Sparkline } from './Sparkline';
import {
  Edit3,
  Search,
  ChevronDown,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  Calendar,
  DollarSign,
  Check,
} from 'lucide-react';

interface WatchlistViewProps {
  watchlist: WatchlistItem[];
  onOpenSearch: () => void;
  onGoToProfile: () => void;
  onRemoveFromWatchlist: (id: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  onOpenSearch,
  onGoToProfile,
  onRemoveFromWatchlist,
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Ordenación según la opción elegida
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    switch (sortOption) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'change-asc':
        return a.dailyChangePct - b.dailyChangePct;
      case 'change-desc':
        return b.dailyChangePct - a.dailyChangePct;
      case 'custom':
        return (a.customOrder || 0) - (b.customOrder || 0);
      default:
        return 0;
    }
  });

  const getSortLabel = () => {
    switch (sortOption) {
      case 'name-asc':
        return 'Nombre ↑';
      case 'name-desc':
        return 'Nombre ↓';
      case 'change-asc':
        return 'Porcentaje de cambio ↑';
      case 'change-desc':
        return 'Porcentaje de cambio ↓';
      case 'custom':
        return 'Personalizado';
    }
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto relative min-h-screen">
      {/* 1. Cabecera idéntica a la captura de pantalla: "Seguimiento", lápiz, lupa, avatar */}
      <header className="flex items-center justify-between pt-1 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Seguimiento</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isEditMode ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Editar lista"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
            title="Buscar activos"
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={onGoToProfile}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center hover:bg-slate-200 transition-colors shadow-xs"
          >
            SE
          </button>
        </div>
      </header>

      {/* 2. Botón desplegable de ordenación idéntico a Screenshots 4 y 5 ("Nombre ⌄") */}
      <div className="relative mb-3 inline-block">
        <button
          onClick={() => setShowSortDropdown(!showSortDropdown)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition-colors"
        >
          <span>{getSortLabel()}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* Menú desplegable flotante con las 5 opciones de la Captura 5 */}
        {showSortDropdown && (
          <div className="absolute left-0 top-10 z-30 bg-slate-100/95 backdrop-blur-md border border-slate-200/80 rounded-2xl p-2 w-64 shadow-xl animate-fadeIn">
            <button
              onClick={() => { setSortOption('name-asc'); setShowSortDropdown(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-white/80 transition-colors"
            >
              <span>Nombre ↑</span>
              {sortOption === 'name-asc' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
            </button>

            <button
              onClick={() => { setSortOption('name-desc'); setShowSortDropdown(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-white/80 transition-colors"
            >
              <span>Nombre ↓</span>
              {sortOption === 'name-desc' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
            </button>

            <button
              onClick={() => { setSortOption('change-asc'); setShowSortDropdown(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-white/80 transition-colors"
            >
              <span>Porcentaje de cambio ↑</span>
              {sortOption === 'change-asc' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
            </button>

            <button
              onClick={() => { setSortOption('change-desc'); setShowSortDropdown(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-white/80 transition-colors"
            >
              <span>Porcentaje de cambio ↓</span>
              {sortOption === 'change-desc' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
            </button>

            <button
              onClick={() => { setSortOption('custom'); setShowSortDropdown(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-white/80 transition-colors"
            >
              <span>Personalizado</span>
              {sortOption === 'custom' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
            </button>
          </div>
        )}
      </div>

      {/* 3. Listado de activos en seguimiento con sparklines y porcentajes */}
      <div className="space-y-1">
        {sortedWatchlist.map(item => {
          const isNegative = item.dailyChangePct < 0;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between py-2.5 px-2 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              {/* Logo + Nombre + Ticker + Badges de eventos */}
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0 ${item.logoBg || 'bg-slate-800'}`}
                >
                  {item.logoText || item.ticker.slice(0, 2)}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{item.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span>{item.ticker}</span>
                    {/* Indicadores de eventos (earnings / dividendos próximos) */}
                    <div className="flex items-center gap-1">
                      {item.hasDividendSoon && (
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold" title="Dividendo próximo">
                          $
                        </span>
                      )}
                      {item.hasEarningsSoon && (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold" title="Resultados próximos">
                          📊
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sparkline central */}
              <div className="shrink-0 px-2">
                <Sparkline data={item.sparkline} width={68} height={20} isPositive={!isNegative} />
              </div>

              {/* Porcentaje de cambio en verde o rojo como en Screenshot 4 */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`text-sm font-bold flex items-center gap-0.5 ${
                    isNegative ? 'text-rose-500' : 'text-emerald-600'
                  }`}
                >
                  <span className="text-xs opacity-75">{isNegative ? '›' : '›'}</span>
                  <span>{formatPercent(item.dailyChangePct)}</span>
                </div>

                {isEditMode && (
                  <button
                    onClick={() => onRemoveFromWatchlist(item.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Eliminar de seguimiento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Botón flotante verde '+' abajo a la derecha (FAB) idéntico a las Capturas 4 y 5 */}
      <button
        onClick={onOpenSearch}
        className="fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
        title="Añadir a seguimiento"
      >
        <Plus className="w-7 h-7 stroke-[2.6]" />
      </button>
    </div>
  );
};
