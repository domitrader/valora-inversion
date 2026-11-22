import React, { useState, useEffect, useMemo } from 'react';
import { FinancialEvent, PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import { marketEventsService, LiveMarketNews } from '../services/marketEventsService';
import {
  MARKET_HOLIDAYS_2026_2027,
  MarketHoliday,
  getMarketStatusInfo,
} from '../data/marketHolidays';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Newspaper,
  Sun,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Search,
  Building,
  Flag,
  ChevronRight,
  Info,
} from 'lucide-react';

interface EventsViewProps {
  events: FinancialEvent[];
  positions: PositionItem[];
  hideFigures?: boolean;
}

type EventSection = 'dividendos' | 'festivos' | 'resultados' | 'noticias';

export const EventsView: React.FC<EventsViewProps> = ({
  events: initialEvents,
  positions,
  hideFigures = false,
}) => {
  const [activeSection, setActiveSection] = useState<EventSection>('dividendos');

  // Estado de los mercados (Texto automático)
  const marketStatus = useMemo(() => getMarketStatusInfo(), []);

  // Eventos reales vinculados a la cartera
  const realDividendEvents = useMemo(() => {
    return marketEventsService.getRealDividendEvents(positions);
  }, [positions]);

  const realEarningsEvents = useMemo(() => {
    return marketEventsService.getRealEarningsEvents();
  }, []);

  // Filtro de mercado para Festivos
  const [selectedMarket, setSelectedMarket] = useState<'TODOS' | 'BME' | 'NYSE' | 'NASDAQ' | 'XETRA' | 'MIL'>('TODOS');

  // Noticias en tiempo real
  const [selectedNewsTicker, setSelectedNewsTicker] = useState<string>('NVDA');
  const [newsList, setNewsList] = useState<LiveMarketNews[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [selectedArticle, setSelectedArticle] = useState<LiveMarketNews | null>(null);

  // Cargar noticias al entrar o al cambiar de activo
  useEffect(() => {
    let isMounted = true;
    async function loadNews() {
      setIsLoadingNews(true);
      try {
        const results = await marketEventsService.fetchLiveNews(selectedNewsTicker);
        if (isMounted) {
          setNewsList(results);
        }
      } catch (err) {
        console.warn('Error al cargar noticias:', err);
      } finally {
        if (isMounted) setIsLoadingNews(false);
      }
    }

    if (activeSection === 'noticias') {
      loadNews();
    }

    return () => {
      isMounted = false;
    };
  }, [activeSection, selectedNewsTicker]);

  // Total proyectado de dividendos de los próximos eventos
  const totalProjectedDividends = useMemo(() => {
    return realDividendEvents.reduce((acc, ev) => acc + (ev.estimatedAmount || 0), 0);
  }, [realDividendEvents]);

  // Festivos filtrados
  const filteredHolidays = useMemo(() => {
    return MARKET_HOLIDAYS_2026_2027.filter(h => {
      if (selectedMarket === 'TODOS') return true;
      return h.markets.includes(selectedMarket as any);
    });
  }, [selectedMarket]);

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* 1. Cabecera principal */}
      <header className="flex items-center justify-between pt-1 pb-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Eventos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Cartera real, calendario corporativo y mercados
          </p>
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs">
          <Calendar className="w-5 h-5 text-emerald-600" />
        </div>
      </header>

      {/* 2. Tarjeta de Estado de Mercados (Texto automático) */}
      <div className="mb-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-4 shadow-md border border-slate-700/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                marketStatus.isOpenToday ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {marketStatus.isOpenToday ? 'Mercados Abiertos' : 'Mercados Cerrados'}
            </span>
          </div>

          {marketStatus.nextHoliday && (
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Próximo festivo: en {marketStatus.daysUntilNextHoliday}d
            </span>
          )}
        </div>

        {/* Texto automático dinámico */}
        <p className="text-xs text-slate-200 leading-relaxed font-normal">
          {marketStatus.marketNotice}
        </p>

        {marketStatus.nextHoliday && (
          <div className="mt-3 pt-2.5 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              📅 {marketStatus.nextHoliday.name} ({marketStatus.nextHoliday.date})
            </span>
            <span className="font-semibold text-slate-300">
              {marketStatus.nextHoliday.markets.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* 3. Selector de Secciones / Subpestañas */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setActiveSection('dividendos')}
          className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
            activeSection === 'dividendos'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Dividendos ({realDividendEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('festivos')}
          className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
            activeSection === 'festivos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Festivos Bolsas</span>
        </button>

        <button
          onClick={() => setActiveSection('resultados')}
          className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
            activeSection === 'resultados'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Resultados</span>
        </button>

        <button
          onClick={() => setActiveSection('noticias')}
          className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
            activeSection === 'noticias'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>Noticias en Vivo</span>
        </button>
      </div>

      {/* 4. CONTENIDO SEGÚN SECCIÓN */}

      {/* --- SECCIÓN 1: DIVIDENDOS REALES PROYECTADOS --- */}
      {activeSection === 'dividendos' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Banner resumen de cobros futuros */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Total Proyectado en Cartera
              </span>
              <div className="text-xl font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5">
                +{formatEUR(totalProjectedDividends, hideFigures)}
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                Calculado con tus títulos reales en posesión
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              💰
            </div>
          </div>

          {/* Listado de eventos de dividendos */}
          {realDividendEvents.map(event => {
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        event.logoBg || 'bg-emerald-600'
                      }`}
                    >
                      {event.logoText || event.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {event.assetName}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {event.ticker}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        <span className="capitalize">{formattedDate}</span>
                        {event.time && <span>• {event.time}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {event.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Confirmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Estimado
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                    {event.description}
                  </p>
                </div>

                {event.sharesOwned && (
                  <div className="mt-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
                    <div>
                      <span className="font-medium text-[11px] block">
                        Tus títulos: <strong>{event.sharesOwned} acciones</strong>
                      </span>
                      {event.dividendPerShare && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          Dividendo unitario: {event.dividendPerShare.toFixed(3)} €
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                      +{formatEUR(event.estimatedAmount || 0, hideFigures)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- SECCIÓN 2: FESTIVOS BURSÁTILES (MARKET HOLIDAYS) --- */}
      {activeSection === 'festivos' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Selector de Mercado */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {(['TODOS', 'BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL'] as const).map(market => (
              <button
                key={market}
                onClick={() => setSelectedMarket(market)}
                className={`text-[11px] px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  selectedMarket === market
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {market === 'TODOS'
                  ? 'Todas las bolsas'
                  : market === 'BME'
                  ? '🇪🇸 BME Madrid'
                  : market === 'NYSE' || market === 'NASDAQ'
                  ? '🇺🇸 Wall Street (' + market + ')'
                  : market === 'XETRA'
                  ? '🇩🇪 XETRA (Alemania)'
                  : '🇮🇹 Borsa Italiana'}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredHolidays.map((holiday, idx) => {
              const hDate = new Date(holiday.date + 'T00:00:00');
              const formattedDate = hDate.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const isPast = holiday.date < new Date().toISOString().split('T')[0];

              return (
                <div
                  key={`${holiday.date}-${idx}`}
                  className={`border rounded-2xl p-3.5 transition-all ${
                    isPast
                      ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {holiday.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            holiday.status.includes('temprano')
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {holiday.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5 font-medium">
                        {formattedDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {holiday.markets.map(m => (
                        <span
                          key={m}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {holiday.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- SECCIÓN 3: RESULTADOS CORPORATIVOS (EARNINGS) --- */}
      {activeSection === 'resultados' && (
        <div className="space-y-3 animate-fadeIn">
          {realEarningsEvents.map(event => {
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        event.logoBg || 'bg-blue-600'
                      }`}
                    >
                      {event.logoText || event.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {event.assetName}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {event.ticker}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        <span className="capitalize">{formattedDate}</span> • {event.time}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {event.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Confirmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Previsto
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                    {event.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">BPA Estimado (EPS)</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        ${event.estimatedEarningsPerShare?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Ingresos Previstos</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {event.revenueEstimate || 'N/D'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- SECCIÓN 4: NOTICIAS FINANCIERAS EN VIVO --- */}
      {activeSection === 'noticias' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Selector rápido de activos para noticias */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { ticker: 'NVDA', label: 'NVIDIA' },
                { ticker: 'BTC-EUR', label: 'Bitcoin' },
                { ticker: 'GC=F', label: 'Oro' },
                { ticker: '^NDX', label: 'Nasdaq 100' },
                { ticker: '^IBEX', label: 'IBEX 35' },
              ].map(item => (
                <button
                  key={item.ticker}
                  onClick={() => setSelectedNewsTicker(item.ticker)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                    selectedNewsTicker === item.ticker
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={async () => {
                setIsLoadingNews(true);
                const res = await marketEventsService.fetchLiveNews(selectedNewsTicker);
                setNewsList(res);
                setIsLoadingNews(false);
              }}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Recargar noticias"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingNews ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {isLoadingNews ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              <span>Consultando noticias financieras en tiempo real...</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {newsList.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedArticle(item)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {item.publisher}
                    </span>
                    <span>{item.timeAgo}</span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                    {item.title}
                  </h3>

                  {item.summary && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">
                      Leer análisis completo
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLE DE NOTICIA */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {selectedArticle.publisher} • {selectedArticle.timeAgo}
              </span>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                {selectedArticle.title}
              </h2>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedArticle.summary}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              {selectedArticle.link && selectedArticle.link !== '#' ? (
                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5"
                >
                  <span>Abrir en fuente original</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
              <button
                onClick={() => setSelectedArticle(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
