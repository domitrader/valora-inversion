import React, { useState, useMemo } from 'react';
import {
  WEEKLY_EARNINGS_SCHEDULES,
  WeeklyEarningsSchedule,
  WeeklyEarningsCompany,
  DayEarnings,
} from '../data/weeklyEarningsData';
import {
  Calendar,
  Clock,
  TrendingUp,
  X,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  Sun,
  Moon,
  ChevronRight,
  ExternalLink,
  Award,
  Layers,
} from 'lucide-react';

interface WeeklyEarningsCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPortfolioTickers?: string[];
}

export const WeeklyEarningsCalendarModal: React.FC<WeeklyEarningsCalendarModalProps> = ({
  isOpen,
  onClose,
  userPortfolioTickers = ['NVDA', 'O', 'ENG.MC'],
}) => {
  const [selectedWeekId, setSelectedWeekId] = useState<string>('week-nov-24');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('TODOS');
  const [sectorFilter, setSectorFilter] = useState<string>('TODOS');
  const [onlyPortfolio, setOnlyPortfolio] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<WeeklyEarningsCompany | null>(null);

  const activeSchedule = useMemo(() => {
    return (
      WEEKLY_EARNINGS_SCHEDULES.find(w => w.weekId === selectedWeekId) ||
      WEEKLY_EARNINGS_SCHEDULES[0]
    );
  }, [selectedWeekId]);

  // Filtrar los días y empresas según los filtros seleccionados
  const filteredDays = useMemo(() => {
    return activeSchedule.days
      .filter(day => {
        if (selectedDayFilter === 'TODOS') return true;
        return day.shortDay === selectedDayFilter;
      })
      .map(day => {
        const companies = day.companies.filter(c => {
          const isUserHolding = c.isInPortfolio || userPortfolioTickers.includes(c.ticker);
          if (onlyPortfolio && !isUserHolding) return false;
          if (sectorFilter !== 'TODOS' && c.sector !== sectorFilter) return false;
          if (
            searchTerm.trim() !== '' &&
            !c.ticker.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !c.name.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            return false;
          }
          return true;
        });

        return {
          ...day,
          companies,
        };
      });
  }, [activeSchedule, selectedDayFilter, sectorFilter, onlyPortfolio, searchTerm, userPortfolioTickers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* 1. Cabecera Fija */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Calendario Semanal de Resultados
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Wall Street & Europa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Presentaciones oficiales de las mayores compañías globales
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Barra de Navegación de Semanas y Filtros */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
          {/* Selector de Semanas */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {WEEKLY_EARNINGS_SCHEDULES.map(schedule => {
              const isSelected = schedule.weekId === selectedWeekId;
              return (
                <button
                  key={schedule.weekId}
                  onClick={() => setSelectedWeekId(schedule.weekId)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {schedule.weekLabel}
                  {schedule.weekId === 'week-nov-24' && (
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-extrabold">
                      NVDA
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Buscador y Filtro Rápido */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empresa o ticker (ej: NVDA, Apple, Dell)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={() => setOnlyPortfolio(!onlyPortfolio)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 ${
                onlyPortfolio
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Award className="w-3 h-3" />
              <span>Mi Cartera</span>
            </button>
          </div>

          {/* Días de la Semana Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
            {['TODOS', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'].map(day => (
              <button
                key={day}
                onClick={() => setSelectedDayFilter(day)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedDayFilter === day
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {day === 'TODOS' ? 'Semana completa' : day}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Contenido de los Días (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredDays.length === 0 || filteredDays.every(d => d.companies.length === 0) ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron resultados con los filtros actuales.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setOnlyPortfolio(false);
                  setSelectedDayFilter('TODOS');
                  setSectorFilter('TODOS');
                }}
                className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            filteredDays.map(day => {
              if (day.companies.length === 0) return null;

              const bmoCompanies = day.companies.filter(c => c.timing === 'BMO');
              const amcCompanies = day.companies.filter(c => c.timing === 'AMC');

              return (
                <div
                  key={day.isoDate}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 shadow-2xs"
                >
                  {/* Encabezado del Día */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                        {day.dayName}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        • {day.dateStr}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {day.companies.length} {day.companies.length === 1 ? 'empresa' : 'empresas'}
                    </span>
                  </div>

                  {/* Bloque BMO (Antes de apertura) */}
                  {bmoCompanies.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-2">
                        <Sun className="w-3.5 h-3.5" />
                        <span>Antes de la Apertura (BMO)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {bmoCompanies.map(company => (
                          <CompanyCard
                            key={company.id}
                            company={company}
                            onClick={() => setSelectedCompany(company)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bloque AMC (Tras el cierre) */}
                  {amcCompanies.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                        <Moon className="w-3.5 h-3.5" />
                        <span>Tras el Cierre de Mercado (AMC)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {amcCompanies.map(company => (
                          <CompanyCard
                            key={company.id}
                            company={company}
                            onClick={() => setSelectedCompany(company)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 4. Modal Detalle de Empresa Seleccionada */}
        {selectedCompany && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm ${selectedCompany.logoBg}`}
                  >
                    {selectedCompany.logoText}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                        {selectedCompany.name}
                      </h3>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {selectedCompany.ticker}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedCompany.sector} • Cap: {selectedCompany.marketCap}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCompany(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              {selectedCompany.isInPortfolio && (
                <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>¡Activo en tu cartera! Tienes títulos en posesión.</span>
                </div>
              )}

              {/* Métricas clave */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">BPA Estimado</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    ${selectedCompany.epsEstimate.toFixed(2)}
                  </span>
                  {selectedCompany.epsPrior && (
                    <span className="text-[9px] text-slate-400 block">Ant: ${selectedCompany.epsPrior}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Ingresos Est.</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedCompany.revenueEstimate}
                  </span>
                  <span className="text-[9px] text-slate-400 block">{selectedCompany.fiscalQuarter}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Mov. Implícito</span>
                  <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                    {selectedCompany.impliedMove || '±5.0%'}
                  </span>
                  <span className="text-[9px] text-slate-400 block">En opciones</span>
                </div>
              </div>

              {/* Análisis / Guía */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Aspectos Clave a Seguir:
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedCompany.highlights}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="py-2 px-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Tarjeta Individual de Empresa
const CompanyCard: React.FC<{
  company: WeeklyEarningsCompany;
  onClick: () => void;
}> = ({ company, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-2.5 transition-all cursor-pointer hover:border-emerald-500/70 hover:shadow-xs flex items-center justify-between ${
        company.isInPortfolio
          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 ${company.logoBg}`}
        >
          {company.logoText}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
              {company.ticker}
            </span>
            {company.isInPortfolio && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                EN CARTERA
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {company.name}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span className="text-[10px] text-slate-400 block font-semibold">BPA est.</span>
        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
          ${company.epsEstimate > 0 ? company.epsEstimate.toFixed(2) : '-'}
        </span>
      </div>
    </div>
  );
};
