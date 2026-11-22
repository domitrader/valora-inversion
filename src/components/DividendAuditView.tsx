import React, { useState, useMemo } from 'react';
import { formatEUR } from '../utils/calculations';
import dividendsRaw from '../data/degiroDividendsData.json';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Search,
  Building2,
  Clock,
  Sparkles,
  PieChart,
  HelpCircle,
  PlusCircle,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DividendAuditViewProps {
  hideFigures?: boolean;
}

export const DividendAuditView: React.FC<DividendAuditViewProps> = ({ hideFigures = false }) => {
  const [selectedBroker, setSelectedBroker] = useState<'Todas' | 'DEGIRO' | 'MyInvestor'>('Todas');
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'historial' | 'mapa-futuro' | 'empresas'>('historial');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProductIsin, setSelectedProductIsin] = useState<string>('TODOS');
  const [taxRateSpanish19, setTaxRateSpanish19] = useState<boolean>(true);

  const rawData = dividendsRaw as {
    totalHistoricalNet: number;
    totalHistoricalGross: number;
    totalHistoricalTaxes: number;
    totalPaymentsCount: number;
    yearsAvailable: string[];
    brokersAvailable: string[];
    annualSummary: Array<{ year: string; gross: number; tax: number; net: number; count: number }>;
    productSummary: Array<{ product: string; isin: string; flag: string; gross: number; tax: number; net: number; count: number }>;
    payments: Array<{
      date: string;
      year: string;
      month: string;
      product: string;
      isin: string;
      gross: number;
      tax: number;
      net: number;
      currency: string;
      broker: string;
      flag: string;
      descriptions?: string[];
    }>;
    futureCalendar: Array<{
      id: string;
      product: string;
      ticker: string;
      isin: string;
      shares: number;
      broker: string;
      flag: string;
      month: string;
      quarter: string;
      estimatedDate: string;
      dividendPerShare: number;
      currency: string;
      estimatedGrossEUR: number;
      estimatedTaxEUR: number;
      estimatedNetEUR: number;
      frequency: string;
      status: string;
    }>;
  };

  // Filtrado de pagos históricos
  const filteredPayments = useMemo(() => {
    return rawData.payments.filter(p => {
      const matchBroker = selectedBroker === 'Todas' || p.broker.toUpperCase() === selectedBroker.toUpperCase();
      const matchYear = selectedYear === 'Todos' || p.year === selectedYear;
      const matchSearch =
        searchTerm === '' ||
        p.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.isin.toLowerCase().includes(searchTerm.toLowerCase());
      return matchBroker && matchYear && matchSearch;
    });
  }, [rawData.payments, selectedBroker, selectedYear, searchTerm]);

  // Filtrado de calendario futuro según broker
  const filteredFutureCalendar = useMemo(() => {
    return rawData.futureCalendar.filter(ev => {
      return selectedBroker === 'Todas' || ev.broker.toUpperCase() === selectedBroker.toUpperCase();
    });
  }, [rawData.futureCalendar, selectedBroker]);

  // Suma total de cobros futuros proyectados (Bruto, Retención 19% España y Neto)
  const futureGrossSum = useMemo(() => {
    return filteredFutureCalendar.reduce((acc, ev) => acc + ev.estimatedGrossEUR, 0);
  }, [filteredFutureCalendar]);

  const futureSpanishTax19Sum = useMemo(() => {
    return futureGrossSum * 0.19;
  }, [futureGrossSum]);

  const futureNet19Sum = useMemo(() => {
    return futureGrossSum * 0.81;
  }, [futureGrossSum]);

  const futureDistinctAssets = useMemo(() => {
    const map = new Map<string, { product: string; ticker: string; isin: string; flag: string; annualGross: number; count: number }>();
    filteredFutureCalendar.forEach(ev => {
      const existing = map.get(ev.isin);
      if (existing) {
        existing.annualGross += ev.estimatedGrossEUR;
        existing.count += 1;
      } else {
        map.set(ev.isin, {
          product: ev.product,
          ticker: ev.ticker,
          isin: ev.isin,
          flag: ev.flag,
          annualGross: ev.estimatedGrossEUR,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [filteredFutureCalendar]);

  // Cálculos dinámicos según filtros aplicados
  const currentNet = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.net, 0);
  }, [filteredPayments]);

  const currentGross = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.gross, 0);
  }, [filteredPayments]);

  const currentTaxes = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.tax, 0);
  }, [filteredPayments]);

  // Máximo para escala del gráfico de barras anual
  const maxAnnualNet = useMemo(() => {
    return Math.max(...rawData.annualSummary.map(a => a.net), 1);
  }, [rawData.annualSummary]);

  // Datos consolidados o específicos para la pestaña 'Por Activo'
  const selectedProductData = useMemo(() => {
    if (selectedProductIsin === 'TODOS') {
      const gross = rawData.productSummary.reduce((acc, p) => acc + p.gross, 0);
      const tax = rawData.productSummary.reduce((acc, p) => acc + p.tax, 0);
      const net = rawData.productSummary.reduce((acc, p) => acc + p.net, 0);
      const count = rawData.productSummary.reduce((acc, p) => acc + p.count, 0);
      return {
        product: 'Todos los Activos con Dividendo',
        ticker: `${rawData.productSummary.length} activos`,
        isin: 'TODOS',
        flag: '💼',
        gross,
        tax,
        net,
        count,
      };
    }
    const found = rawData.productSummary.find(p => p.isin === selectedProductIsin);
    if (found) return found;
    return rawData.productSummary[0] || {
      product: 'Activo',
      ticker: '',
      isin: '',
      flag: '📄',
      gross: 0,
      tax: 0,
      net: 0,
      count: 0,
    };
  }, [selectedProductIsin, rawData.productSummary]);

  const selectedProductPayments = useMemo(() => {
    if (selectedProductIsin === 'TODOS') return rawData.payments;
    return rawData.payments.filter(p => p.isin === selectedProductIsin);
  }, [selectedProductIsin, rawData.payments]);

  return (
    <div className="space-y-4">
      {/* 1. SELECTOR DE CARTERA / BROKER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cartera de origen
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            Auditoría 2018–2026
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedBroker('Todas')}
            className={`py-2 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'Todas'
                ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>Todas</span>
            <span className="text-[10px] font-medium opacity-80">Consolidado</span>
          </button>

          <button
            onClick={() => setSelectedBroker('DEGIRO')}
            className={`py-2 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'DEGIRO'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>DEGIRO</span>
            <span className="text-[10px] font-medium opacity-80">104 cobros</span>
          </button>

          <button
            onClick={() => setSelectedBroker('MyInvestor')}
            className={`py-2 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'MyInvestor'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>MyInvestor</span>
            <span className="text-[10px] font-medium opacity-80">Fondos & DGI</span>
          </button>
        </div>
      </div>

      {/* 2. NAVEGACIÓN PRINCIPAL DE PESTAÑAS (ARRIBA DEL TODO) */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl gap-1 shadow-inner border border-slate-200/60 dark:border-slate-700/60">
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'historial'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📜 Historial</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {filteredPayments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mapa-futuro')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'mapa-futuro'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📅 Mapa Futuro</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('empresas')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'empresas'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🏢 Por Empresa</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {rawData.productSummary.length}
          </span>
        </button>
      </div>

      {/* 3. PANEL HERO DINÁMICO (CUADRO AZUL QUE REACCIONA A LA PESTAÑA Y AL ACTIVO SELECCIONADO) */}
      {activeTab === 'historial' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                Historial de Dividendos Cobrados
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {filteredPayments.length} Pagos Registrados
            </span>
          </div>

          <div className="text-center py-1">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
              +{formatEUR(currentNet, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              {selectedYear === 'Todos' ? 'Total Histórico Neto Cobrado (2018–2026)' : `Neto Cobrado en ${selectedYear}`}
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retención, Neto */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(currentGross, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retenciones</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(currentTaxes, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto en Cuenta</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(currentNet, hideFigures)}
              </div>
            </div>
          </div>

          {/* Selector de Años */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Filtrar año:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedYear('Todos')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedYear === 'Todos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              {rawData.annualSummary.map(a => (
                <button
                  key={a.year}
                  type="button"
                  onClick={() => setSelectedYear(a.year)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                    selectedYear === a.year
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {a.year}
                </button>
              ))}
            </div>
          </div>

          {/* Gráfico Visual de Evolución Histórica Anual */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Evolución Anual (2018–2026)</span>
              <span className="text-[10px] text-slate-400">Récord: 2021 (136,95 €)</span>
            </div>
            <div className="grid grid-cols-9 gap-1.5 items-end h-20 pt-1 pb-1">
              {[...rawData.annualSummary].reverse().map(item => {
                const heightPct = Math.max(15, Math.round((item.net / maxAnnualNet) * 100));
                const isSelected = selectedYear === item.year;
                return (
                  <div
                    key={item.year}
                    onClick={() => setSelectedYear(selectedYear === item.year ? 'Todos' : item.year)}
                    className="flex flex-col items-center h-full justify-end cursor-pointer group"
                    title={`${item.year}: ${item.net.toFixed(2)} €`}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        isSelected
                          ? 'bg-emerald-400 ring-2 ring-emerald-300'
                          : 'bg-slate-700 group-hover:bg-emerald-500/80'
                      }`}
                    />
                    <span className={`text-[9px] mt-1 font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {item.year.slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mapa-futuro' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                Proyección Anual • Cobros Futuros
              </span>
            </div>

            {/* BOTÓN CONMUTADOR: BRUTO vs NETO (19% IRPF ESPAÑA) */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 shadow-inner self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTaxRateSpanish19(false)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  !taxRateSpanish19
                    ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                💶 Bruto
              </button>
              <button
                type="button"
                onClick={() => setTaxRateSpanish19(true)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-all ${
                  taxRateSpanish19
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇪🇸 Neto (-19% IRPF)
              </button>
            </div>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              +{formatEUR(taxRateSpanish19 ? futureNet19Sum : futureGrossSum, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              {taxRateSpanish19
                ? 'Neto Anual Estimado (Tras 19% Fiscalidad Española)'
                : 'Importe Total Bruto Proyectado'}
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retención 19%, Neto */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(futureGrossSum, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retención 19%</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(futureSpanishTax19Sum, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto Anual</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(futureNet19Sum, hideFigures)}
              </div>
            </div>
          </div>

          {/* Resumen de activos que reparten en el año */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400">Activos en el cómputo anual:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {futureDistinctAssets.map(a => (
                <span key={a.isin} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold border border-white/10 text-[10px]">
                  <span>{a.flag}</span>
                  <span>{a.product}</span>
                  <span className="text-emerald-400">
                    (+{formatEUR(taxRateSpanish19 ? a.annualGross * 0.81 : a.annualGross, hideFigures)})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'empresas' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 truncate max-w-[220px]">
                {selectedProductData.product}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {selectedProductData.count} Cobros Realizados
            </span>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
              +{formatEUR(selectedProductData.net, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              Neto Real Cobrado de {selectedProductData.product}
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retención, Neto */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(selectedProductData.gross, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retenciones</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(selectedProductData.tax, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto Total</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(selectedProductData.net, hideFigures)}
              </div>
            </div>
          </div>

          {/* Selector Rápido de Activo en la Tarjeta */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Tocar empresa:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedProductIsin('TODOS')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedProductIsin === 'TODOS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                🌐 Todas
              </button>
              {rawData.productSummary.slice(0, 6).map(prod => (
                <button
                  key={prod.isin}
                  type="button"
                  onClick={() => setSelectedProductIsin(prod.isin)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                    selectedProductIsin === prod.isin
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{prod.flag}</span>
                  <span>{prod.product.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 1: HISTORIAL DE PAGOS */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por empresa o ISIN..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            {filteredPayments.length > 0 ? (
              filteredPayments.map((p, idx) => (
                <div
                  key={`${p.date}_${p.isin}_${idx}`}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {p.flag}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                        <span>{p.product}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {p.broker}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {p.date} • Bruto: {p.gross.toFixed(2)} € • Retención: -{p.tax.toFixed(2)} €
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      +{formatEUR(p.net, hideFigures)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Neto cobrado</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4">
                No se encontraron cobros para los filtros seleccionados
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: MAPA FUTURO (CALENDARIO DE COBROS Y PROYECCIONES) */}
      {activeTab === 'mapa-futuro' && (
        <div className="space-y-4">
          {/* TARJETA DESTACADA: SUMA TOTAL ANUAL EN MAPA FUTURO */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-lg border border-slate-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Proyección Anual 2027 • Suma Total de Cartera
                  </div>
                  <h3 className="text-base font-extrabold text-white">
                    {futureDistinctAssets.length} {futureDistinctAssets.length === 1 ? 'Activo' : 'Activos'} con Dividendo ({filteredFutureCalendar.length} Cobros en el Año)
                  </h3>
                </div>
              </div>

              {/* Botón selector Bruto / Neto 19% */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTaxRateSpanish19(false)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    !taxRateSpanish19 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  💶 Bruto
                </button>
                <button
                  type="button"
                  onClick={() => setTaxRateSpanish19(true)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    taxRateSpanish19 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🇪🇸 Neto (-19% IRPF)
                </button>
              </div>
            </div>

            {/* 3 Columnas de Totales Anuales */}
            <div className="grid grid-cols-3 gap-3 pt-3.5 text-center">
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Bruto Anual
                </div>
                <div className="text-base sm:text-lg font-black text-white mt-0.5">
                  +{formatEUR(futureGrossSum, hideFigures)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 font-medium">100% devengado</div>
              </div>

              <div className="bg-rose-500/10 rounded-2xl p-2.5 border border-rose-500/20">
                <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                  Retenciones (19%)
                </div>
                <div className="text-base sm:text-lg font-black text-rose-400 mt-0.5">
                  -{formatEUR(futureSpanishTax19Sum, hideFigures)}
                </div>
                <div className="text-[9px] text-rose-300/80 mt-0.5 font-medium">IRPF España</div>
              </div>

              <div className="bg-emerald-500/15 rounded-2xl p-2.5 border border-emerald-500/30">
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Total Neto Anual
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                  +{formatEUR(futureNet19Sum, hideFigures)}
                </div>
                <div className="text-[9px] text-emerald-300/80 mt-0.5 font-medium">Líquido a percibir</div>
              </div>
            </div>

            {/* Resumen por Activo */}
            <div className="mt-3.5 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-300">
              <span className="font-semibold text-slate-400">Activos en el cómputo anual:</span>
              <div className="flex flex-wrap items-center gap-2">
                {futureDistinctAssets.map(a => (
                  <span key={a.isin} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-white font-bold border border-white/10">
                    <span>{a.flag}</span>
                    <span>{a.product}</span>
                    <span className="text-emerald-400">
                      (+{formatEUR(taxRateSpanish19 ? a.annualGross * 0.81 : a.annualGross, hideFigures)})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjeta explicativa de la cartera actual de DEGIRO */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-4 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Diagnóstico de Dividendos en tu Cartera DEGIRO Actual</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] mt-1">
              Actualmente en DEGIRO tienes <strong>5 acciones de NVIDIA</strong> que abonan dividendo trimestral. Los ETFs apalancados (<strong>WisdomTree Gold 3X</strong> y <strong>Nasdaq 100 3X</strong>) y las criptomonedas (<strong>21Shares Bitcoin</strong> y <strong>VanEck Bitcoin</strong>) son instrumentos de réplica sintética y acumulación que <strong>no reparten dividendos</strong>.
            </p>
          </div>

          {/* Calendario Trimestral de NVIDIA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Mapa de Cobros Proyectados (NVIDIA - 5 acciones)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {taxRateSpanish19 ? 'Mostrando Neto (-19%)' : 'Mostrando Bruto'}
              </span>
            </div>

            <div className="space-y-2">
              {filteredFutureCalendar.map(ev => {
                const gross = ev.estimatedGrossEUR;
                const tax19 = gross * 0.19;
                const net19 = gross * 0.81;
                const displayVal = taxRateSpanish19 ? net19 : gross;

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-xs flex items-center justify-center">
                        NV
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                          {ev.product} ({ev.ticker})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {ev.month} • {ev.frequency} • {ev.shares} acciones
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Bruto: {gross.toFixed(2)} € • IRPF 19%: -{tax19.toFixed(2)} €
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        +{formatEUR(displayVal, hideFigures)}
                      </div>
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {taxRateSpanish19 ? 'Neto (-19%)' : 'Bruto'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recomendaciones / Ideas de Crecimiento para MyInvestor / DEGIRO */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 border border-indigo-100 dark:border-slate-700 rounded-3xl p-4">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-xs mb-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Estrategia de Optimización de Dividendos (DEGIRO vs. MyInvestor)</span>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span>
                  <strong>En MyInvestor:</strong> Es ideal para fondos indexados de distribución o ETFs con reinversión automática libre de retención en origen (traspasables sin peaje fiscal en España).
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span>
                  <strong>En DEGIRO:</strong> Ideal para acciones individuales de alta rentabilidad por dividendo (DGI como Microsoft, Apple, Visa, Realty Income) aprovechando el formulario W-8BEN (15% de retención estadounidense compensable en el IRPF español).
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 3: DESGLOSE POR EMPRESA */}
      {activeTab === 'empresas' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Empresa
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Neto Cobrado
            </span>
          </div>

          <div className="space-y-1">
            {rawData.productSummary.map((prod, idx) => (
              <div
                key={prod.isin || idx}
                className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="text-sm shrink-0">{prod.flag}</span>
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                      {prod.product}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {prod.count} pagos • Bruto: {prod.gross.toFixed(2)} € • Ret.: -{prod.tax.toFixed(2)} €
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                    +{formatEUR(prod.net, hideFigures)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
