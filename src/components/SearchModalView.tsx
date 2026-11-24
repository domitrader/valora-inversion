import React, { useState, useMemo, useEffect } from 'react';
import { AssetType, PositionItem, WatchlistItem, WatchlistPortfolioMeta } from '../types/portfolio';
import { COMPREHENSIVE_CATALOG, CatalogAsset } from '../data/comprehensiveAssetCatalog';
import degiroCoreEtfsRaw from '../data/degiroCoreEtfs.json';
import { estimateHistoricalPrice, formatDateToSpanish } from '../utils/historicalPriceEstimator';
import { formatEUR } from '../utils/calculations';
import { liveQuotesService } from '../services/liveQuotesService';
import {
  ArrowLeft,
  Search,
  Plus,
  Check,
  Building2,
  PieChart,
  Coins,
  ShieldCheck,
  TrendingUp,
  Calendar,
  X,
  Sparkles,
  HelpCircle,
  Clock,
  Layers,
  Globe,
  Loader2,
} from 'lucide-react';

interface DegiroCoreRaw {
  isin: string;
  name: string;
  currency: string;
  exchange: string;
}

const DEGIRO_CORE_LIST = degiroCoreEtfsRaw as DegiroCoreRaw[];
const DEGIRO_CORE_ISINS = new Set(DEGIRO_CORE_LIST.map(e => e.isin.toUpperCase()));

function buildMergedCatalog(): CatalogAsset[] {
  const existingIsins = new Set<string>();
  const base: CatalogAsset[] = COMPREHENSIVE_CATALOG.map(item => {
    const up = (item.isin || '').toUpperCase();
    if (up) existingIsins.add(up);
    return up && DEGIRO_CORE_ISINS.has(up) ? { ...item, degiroCore1Eur: true } : item;
  });

  const extraCore: CatalogAsset[] = [];
  for (const e of DEGIRO_CORE_LIST) {
    const up = e.isin.toUpperCase();
    if (existingIsins.has(up)) continue;
    existingIsins.add(up);

    const isIreland = up.startsWith('IE');
    const flag = e.exchange.includes('Madrid')
      ? '🇪🇸'
      : e.exchange.includes('Paris')
        ? '🇫🇷'
        : e.exchange.includes('Amsterdam')
          ? '🇳🇱'
          : e.exchange.includes('Xetra')
            ? '🇩🇪'
            : e.exchange.includes('Italiana')
              ? '🇮🇹'
              : e.exchange.includes('London')
                ? '🇬🇧'
                : '🇪🇺';

    extraCore.push({
      name: e.name,
      ticker: up,
      yahooSymbol: up,
      isin: up,
      type: 'ETFs',
      countryFlag: flag,
      market: `DEGIRO Core (${e.exchange})`,
      price: 0,
      currency: (e.currency === 'USD' || e.currency === 'GBP' ? e.currency : 'EUR') as 'EUR' | 'USD' | 'GBP',
      dailyChangePct: 0,
      logoBg: 'bg-sky-700',
      logoText: e.name.split(/\s+/)[0].slice(0, 4).toUpperCase(),
      degiroCore1Eur: true,
      zeroDoubleTax: isIreland,
    });
  }

  return [...base, ...extraCore];
}

const FULL_CATALOG: CatalogAsset[] = buildMergedCatalog();

interface SearchModalViewProps {
  onClose: () => void;
  onAddToPortfolio: (position: Omit<PositionItem, 'id' | 'totalValue' | 'unrealizedGainLoss' | 'unrealizedGainLossPct' | 'dailyChangeValue' | 'sparkline'>) => void;
  onAddToWatchlist: (item: Omit<WatchlistItem, 'id' | 'sparkline' | 'dailyChangeValue'>) => void;
  initialCategory?: AssetType;
  defaultAddMode?: 'portfolio' | 'watchlist';
  watchlistLists?: WatchlistPortfolioMeta[];
  activeWatchlistListId?: string;
}

