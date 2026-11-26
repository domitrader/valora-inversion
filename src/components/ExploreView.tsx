import React, { useEffect, useMemo, useState } from 'react';
import { AssetType, PortfolioState } from '../types/portfolio';
import { MARKET_HOLIDAYS_2026_2027 } from '../data/marketHolidays';
import { FifoFiscalView } from './FifoFiscalView';
import {
  DIVIDEND_MARKETS,
  DividendMarketKey,
  GlobalDividendItem,
  LiveMarketIndex,
  LiveMoverItem,
  RealNewsArticle,
  WeeklyEarningsDay,
  fetchGlobalDividends,
  fetchLiveMarketsSummary,
  fetchRealFinancialNews,
  fetchTopMovers,
  fetchWeeklyEarnings,
} from '../services/exploreMarketService';
import {
  Menu,
  X,
  RefreshCw,
  Search,
  Globe,
  Flame,
  Calendar,
  Coins,
  Palmtree,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Sunrise,
  Moon,
  Clock,
  Scale,
} from 'lucide-react';

export type ExploreSection =
  | 'mercados'
  | 'tendencias'
  | 'earnings'
  | 'dividendos'
  | 'festivos'
  | 'noticias'
  | 'fifo';

interface ExploreViewProps {
  onSelectCategory: (type: AssetType) => void;
  onOpenSearch: () => void;
  onGoToProfile: () => void;
  portfolioState?: PortfolioState;
}

const SECTION_STORAGE_KEY = 'valora_explore_section_v1';

const MENU_ITEMS: {
  id: ExploreSection;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}[] = [
  {
    id: 'mercados',
    label: 'Mercados en Vivo',
    subtitle: 'Índices, Oro, Bitcoin y Divisas',
    icon: Globe,
    color: 'text-sky-500',
  },
  {
    id: 'earnings',
    label: 'Resultados (Earnings)',
    subtitle: 'Calendario semanal BMO / AMC',
    icon: Calendar,
    color: 'text-blue-600',
  },
  {
    id: 'dividendos',
    label: 'Dividendos Globales',
    subtitle: 'España, Europa, UK y EE.UU.',
    icon: Coins,
    color: 'text-emerald-500',
  },
  {
    id: 'tendencias',
    label: 'Tendencias del Día',
    subtitle: 'Mayores subidas y caídas reales',
    icon: Flame,
    color: 'text-orange-500',
  },
  {
    id: 'festivos',
    label: 'Festivos Bursátiles',
    subtitle: 'Cierres de bolsa 2026–2027',
    icon: Palmtree,
    color: 'text-amber-500',
  },
  {
    id: 'noticias',
    label: 'Noticias Reales',
    subtitle: 'Actualidad financiera al minuto',
    icon: Newspaper,
    color: 'text-indigo-500',
  },
  {
    id: 'fifo',
    label: 'FIFO Fiscal',
    subtitle: 'Optimizador fiscal y ventas sin IRPF',
    icon: Scale,
    color: 'text-violet-500',
  },
];

