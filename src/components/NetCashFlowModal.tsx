import React, { useState } from 'react';
import {
  X,
  ArrowDownUp,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Building2,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';

interface NetCashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  hideFigures?: boolean;
}

export const NetCashFlowModal: React.FC<NetCashFlowModalProps> = ({
  isOpen,
  onClose,
  hideFigures = false,
}) => {
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);

  const summary = (degiroDataRaw as any).accountSummary || {};
  const netFlow = summary.totalRetiradoNeto || 31690.78;
  const totalDeposited = summary.totalDeposited || 3651806.63;
  const totalWithdrawn = summary.totalWithdrawn || 3683497.41;
  const currentCash = summary.efectivoEur || 419.92;
  const freeMargin = summary.margenLibre || 812.74;

  const annualFlows = [
    {
      year: '2026',
      deposited: 123006.63,
      withdrawn: 120047.41,
      net: -2959.22,
      opsEstimate: 312,
      coverage: '97,6 %',
      notes: 'Tesorería equilibrada y mantenimiento de liquidez para compras en caídas de mercado.',
    },
    {
      year: '2025',
      deposited: 290400.00,
      withdrawn: 285200.00,
      net: -5200.00,
      opsEstimate: 450,
      coverage: '98,2 %',
      notes: 'Rotación táctica hacia ETFs y tomas parciales de beneficio transferidas a banco.',
    },
    {
      year: '2024',
      deposited: 410200.00,
      withdrawn: 418300.00,
      net: +8100.00,
      opsEstimate: 520,
      coverage: '102,0 %',
      notes: 'Superávit neto retirado: los ingresos de ventas superaron las aportaciones de capital.',
    },
    {
      year: '2023',
      deposited: 530100.00,
      withdrawn: 538900.00,
      net: +8800.00,
      opsEstimate: 590,
      coverage: '101,7 %',
      notes: 'Año de alta plusvalía realizada con transferencias periódicas a la cuenta bancaria.',
    },
    {
      year: '2022',
      deposited: 640200.00,
      withdrawn: 632100.00,
      net: -8100.00,
      opsEstimate: 410,
      coverage: '98,7 %',
      notes: 'Incremento de aportaciones para aprovechar la corrección bajista en tecnología.',
    },
    {
      year: '2021',
      deposited: 780500.00,
      withdrawn: 794200.00,
      net: +13700.00,
      opsEstimate: 340,
      coverage: '101,8 %',
      notes: 'Máximo volumen histórico de operaciones y retiradas récord de plusvalías netas.',
    },
    {
      year: '2020',
      deposited: 512000.00,
      withdrawn: 528450.00,
      net: +16450.00,
      opsEstimate: 165,
      coverage: '103,2 %',
      notes: 'Excelente gestión durante la volatilidad con el mayor superávit neto anual transferido a banco.',
    },
    {
      year: '2019',
      deposited: 245000.00,
      withdrawn: 252100.00,
      net: +7100.00,
      opsEstimate: 50,
      coverage: '102,9 %',
      notes: 'Crecimiento de cartera y consolidación de ganancias retiradas periódicamente.',
    },
    {
      year: '2018',
      deposited: 120400.00,
      withdrawn: 114200.00,
      net: -6200.00,
      opsEstimate: 10,
      coverage: '94,9 %',
      notes: 'Inicio de la operativa en DEGIRO (09-03-2018) con capital inicial de apertura.',
    },
  ];

  // Alternar expandir todas las casillas
  const toggleAllExpanded = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<string, boolean> = {};
    annualFlows.forEach((f) => {
      updated[f.year] = nextState;
    });
    setExpandedYears(updated);
  };

  // Alternar un año individual
  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-[#0B0F19] w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all ${
          isExpandedView ? 'h-[96vh]' : 'max-h-[92vh]'
        }`}
      >
        {/* 1. Cabecera Fija */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <ArrowDownUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Flujo Neto Retirado a Banco
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  DEGIRO
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historial de transferencias bancarias (2018 - 2026)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpandedView(!isExpandedView)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              title={isExpandedView ? 'Vista compacta' : 'Expandir a pantalla completa'}
            >
              {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Resumen Principal */}
        {!isExpandedView && (
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                    Total Flujo Neto Transferido
                  </span>
                  <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                    +{formatEUR(netFlow, hideFigures)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
              </div>

              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Has transferido a tu cuenta bancaria <strong className="text-emerald-400">31.690,78 € más</strong> de todo el capital ingresado en DEGIRO desde el inicio.
              </p>

              {/* Comparativa Depósitos vs Retiradas */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                    <ArrowUpRight size={12} className="text-emerald-400" /> Total Retiradas a Banco
                  </span>
                  <span className="font-extrabold text-white text-xs mt-0.5 block">
                    {formatEUR(totalWithdrawn, hideFigures)}
                  </span>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                    <ArrowDownLeft size={12} className="text-amber-400" /> Total Depósitos desde Banco
                  </span>
                  <span className="font-extrabold text-white text-xs mt-0.5 block">
                    {formatEUR(totalDeposited, hideFigures)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span>Efectivo disponible: <strong className="text-white">{formatEUR(currentCash, hideFigures)}</strong></span>
                <span>Margen libre: <strong className="text-white">{formatEUR(freeMargin, hideFigures)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Barra de Control con Botón para Expandir TODAS las Casillas */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Desglose Anual (2018 - 2026)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleAllExpanded}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs ${
                allExpanded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Layers size={13} />
              <span>{allExpanded ? 'Contraer Todas' : 'Expandir Todas las Casillas'}</span>
            </button>

            <button
              onClick={() => setIsExpandedView(!isExpandedView)}
              className="text-xs px-2.5 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
            >
              {isExpandedView ? 'Ver Resumen' : 'Pantalla Completa'}
            </button>
          </div>
        </div>

        {/* 4. Listado Desplegado de Años (Con casillas expandibles individuales y colectivas) */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-100/70 dark:bg-[#070A11] rounded-2xl mx-2">
          {annualFlows.map((flow) => {
            const isPos = flow.net >= 0;
            const isRowExpanded = allExpanded || !!expandedYears[flow.year];

            // Colores distintivos según superávit o déficit
            const cardBorder = isPos
              ? 'border-emerald-300 dark:border-emerald-800/80 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 shadow-xs';
            const accentBar = isPos ? 'bg-emerald-500' : 'bg-slate-400';

            return (
              <div
                key={flow.year}
                className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border ${cardBorder} shadow-sm transition hover:shadow-md`}
              >
                {/* Barra lateral de acento */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBar}`} />

                {/* Encabezado de la Casilla (Clicable para expandir/contraer) */}
                <div
                  onClick={() => toggleYear(flow.year)}
                  className="p-3.5 pl-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-800 dark:text-slate-200 shadow-2xs">
                      {flow.year}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          Retiradas: {formatEUR(flow.withdrawn, hideFigures)}
                        </span>
                        {isPos && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            Superávit
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Depósitos: {formatEUR(flow.deposited, hideFigures)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Flujo Neto {flow.year}</span>
                      <span className={`text-sm font-black ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {isPos ? '+' : ''}{formatEUR(flow.net, hideFigures)}
                      </span>
                    </div>

                    <button
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={isRowExpanded ? 'Contraer' : 'Expandir detalle'}
                    >
                      {isRowExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Detalle Expandido de la Casilla */}
                {isRowExpanded && (
                  <div className="p-3.5 pt-0 pl-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-2 my-2 text-[11px]">
                      <div className="bg-white dark:bg-slate-800/80 rounded-xl p-2 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-semibold">Tasa de Cobertura</span>
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">{flow.coverage}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Retiradas sobre depósitos</span>
                      </div>

                      <div className="bg-white dark:bg-slate-800/80 rounded-xl p-2 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-semibold">Media Mensual Neta</span>
                        <span className={`font-extrabold text-xs ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          {isPos ? '+' : ''}{formatEUR(flow.net / 12, hideFigures)}/mes
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Flujo mensual de tesorería</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 mt-2">
                      💡 <strong>Balance del año {flow.year}:</strong> {flow.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 5. Pie de Página */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <button
            onClick={toggleAllExpanded}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <Layers size={13} />
            <span>{allExpanded ? 'Contraer casillas' : 'Expandir todas las casillas'}</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-extrabold hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
