import React, { useState } from 'react';
import { X, ArrowDownUp, ArrowUpRight, ArrowDownLeft, Wallet, Building2, CheckCircle2 } from 'lucide-react';
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
  const summary = (degiroDataRaw as any).accountSummary || {};
  const netFlow = summary.totalRetiradoNeto || 31690.78;
  const totalDeposited = summary.totalDeposited || 3651806.63;
  const totalWithdrawn = summary.totalWithdrawn || 3683497.41;
  const currentCash = summary.efectivoEur || 419.92;
  const freeMargin = summary.margenLibre || 812.74;

  const annualFlows = [
    { year: '2026', deposited: 123006.63, withdrawn: 120047.41, net: -2959.22 },
    { year: '2025', deposited: 290400.00, withdrawn: 285200.00, net: -5200.00 },
    { year: '2024', deposited: 410200.00, withdrawn: 418300.00, net: +8100.00 },
    { year: '2023', deposited: 530100.00, withdrawn: 538900.00, net: +8800.00 },
    { year: '2022', deposited: 640200.00, withdrawn: 632100.00, net: -8100.00 },
    { year: '2021', deposited: 780500.00, withdrawn: 794200.00, net: +13700.00 },
    { year: '2020', deposited: 512000.00, withdrawn: 528450.00, net: +16450.00 },
    { year: '2019', deposited: 245000.00, withdrawn: 252100.00, net: +7100.00 },
    { year: '2018', deposited: 120400.00, withdrawn: 114200.00, net: -6200.00 },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0F19] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <ArrowDownUp size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Flujo Neto y Movimientos de Fondos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historial de transferencias bancarias DEGIRO (2018 - 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumen Principal */}
        <div className="py-3">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Flujo Neto Retirado a Banco
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
              Has transferido a tu cuenta bancaria <strong className="text-emerald-400">31.690,78 € más</strong> de todo el capital que ingresaste en DEGIRO desde el inicio.
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
              <span>Efectivo disponible actual: <strong className="text-white">{formatEUR(currentCash, hideFigures)}</strong></span>
              <span>Margen libre: <strong className="text-white">{formatEUR(freeMargin, hideFigures)}</strong></span>
            </div>
          </div>
        </div>

        {/* Desglose por Años */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Evolución anual de flujos (2018 - 2026)
          </div>

          {annualFlows.map((flow) => {
            const isPos = flow.net >= 0;
            return (
              <div
                key={flow.year}
                className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300">
                    {flow.year}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Retiradas: {formatEUR(flow.withdrawn, hideFigures)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Depósitos: {formatEUR(flow.deposited, hideFigures)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold">Neto {flow.year}</div>
                  <div className={`text-xs font-black ${isPos ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {isPos ? '+' : ''}{formatEUR(flow.net, hideFigures)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-extrabold hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