function formatSpanishDate(dateStr: string | null): string {
  if (!dateStr) return 'Pendiente';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${months[Number(m) - 1] || m} ${y}`;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onOpenSearch,
  onGoToProfile,
  portfolioState,
}) => {
  const [activeSection, setActiveSection] = useState<ExploreSection>(() => {
    try {
      const saved = localStorage.getItem(SECTION_STORAGE_KEY) as ExploreSection | null;
      if (saved && MENU_ITEMS.some(m => m.id === saved)) return saved;
    } catch {}
    return 'earnings';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 1. Mercados en Vivo
  const [markets, setMarkets] = useState<LiveMarketIndex[]>([]);

  // 2. Tendencias
  const [moverRegion, setMoverRegion] = useState<'america' | 'spain' | 'europe' | 'crypto'>('america');
  const [movers, setMovers] = useState<{ gainers: LiveMoverItem[]; losers: LiveMoverItem[] }>({
    gainers: [],
    losers: [],
  });

  // 3. Resultados Semanales (Earnings)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [earningsRegion, setEarningsRegion] = useState<'america' | 'europe' | 'spain'>('america');
  const [earningsData, setEarningsData] = useState<{
    weekLabel: string;
    days: WeeklyEarningsDay[];
    totalCount: number;
  }>({ weekLabel: '', days: [], totalCount: 0 });

  // 4. Dividendos Globales
  const [divCountry, setDivCountry] = useState<DividendMarketKey>('spain');
  const [divMode, setDivMode] = useState<'upcoming' | 'high_yield'>('upcoming');
  const [divSearch, setDivSearch] = useState('');
  const [dividends, setDividends] = useState<GlobalDividendItem[]>([]);

  // 5. Festivos
  const [holidayFilter, setHolidayFilter] = useState<'ALL' | 'BME' | 'US' | 'EU'>('ALL');

  // 6. Noticias Reales
  const [newsTopic, setNewsTopic] = useState<'all' | 'NVDA' | 'Oro' | 'Nasdaq' | 'Bitcoin' | 'IBEX'>('all');
  const [news, setNews] = useState<RealNewsArticle[]>([]);

  const handleSelectSection = (sec: ExploreSection) => {
    setActiveSection(sec);
    setDrawerOpen(false);
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, sec);
    } catch {}
  };

  const loadSectionData = async () => {
    if (activeSection === 'festivos' || activeSection === 'fifo') {
      setErrorMsg(null);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeSection === 'mercados') {
        const res = await fetchLiveMarketsSummary();
        setMarkets(res);
      } else if (activeSection === 'tendencias') {
        const res = await fetchTopMovers(moverRegion);
        setMovers(res);
      } else if (activeSection === 'earnings') {
        const res = await fetchWeeklyEarnings(weekOffset, earningsRegion);
        setEarningsData(res);
      } else if (activeSection === 'dividendos') {
        const res = await fetchGlobalDividends(divCountry, divMode, divSearch);
        setDividends(res);
      } else if (activeSection === 'noticias') {
        const res = await fetchRealFinancialNews(newsTopic);
        setNews(res);
      }
      setLastUpdated(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error cargando sección Explorar:', err);
      setErrorMsg('No se pudieron cargar los datos en vivo. Pulsa refrescar para reintentar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSectionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, moverRegion, weekOffset, earningsRegion, divCountry, divMode, newsTopic]);

  const filteredHolidays = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return MARKET_HOLIDAYS_2026_2027.filter(h => {
      if (h.date < todayStr) return false;
      if (holidayFilter === 'BME') return h.markets.includes('BME');
      if (holidayFilter === 'US') return h.markets.includes('NYSE') || h.markets.includes('NASDAQ');
      if (holidayFilter === 'EU') return h.markets.includes('XETRA') || h.markets.includes('MIL') || h.markets.includes('EPA');
      return true;
    });
  }, [holidayFilter]);

  const activeMeta = MENU_ITEMS.find(m => m.id === activeSection) || MENU_ITEMS[0];

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto min-h-screen bg-gradient-to-b from-[#E6F4FE] via-[#F5FAFF] to-white dark:from-[#0B1221] dark:via-[#0B0F19] dark:to-[#0B0F19]">
      {/* Cabecera superior con botón Menú Lateral (☰), Título de Sección y Avatar Dorado */}
      <header className="flex items-center justify-between pt-2 pb-3 sticky top-0 z-20 bg-[#EAF5FE]/90 dark:bg-[#0B0F19]/90 backdrop-blur-md -mx-4 px-4 border-b border-sky-100/80 dark:border-slate-800/80 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full bg-white/95 dark:bg-slate-900 border border-sky-200/90 dark:border-slate-700 flex items-center justify-center text-[#0F2952] dark:text-slate-100 shadow-[0_4px_12px_rgba(14,165,233,0.16)] hover:bg-white active:scale-95 transition-all shrink-0"
            title="Abrir menú de secciones"
          >
            <Menu className="w-5 h-5 stroke-[2.3]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-black text-[#081C3E] dark:text-white leading-tight truncate">
              {activeMeta.label}
            </h1>
            <p className="text-[11px] text-[#173A6A]/80 dark:text-slate-400 font-semibold truncate">
              {activeSection === 'fifo' || activeSection === 'festivos'
                ? activeMeta.subtitle
                : lastUpdated
                  ? `En vivo · ${lastUpdated}`
                  : activeMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900 border border-sky-200/90 dark:border-slate-700 flex items-center justify-center text-[#0F2952] dark:text-slate-300 shadow-xs hover:bg-white transition-colors"
            title="Buscador global en vivo"
          >
            <Search className="w-4 h-4" />
          </button>
          {activeSection !== 'festivos' && activeSection !== 'fifo' && (
            <button
              type="button"
              onClick={loadSectionData}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900 border border-sky-200/90 dark:border-slate-700 flex items-center justify-center text-[#0F2952] dark:text-slate-300 shadow-xs hover:bg-white transition-colors disabled:opacity-50"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-500' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onGoToProfile}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0F2952] via-[#173566] to-[#0B1D3B] text-white font-black text-xs flex items-center justify-center ring-2 ring-amber-400 border border-amber-200/90 shadow-[0_0_12px_rgba(251,191,36,0.5)] active:scale-95 transition-all"
            title="Perfil"
          >
            DO
          </button>
        </div>
      </header>

      {/* MENÚ LATERAL DESLIZABLE IZQUIERDO (DRAWER) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex animate-in fade-in duration-150"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Centro de Mercado
                </span>
                <h2 className="text-base font-black text-slate-950 dark:text-white">Explorar</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1.5 flex-1 overflow-y-auto">
              {MENU_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                      isActive
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-white/15 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-slate-950' : item.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">{item.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Acceso directo Buscador Global */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenSearch();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl text-left bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold">Buscador Global</div>
                    <div className="text-[10px] opacity-80 truncate">Acciones, ETFs y Cripto en vivo</div>
                  </div>
                </button>
              </div>
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
              Datos reales en vivo · TradingView & Google News
            </div>
          </aside>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="mb-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={loadSectionData}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ==================== 1. RESULTADOS SEMANALES (EARNINGS) ==================== */}
      {activeSection === 'earnings' && (
        <div className="space-y-3">
          {/* Selector de Región */}
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'america', label: '🇺🇸 EE.UU.' },
                { id: 'europe', label: '🇪🇺 Europa' },
                { id: 'spain', label: '🇪🇸 España' },
              ] as const
            ).map(reg => (
              <button
                key={reg.id}
                type="button"
                onClick={() => setEarningsRegion(reg.id)}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all ${
                  earningsRegion === reg.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>

          {/* Navegador de Semana estilo Stock Analysis */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
            <button
              type="button"
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="text-xs font-black text-slate-950 dark:text-white">
                {earningsData.weekLabel || 'Cargando semana...'}
              </div>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {weekOffset === 0
                  ? `Esta semana · ${earningsData.totalCount} resultados`
                  : `Volver a esta semana (${earningsData.totalCount} res.)`}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Consultando resultados reales de la semana...
            </div>
          ) : (
            <div className="space-y-3">
              {earningsData.days.map(day => {
                const isEmpty = day.bmo.length === 0 && day.amc.length === 0;
                return (
                  <div
                    key={day.dateStr}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                  >
                    {/* Cabecera azul estilo Stock Analysis */}
                    <div className="bg-blue-600 text-white px-3.5 py-2 flex items-center justify-between">
                      <span className="font-black text-xs tracking-wide uppercase">
                        {day.dayName}
                      </span>
                      <span className="text-xs font-bold opacity-90">{day.dateLabel}</span>
                    </div>

                    {isEmpty ? (
                      <div className="py-4 px-3 text-center text-[11px] text-slate-400 font-medium">
                        Sin resultados relevantes programados este día
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                        {/* Columna Izquierda: Antes de Apertura (BMO) */}
                        <div className="p-2.5">
                          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <Sunrise className="w-3 h-3" />
                            <span>Antes Apertura</span>
                          </div>
                          {day.bmo.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-2">—</p>
                          ) : (
                            <div className="space-y-1.5">
                              {day.bmo.slice(0, 8).map(item => (
                                <div
                                  key={item.ticker}
                                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-black text-slate-900 dark:text-white">
                                      {item.ticker}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        item.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                                      }`}
                                    >
                                      {item.changePct > 0 ? '+' : ''}
                                      {item.changePct.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.name}
                                  </div>
                                  {item.marketCapB > 0 && (
                                    <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                      Cap: {item.marketCapB}B · {item.price} {item.currency}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Columna Derecha: Tras el Cierre (AMC) */}
                        <div className="p-2.5">
                          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <Moon className="w-3 h-3" />
                            <span>Tras el Cierre</span>
                          </div>
                          {day.amc.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-2">—</p>
                          ) : (
                            <div className="space-y-1.5">
                              {day.amc.slice(0, 8).map(item => (
                                <div
                                  key={item.ticker}
                                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-black text-slate-900 dark:text-white">
                                      {item.ticker}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        item.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                                      }`}
                                    >
                                      {item.changePct > 0 ? '+' : ''}
                                      {item.changePct.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.name}
                                  </div>
                                  {item.marketCapB > 0 && (
                                    <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                      Cap: {item.marketCapB}B · {item.price} {item.currency}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== 2. CALENDARIO GLOBAL DE DIVIDENDOS ==================== */}
      {activeSection === 'dividendos' && (
        <div className="space-y-3">
          {/* Selector de Mercados Globales (España primero!) */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {DIVIDEND_MARKETS.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setDivCountry(m.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  divCountry === m.key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {m.flag} {m.label}
              </button>
            ))}
          </div>

          {/* Toggle Próximos Ex-Dividendo vs Mayor Rentabilidad + Buscador */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setDivMode('upcoming')}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold transition ${
                divMode === 'upcoming'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              📅 Próximos pagos
            </button>
            <button
              type="button"
              onClick={() => setDivMode('high_yield')}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold transition ${
                divMode === 'high_yield'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              🔥 Mayor Yield (%)
            </button>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              loadSectionData();
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={divSearch}
              onChange={e => setDivSearch(e.target.value)}
              placeholder="Buscar empresa (ej. Iberdrola, Shell, Coca-Cola)..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold"
            >
              Buscar
            </button>
          </form>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              Consultando calendario global de dividendos...
            </div>
          ) : dividends.length === 0 ? (
            <div className="py-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500">
              No se encontraron dividendos próximos confirmados con ese filtro. Prueba con <strong>Mayor Yield (%)</strong> o cambia de mercado.
            </div>
          ) : (
            <div className="space-y-2">
              {dividends.map(item => (
                <div
                  key={`${item.exchange}-${item.ticker}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-950 dark:text-white">
                        {item.ticker}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {item.exchange}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>Ex-Div: <strong className="text-slate-700 dark:text-slate-200">{formatSpanishDate(item.exDateStr)}</strong></span>
                      {item.dividendAmount !== null && item.dividendAmount > 0 && (
                        <span>
                          · Pago: <strong className="text-emerald-600 dark:text-emerald-400">{item.dividendAmount} {item.currency}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-black">
                      {item.yieldPct.toFixed(2)}%
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      {item.price} {item.currency}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 3. MERCADOS EN VIVO ==================== */}
      {activeSection === 'mercados' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
              Conectando con mercados en tiempo real...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {markets.map(m => {
                const isPos = m.changePct >= 0;
                return (
                  <div
                    key={m.symbol}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{m.flag}</span>
                      <span
                        className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg ${
                          isPos
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {m.changePct > 0 ? '+' : ''}
                        {m.changePct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {m.label}
                    </div>
                    <div className="text-sm font-black font-mono text-slate-950 dark:text-white mt-0.5">
                      {m.price.toLocaleString('es-ES')} <span className="text-[10px] font-semibold text-slate-400">{m.currency}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== 4. TENDENCIAS DEL DÍA (TOP MOVERS) ==================== */}
      {activeSection === 'tendencias' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {(
              [
                { id: 'america', label: '🇺🇸 EE.UU.' },
                { id: 'spain', label: '🇪🇸 España' },
                { id: 'europe', label: '🇩🇪 Europa' },
                { id: 'crypto', label: '₿ Cripto' },
              ] as const
            ).map(reg => (
              <button
                key={reg.id}
                type="button"
                onClick={() => setMoverRegion(reg.id)}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  moverRegion === reg.id
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
              Cargando mayores subidas y caídas...
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Mayores Subidas Hoy
                </h2>
                <div className="space-y-1.5">
                  {movers.gainers.map(item => (
                    <div
                      key={item.fullSymbol}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-950 dark:text-white">{item.ticker}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          +{item.changePct.toFixed(2)}%
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {item.price} {item.currency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Mayores Caídas Hoy
                </h2>
                <div className="space-y-1.5">
                  {movers.losers.map(item => (
                    <div
                      key={item.fullSymbol}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-950 dark:text-white">{item.ticker}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                          {item.changePct.toFixed(2)}%
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {item.price} {item.currency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== 5. FESTIVOS BURSÁTILES ==================== */}
      {activeSection === 'festivos' && (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(
              [
                { id: 'ALL', label: '🌍 Todos' },
                { id: 'BME', label: '🇪🇸 España' },
                { id: 'US', label: '🇺🇸 EE.UU.' },
                { id: 'EU', label: '🇪🇺 Europa' },
              ] as const
            ).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHolidayFilter(f.id)}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold transition ${
                  holidayFilter === f.id
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredHolidays.map(h => (
              <div
                key={`${h.date}-${h.name}`}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-black text-slate-950 dark:text-white">{h.name}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
                    {formatSpanishDate(h.date)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mb-2">
                  {h.description}
                </p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-1 flex-wrap">
                    {h.markets.map(m => (
                      <span
                        key={m}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 6. NOTICIAS REALES ==================== */}
      {activeSection === 'noticias' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {(
              [
                { id: 'all', label: '🌐 Todas' },
                { id: 'NVDA', label: 'NVIDIA' },
                { id: 'Oro', label: '🥇 Oro' },
                { id: 'Nasdaq', label: 'Nasdaq' },
                { id: 'Bitcoin', label: '₿ Bitcoin' },
                { id: 'IBEX', label: '🇪🇸 IBEX' },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setNewsTopic(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition ${
                  newsTopic === t.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Cargando noticias financieras reales...
            </div>
          ) : (
            <div className="space-y-2">
              {news.map(item => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.source}</span>
                    <span className="inline-flex items-center gap-1">
                      {item.publishedAt ? item.publishedAt.slice(0, 16) : ''}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 7. FIFO FISCAL (OPTIMIZADOR IRPF ESPAÑA) ==================== */}
      {activeSection === 'fifo' && portfolioState && (
        <FifoFiscalView portfolioState={portfolioState} />
      )}

      {/* Acceso rápido a FIFO Fiscal desde el resto de secciones de Explorar */}
      {activeSection !== 'fifo' && portfolioState && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => handleSelectSection('fifo')}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-slate-900 text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5 text-violet-100" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black tracking-tight truncate">
                  FIFO Fiscal · Optimizador IRPF
                </div>
                <div className="text-[10px] text-violet-100/90 font-medium truncate">
                  Calcula ventas sin impuestos y regla de 2 meses
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-violet-200 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
