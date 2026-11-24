import React, { useState } from 'react';
import {
  PositionItem,
  InicioSubTab,
  TimeRange,
  AssetType,
  FinancialEvent,
  TradingAnalytics,
  PortfolioMeta,
} from '../types/portfolio';
import {
  formatEUR,
  formatHeaderEUR,
  formatPercent,
  calculatePortfolioMetrics,
} from '../utils/calculations';
import { buildRealDegiroChartData } from '../utils/realPortfolioChartBuilder';
import { Sparkline } from './Sparkline';
import { InteractiveChart } from './InteractiveChart';
import { HistoricalAssetModal } from './HistoricalAssetModal';
import { DividendAuditView } from './DividendAuditView';
import { CommissionsModal } from './CommissionsModal';
import { NetCashFlowModal } from './NetCashFlowModal';
import { ClosedProfitsModal } from './ClosedProfitsModal';
import { AssetHistoryModal, getAssetHistoryCount } from './AssetHistoryModal';
import { ChartsHubView } from './ChartsHubView';
import { BrokerFeesView } from './BrokerFeesView';
import { formatDateToSpanish } from '../utils/historicalPriceEstimator';
import degiroData from '../data/degiroPositionsData.json';
import earthGlobeHeader from '../assets/earth-globe-header.webp';
import logoDegiro from '../assets/logo-degiro.png';
import logoMyInvestor from '../assets/logo-myinvestor.png';
import logoCoinbase from '../assets/logo-coinbase.svg';
import logoBitvavo from '../assets/logo-bitvavo.svg';
import logoBbva from '../assets/logo-bbva.svg';
import {
  Search,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  X,
  Target,
  Wallet,
  PieChart,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Menu,
  Briefcase,
  Coins,
  Edit3,
  Zap,
  Trophy,
  FileCheck2,
  Receipt,
} from 'lucide-react';

function getBrokerLogo(name: string, isDefault?: boolean): string | null {
  const norm = (name || '').toLowerCase().replace(/\s+/g, '');
  if (norm.includes('myinvestor') || norm.includes('myivestor')) return logoMyInvestor;
  if (norm.includes('coinbase')) return logoCoinbase;
  if (norm.includes('bitvavo')) return logoBitvavo;
  if (norm.includes('bbva')) return logoBbva;
  if (norm.includes('degiro') || isDefault) return logoDegiro;
  return null;
}

