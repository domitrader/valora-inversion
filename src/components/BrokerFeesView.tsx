import React, { useState } from 'react';
import {
  ExternalLink,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Search,
  TrendingUp,
  FileText,
  Sparkles,
} from 'lucide-react';
import logoDegiro from '../assets/logo-degiro.png';
import logoMyInvestor from '../assets/logo-myinvestor.png';

interface BrokerFeesViewProps {
  showExtendedBrokers?: boolean;
}

export const BrokerFeesView: React.FC<BrokerFeesViewProps> = ({
  showExtendedBrokers = false,
}) => {
  const [selectedBroker, setSelectedBroker] = useState<'degiro' | 'myinvestor' | 'otros'>('degiro');

  return (
    <div className="px-4 pb-8 space-y-4">
      {/* Cabecera */}
      <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#081C3E] dark:text-white leading-tight">
              Tarifas Vigentes y Buscadores Oficiales
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Referencia rápida de comisiones reales antes de operar
            </p>
          </div>
        </div>

        {/* Selector de Broker */}
        <div className="flex gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => setSelectedBroker('degiro')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
              selectedBroker === 'degiro'
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-sm'
                : 'bg-sky-50/80 dark:bg-slate-800 text-[#0B2246] dark:text-slate-300 border border-sky-100 dark:border-slate-700'
            }`}
          >
            <span>DEGIRO</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedBroker('myinvestor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
              selectedBroker === 'myinvestor'
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-sm'
                : 'bg-sky-50/80 dark:bg-slate-800 text-[#0B2246] dark:text-slate-300 border border-sky-100 dark:border-slate-700'
            }`}
          >
            <span>MyInvestor</span>
          </button>
          {showExtendedBrokers && (
            <button
              type="button"
              onClick={() => setSelectedBroker('otros')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                selectedBroker === 'otros'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-sm'
                  : 'bg-sky-50/80 dark:bg-slate-800 text-[#0B2246] dark:text-slate-300 border border-sky-100 dark:border-slate-700'
              }`}
            >
              <span>Kraken / BBVA</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== TARIFAS DEGIRO ==================== */}
      {selectedBroker === 'degiro' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-sky-100 dark:border-slate-800">
            <span className="inline-flex items-center bg-sky-50/80 dark:bg-white px-2.5 py-1 rounded-xl border border-sky-100">
              <img src={logoDegiro} alt="DEGIRO" className="h-4 w-auto object-contain" />
            </span>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
              Tarifas vigentes
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: 'ETFs Selección Principal (Core)', fee: '1,00 €', note: 'Coste de tramitación (uso justo)', highlight: true },
              { label: 'ETFs fuera de Selección Principal', fee: '3,00 €', note: '2,00 € comisión + 1,00 € tramitación' },
              { label: 'Acciones EE.UU. (NYSE / Nasdaq)', fee: '2,00 €', note: '1,00 € comisión + 1,00 € tramitación' },
              { label: 'Acciones España (BME)', fee: '3,00 €', note: '2,00 € comisión + 1,00 € tramitación' },
              { label: 'Acciones Europa (Xetra / Euronext / Milán)', fee: '4,90 €', note: '3,90 € comisión + 1,00 € tramitación' },
              { label: 'Cambio de divisa automático (AutoFX)', fee: '0,25%', note: 'Aplicado al comprar/vender en USD/GBP' },
              { label: 'Conectividad anual por bolsa extranjera', fee: '2,50 € / año', note: 'Por cada mercado extranjero con saldo/ops' },
            ].map(row => (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border ${
                  row.highlight
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-[#081C3E] dark:text-white leading-snug">{row.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.note}</div>
                </div>
                <span className={`font-black text-xs shrink-0 ${row.highlight ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#081C3E] dark:text-slate-100'}`}>
                  {row.fee}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-extrabold">Consejo sobre Margen Libre:</strong>
              Si utilizas saldo negativo en margen, pide siempre <strong>Asignación mensual</strong> en DEGIRO para reducir el tipo de interés frente a la tarifa sin asignación.
            </div>
          </div>
        </div>
      )}

      {/* ==================== TARIFAS MYINVESTOR ==================== */}
      {selectedBroker === 'myinvestor' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-sky-100 dark:border-slate-800">
            <span className="inline-flex items-center bg-sky-50/80 dark:bg-white px-2.5 py-1 rounded-xl border border-sky-100">
              <img src={logoMyInvestor} alt="MyInvestor" className="h-4 w-auto object-contain" />
            </span>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
              Tarifas vigentes
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: 'Fondos Indexados y de Inversión', fee: '0,00 €', note: 'Sin comisión de compra, venta ni custodia (solo TER del fondo)', highlight: true },
              { label: 'Acciones y ETFs (España, Europa, EE.UU.)', fee: '0,12%', note: 'Mínimo 2,00 € · Máximo 25,00 € por operación' },
              { label: 'Cambio de divisa (acciones/ETFs USD)', fee: '0,30%', note: 'Sobre importe convertido en operaciones en divisa' },
              { label: 'Custodia, mantenimiento y cobro dividendos', fee: '0,00 €', note: 'Sin comisión de conectividad anual por mercados', highlight: true },
              { label: 'Traspaso entre fondos de inversión', fee: '0,00 €', note: 'Exento de tributar en IRPF hasta el reembolso final' },
            ].map(row => (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border ${
                  row.highlight
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-[#081C3E] dark:text-white leading-snug">{row.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.note}</div>
                </div>
                <span className={`font-black text-xs shrink-0 ${row.highlight ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#081C3E] dark:text-slate-100'}`}>
                  {row.fee}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-3 flex items-start gap-2 text-[11px] text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Ventaja fiscal España:</strong> MyInvestor informa automáticamente a Hacienda (modelo fiscal integrado) y permite traspasar entre fondos sin pagar impuestos.
            </div>
          </div>
        </div>
      )}

      {/* ==================== KRAKEN / BBVA ==================== */}
      {selectedBroker === 'otros' && showExtendedBrokers && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-[#081C3E] dark:text-white pb-2 border-b border-sky-100 dark:border-slate-800">
            Kraken & BBVA · Referencia rápida
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Kraken Pro (orden Limit / Maker)', fee: '0,25%', note: 'Mucho más barato que compra instantánea (~1,5%)' },
              { label: 'Kraken Pro (orden Market / Taker)', fee: '0,40%', note: 'Comisión estándar cripto spot en Kraken Pro' },
              { label: 'BBVA Broker (Acciones España)', fee: 'Desde 3 €–10 €', note: 'Según importe + custodia trimestral si no cumples condiciones' },
              { label: 'Urbanitae (Crowdfunding Inmobiliario)', fee: '0,00 €', note: 'Sin comisión directa al inversor (coste asumido por promotor)' },
            ].map(row => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-[#081C3E] dark:text-white leading-snug">{row.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.note}</div>
                </div>
                <span className="font-black text-xs text-[#081C3E] dark:text-slate-100 shrink-0">
                  {row.fee}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== ACCESOS DIRECTOS OFICIALES ==================== */}
      <div className="bg-gradient-to-br from-white via-[#F0F9FF] to-[#E6FBF2] dark:from-slate-900 dark:to-slate-950 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#081C3E] dark:text-white">
            Buscadores y Documentos Oficiales
          </h3>
        </div>

        <a
          href="https://myinvestor.es/inversion/fondos-inversion/buscador/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-700 hover:border-sky-400 transition-all shadow-2xs active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-[#081C3E] dark:text-white truncate">
                Buscador de Fondos MyInvestor
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Consulta ISIN, TER y fichas oficiales de fondos indexados
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-600 shrink-0" />
        </a>

        <a
          href="https://myinvestor.es/inversion/broker/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-700 hover:border-sky-400 transition-all shadow-2xs active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-[#081C3E] dark:text-white truncate">
                Acciones y ETFs · Broker MyInvestor
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Condiciones y buscador oficial de acciones y ETFs
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-emerald-600 shrink-0" />
        </a>

        <a
          href="https://www.degiro.com/data/pdf/uk/commission-free-etfs-list.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-700 hover:border-sky-400 transition-all shadow-2xs active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-[#081C3E] dark:text-white truncate">
                Lista Oficial ETFs Core DEGIRO (PDF)
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Los 200 ETFs económicos (ya integrados en el buscador 🔍)
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-amber-600 shrink-0" />
        </a>
      </div>
    </div>
  );
};