export const SearchModalView: React.FC<SearchModalViewProps> = ({
  onClose,
  onAddToPortfolio,
  onAddToWatchlist,
  initialCategory,
  defaultAddMode = 'portfolio',
  watchlistLists = [],
  activeWatchlistListId = 'default',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'Todos' | AssetType>(initialCategory || 'Todos');
  const [onlyZeroDoubleTax, setOnlyZeroDoubleTax] = useState(false);
  const [onlyDegiroCore, setOnlyDegiroCore] = useState(false);
  const [quickAddAsset, setQuickAddAsset] = useState<CatalogAsset | null>(null);
  
  // Parámetros para añadir posición o cartera de seguimiento
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sharesInput, setSharesInput] = useState('10');
  const [priceInput, setPriceInput] = useState('');
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [addMode, setAddMode] = useState<'portfolio' | 'watchlist'>(defaultAddMode);
  const [targetListId, setTargetListId] = useState<string>(activeWatchlistListId || 'default');
  const [addedSuccessMsg, setAddedSuccessMsg] = useState('');

  // Modal para añadir activo 100% manual si no está en catálogo
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTicker, setCustomTicker] = useState('');
  const [customIsin, setCustomIsin] = useState('');
  const [customType, setCustomType] = useState<AssetType>('Acciones');
  const [customMarket, setCustomMarket] = useState('BME / Mercado Libre');
  const [customCountryFlag, setCustomCountryFlag] = useState('🇪🇸');
  const [customPrice, setCustomPrice] = useState('10.00');

  // Búsqueda global online en tiempo real desde 1 sola letra (TradingView + Yahoo Finance + CoinGecko)
  const [onlineResults, setOnlineResults] = useState<CatalogAsset[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  useEffect(() => {
    const clean = searchTerm.trim();
    if (clean.length < 1) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    let cancelled = false;
    setIsSearchingOnline(true);

    const timer = setTimeout(async () => {
      try {
        const remote = await liveQuotesService.searchGlobalMarketAssets(clean, selectedFilter);
        if (cancelled) return;

        // Excluir duplicados exactos que ya están en el catálogo local
        const localSymbols = new Set(
          FULL_CATALOG.map(c => (c.yahooSymbol || c.ticker).toUpperCase())
        );

        const mapped: CatalogAsset[] = remote
          .filter(r => !localSymbols.has(r.symbol.toUpperCase()))
          .map(r => ({
            name: r.name,
            ticker: r.symbol,
            yahooSymbol: r.yahooSymbol || r.symbol,
            isin: '',
            type: r.assetType,
            countryFlag: r.countryFlag,
            market: r.exchange,
            price: r.priceEUR || 0,
            currency: 'EUR',
            dailyChangePct: r.changePct || 0,
            logoBg: r.assetType === 'ETFs' ? 'bg-amber-600' : r.assetType === 'Fondos' ? 'bg-emerald-700' : 'bg-blue-700',
            logoText: r.symbol.split('.')[0].slice(0, 4),
            zeroDoubleTax: r.symbol.endsWith('.L') || r.symbol.endsWith('.MC'),
          }));

        setOnlineResults(mapped);
      } catch {
        if (!cancelled) setOnlineResults([]);
      } finally {
        if (!cancelled) setIsSearchingOnline(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, selectedFilter]);

  // Filtrado de activos reactivo y veloz (Catálogo Local + 200 ETFs DEGIRO Core Selection)
  const filteredAssets = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return FULL_CATALOG.filter(asset => {
      const matchesFilter = selectedFilter === 'Todos' || asset.type === selectedFilter;
      const matchesZeroTax = !onlyZeroDoubleTax || asset.zeroDoubleTax === true;
      const matchesDegiroCore = !onlyDegiroCore || asset.degiroCore1Eur === true;

      if (!matchesFilter || !matchesZeroTax || !matchesDegiroCore) return false;
      if (!term) return true;

      if (term.length === 1) {
        return (
          asset.ticker.toLowerCase().startsWith(term) ||
          asset.name.toLowerCase().startsWith(term)
        );
      }

      const matchesSearch =
        asset.name.toLowerCase().includes(term) ||
        asset.ticker.toLowerCase().includes(term) ||
        (asset.isin && asset.isin.toLowerCase().includes(term)) ||
        asset.market.toLowerCase().includes(term);

      return matchesSearch;
    });
  }, [searchTerm, selectedFilter, onlyZeroDoubleTax, onlyDegiroCore]);

  // Buscador global sin filtros: muestra todos los resultados encontrados online (acciones, ETFs, fondos, cripto)
  const filteredOnlineResults = useMemo(() => {
    return onlineResults;
  }, [onlineResults]);

  // Agrupación para la vista de inicio vacía
  const accionesList = useMemo(() => FULL_CATALOG.filter(a => a.type === 'Acciones'), []);
  const etfsList = useMemo(() => FULL_CATALOG.filter(a => a.type === 'ETFs'), []);
  const fondosList = useMemo(() => FULL_CATALOG.filter(a => a.type === 'Fondos'), []);
  const criptoList = useMemo(() => FULL_CATALOG.filter(a => a.type === 'Cripto'), []);

  // Estimación de precio histórico según la fecha elegida
  const historicalEstimate = useMemo(() => {
    if (!quickAddAsset) return null;
    return estimateHistoricalPrice(quickAddAsset, purchaseDate);
  }, [quickAddAsset, purchaseDate]);

  // Abrir diálogo de añadir activo (y consultar cotización en vivo si es online o si está disponible)
  const handleOpenAddDialog = async (asset: CatalogAsset) => {
    setQuickAddAsset(asset);
    const today = new Date().toISOString().split('T')[0];
    setPurchaseDate(today);
    setPriceInput(asset.price > 0 ? asset.price.toString() : '');
    const defaultShares = asset.type === 'Fondos' ? 100 : 10;
    setSharesInput(defaultShares.toString());
    setTotalAmountInput(asset.price > 0 ? (defaultShares * asset.price).toFixed(2) : '');
    setAddMode(defaultAddMode);
    setTargetListId(activeWatchlistListId && activeWatchlistListId !== 'all' ? activeWatchlistListId : 'default');

    // Si es resultado online (o cualquier ticker con símbolo de Yahoo), intentar traer su precio actual en vivo
    if (asset.price === 0 || asset.yahooSymbol) {
      const live = await liveQuotesService.fetchStockQuote(asset.yahooSymbol || asset.ticker);
      if (live && live.priceEUR > 0) {
        setQuickAddAsset(prev => prev ? { ...prev, price: live.priceEUR, dailyChangePct: live.changePct } : prev);
        setPriceInput(prev => {
          const nextPrice = (!prev || prev === '0' || prev === asset.price.toString()) ? live.priceEUR.toString() : prev;
          setTotalAmountInput((defaultShares * (parseFloat(nextPrice) || live.priceEUR)).toFixed(2));
          return nextPrice;
        });
      }
    }
  };

  // Cálculo bidireccional: al poner un importe en € (ej. 1000 € o 3000 €), calcula automáticamente los títulos aproximados
  const handleTotalAmountChange = (rawVal: string) => {
    setTotalAmountInput(rawVal);
    const targetEur = parseFloat(rawVal);
    const unitPrice = parseFloat(priceInput) || quickAddAsset?.price || 0;
    if (!isNaN(targetEur) && targetEur > 0 && unitPrice > 0) {
      const isFractional = quickAddAsset?.type === 'Fondos' || quickAddAsset?.type === 'Cripto';
      const calcShares = isFractional
        ? Number((targetEur / unitPrice).toFixed(4))
        : Math.max(1, Math.round(targetEur / unitPrice));
      setSharesInput(calcShares.toString());
    }
  };

  const handleSharesInputChange = (rawVal: string) => {
    setSharesInput(rawVal);
    const sh = parseFloat(rawVal);
    const unitPrice = parseFloat(priceInput) || quickAddAsset?.price || 0;
    if (!isNaN(sh) && sh >= 0 && unitPrice > 0) {
      setTotalAmountInput((sh * unitPrice).toFixed(2));
    } else {
      setTotalAmountInput('');
    }
  };

  const handlePriceInputChange = (rawVal: string) => {
    setPriceInput(rawVal);
    const unitPrice = parseFloat(rawVal);
    const sh = parseFloat(sharesInput);
    if (!isNaN(unitPrice) && unitPrice > 0 && !isNaN(sh) && sh > 0) {
      setTotalAmountInput((sh * unitPrice).toFixed(2));
    }
  };

  // Aplicar fecha rápida (ej: 01/01/2025) y su precio estimado correspondiente
  const handleApplyQuickDate = (dateStr: string) => {
    setPurchaseDate(dateStr);
    if (quickAddAsset) {
      const est = estimateHistoricalPrice(quickAddAsset, dateStr);
      setPriceInput(est.estimatedPrice.toString());
    }
  };

  // Cuando cambia la fecha en el input date, recalcular sugerencia de precio
  const handleDateChange = (newDate: string) => {
    setPurchaseDate(newDate);
    if (quickAddAsset) {
      const est = estimateHistoricalPrice(quickAddAsset, newDate);
      // Actualizar automáticamente el precio estimado si coincide con el anterior
      setPriceInput(est.estimatedPrice.toString());
    }
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
        purchaseDate,
        market: quickAddAsset.market,
        countryFlag: quickAddAsset.countryFlag,
        logoBg: quickAddAsset.logoBg,
        logoText: quickAddAsset.logoText,
        dailyChangePct: quickAddAsset.dailyChangePct,
      });
      setAddedSuccessMsg(`¡${quickAddAsset.ticker} añadido con fecha ${formatDateToSpanish(purchaseDate)}!`);
    } else {
      const shares = parseFloat(sharesInput) || 1;
      const entryPrice = parseFloat(priceInput) || quickAddAsset.price;
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
        listId: targetListId || 'default',
        addedDate: purchaseDate,
        entryPrice,
        shares,
      });
      const listName = watchlistLists.find(l => l.id === targetListId)?.name || 'Favoritos';
      setAddedSuccessMsg(`¡${quickAddAsset.ticker} añadido a "${listName}" (${formatDateToSpanish(purchaseDate)})!`);
    }

    setQuickAddAsset(null);
    setTimeout(() => setAddedSuccessMsg(''), 3000);
  };

  // Confirmar creación de activo personalizado
  const handleConfirmCustomAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customTicker.trim()) return;

    const shares = parseFloat(sharesInput) || 1;
    const avgPrice = parseFloat(customPrice) || 10;

    onAddToPortfolio({
      name: customName.trim(),
      ticker: customTicker.trim().toUpperCase(),
      isin: customIsin.trim().toUpperCase(),
      type: customType,
      shares,
      avgPrice,
      currentPrice: avgPrice,
      currency: 'EUR',
      purchaseDate,
      market: customMarket.trim(),
      countryFlag: customCountryFlag.trim() || '🌐',
      logoBg: 'bg-indigo-600',
      logoText: customTicker.slice(0, 3).toUpperCase(),
      dailyChangePct: 0.0,
    });

    setShowCustomModal(false);
    setAddedSuccessMsg(`¡${customTicker} añadido correctamente a tu cartera!`);
    setTimeout(() => setAddedSuccessMsg(''), 3000);
  };

  const renderAssetRow = (asset: CatalogAsset) => (
    <div
      key={`${asset.ticker}-${asset.isin}`}
      className="flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors border-b border-slate-100/60 last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${asset.logoBg}`}
        >
          {asset.logoText}
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-1.5">
            <span className="truncate">{asset.name}</span>
            <span className="shrink-0">{asset.countryFlag}</span>
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-800">{asset.ticker}</span>
            {asset.isin && <span className="text-[10px] text-slate-400 font-mono">({asset.isin})</span>}
            <span className="text-[11px] text-slate-400">• {asset.market}</span>
          </div>
          {/* Etiquetas fiscales y DEGIRO Core */}
          {(asset.zeroDoubleTax || asset.degiroCore1Eur || asset.accumulation) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {asset.zeroDoubleTax && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>{asset.withholdingTaxOrigin || '0% Doble Retención'}</span>
                </span>
              )}
              {asset.degiroCore1Eur && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold">
                  ⚡ DEGIRO 1€
                </span>
              )}
              {asset.accumulation && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold">
                  🔄 Acum.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          {asset.price > 0 ? (
            <>
              <div className="text-xs font-black text-slate-900">
                {formatEUR(asset.price)}
              </div>
              <div
                className={`text-[10px] font-bold ${
                  asset.dailyChangePct >= 0 ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {asset.dailyChangePct >= 0 ? '+' : ''}
                {asset.dailyChangePct.toFixed(2)}%
              </div>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
              <Globe className="w-2.5 h-2.5" />
              <span>En vivo</span>
            </span>
          )}
        </div>

        {/* Botón "+" en círculo verde menta */}
        <button
          onClick={() => handleOpenAddDialog(asset)}
          className="w-8 h-8 rounded-full border border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors shadow-2xs shrink-0 ml-1"
          title="Añadir a la cartera o seguimiento"
        >
          <Plus className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>
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
            placeholder="Buscar Logista, Visa, UK, Fondos MyInvestor..."
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

      {/* 2. Chips de filtro horizontales (Acciones, ETFs, Fondos, Cripto) */}
      <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedFilter('Todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedFilter === 'Todos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🌐 Todos (Global)
          </button>

          <button
            onClick={() => setSelectedFilter('Acciones')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedFilter === 'Acciones'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Acciones</span>
          </button>

          <button
            onClick={() => setSelectedFilter('ETFs')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedFilter === 'ETFs'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <PieChart className="w-3 h-3" />
            <span>ETFs</span>
          </button>

          <button
            onClick={() => setSelectedFilter('Fondos')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedFilter === 'Fondos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>Fondos MyInvestor</span>
          </button>

          <button
            onClick={() => setSelectedFilter('Cripto')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedFilter === 'Cripto'
                ? 'bg-fuchsia-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-3 h-3" />
            <span>Cripto</span>
          </button>
        </div>

        {/* Filtros especiales: 0% Doble Retención y DEGIRO Core 1€ */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setOnlyZeroDoubleTax(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shrink-0 border ${
              onlyZeroDoubleTax
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>0% Doble Retención (UK / Irlanda / ES)</span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyDegiroCore(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shrink-0 border ${
              onlyDegiroCore
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>⚡ ETFs DEGIRO Core (1€ / Gratis)</span>
          </button>
        </div>
      </div>

      {/* Alerta de confirmación */}
      {addedSuccessMsg && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shadow-sm animate-fadeIn">
          <span>{addedSuccessMsg}</span>
          <Check className="w-4 h-4" />
        </div>
      )}

      {/* 3. Botón para añadir activo manual personalizado */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setShowCustomModal(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200/80"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>¿No encuentras tu activo? <strong>Añadir manualmente</strong></span>
          </span>
          <span className="text-[11px] text-slate-400 font-normal">Personalizado →</span>
        </button>
      </div>

      {/* 4. Lista de resultados o categorías iniciales */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {selectedFilter === 'Todos' && !searchTerm && !onlyZeroDoubleTax && !onlyDegiroCore ? (
          <>
            {/* Sección Acciones Populares */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Acciones (España & USA)</span>
                </h2>
                <button
                  onClick={() => setSelectedFilter('Acciones')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Ver todas ({accionesList.length})
                </button>
              </div>
              <div className="space-y-0.5">
                {accionesList.slice(0, 6).map(renderAssetRow)}
              </div>
            </div>

            {/* Sección Fondos MyInvestor */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Fondos de Inversión MyInvestor</span>
                </h2>
                <button
                  onClick={() => setSelectedFilter('Fondos')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Ver todos ({fondosList.length})
                </button>
              </div>
              <div className="space-y-0.5">
                {fondosList.slice(0, 5).map(renderAssetRow)}
              </div>
            </div>

            {/* Sección ETFs */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-amber-500" />
                  <span>ETFs Indexados & Materias Primas</span>
                </h2>
                <button
                  onClick={() => setSelectedFilter('ETFs')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Ver todos ({etfsList.length})
                </button>
              </div>
              <div className="space-y-0.5">
                {etfsList.slice(0, 4).map(renderAssetRow)}
              </div>
            </div>

            {/* Sección Cripto */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-fuchsia-600" />
                  <span>Criptoactivos</span>
                </h2>
                <button
                  onClick={() => setSelectedFilter('Cripto')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Ver todos ({criptoList.length})
                </button>
              </div>
              <div className="space-y-0.5">
                {criptoList.slice(0, 3).map(renderAssetRow)}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {filteredAssets.length > 0 && (
              <div className="space-y-0.5">
                {filteredAssets.map(renderAssetRow)}
              </div>
            )}

            {/* Resultados globales en directo de Yahoo Finance (todas las bolsas del mundo) */}
            {searchTerm.trim().length >= 2 && (
              <div className="pt-2">
                {isSearchingOnline && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Buscando más bolsas mundiales (Milán, Frankfurt, Londres, NYSE...)</span>
                  </div>
                )}

                {!isSearchingOnline && filteredOnlineResults.length > 0 && (
                  <div className="mt-1">
                    <div className="px-3 py-1.5 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>Otras Bolsas Mundiales ({filteredOnlineResults.length})</span>
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {filteredOnlineResults.map(renderAssetRow)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredAssets.length === 0 && !isSearchingOnline && filteredOnlineResults.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs space-y-3">
                <div>No se encontraron activos para &quot;{searchTerm}&quot;</div>
                <button
                  onClick={() => {
                    setCustomName(searchTerm);
                    setCustomTicker(searchTerm.slice(0, 5).toUpperCase());
                    setShowCustomModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-700"
                >
                  ➕ Añadir &quot;{searchTerm}&quot; de forma manual
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIÁLOGO QUICK ADD CON FECHA DE COMPRA Y PRECIO ESTIMADO */}
      {quickAddAsset && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Cabecera del activo */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${quickAddAsset.logoBg}`}>
                  {quickAddAsset.logoText}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-1">
                    <span className="truncate">{quickAddAsset.name}</span>
                    <span className="shrink-0">{quickAddAsset.countryFlag}</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {quickAddAsset.ticker} • {quickAddAsset.market}
                  </span>
                </div>
              </div>
              <button onClick={() => setQuickAddAsset(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de destino */}
            <div className="flex gap-2 my-3">
              <button
                type="button"
                onClick={() => setAddMode('portfolio')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  addMode === 'portfolio' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Añadir a Cartera
              </button>
              <button
                type="button"
                onClick={() => setAddMode('watchlist')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  addMode === 'watchlist' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Añadir a Seguimiento
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {addMode === 'watchlist' && watchlistLists.length > 0 && (
                <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200/80">
                  <label className="text-[11px] font-black uppercase text-indigo-800 block mb-1.5">
                    Lista / Cartera de Seguimiento
                  </label>
                  <select
                    value={targetListId}
                    onChange={e => setTargetListId(e.target.value)}
                    className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {watchlistLists.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 1. CAMPO: FECHA DE ENTRADA / COMPRA */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{addMode === 'watchlist' ? 'Fecha de entrada en lista' : 'Fecha de la compra'}</span>
                  </label>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      {formatDateToSpanish(purchaseDate)}
                    </span>
                  </div>

                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => handleDateChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Botones de fechas rápidas */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => handleApplyQuickDate(new Date().toISOString().split('T')[0])}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyQuickDate('2025-01-01')}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                    >
                      01/01/2025
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyQuickDate('2024-06-01')}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                    >
                      01/06/2024
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyQuickDate('2024-01-01')}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                    >
                      01/01/2024
                    </button>
                  </div>
                </div>

                {/* 2. CAMPO: PRECIO DE COMPRA CON RECOMENDACIÓN HISTÓRICA */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Precio de compra (€)</label>
                    {historicalEstimate && (
                      <span className="text-[10px] text-slate-500">
                        {historicalEstimate.explanation}
                      </span>
                    )}
                  </div>

                  <input
                    type="number"
                    step="any"
                    value={priceInput}
                    onChange={e => handlePriceInputChange(e.target.value)}
                    placeholder={quickAddAsset.price.toString()}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Sugerencia de precio estimado con botón de 1 toque */}
                  {historicalEstimate && purchaseDate !== new Date().toISOString().split('T')[0] && (
                    <div className="mt-1 flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200">
                      <span>Precio histórico estimado: <strong>{formatEUR(historicalEstimate.estimatedPrice)}</strong></span>
                      <button
                        type="button"
                        onClick={() => handlePriceInputChange(historicalEstimate.estimatedPrice.toString())}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition-colors shadow-2xs"
                      >
                        Aplicar
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. CAMPO: NÚMERO DE TÍTULOS O PARTICIPACIONES */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {quickAddAsset.type === 'Fondos' ? 'Número de participaciones' : 'Número de títulos / acciones'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={sharesInput}
                    onChange={e => handleSharesInputChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 4. CAMPO EDITABLE: TOTAL INVERSIÓN (€) -> CALCULA AUTOMÁTICAMENTE LOS TÍTULOS */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-black text-slate-700">
                      Invertir por importe (€):
                    </label>
                    <div className="relative w-32">
                      <input
                        type="number"
                        step="any"
                        value={totalAmountInput}
                        onChange={e => handleTotalAmountChange(e.target.value)}
                        placeholder="1000"
                        className="w-full border border-emerald-300 bg-emerald-50/40 rounded-xl pl-3 pr-7 py-1.5 text-sm font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">€</span>
                    </div>
                  </div>

                  {/* Botones rápidos de importe en euros */}
                  <div className="flex items-center gap-1.5">
                    {[500, 1000, 3000, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleTotalAmountChange(amt.toString())}
                        className="flex-1 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 transition"
                      >
                        {amt.toLocaleString('es-ES')} €
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Importe real ({sharesInput || 0} títulos):</span>
                    <span className="font-black text-slate-900">
                      {formatEUR((parseFloat(sharesInput) || 0) * (parseFloat(priceInput) || quickAddAsset.price || 0))}
                    </span>
                  </div>
                </div>
              </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuickAddAsset(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAdd}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA ACTIVO 100% PERSONALIZADO / MANUAL */}
      {showCustomModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Añadir Activo Manual</span>
              </h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCustomAdd} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nombre del activo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Logista / Vanguard Global / Fondo X"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Ticker / Símbolo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: LOG, V, VG-GLOB"
                    value={customTicker}
                    onChange={e => setCustomTicker(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Código ISIN (opcional)</label>
                  <input
                    type="text"
                    placeholder="ES0105027009"
                    value={customIsin}
                    onChange={e => setCustomIsin(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Tipo de Activo</label>
                  <select
                    value={customType}
                    onChange={e => setCustomType(e.target.value as AssetType)}
                    className="w-full border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Acciones">Acciones</option>
                    <option value="ETFs">ETFs</option>
                    <option value="Fondos">Fondos de Inversión</option>
                    <option value="Cripto">Cripto</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">País / Bandera</label>
                  <input
                    type="text"
                    value={customCountryFlag}
                    onChange={e => setCustomCountryFlag(e.target.value)}
                    placeholder="🇪🇸 o 🇺🇸 o 🌐"
                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Mercado / Broker</label>
                <input
                  type="text"
                  value={customMarket}
                  onChange={e => setCustomMarket(e.target.value)}
                  placeholder="Ej: Bolsa de Madrid, NYSE, MyInvestor"
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Fecha de compra en manual */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span>Fecha de compra</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">{formatDateToSpanish(purchaseDate)}</span>
                </div>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Títulos / Participaciones</label>
                  <input
                    type="number"
                    step="any"
                    value={sharesInput}
                    onChange={e => setSharesInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Precio Compra (€)</label>
                  <input
                    type="number"
                    step="any"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-black bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs"
                >
                  Añadir Activo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