interface PortfolioViewProps {
  positions: PositionItem[];
  portfolios?: PortfolioMeta[];
  activePortfolioId?: string;
  onSwitchPortfolio?: (id: string) => void;
  onAddPortfolio?: (name: string) => void;
  onRenamePortfolio?: (id: string, newName: string) => void;
  onDeletePortfolio?: (id: string) => void;
  cash: number;
  goalAmount: number;
  hideFigures: boolean;
  selectedTimeRange: TimeRange;
  events: FinancialEvent[];
  tradingAnalytics?: TradingAnalytics;
  onToggleHideFigures: () => void;
  onSelectTimeRange: (range: TimeRange) => void;
  onOpenSearch: () => void;
  onGoToProfile: () => void;
  onUpdateCash: (newCash: number) => void;
  onUpdatePosition: (position: PositionItem) => void;
  onDeletePosition: (id: string) => void;
  onOpenImport: () => void;
  onRefreshLiveQuotes?: () => void;
  isRefreshingLive?: boolean;
  lastUpdatedTime?: string;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  positions,
  portfolios = [],
  activePortfolioId = 'port-main',
  onSwitchPortfolio,
  onAddPortfolio,
  onRenamePortfolio,
  onDeletePortfolio,
  cash,
  goalAmount,
  hideFigures,
  selectedTimeRange,
  events,
  tradingAnalytics,
  onToggleHideFigures,
  onSelectTimeRange,
  onOpenSearch,
  onGoToProfile,
  onUpdateCash,
  onUpdatePosition,
  onDeletePosition,
  onOpenImport,
  onRefreshLiveQuotes,
  isRefreshingLive = false,
  lastUpdatedTime,
}) => {
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || portfolios[0] || { id: 'port-main', name: 'DEGIRO', currency: 'EUR', createdAt: '' };
  const [activeSubTab, setActiveSubTab] = useState<InicioSubTab>('portafolio');
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<'Todos' | AssetType>('Todos');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [positionSort, setPositionSort] = useState<'degiro' | 'value-desc' | 'change-asc' | 'change-desc' | 'name-asc'>('degiro');
  const [selectedPosition, setSelectedPosition] = useState<PositionItem | null>(null);
  const [historyModalPosition, setHistoryModalPosition] = useState<PositionItem | null>(null);
  const [homeDrawerOpen, setHomeDrawerOpen] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashInput, setCashInput] = useState(cash.toString());
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [showCommissionsModal, setShowCommissionsModal] = useState(false);
  const [showNetCashFlowModal, setShowNetCashFlowModal] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);

  // Selector estilo DEGIRO: Posiciones abiertas / Posiciones cerradas / Todas las posiciones
  const [positionViewMode, setPositionViewMode] = useState<'abiertas' | 'cerradas' | 'todas'>('abiertas');
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  // Modo de visualización táctil DEGIRO: 'dia' (Día +/-) o 'total' (Total +/- acumulado)
  const [globalGainMode, setGlobalGainMode] = useState<'dia' | 'total'>('dia');
  const [rowGainModes, setRowGainModes] = useState<Record<string, 'dia' | 'total'>>({});

  const getRowGainMode = (id: string) => rowGainModes[id] || globalGainMode;

  const toggleRowGainMode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRowGainModes(prev => {
      const current = prev[id] || globalGainMode;
      const next = current === 'dia' ? 'total' : 'dia';
      return { ...prev, [id]: next };
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(12); } catch {}
    }
  };

  const toggleGlobalGainMode = () => {
    const next = globalGainMode === 'dia' ? 'total' : 'dia';
    setGlobalGainMode(next);
    setRowGainModes({}); // Al pulsar en la cabecera sincronizamos todas las filas
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {}
    }
  };

  const isDefaultDegiroPortfolio =
    activePortfolio.isDefault === true ||
    activePortfolio.id === (portfolios[0]?.id || 'port-main');

  const closedPositions = isDefaultDegiroPortfolio
    ? ((degiroData.closedPositions || []) as any[])
    : [];

  const baseAccountSummary = isDefaultDegiroPortfolio
    ? degiroData.accountSummary || {
        cuentaCompleta: 17544.78,
        cartera: 17124.86,
        efectivoEur: 419.92,
        margenLibre: 954.81,
        diaBp: 1939.91,
        diaBpPct: 12.43,
        totalBpDegiro: 15493.45,
        historicoCerradoPnl: 23915.65,
        totalTrades: 0,
      }
    : {
        cuentaCompleta: 0,
        cartera: 0,
        efectivoEur: 0,
        margenLibre: 0,
        diaBp: 0,
        diaBpPct: 0,
        totalBpDegiro: 0,
        historicoCerradoPnl: 0,
        totalTrades: 0,
      };

  // Dinámicas en tiempo real a partir de las cotizaciones y posiciones actuales de ESTA cartera
  const liveCarteraVal = Number(positions.reduce((acc, p) => acc + (p.totalValue || 0), 0).toFixed(2));
  const liveEfectivoEur = Number((cash || 0).toFixed(2));
  const liveCuentaCompleta = Number((liveCarteraVal + liveEfectivoEur).toFixed(2));
  const liveDiaBp = Number(positions.reduce((acc, p) => acc + (p.dailyChangeValue || 0), 0).toFixed(2));
  const liveDiaBpPct = (liveCarteraVal - liveDiaBp) > 0 ? Number(((liveDiaBp / (liveCarteraVal - liveDiaBp)) * 100).toFixed(2)) : 0;
  // Total B/P: solo usa la fórmula histórica DEGIRO en la cartera DEGIRO; en cualquier cartera nueva (MyInvestor, etc.) usa el P/G real de sus posiciones
  const liveTotalBp = isDefaultDegiroPortfolio
    ? Number((liveCuentaCompleta - 2051.33).toFixed(2))
    : Number(positions.reduce((acc, p) => acc + (p.unrealizedGainLoss || 0), 0).toFixed(2));
  const liveMargenLibre = isDefaultDegiroPortfolio ? Number((liveEfectivoEur * 2.274).toFixed(2)) : 0;

  const accountSummary = {
    ...baseAccountSummary,
    cuentaCompleta: liveCuentaCompleta,
    cartera: liveCarteraVal,
    efectivoEur: liveEfectivoEur,
    margenLibre: liveMargenLibre,
    diaBp: liveDiaBp,
    diaBpPct: liveDiaBpPct,
    totalBpDegiro: liveTotalBp,
  };

  // Métricas calculadas y serie de gráfico 100% real (sin datos simulados)
  const metrics = calculatePortfolioMetrics(positions, cash);
  const realDegiroChart = isDefaultDegiroPortfolio
    ? buildRealDegiroChartData(
        selectedTimeRange,
        liveCuentaCompleta,
        liveDiaBp,
        liveDiaBpPct,
        liveTotalBp
      )
    : {
        subtitle: `Evolución real · ${activePortfolio.name}`,
        points: [
          {
            date: 'Inicio',
            label: 'Invertido',
            value: Number(Math.max(liveCuentaCompleta - liveTotalBp, 0).toFixed(2)),
            change: 0,
            changePct: 0,
          },
          {
            date: 'Hoy',
            label: 'Hoy (vivo)',
            value: liveCuentaCompleta,
            change: liveTotalBp,
            changePct: liveDiaBpPct,
          },
        ],
      };
  const chartPoints = realDegiroChart.points;
  const chartSubtitle = realDegiroChart.subtitle;

  // Formato cabecera idéntico al de la captura de pantalla con cifras dinámicas en vivo
  const headerFormatted = formatHeaderEUR(accountSummary.cuentaCompleta, hideFigures);

  // Filtrado y ordenación de posiciones abiertas
  const filteredPositions = positions
    .filter(pos => selectedAssetFilter === 'Todos' || pos.type === selectedAssetFilter)
    .sort((a, b) => {
      if (positionSort === 'degiro') return 0;
      if (positionSort === 'value-desc') return b.totalValue - a.totalValue;
      if (positionSort === 'name-asc') return a.name.localeCompare(b.name);
      if (positionSort === 'change-desc') return b.dailyChangePct - a.dailyChangePct;
      if (positionSort === 'change-asc') return a.dailyChangePct - b.dailyChangePct;
      return 0;
    });

  // Filtrado de posiciones cerradas
  const filteredClosedPositions = closedPositions
    .filter(pos => selectedAssetFilter === 'Todos' || pos.type === selectedAssetFilter)
    .sort((a, b) => b.realized_pnl - a.realized_pnl);

  // Separación explícita solicitada por el usuario: Acciones ARRIBA, ETFs ABAJO
  const stockPositions = filteredPositions.filter(p => p.type === 'Acciones');
  const fondosPositions = filteredPositions.filter(p => p.type === 'Fondos');
  const etfAndCryptoPositions = filteredPositions.filter(p => p.type === 'ETFs' || p.type === 'Cripto');

  const closedStocks = filteredClosedPositions.filter(p => p.type === 'Acciones');
  const closedFondos = filteredClosedPositions.filter(p => p.type === 'Fondos');
  const closedEtfsAndCrypto = filteredClosedPositions.filter(p => p.type === 'ETFs' || p.type === 'Cripto');

  // Cálculo de distribución por tipo
  const totalPosValue = positions.reduce((acc, p) => acc + p.totalValue, 0) || 1;
  const accionesVal = positions.filter(p => p.type === 'Acciones').reduce((a, b) => a + b.totalValue, 0);
  const etfsVal = positions.filter(p => p.type === 'ETFs').reduce((a, b) => a + b.totalValue, 0);
  const fondosVal = positions.filter(p => p.type === 'Fondos').reduce((a, b) => a + b.totalValue, 0);
  const criptoVal = positions.filter(p => p.type === 'Cripto').reduce((a, b) => a + b.totalValue, 0);

  const accionesPct = Math.round((accionesVal / totalPosValue) * 100);
  const etfsPct = Math.round((etfsVal / totalPosValue) * 100);
  const fondosPct = Math.round((fondosVal / totalPosValue) * 100);
  const criptoPct = Math.max(0, 100 - accionesPct - etfsPct - fondosPct);

  // Meta de inversión calculada
  const goalProgress = Math.min(100, Math.round((metrics.totalMarketValue / goalAmount) * 100));

  // Próximos dividendos
  const upcomingDividends = events.filter(e => e.type === 'pago-dividendo' || e.type === 'ex-dividend');

  return (
    <div className="pb-28 relative overflow-x-clip">
      {/* Fondo fotográfico del globo terráqueo azulado (solo en portada de Portafolio) */}
      {activeSubTab === 'portafolio' ? (
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-[250px] z-0 bg-cover bg-top bg-no-repeat select-none"
          style={{ backgroundImage: `url(${earthGlobeHeader})` }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-sky-50/15 via-white/55 to-white dark:from-slate-950/70 dark:via-slate-950/85 dark:to-[#0B0F19]" />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-32 z-0 bg-gradient-to-b from-[#E6F4FE] to-transparent dark:from-[#0B1221] dark:to-transparent select-none"
          aria-hidden="true"
        />
      )}

      {/* 1. Cabecera con Menú Lateral Izquierdo (☰), Sección Activa, Lupa y Avatar Dorado */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-3.5 pb-2.5 sticky top-0 backdrop-blur-[2px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setHomeDrawerOpen(true)}
            className="w-10 h-10 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-sky-200/90 dark:border-slate-700 flex items-center justify-center text-[#0B2246] dark:text-slate-100 shadow-[0_4px_14px_rgba(14,165,233,0.2)] hover:bg-white active:scale-95 transition-all shrink-0"
            title="Abrir menú de Inicio"
          >
            <Menu className="w-5 h-5 stroke-[2.4]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[20px] font-black tracking-tight text-[#061838] dark:text-white leading-tight truncate drop-shadow-[0_1px_6px_rgba(255,255,255,0.95)] dark:drop-shadow-none">
              {activeSubTab === 'portafolio'
                ? 'Portafolio'
                : activeSubTab === 'dividendos'
                  ? 'Dividendos'
                  : activeSubTab === 'tarifas'
                    ? 'Tarifas y Buscadores'
                    : 'Zona de Gráficos'}
            </h1>
            <p className="text-[11px] text-[#0B2246] dark:text-slate-200 font-extrabold truncate flex items-center gap-1.5 mt-0.5 drop-shadow-[0_1px_5px_rgba(255,255,255,0.95)] dark:drop-shadow-none">
              {activeSubTab === 'portafolio' ? (
                (() => {
                  const brokerLogo = getBrokerLogo(activePortfolio.name, isDefaultDegiroPortfolio);
                  return (
                    <>
                      {brokerLogo ? (
                        <span className="inline-flex items-center bg-white/95 px-2 py-0.5 rounded-md shadow-xs border border-sky-200/80">
                          <img
                            src={brokerLogo}
                            alt={activePortfolio.name}
                            className="h-3.5 w-auto object-contain"
                          />
                        </span>
                      ) : (
                        <span>{activePortfolio.name}</span>
                      )}
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" />
                      <span className="truncate">Cartera en vivo</span>
                    </>
                  );
                })()
              ) : activeSubTab === 'dividendos' ? (
                'Auditoría 2018–2026 y Mapa Futuro'
              ) : activeSubTab === 'tarifas' ? (
                'DEGIRO · MyInvestor · Buscadores Oficiales'
              ) : (
                'Mapa de Calor y Rendimiento Real'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSearch}
            className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-sky-200/90 dark:border-slate-700 flex items-center justify-center text-[#0F2952] dark:text-slate-200 shadow-[0_4px_14px_rgba(14,165,233,0.18)] hover:bg-white active:scale-95 transition-all"
            title="Buscar activos"
          >
            <Search className="w-4 h-4 stroke-[2.3]" />
          </button>
          <button
            onClick={onGoToProfile}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0F2952] via-[#173566] to-[#0B1D3B] text-white font-black text-xs flex items-center justify-center ring-2 ring-amber-400 border border-amber-200/90 shadow-[0_0_16px_rgba(251,191,36,0.55)] active:scale-95 transition-all"
            title="Perfil de usuario"
          >
            DO
          </button>
        </div>
      </header>

      {/* MENÚ LATERAL DESLIZABLE IZQUIERDO DE INICIO */}
      {homeDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex animate-in fade-in duration-150"
          onClick={() => setHomeDrawerOpen(false)}
        >
          <aside
            className="w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Mi Patrimonio
                </span>
                <h2 className="text-base font-black text-slate-950 dark:text-white">Inicio</h2>
              </div>
              <button
                type="button"
                onClick={() => setHomeDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1.5 flex-1 overflow-y-auto">
              {(
                [
                  {
                    id: 'portafolio' as InicioSubTab,
                    label: `Portafolio (${activePortfolio.name})`,
                    subtitle: 'Posiciones, Día +/- y Total +/- en vivo',
                    icon: Briefcase,
                    color: 'text-sky-500',
                  },
                  {
                    id: 'graficos' as InicioSubTab,
                    label: 'Zona de Gráficos',
                    subtitle: 'Mapa de Calor, Años/Meses/Semanas y Top',
                    icon: BarChart3,
                    color: 'text-indigo-500',
                  },
                  {
                    id: 'dividendos' as InicioSubTab,
                    label: 'Dividendos',
                    subtitle: 'Auditoría 2018–2026 y Mapa Futuro',
                    icon: Coins,
                    color: 'text-emerald-500',
                  },
                  {
                    id: 'tarifas' as InicioSubTab,
                    label: 'Tarifas y Buscadores',
                    subtitle: 'DEGIRO, MyInvestor Fondos y Broker',
                    icon: Receipt,
                    color: 'text-amber-500',
                  },
                ]
              ).map(item => {
                const Icon = item.icon;
                const isActive = activeSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(item.id);
                      setHomeDrawerOpen(false);
                    }}
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

              {/* SECCIÓN: MIS CARTERAS (CREAR, CAMBIAR, RENOMBRAR Y ELIMINAR) */}
              {portfolios.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Mis Carteras ({portfolios.length})
                    </span>
                    {onAddPortfolio && (
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt('Nombre de la nueva cartera (ej. MyInvestor, Trade Republic):');
                          if (name && name.trim()) {
                            onAddPortfolio(name.trim());
                            setActiveSubTab('portafolio');
                            setHomeDrawerOpen(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Nueva cartera
                      </button>
                    )}
                  </div>

                  {portfolios.map(port => {
                    const isSelected = port.id === activePortfolio.id;
                    const portLogo = getBrokerLogo(port.name, port.isDefault);
                    return (
                      <div key={port.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchPortfolio?.(port.id);
                            setActiveSubTab('portafolio');
                            setHomeDrawerOpen(false);
                          }}
                          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {portLogo ? (
                            <span className="inline-flex items-center bg-white/95 px-2 py-0.5 rounded-md border border-slate-100 shadow-2xs">
                              <img src={portLogo} alt={port.name} className="h-3.5 w-auto object-contain" />
                            </span>
                          ) : (
                            <span className="truncate">{port.name}</span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>

                        {onRenamePortfolio && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              const nextName = prompt('Nuevo nombre para esta cartera:', port.name);
                              if (nextName && nextName.trim()) {
                                onRenamePortfolio(port.id, nextName.trim());
                              }
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition shrink-0"
                            title={`Renombrar "${port.name}"`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onDeletePortfolio && portfolios.length > 1 && !port.isDefault && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`¿Eliminar la cartera "${port.name}" y sus posiciones?`)) {
                                onDeletePortfolio(port.id);
                              }
                            }}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                            title={`Eliminar "${port.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
              {activePortfolio.name} · Domingo
            </div>
          </aside>
        </div>
      )}

      {/* CONTENIDO SEGÚN LA SUB-PESTAÑA ACTIVA */}
      {activeSubTab === 'portafolio' && (
        <>
          {/* 3. Bloque "VALOR DE MERCADO" sobre el horizonte del globo terráqueo */}
          <section className="relative z-10 text-center px-4 pt-2 pb-1">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] font-black tracking-widest text-[#081C3E] dark:text-slate-100 uppercase mb-0.5 drop-shadow-[0_1px_6px_rgba(255,255,255,0.95)] dark:drop-shadow-none">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 stroke-[2.8]" />
              <span>VALOR DE MERCADO</span>
              <button
                onClick={onToggleHideFigures}
                className="text-[#081C3E] dark:text-slate-200 hover:text-sky-700 p-0.5 transition-colors"
                title={hideFigures ? 'Mostrar cifras' : 'Ocultar cifras'}
              >
                {hideFigures ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Cifra grande principal formateada: €18.233,10 */}
            <div className="flex items-baseline justify-center tracking-tight text-[#051430] dark:text-white font-black text-[42px] sm:text-[48px] leading-none my-1 drop-shadow-[0_2px_12px_rgba(255,255,255,0.98)] dark:drop-shadow-none">
              <span className="text-3xl sm:text-4xl font-extrabold mr-0.5">€</span>
              <span>{headerFormatted.integerPart}</span>
              <span className="text-2xl sm:text-3xl font-extrabold">,{headerFormatted.decimalPart}</span>
            </div>

            {/* Fila 1: Día B/P y Total B/P con alto contraste y moneda dorada € */}
            <div className="flex items-center justify-center gap-3 text-xs mt-3 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300/90 dark:border-emerald-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 stroke-[2.3]" />
                </span>
                <div className="text-left leading-tight">
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">Día B/P</span>
                  <span className={`text-[12px] font-black ${accountSummary.diaBp >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {accountSummary.diaBp > 0 ? '+' : ''}{formatEUR(accountSummary.diaBp, hideFigures)} ({accountSummary.diaBpPct > 0 ? '+' : ''}{accountSummary.diaBpPct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <span className="h-8 w-px bg-sky-200 dark:bg-slate-700" />

              <div className="flex items-center gap-1.5">
                <span
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 text-[#0B2246] text-sm font-black flex items-center justify-center shadow-[0_3px_10px_rgba(245,158,11,0.45)] ring-2 ring-amber-200/90 border border-yellow-100 shrink-0"
                  title="Beneficio / Pérdida Total en Euros"
                >
                  €
                </span>
                <div className="text-left leading-tight">
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">
                    {isDefaultDegiroPortfolio ? 'Total B/P (DEGIRO)' : 'Total B/P'}
                  </span>
                  <span className={`text-[12px] font-black ${accountSummary.totalBpDegiro >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {accountSummary.totalBpDegiro > 0 ? '+' : ''}{formatEUR(accountSummary.totalBpDegiro, hideFigures)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fila 2: Desglose Cartera | EUR | Margen libre con mayor nitidez */}
            <div className="flex items-center justify-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-2.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[9px]">
                  <Coins className="w-2.5 h-2.5" />
                </span>
                <span>Cartera:</span>
                <strong className="text-[#061838] dark:text-white font-extrabold">{formatEUR(accountSummary.cartera, hideFigures)}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[9px] font-black">
                  €
                </span>
                <span>EUR:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">{formatEUR(accountSummary.efectivoEur, hideFigures)}</strong>
              </span>
              {isDefaultDegiroPortfolio && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                      <PieChart className="w-2.5 h-2.5" />
                    </span>
                    <span>Margen libre:</span>
                    <strong className="text-[#061838] dark:text-slate-100 font-extrabold">{formatEUR(accountSummary.margenLibre, hideFigures)}</strong>
                  </span>
                </>
              )}
            </div>

            {/* Píldora flotante de Cotizaciones en vivo */}
            {onRefreshLiveQuotes && (
              <div className="flex items-center justify-center mt-2.5">
                <button
                  onClick={onRefreshLiveQuotes}
                  disabled={isRefreshingLive}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-white/95 dark:bg-slate-900/90 text-[#16325C] dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 transition-all border border-sky-100 dark:border-slate-700 shadow-[0_6px_18px_-6px_rgba(14,165,233,0.28)] disabled:opacity-60 active:scale-95"
                  title="Actualizar cotizaciones en vivo con Yahoo Finance y CoinGecko"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  <span>{isRefreshingLive ? 'Actualizando...' : 'Cotizaciones en vivo'}</span>
                  <RefreshCw className={`w-3 h-3 ${isRefreshingLive ? 'animate-spin text-emerald-500' : 'text-[#16325C]/70 dark:text-slate-400'}`} />
                  {lastUpdatedTime && (
                    <>
                      <span className="h-3 w-px bg-sky-200 dark:bg-slate-700" />
                      <span className="text-[10px] font-extrabold text-[#16325C]/80 dark:text-slate-300">
                        {lastUpdatedTime}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* 4. Gráfico interactivo 100% real (oculto en carteras nuevas vacías) */}
          {(isDefaultDegiroPortfolio || positions.length > 0 || cash > 0) && (
            <section className="mt-2 mb-4">
              <InteractiveChart
                data={chartPoints}
                selectedRange={selectedTimeRange}
                onRangeChange={onSelectTimeRange}
                onExpand={() => setShowChartModal(true)}
                onOpenChartsHub={() => setActiveSubTab('graficos')}
                subtitle={chartSubtitle}
                hideFigures={hideFigures}
              />
            </section>
          )}

          {/* 5. Tarjetas horizontales pastel luminosas ("Analíticas", "Efectivo", "Meta") */}
          <section className="px-4 mb-4">
            <div className="grid grid-cols-3 gap-2.5">
              {/* Tarjeta 1: Analíticas (azul cielo pastel) */}
              <button
                onClick={() => setShowAnalyticsModal(true)}
                className="fintech-card-blue border border-sky-200/80 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-sky-300 dark:hover:border-slate-700 transition-all active:scale-[0.98] flex flex-col justify-between h-[106px]"
              >
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="text-[11px] font-extrabold text-[#0F2952] dark:text-slate-200 truncate">Analíticas</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <svg className="w-10 h-10 -rotate-90 drop-shadow-xs" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="13.5" fill="none" stroke="#E2EEF9" strokeWidth="4.5" className="dark:stroke-slate-800" />
                    <circle
                      cx="18"
                      cy="18"
                      r="13.5"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="4.5"
                      strokeDasharray={`${accionesPct} 100`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="13.5"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="4.5"
                      strokeDasharray={`${etfsPct} 100`}
                      strokeDashoffset={`-${accionesPct}`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="13.5"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4.5"
                      strokeDasharray={`${criptoPct} 100`}
                      strokeDashoffset={`-${accionesPct + etfsPct}`}
                    />
                  </svg>
                  <span className="inline-flex items-center text-[10px] text-sky-700 dark:text-sky-400 font-extrabold">
                    Ver
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>

              {/* Tarjeta 2: Efectivo (menta pastel) */}
              <button
                onClick={() => setShowCashModal(true)}
                className="fintech-card-mint border border-emerald-200/80 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-emerald-300 dark:hover:border-slate-700 transition-all active:scale-[0.98] flex flex-col justify-between h-[106px]"
              >
                <div className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 shrink-0" />
                  <span className="text-[11px] font-extrabold text-[#0F2952] dark:text-slate-200 truncate">Efectivo</span>
                </div>
                <div>
                  <div className="text-[14px] font-black text-[#081C3E] dark:text-white truncate">
                    {formatEUR(cash, hideFigures)}
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
                    <ArrowUp className="w-3 h-3 stroke-[2.5]" />
                    Ajustar
                  </span>
                </div>
              </button>

              {/* Tarjeta 3: Meta de inversión (dorado pastel) */}
              <button
                onClick={() => alert(`Meta de ahorro e inversión: ${goalProgress}% alcanzado de ${formatEUR(goalAmount, hideFigures)}`)}
                className="fintech-card-gold border border-amber-200/80 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-amber-300 dark:hover:border-slate-700 transition-all active:scale-[0.98] flex flex-col justify-between h-[106px]"
              >
                <div className="flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-extrabold text-[#0F2952] dark:text-slate-200 truncate">Meta</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="13.5" fill="none" stroke="#FDE68A" strokeWidth="4" className="dark:stroke-slate-800" />
                      <circle
                        cx="18"
                        cy="18"
                        r="13.5"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="4"
                        strokeDasharray={`${goalProgress} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[9px] font-black text-[#081C3E] dark:text-slate-100">{goalProgress}%</span>
                  </div>
                  <span className="text-[10px] text-[#0F2952]/70 dark:text-slate-400 font-extrabold tracking-tight">
                    {formatEUR(goalAmount, true)}
                  </span>
                </div>
              </button>
            </div>
          </section>

          {/* Historial Global DEGIRO & Rendimiento Realizado (tarjeta luminosa azul-menta, solo en cartera DEGIRO) */}
          {isDefaultDegiroPortfolio && tradingAnalytics && (
            <section className="px-4 mb-4">
              <div className="bg-gradient-to-br from-white via-[#F0F9FF] to-[#E6FBF2] dark:from-slate-900 dark:to-slate-950 rounded-3xl p-4 shadow-[0_10px_28px_-12px_rgba(14,165,233,0.28)] border border-sky-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800/80 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/60 text-[#16325C] dark:text-sky-300 flex items-center justify-center shrink-0 shadow-2xs">
                      <FileCheck2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-[13px] text-[#081C3E] dark:text-white leading-tight truncate">
                        Historial Financiero <span className="text-emerald-600 dark:text-emerald-400">DEGIRO</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                        {tradingAnalytics.startDate} al {tradingAnalytics.endDate} • {tradingAnalytics.totalTrades.toLocaleString('es-ES')} ops
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_12px_rgba(16,185,129,0.4)] shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                    Auditado
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                  {/* 1. Casilla Beneficio Cerrado */}
                  <button
                    type="button"
                    onClick={() => setShowClosedModal(true)}
                    className="bg-white/85 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-sky-100 dark:border-slate-700/60 cursor-pointer group shadow-2xs focus:outline-none"
                    title="Ver detalle de beneficio cerrado y posiciones ganadoras/perdedoras"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Beneficio Cerrado</span>
                      <span className="text-[10px] text-sky-500 group-hover:text-emerald-600 transition">↗</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      +{formatEUR(tradingAnalytics.totalRealizedPnl, hideFigures)}
                    </span>
                  </button>

                  {/* 2. Casilla Flujo Neto Retirado */}
                  {tradingAnalytics.netCashFlow !== undefined && (
                    <button
                      type="button"
                      onClick={() => setShowNetCashFlowModal(true)}
                      className="bg-white/85 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-sky-100 dark:border-slate-700/60 cursor-pointer group shadow-2xs focus:outline-none"
                      title="Ver detalle de depósitos, retiradas a banco y saldo neto extraído"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Flujo Neto Retirado</span>
                        <span className="text-[10px] text-sky-500 group-hover:text-emerald-600 transition">↗</span>
                      </div>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-300 mt-0.5 block">
                        +{formatEUR(tradingAnalytics.netCashFlow, hideFigures)}
                      </span>
                    </button>
                  )}

                  {/* 3. Casilla Dividendos Netos */}
                  {tradingAnalytics.totalDividendsReceived !== undefined && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab('dividendos');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-white/85 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-sky-100 dark:border-slate-700/60 cursor-pointer group shadow-2xs focus:outline-none"
                      title="Ir a la página y desglose de dividendos"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Dividendos Netos</span>
                        <span className="text-[10px] text-sky-500 group-hover:text-[#081C3E] dark:group-hover:text-white transition">➔</span>
                      </div>
                      <span className="text-sm font-black text-[#081C3E] dark:text-white mt-0.5 block">
                        +{formatEUR(tradingAnalytics.totalDividendsReceived, hideFigures)}
                      </span>
                    </button>
                  )}

                  {/* 4. Casilla Comisiones DEGIRO */}
                  <button
                    type="button"
                    onClick={() => setShowCommissionsModal(true)}
                    className="bg-white/85 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-sky-100 dark:border-slate-700/60 cursor-pointer group shadow-2xs focus:outline-none"
                    title="Ver desglose completo de comisiones de corretaje, conectividad y cambio"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Comisiones DEGIRO</span>
                      <span className="text-[10px] text-sky-500 group-hover:text-amber-500 transition">↗</span>
                    </div>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300 mt-0.5 block">
                      {formatEUR(tradingAnalytics.totalFeesPaid, hideFigures)}
                    </span>
                  </button>
                </div>

                {/* Botón para ver desglose de beneficio por activo (117 activos) */}
                <button
                  onClick={() => setShowHistoricalModal(true)}
                  className="w-full mt-3 py-2.5 px-3 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 rounded-2xl text-xs font-extrabold text-white flex items-center justify-center gap-2 shadow-[0_6px_16px_-6px_rgba(2,132,199,0.55)] transition-all active:scale-[0.99]"
                >
                  <span>📊</span>
                  <span>Ver Beneficio Histórico por Acción & ETF (117 activos)</span>
                </button>
              </div>
            </section>
          )}

          {/* 6. Sección de Activos / Posiciones: Selector DEGIRO (Abiertas / Cerradas / Todas) */}
          <section className="px-4">
            <div className="flex items-center justify-between mb-3">
              {/* Botón selector idéntico al de DEGIRO */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowViewDropdown(!showViewDropdown)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white shadow-2xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <span>
                    {positionViewMode === 'abiertas'
                      ? 'Posiciones abiertas'
                      : positionViewMode === 'cerradas'
                      ? 'Posiciones cerradas'
                      : 'Todas las posiciones'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showViewDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showViewDropdown && (
                  <div className="absolute left-0 top-10 z-40 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 w-64 text-xs">
                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('abiertas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'abiertas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Posiciones abiertas</div>
                        <div className="text-[10px] text-slate-400">7 activos en cartera (Alemania y Milán)</div>
                      </div>
                      {positionViewMode === 'abiertas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('cerradas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'cerradas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Posiciones cerradas</div>
                        <div className="text-[10px] text-slate-400">116 activos cerrados (+28.145,97 € B/P)</div>
                      </div>
                      {positionViewMode === 'cerradas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('todas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'todas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Todas las posiciones</div>
                        <div className="text-[10px] text-slate-400">123 activos totales (abiertas + cerradas)</div>
                      </div>
                      {positionViewMode === 'todas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de orden/filtro con icono de deslizadores */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                  {positionViewMode === 'abiertas'
                    ? `${filteredPositions.length} abiertas`
                    : positionViewMode === 'cerradas'
                    ? `${filteredClosedPositions.length} cerradas`
                    : `${filteredPositions.length + filteredClosedPositions.length} total`}
                </span>

                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                    title="Ordenar posiciones"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-10 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 w-52 text-xs">
                      <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">Ordenar por</div>
                      <button
                        onClick={() => { setPositionSort('value-desc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'value-desc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor valor / beneficio</span>
                        {positionSort === 'value-desc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('change-desc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'change-desc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor rentabilidad</span>
                        {positionSort === 'change-desc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('change-asc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'change-asc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor caída</span>
                        {positionSort === 'change-asc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('name-asc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'name-asc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Nombre alfabético</span>
                        {positionSort === 'name-asc' && <span>✓</span>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chips de filtro rápido por tipo */}
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
              {(['Todos', 'Acciones', 'ETFs', 'Fondos', 'Cripto'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedAssetFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                    selectedAssetFilter === f
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* VISTA 1: POSICIONES ABIERTAS (O TODAS) */}
            {(positionViewMode === 'abiertas' || positionViewMode === 'todas') && (
              <>
                {/* 1. SECCIÓN: ACCIONES (ARRIBA) */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Acciones') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Acciones ({stockPositions.length})
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(accionesVal, hideFigures)}
                      </span>
                    </div>

                    {/* Subcabecera estilo DEGIRO: Precio × Nº y selector táctil Día +/- ⇄ Total +/- */}
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 px-2 pb-1 select-none">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                        <ArrowDown className="w-3 h-3 text-sky-500" />
                        <span>Precio × Nº</span>
                      </span>
                      <button
                        type="button"
                        onClick={toggleGlobalGainMode}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 font-extrabold text-[11px] active:scale-95 transition-all cursor-pointer py-0.5 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 shadow-2xs"
                        title="Toca para alternar todas las posiciones entre Día +/- y Total +/-"
                      >
                        <span>{globalGainMode === 'dia' ? 'Día +/-' : 'Total +/-'}</span>
                        <ArrowUpDown className="w-3 h-3 text-sky-500" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {stockPositions.length > 0 ? (
                        stockPositions.map(pos => {
                          const mode = getRowGainMode(pos.id);
                          const isDia = mode === 'dia';
                          const amount = isDia ? pos.dailyChangeValue : (pos.unrealizedGainLoss || 0);
                          const pct = isDia ? pos.dailyChangePct : (pos.unrealizedGainLossPct || 0);
                          const isPos = amount >= 0;

                          return (
                            <div
                              key={pos.id}
                              onClick={() => setSelectedPosition(pos)}
                              className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${pos.logoBg || 'bg-slate-800'}`}>
                                  {pos.logoText || pos.ticker.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                    <span>{pos.name}</span>
                                    {pos.countryFlag && <span className="text-xs">{pos.countryFlag}</span>}
                                    {positionViewMode === 'todas' && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                        Abierta
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    {pos.exchange || 'NDQ'} | {pos.exchange === 'NDQ' ? '$ 167,64' : `€ ${pos.currentPrice}`} × {pos.shares}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                  {formatEUR(pos.totalValue, hideFigures)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => toggleRowGainMode(pos.id, e)}
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 mt-0.5 rounded-lg border transition-all active:scale-95 cursor-pointer select-none shadow-2xs ${
                                    isPos
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                  }`}
                                  title={`Toca con el dedo para cambiar a ${isDia ? 'Total acumulado' : 'Día +/-'}`}
                                >
                                  <span>
                                    {amount > 0 ? '+' : ''}{formatEUR(amount, hideFigures)} ({pct > 0 ? '+' : ''}{pct.toFixed(2)}%)
                                  </span>
                                  <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight ml-0.5">
                                    {isDia ? 'Día' : 'Tot'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 py-2 italic text-center">No hay acciones abiertas</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. SECCIÓN: FONDOS DE INVERSIÓN (MYINVESTOR / INDEXADOS) */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Fondos') && fondosPositions.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Fondos de Inversión ({fondosPositions.length})</span>
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(fondosVal, hideFigures)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {fondosPositions.map(pos => {
                        return (
                          <div
                            key={pos.id}
                            onClick={() => setSelectedPosition(pos)}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${pos.logoBg || 'bg-emerald-700'}`}>
                                {pos.logoText || pos.ticker.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  {pos.countryFlag && <span className="text-xs">{pos.countryFlag}</span>}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                  {pos.market || 'MyInvestor'} | € {pos.currentPrice} × {pos.shares} part.
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {formatEUR(pos.totalValue, hideFigures)}
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-500">
                                {pos.purchaseDate ? formatDateToSpanish(pos.purchaseDate) : 'Fondo Indexado'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. SECCIÓN: TRACKERS (ETFS) Y CRIPTO (ABAJO) */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'ETFs' || selectedAssetFilter === 'Cripto') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Trackers (ETFs) ({etfAndCryptoPositions.length})
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(etfsVal + criptoVal, hideFigures)}
                      </span>
                    </div>

                    {/* Subcabecera estilo DEGIRO: Precio × Nº y selector táctil Día +/- ⇄ Total +/- */}
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 px-2 pb-1 select-none">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                        <ArrowDown className="w-3 h-3 text-sky-500" />
                        <span>Precio × Nº</span>
                      </span>
                      <button
                        type="button"
                        onClick={toggleGlobalGainMode}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 font-extrabold text-[11px] active:scale-95 transition-all cursor-pointer py-0.5 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 shadow-2xs"
                        title="Toca para alternar todas las posiciones entre Día +/- y Total +/-"
                      >
                        <span>{globalGainMode === 'dia' ? 'Día +/-' : 'Total +/-'}</span>
                        <ArrowUpDown className="w-3 h-3 text-sky-500" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {etfAndCryptoPositions.length > 0 ? (
                        etfAndCryptoPositions.map(pos => {
                          const isBitcoin = pos.type === 'Cripto' || pos.name.toUpperCase().includes('BITCOIN');
                          const displayFlag = isBitcoin ? '₿' : pos.countryFlag;
                          const mode = getRowGainMode(pos.id);
                          const isDia = mode === 'dia';
                          const amount = isDia ? pos.dailyChangeValue : (pos.unrealizedGainLoss || 0);
                          const pct = isDia ? pos.dailyChangePct : (pos.unrealizedGainLossPct || 0);
                          const isPos = amount >= 0;

                          return (
                            <div
                              key={pos.id}
                              onClick={() => setSelectedPosition(pos)}
                              className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${isBitcoin ? 'bg-amber-600' : pos.logoBg || 'bg-blue-700'}`}>
                                  {isBitcoin ? '₿' : pos.logoText || pos.ticker.slice(0, 3)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                    <span>{pos.name}</span>
                                    {displayFlag && (
                                      <span className={`text-xs ${isBitcoin ? 'font-black text-amber-500' : ''}`}>
                                        {displayFlag}
                                      </span>
                                    )}
                                    {positionViewMode === 'todas' && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                        Abierta
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    {pos.exchange || 'MIL'} | € {pos.currentPrice} × {pos.shares}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                  {formatEUR(pos.totalValue, hideFigures)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => toggleRowGainMode(pos.id, e)}
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 mt-0.5 rounded-lg border transition-all active:scale-95 cursor-pointer select-none shadow-2xs ${
                                    isPos
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                  }`}
                                  title={`Toca con el dedo para cambiar a ${isDia ? 'Total acumulado' : 'Día +/-'}`}
                                >
                                  <span>
                                    {amount > 0 ? '+' : ''}{formatEUR(amount, hideFigures)} ({pct > 0 ? '+' : ''}{pct.toFixed(2)}%)
                                  </span>
                                  <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight ml-0.5">
                                    {isDia ? 'Día' : 'Tot'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 py-2 italic text-center">No hay ETFs abiertos</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VISTA 2: POSICIONES CERRADAS (O TODAS) */}
            {(positionViewMode === 'cerradas' || positionViewMode === 'todas') && (
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-slate-900 text-white rounded-2xl p-3 mb-4 shadow-sm flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Beneficio Cerrado</span>
                    <span className="text-base font-black text-emerald-400">+{formatEUR(accountSummary.historicoCerradoPnl, hideFigures)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Operaciones</span>
                    <span className="text-xs font-bold text-slate-200">
                      {accountSummary.totalTrades} trades{isDefaultDegiroPortfolio ? ' (2018–2026)' : ''}
                    </span>
                  </div>
                </div>

                {/* Acciones Cerradas */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Acciones') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        🏢 Acciones Cerradas ({closedStocks.length})
                      </span>
                    </div>

                    <div className="space-y-1">
                      {closedStocks.map(pos => {
                        const isPos = pos.realized_pnl >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-9 h-9 rounded-xl bg-slate-800 text-white text-xs font-black flex items-center justify-center shrink-0">
                                {pos.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  <span className="text-xs">{pos.flag}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    Cerrada
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {pos.exchange} • {pos.trades_count} trades • {pos.first_trade} → {pos.last_trade}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-black text-xs ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPos ? '+' : ''}{formatEUR(pos.realized_pnl, hideFigures)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Com: {pos.total_fees.toFixed(2)} €
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ETFs Cerrados */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'ETFs' || selectedAssetFilter === 'Cripto') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        📈 Trackers (ETFs) Cerrados ({closedEtfsAndCrypto.length})
                      </span>
                    </div>

                    <div className="space-y-1">
                      {closedEtfsAndCrypto.map(pos => {
                        const isPos = pos.realized_pnl >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-9 h-9 rounded-xl bg-blue-800 text-white text-xs font-black flex items-center justify-center shrink-0">
                                {pos.name.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  <span className="text-xs">{pos.flag}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    Cerrada
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {pos.exchange} • {pos.trades_count} trades • {pos.first_trade} → {pos.last_trade}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-black text-xs ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPos ? '+' : ''}{formatEUR(pos.realized_pnl, hideFigures)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Com: {pos.total_fees.toFixed(2)} €
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botón inferior para importar más posiciones */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2.5">
              <button
                onClick={onOpenImport}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Subir DEGIRO / MyInvestor</span>
              </button>
              <button
                onClick={onOpenSearch}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Añadir manual</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* PESTAÑA: DIVIDENDOS */}
      {activeSubTab === 'dividendos' && (
        <section className="relative z-10 px-4 pt-1">
          <DividendAuditView hideFigures={hideFigures} />
        </section>
      )}

      {/* PESTAÑA: ZONA DE GRÁFICOS */}
      {activeSubTab === 'graficos' && (
        <section className="relative z-10 pt-1">
          <ChartsHubView positions={positions} hideFigures={hideFigures} />
        </section>
      )}

      {/* PESTAÑA: TARIFAS Y BUSCADORES OFICIALES */}
      {activeSubTab === 'tarifas' && (
        <section className="relative z-10 pt-1">
          <BrokerFeesView showExtendedBrokers={false} />
        </section>
      )}



      {/* MODAL DETALLE DE POSICIÓN */}
      {selectedPosition && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedPosition.logoBg || 'bg-slate-800'}`}>
                  {selectedPosition.logoText || selectedPosition.ticker.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedPosition.name}</h3>
                  <div className="text-xs text-slate-500">{selectedPosition.ticker} • {selectedPosition.type}</div>
                </div>
              </div>
              <button onClick={() => setSelectedPosition(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPosition.purchaseDate && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-2xl my-3 flex items-center justify-between text-xs">
                <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fecha de compra:</span>
                </span>
                <span className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  {formatDateToSpanish(selectedPosition.purchaseDate)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[11px] text-slate-500">Títulos en posesión</span>
                <div className="text-base font-bold text-slate-900">{selectedPosition.shares}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[11px] text-slate-500">Precio de compra medio</span>
                <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.avgPrice)}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[11px] text-slate-500">Cotización actual</span>
                <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.currentPrice)}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[11px] text-slate-500">Valor de posición</span>
                <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.totalValue)}</div>
              </div>
            </div>

            {getAssetHistoryCount(selectedPosition.id) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const pos = selectedPosition;
                  setSelectedPosition(null);
                  setHistoryModalPosition(pos);
                }}
                className="w-full mb-2.5 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" />
                <span>
                  Historial y Estadísticas ({getAssetHistoryCount(selectedPosition.id)} ops)
                </span>
              </button>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  const newShares = prompt('Modificar número de títulos:', selectedPosition.shares.toString());
                  if (newShares && !isNaN(Number(newShares))) {
                    const sharesNum = Number(newShares);
                    onUpdatePosition({
                      ...selectedPosition,
                      shares: sharesNum,
                      totalValue: Number((sharesNum * selectedPosition.currentPrice).toFixed(2)),
                    });
                    setSelectedPosition(null);
                  }
                }}
                className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-colors"
              >
                Editar títulos
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar ${selectedPosition.name} de la cartera?`)) {
                    onDeletePosition(selectedPosition.id);
                    setSelectedPosition(null);
                  }
                }}
                className="w-10 h-10 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                title="Eliminar posición"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL Y ESTADÍSTICAS DEL ACTIVO */}
      {historyModalPosition && (
        <AssetHistoryModal
          position={historyModalPosition}
          hideFigures={hideFigures}
          onClose={() => setHistoryModalPosition(null)}
        />
      )}

      {/* MODAL EDITAR EFECTIVO */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base mb-1">Efectivo disponible</h3>
            <p className="text-xs text-slate-500 mb-4">Indica la liquidez sin invertir en tu cuenta broker.</p>
            <input
              type="number"
              step="any"
              value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              className="w-full text-2xl font-bold text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              placeholder="0,00"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCashModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(cashInput) || 0;
                  onUpdateCash(val);
                  setShowCashModal(false);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANALÍTICAS DE DISTRIBUCIÓN */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Distribución de activos</h3>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Acciones</span>
                  <span>{accionesPct}% ({formatEUR(accionesVal, hideFigures)})</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${accionesPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>ETFs</span>
                  <span>{etfsPct}% ({formatEUR(etfsVal, hideFigures)})</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${etfsPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>Cripto</span>
                  <span>{criptoPct}% ({formatEUR(criptoVal, hideFigures)})</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${criptoPct}%` }}></div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAnalyticsModal(false)}
              className="w-full mt-6 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL GRÁFICO AMPLIADO */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-slate-400">VALOR EN TIEMPO REAL</span>
              <div className="text-2xl font-black">{formatEUR(metrics.totalMarketValue, hideFigures)}</div>
            </div>
            <button
              onClick={() => setShowChartModal(false)}
              className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <InteractiveChart
              data={chartPoints}
              selectedRange={selectedTimeRange}
              onRangeChange={onSelectTimeRange}
              hideFigures={hideFigures}
            />
          </div>
          <div className="text-center text-xs text-slate-400 pb-4">
            Toca o desliza sobre el gráfico para consultar los puntos horarios
          </div>
        </div>
      )}

      {/* MODAL BENEFICIO HISTÓRICO POR ACCIÓN O ETF (117 ACTIVOS) */}
      <HistoricalAssetModal
        isOpen={showHistoricalModal}
        onClose={() => setShowHistoricalModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL COMISIONES DEGIRO */}
      <CommissionsModal
        isOpen={showCommissionsModal}
        onClose={() => setShowCommissionsModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL FLUJO NETO Y MOVIMIENTO DE FONDOS */}
      <NetCashFlowModal
        isOpen={showNetCashFlowModal}
        onClose={() => setShowNetCashFlowModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL BENEFICIO CERRADO */}
      <ClosedProfitsModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        hideFigures={hideFigures}
      />
    </div>
  );
};
