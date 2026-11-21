import React, { useState } from 'react';
import { FinancialEvent, PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import { Calendar, DollarSign, TrendingUp, Filter, CheckCircle2, Clock } from 'lucide-react';

interface EventsViewProps {
  events: FinancialEvent[];
  positions: PositionItem[];
  hideFigures?: boolean;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  positions,
  hideFigures = false,
}) => {
  const [filterType, setFilterType] = useState<'todos' | 'dividendos' | 'resultados'>('todos');

  const filteredEvents = events.filter(e => {
    if (filterType === 'dividendos') return e.type === 'pago-dividendo' || e.type === 'ex-dividend';
    if (filterType === 'resultados') return e.type === 'resultados';
    return true;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Mapa de posiciones del usuario para calcular ingresos si tiene acciones
  const positionsByTicker = new Map(positions.map(p => [p.ticker, p]));

  return (
    <div className="pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Cabecera */}
      <header className="flex items-center justify-between pt-1 pb-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Eventos</h1>
          <p className="text-xs text-slate-500 font-medium">Calendario de dividendos y resultados</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
          <Calendar className="w-4 h-4" />
        </div>
      </header>

      {/* Filtros rápidos tipo chips */}
      <div className="flex items-center gap-1.5 mb-4">
        <button
          onClick={() => setFilterType('todos')}
          className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
            filterType === 'todos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos ({events.length})
        </button>
        <button
          onClick={() => setFilterType('dividendos')}
          className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
            filterType === 'dividendos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Dividendos
        </button>
        <button
          onClick={() => setFilterType('resultados')}
          className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
            filterType === 'resultados' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Resultados (Earnings)
        </button>
      </div>

      {/* Lista cronológica de eventos */}
      <div className="space-y-3">
        {filteredEvents.map(event => {
          const userHolding = positionsByTicker.get(event.ticker);
          const isDividend = event.type === 'pago-dividendo' || event.type === 'ex-dividend';
          const isEarnings = event.type === 'resultados';

          // Fecha formateada en español
          const eventDate = new Date(event.date);
          const formattedDate = eventDate.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });

          return (
            <div
              key={event.id}
              className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Logo + Ticker + Fecha */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                      event.logoBg || (isDividend ? 'bg-emerald-600' : 'bg-blue-600')
                    }`}
                  >
                    {event.logoText || event.ticker.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900 text-sm">{event.assetName}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {event.ticker}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
                      <span className="capitalize">{formattedDate}</span>
                      {event.time && <span>• {event.time}</span>}
                    </div>
                  </div>
                </div>

                {/* Badge de estado / confirmación */}
                <div className="shrink-0 text-right">
                  {event.confirmed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Confirmado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Estimado
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción o datos clave */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <p className="text-slate-600 text-xs pr-2">{event.description}</p>
                {isDividend && event.dividendPerShare && (
                  <div className="text-right shrink-0">
                    <span className="text-slate-400 text-[10px] block">Por acción</span>
                    <span className="font-bold text-slate-900">{event.dividendPerShare.toFixed(3)} €</span>
                  </div>
                )}
                {isEarnings && event.estimatedEarningsPerShare && (
                  <div className="text-right shrink-0">
                    <span className="text-slate-400 text-[10px] block">BPA estimado</span>
                    <span className="font-bold text-slate-900">${event.estimatedEarningsPerShare.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Si el usuario tiene acciones, mostrar el total que cobrará */}
              {userHolding && isDividend && (
                <div className="mt-2 bg-emerald-50/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-emerald-900">
                  <span className="font-medium text-[11px]">En tu cartera ({userHolding.shares} títulos):</span>
                  <span className="font-extrabold text-emerald-700">
                    +{formatEUR((event.dividendPerShare || 0) * userHolding.shares, hideFigures)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
