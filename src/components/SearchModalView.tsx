import React, { useState } from 'react';
import { AssetType, PositionItem, WatchlistItem } from '../types/portfolio';
import { EXPLORE_CATALOG } from '../data/mockPortfolio';
import { formatEUR } from '../utils/calculations';
import {
  ArrowLeft,
  Search,
  Plus,
  Check,
  Building2,
  PieChart,
  Coins,
  X,
} from 'lucide-react';

interface SearchModalViewProps {
  onClose: () => void;
  onAddToPortfolio: (position: Omit<PositionItem, 'id' | 'totalValue' | 'unrealizedGainLoss' | 'unrealizedGainLossPct' | 'dailyChangeValue' | 'sparkline'>) => void;
  onAddToWatchlist: (item: Omit<WatchlistItem, 'id' | 'sparkline' | 'dailyChangeValue'>) => void;
  initialCategory?: AssetType;
}

export const SearchModalView: React.FC<SearchModalViewProps> = ({
  onClose,
  onAddToPortfolio,
  onAddToWatchlist,
  initialCategory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'Todos' | AssetType>(initialCategory || 'Todos');
  const [quickAddAsset, setQuickAddAsset] = useState<typeof EXPLORE_CATALOG[0] | null>(null);
  const [sharesInput, setSharesInput] = useState('10');
  const [priceInput, setPriceInput] = useState('');
  const [addMode, setAddMode] = useState<'portfolio' | 'watchlist'>('portfolio');
  const [addedSuccessMsg, setAddedSuccessMsg] = useState('');

  // Filtrado de activos
  const filteredAssets = EXPLORE_CATALOG.filter(asset => {
    const matchesFilter = selectedFilter === 'Todos' || asset.type === selectedFilter;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return matchesFilter;

    const matchesSearch =
      asset.name.toLowerCase().includes(term) ||
      asset.ticker.toLowerCase().includes(term) ||
      (asset.isin && asset.isin.toLowerCase().includes(term));

    return matchesFilter && matchesSearch;
  });

  // Agrupado por tipo cuando no hay término de búsqueda específico
  const accionesList = filteredAssets.filter(a => a.type === 'Acciones');
  const etfsList = filteredAssets.filter(a => a.type === 'ETFs');
  const criptoList = filteredAssets.filter(a => a.type === 'Cripto');

  const handleOpenAddDialog = (asset: typeof EXPLORE_CATALOG[0]) => {
    setQuickAddAsset(asset);
    setPriceInput(asset.price.toString());
    setSharesInput('10');
    setAddMode('portfolio');
  };

  const handleConfirmAdd = () => {
    if (!quickAddAsset) return;

    if (addMode === 'portfolio') {
      const shares = parseFloat(sharesInput) || 1;
      const avgPrice = parseFloat(priceInput) || quickAddAsset.price;

      onAddToPortfolio({
        name: quickAddAsset.name,
        ticker: quickAddAsset.ticker,
        isin: quickAddAsset.isin,
        type: quickAddAsset.type,
        shares,
        avgPrice,
        currentPrice: quickAddAsset.price,
        currency: 'EUR',
        market: quickAddAsset.market,
        countryFlag: quickAddAsset.countryFlag,
        logoBg: quickAddAsset.logoBg,
        logoText: quickAddAsset.logoText,
        dailyChangePct: quickAddAsset.dailyChangePct,
      });
      setAddedSuccessMsg(`¡${quickAddAsset.name} añadido a tu cartera!`);
    } else {
      onAddToWatchlist({
        name: quickAddAsset.name,
        ticker: quickAddAsset.ticker,
        isin: quickAddAsset.isin,
        type: quickAddAsset.type,
        price: quickAddAsset.price,
        currency: 'EUR',
        dailyChangePct: quickAddAsset.dailyChangePct,
        countryFlag: quickAddAsset.countryFlag,
        market: quickAddAsset.market,
        logoBg: quickAddAsset.logoBg,
        logoText: quickAddAsset.logoText,
      });
      setAddedSuccessMsg(`¡${quickAddAsset.name} añadido a seguimiento!`);
    }

    setQuickAddAsset(null);
    setTimeout(() => setAddedSuccessMsg(''), 2500);
  };

  const renderAssetRow = (asset: typeof EXPLORE_CATALOG[0]) => (
    <div
      key={asset.ticker}
      className="flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0 ${asset.logoBg}`}
        >
          {asset.logoText}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900 text-sm truncate">{asset.name}</div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <span>{asset.ticker}</span>
            <span>{asset.countryFlag}</span>
            <span className="text-[11px] text-slate-400">• {formatEUR(asset.price)}</span>
          </div>
        </div>
      </div>

      {/* Botón "+" en círculo verde menta como en Screenshot 3 */}
      <button
        onClick={() => handleOpenAddDialog(asset)}
        className="w-8 h-8 rounded-full border border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors shadow-2xs shrink-0"
        title="Añadir activo"
      >
        <Plus className="w-5 h-5 stroke-[2.2]" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-md mx-auto animate-fadeIn">
      {/* 1. Barra superior con flecha volver y campo de texto */}
      <header className="flex items-center gap-3 px-3 pt-3 pb-2 border-b border-slate-100">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar nombre, símbolo o ISIN..."
            autoFocus
            className="w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent py-2 pr-8 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Chips de filtro horizontales idénticos a Screenshot 3 */}
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-slate-100">
        <button
          onClick={() => setSelectedFilter('Acciones')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            selectedFilter === 'Acciones'
              ? 'bg-blue-500 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">
            <Building2 className="w-2.5 h-2.5" />
          </span>
          <span>Acciones</span>
        </button>

        <button
          onClick={() => setSelectedFilter('ETFs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            selectedFilter === 'ETFs'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center text-[10px]">
            <PieChart className="w-2.5 h-2.5" />
          </span>
          <span>ETFs</span>
        </button>

        <button
          onClick={() => setSelectedFilter('Cripto')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            selectedFilter === 'Cripto'
              ? 'bg-fuchsia-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-fuchsia-500 text-white flex items-center justify-center text-[10px]">
            <Coins className="w-2.5 h-2.5" />
          </span>
          <span>Cripto</span>
        </button>

        {selectedFilter !== 'Todos' && (
          <button
            onClick={() => setSelectedFilter('Todos')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2"
          >
            Ver todos
          </button>
        )}
      </div>

      {/* Alerta de confirmación */}
      {addedSuccessMsg && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shadow-sm animate-fadeIn">
          <span>{addedSuccessMsg}</span>
          <Check className="w-4 h-4" />
        </div>
      )}

      {/* 3. Secciones organizadas con enlace "Más" como en la captura */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {selectedFilter === 'Todos' && !searchTerm ? (
          <>
            {/* Sección Acciones */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xl font-extrabold text-slate-900">Acciones</h2>
                <button
                  onClick={() => setSelectedFilter('Acciones')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Más
                </button>
              </div>
              <div className="space-y-0.5">
                {accionesList.slice(0, 5).map(renderAssetRow)}
              </div>
            </div>

            {/* Sección ETFs */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xl font-extrabold text-slate-900">ETFs</h2>
                <button
                  onClick={() => setSelectedFilter('ETFs')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Más
                </button>
              </div>
              <div className="space-y-0.5">
                {etfsList.slice(0, 3).map(renderAssetRow)}
              </div>
            </div>

            {/* Sección Cripto */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xl font-extrabold text-slate-900">Cripto</h2>
                <button
                  onClick={() => setSelectedFilter('Cripto')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Más
                </button>
              </div>
              <div className="space-y-0.5">
                {criptoList.slice(0, 3).map(renderAssetRow)}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-0.5">
            {filteredAssets.length > 0 ? (
              filteredAssets.map(renderAssetRow)
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se encontraron activos para &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIÁLOGO QUICK ADD (Cartera vs Seguimiento) */}
      {quickAddAsset && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${quickAddAsset.logoBg}`}>
                  {quickAddAsset.logoText}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{quickAddAsset.name}</h4>
                  <span className="text-xs text-slate-500">{quickAddAsset.ticker} • {formatEUR(quickAddAsset.price)}</span>
                </div>
              </div>
              <button onClick={() => setQuickAddAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de destino */}
            <div className="flex gap-2 my-4">
              <button
                onClick={() => setAddMode('portfolio')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                  addMode === 'portfolio' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Añadir a Cartera
              </button>
              <button
                onClick={() => setAddMode('watchlist')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                  addMode === 'watchlist' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Añadir a Seguimiento
              </button>
            </div>

            {addMode === 'portfolio' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Número de títulos / participaciones</label>
                  <input
                    type="number"
                    step="any"
                    value={sharesInput}
                    onChange={e => setSharesInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Precio de compra medio (€)</label>
                  <input
                    type="number"
                    step="any"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setQuickAddAsset(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAdd}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
