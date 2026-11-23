import React, { useMemo, useState } from 'react';
import { WatchlistItem, WatchlistPortfolioMeta, SortOption } from '../types/portfolio';
import { formatEUR, formatPercent } from '../utils/calculations';
import { Sparkline } from './Sparkline';
import {
  Edit3,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Calendar,
  Check,
  FolderPlus,
  Briefcase,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';

interface WatchlistViewProps {
  watchlist: WatchlistItem[];
  watchlistLists: WatchlistPortfolioMeta[];
  activeListId: string;
  onSelectList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onDeleteList: (listId: string) => void;
  onUpdateWatchlistItem: (updated: WatchlistItem) => void;
  onOpenSearch: () => void;
  onGoToProfile: () => void;
  onRemoveFromWatchlist: (id: string) => void;
}

function fmtShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1] || parts[1]} ${parts[0]}`;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  watchlistLists,
  activeListId,
  onSelectList,
  onCreateList,
  onDeleteList,
  onUpdateWatchlistItem,
  onOpenSearch,
  onGoToProfile,
  onRemoveFromWatchlist,
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Modal crear nueva lista/cartera de seguimiento
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Modal editar fecha / títulos / precio de entrada / lista de un activo
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editShares, setEditShares] = useState('');
  const [editListId, setEditListId] = useState('default');
  const [showListDropdown, setShowListDropdown] = useState(false);

  const lists = useMemo(() => {
    if (watchlistLists && watchlistLists.length > 0) return watchlistLists;
    return [{ id: 'default', name: 'Favoritos', createdAt: '2026-01-01' }];
  }, [watchlistLists]);

  const isAllMode = activeListId === 'all';
  const activeList = isAllMode
    ? { id: 'all', name: 'Todas las carteras', createdAt: '' }
    : lists.find(l => l.id === activeListId) || lists[0];

  // Filtrar items que pertenecen a la lista activa (o todas si es 'all')
  const itemsInActiveList = useMemo(() => {
    if (isAllMode) return watchlist;
    return watchlist.filter(item => (item.listId || 'default') === activeList.id);
  }, [watchlist, activeList.id, isAllMode]);

  // Ordenación según la opción elegida
  const sortedWatchlist = useMemo(() => {
    return [...itemsInActiveList].sort((a, b) => {
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
  }, [itemsInActiveList, sortOption]);

  // Resumen tipo Cartera Simulada de la lista activa
  const listSummary = useMemo(() => {
    let totalCurrent = 0;
    let totalCost = 0;
    let hasPortfolioData = false;

    for (const item of itemsInActiveList) {
      const sh = item.shares && item.shares > 0 ? item.shares : 1;
      const ep = item.entryPrice && item.entryPrice > 0 ? item.entryPrice : item.price;
      if (item.shares || item.entryPrice || item.addedDate) {
        hasPortfolioData = true;
      }
      totalCurrent += sh * item.price;
      totalCost += sh * ep;
    }

    const totalGain = totalCurrent - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      hasPortfolioData,
      totalCurrent: Number(totalCurrent.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalGain: Number(totalGain.toFixed(2)),
      totalGainPct: Number(totalGainPct.toFixed(2)),
    };
  }, [itemsInActiveList]);

  const getSortLabel = () => {
    switch (sortOption) {
      case 'name-asc':
        return 'Nombre ↑';
      case 'name-desc':
        return 'Nombre ↓';
      case 'change-asc':
        return 'Cambio % ↑';
      case 'change-desc':
        return 'Cambio % ↓';
      case 'custom':
        return 'Personalizado';
    }
  };

  const openEditItemModal = (item: WatchlistItem) => {
    setEditingItem(item);
    setEditDate(item.addedDate || new Date().toISOString().split('T')[0]);
    setEditPrice(String(item.entryPrice ?? item.price));
    setEditShares(String(item.shares ?? 1));
    setEditListId(item.listId || 'default');
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    onUpdateWatchlistItem({
      ...editingItem,
      addedDate: editDate || undefined,
      entryPrice: parseFloat(editPrice) || editingItem.price,
      shares: parseFloat(editShares) || 1,
      listId: editListId || 'default',
    });
    setEditingItem(null);
  };

  const handleCreateListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newListName.trim();
    if (!clean) return;
    onCreateList(clean);
    setNewListName('');
    setShowNewListModal(false);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto relative min-h-screen">
      {/* 1. Cabecera */}
      <header className="flex items-center justify-between pt-1 pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-tight">
            Seguimiento
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Listas de favoritos y carteras simuladas por fecha
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${
              isEditMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
            title="Editar / Eliminar elementos"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            title="Buscar activos globalmente"
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={onGoToProfile}
            className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center shadow-xs"
          >
            DO
          </button>
        </div>
      </header>

      {/* 2. Selector Desplegable Unificado de Listas / Carteras */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowListDropdown(prev => !prev)}
            className="flex-1 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shrink-0">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div className="text-left min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                  Cartera / Lista activa
                </span>
                <span className="text-xs font-black text-slate-950 dark:text-white truncate block mt-0.5">
                  {activeList.name} ({itemsInActiveList.length})
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                showListDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowNewListModal(true)}
            className="w-11 h-11 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center shadow-xs active:scale-95 transition shrink-0"
            title="Crear nueva lista / cartera"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Menú desplegable de todas las listas */}
        {showListDropdown && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowListDropdown(false)}
            />
            <div className="absolute left-0 right-0 top-14 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1">
              {/* Opción 0: Todas las carteras juntas */}
              <button
                type="button"
                onClick={() => {
                  onSelectList('all');
                  setShowListDropdown(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-extrabold transition ${
                  isAllMode
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🌐</span>
                  <span>Todas las carteras</span>
                  <span className="text-[10px] opacity-75">({watchlist.length})</span>
                </span>
                {isAllMode && <Check className="w-4 h-4 stroke-[2.5]" />}
              </button>

              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

              {/* Listas individuales */}
              {lists.map(list => {
                const isSelected = !isAllMode && list.id === activeList.id;
                const count = watchlist.filter(i => (i.listId || 'default') === list.id).length;
                return (
                  <div key={list.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectList(list.id);
                        setShowListDropdown(false);
                      }}
                      className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-extrabold transition ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{list.name}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </span>
                      {isSelected && <Check className="w-4 h-4 stroke-[2.5] shrink-0" />}
                    </button>

                    {list.id !== 'default' && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar la lista "${list.name}" y sus activos?`)) {
                            onDeleteList(list.id);
                            setShowListDropdown(false);
                          }
                        }}
                        className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                        title={`Eliminar "${list.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowListDropdown(false);
                    setShowNewListModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-extrabold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Crear nueva lista / cartera</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Tarjeta Resumen de Cartera Simulada para la lista activa */}
      {itemsInActiveList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 mb-3 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Resumen · {activeList.name}
            </span>
            {activeList.id !== 'default' && isEditMode && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar la lista "${activeList.name}" y sus activos?`)) {
                    onDeleteList(activeList.id);
                  }
                }}
                className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Eliminar lista
              </button>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-xl font-black text-slate-950 dark:text-white">
                {formatEUR(listSummary.totalCurrent)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Entrada total: {formatEUR(listSummary.totalCost)} · {itemsInActiveList.length} activos
              </div>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-xl ${
                  listSummary.totalGain >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                }`}
              >
                {listSummary.totalGain >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {listSummary.totalGain > 0 ? '+' : ''}
                  {formatEUR(listSummary.totalGain)} ({listSummary.totalGainPct > 0 ? '+' : ''}
                  {listSummary.totalGainPct.toFixed(2)}%)
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Desde fecha añadida</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Ordenación + Botón Añadir a esta lista */}
      <div className="flex items-center justify-between mb-3">
        <div className="relative inline-block">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs"
          >
            <span>{getSortLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showSortDropdown && (
            <div className="absolute left-0 top-10 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 w-56 shadow-xl">
              {(
                [
                  { id: 'name-asc', label: 'Nombre ↑' },
                  { id: 'name-desc', label: 'Nombre ↓' },
                  { id: 'change-desc', label: 'Mayor subida hoy' },
                  { id: 'change-asc', label: 'Mayor caída hoy' },
                ] as { id: SortOption; label: string }[]
              ).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSortOption(opt.id);
                    setShowSortDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>{opt.label}</span>
                  {sortOption === opt.id && <Check className="w-4 h-4 text-sky-600 stroke-[2.5]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isAllMode && activeList.id !== 'default' && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar la lista "${activeList.name}" y sus activos?`)) {
                  onDeleteList(activeList.id);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 active:scale-95 transition"
              title={`Eliminar lista "${activeList.name}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold shadow-xs active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir activo</span>
          </button>
        </div>
      </div>

      {/* 5. Lista de Activos en la Cartera/Lista Activa */}
      {sortedWatchlist.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              "{activeList.name}" está vacía
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Busca cualquier acción o ETF del mundo y añádelo con su fecha de entrada y títulos para seguir su evolución como cartera.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold shadow-xs"
          >
            <Search className="w-3.5 h-3.5" />
            Buscar y añadir activo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedWatchlist.map(item => {
            const isPositive = item.dailyChangePct >= 0;
            const sh = item.shares && item.shares > 0 ? item.shares : 1;
            const ep = item.entryPrice && item.entryPrice > 0 ? item.entryPrice : item.price;
            const posVal = sh * item.price;
            const posCost = sh * ep;
            const sinceGain = posVal - posCost;
            const sincePct = posCost > 0 ? (sinceGain / posCost) * 100 : 0;
            const hasEntry = Boolean(item.addedDate || item.entryPrice || item.shares);

            return (
              <div
                key={item.id}
                onClick={() => !isEditMode && openEditItemModal(item)}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onRemoveFromWatchlist(item.id);
                        }}
                        className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"
                        title="Eliminar de esta lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${
                        item.logoBg || 'bg-slate-800'
                      }`}
                    >
                      {item.logoText || item.ticker.slice(0, 3)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-950 dark:text-white truncate">
                          {item.name}
                        </span>
                        {item.countryFlag && <span className="text-xs shrink-0">{item.countryFlag}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {item.ticker} · {item.market || item.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden xs:block w-14">
                      <Sparkline data={item.sparkline} isPositive={isPositive} />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-950 dark:text-white">
                        {formatEUR(item.price)}
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                        }`}
                      >
                        {formatPercent(item.dailyChangePct)} hoy
                      </div>
                    </div>
                  </div>
                </div>

                {/* Franja inferior: Fecha añadida + Cartera simulada */}
                {hasEntry && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                      <Calendar className="w-3 h-3 text-sky-500 shrink-0" />
                      <span>
                        {item.addedDate ? `Desde ${fmtShortDate(item.addedDate)}` : 'Entrada'} ·{' '}
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {sh} × {formatEUR(ep)}
                        </strong>
                      </span>
                    </div>
                    <span
                      className={`font-black px-1.5 py-0.5 rounded-md ${
                        sinceGain >= 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                      }`}
                    >
                      {sinceGain > 0 ? '+' : ''}
                      {formatEUR(sinceGain)} ({sincePct > 0 ? '+' : ''}
                      {sincePct.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR NUEVA LISTA / CARTERA DE FAVORITOS */}
      {showNewListModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowNewListModal(false)}
        >
          <form
            onSubmit={handleCreateListSubmit}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-950 dark:text-white">
                Nueva lista / cartera
              </h3>
              <button
                type="button"
                onClick={() => setShowNewListModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crea una lista independiente para agrupar favoritos o simular una cartera por fechas (ej. "Cartera IA", "ETFs Europa", "Dividendos").
            </p>
            <input
              type="text"
              autoFocus
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="Nombre de la lista..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewListModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
              >
                Crear lista
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDITAR FECHA, PRECIO ENTRADA, TÍTULOS Y LISTA DE UN ACTIVO */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingItem(null)}
        >
          <form
            onSubmit={handleSaveEditItem}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-950 dark:text-white truncate">
                  {editingItem.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">{editingItem.ticker}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Lista / Cartera
              </label>
              <select
                value={editListId}
                onChange={e => setEditListId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 dark:text-white"
              >
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Fecha de entrada
              </label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Precio entrada (€)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Títulos
                </label>
                <input
                  type="number"
                  step="any"
                  value={editShares}
                  onChange={e => setEditShares(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onRemoveFromWatchlist(editingItem.id);
                  setEditingItem(null);
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
